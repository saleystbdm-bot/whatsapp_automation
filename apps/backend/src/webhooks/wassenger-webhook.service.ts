import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from '../groups/entities/group.entity';
import { GroupsService } from '../groups/groups.service';
import {
  WassengerMessagePayload,
  WassengerWebhookEnvelope,
} from './dto/wassenger-webhook-payload';
import { WassengerWebhookEvent } from './entities/wassenger-webhook-event.entity';
import { N8nForwarderService } from './n8n-forwarder.service';

/** Confirmed live on the account's own `/v1/webhooks` registration — the only inbound-message event subscribed. */
const INBOUND_MESSAGE_EVENT_TYPES = new Set(['message:in:new', 'message:in']);

export type WassengerWebhookOutcome =
  | { status: 'forwarded' }
  | { status: 'duplicate' }
  | { status: 'skipped'; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Receives Wassenger webhook events, looks up monitoring status in
 * PostgreSQL (the authoritative source — never n8n, never a hardcoded
 * list), and forwards only eligible inbound group messages for
 * monitored groups to n8n. See the migration/entity comments for the
 * idempotency design.
 */
@Injectable()
export class WassengerWebhookService {
  private readonly logger = new Logger(WassengerWebhookService.name);

  constructor(
    @InjectRepository(WassengerWebhookEvent)
    private readonly events: Repository<WassengerWebhookEvent>,
    private readonly groupsService: GroupsService,
    private readonly forwarder: N8nForwarderService,
  ) {}

  async handle(rawBody: unknown): Promise<WassengerWebhookOutcome> {
    const envelope = isRecord(rawBody)
      ? (rawBody as WassengerWebhookEnvelope)
      : {};
    const message = this.unwrapMessage(envelope);

    const messageId = asString(message.id);
    if (!messageId) {
      // No stable id means we can neither dedupe nor safely process this
      // — reject outright rather than guess. Wassenger will not retry a
      // 400 (client error), which is correct: retrying won't fix it.
      throw new BadRequestException('Webhook payload is missing a message id');
    }

    const eventType = asString(envelope.event) ?? this.inferEventType(message);

    const existing = await this.events.findOneBy({
      externalMessageId: messageId,
    });
    if (existing?.forwarded) {
      // Already successfully forwarded once — never forward the same
      // message twice, however many times Wassenger redelivers it.
      return { status: 'duplicate' };
    }

    const classification = await this.classify(eventType, message);

    if (classification.skippedReason) {
      await this.recordOutcome(
        existing,
        messageId,
        eventType,
        classification,
        false,
        classification.skippedReason,
      );
      this.logger.log(
        `Skipped Wassenger event ${messageId}: ${classification.skippedReason}`,
      );
      return { status: 'skipped', reason: classification.skippedReason };
    }

    const group = classification.group!;
    const forwardPayload = {
      ...message,
      _monitoring: {
        groupId: group.id,
        groupType: group.type,
        slaMinutes: group.slaMinutes,
        forwardedAt: new Date().toISOString(),
      },
    };

    const result = await this.forwarder.forward(forwardPayload);
    if (!result.ok) {
      await this.recordOutcome(
        existing,
        messageId,
        eventType,
        classification,
        false,
        'forward_failed',
      );
      // A non-2xx response tells Wassenger this delivery did not
      // succeed, so it retries later (observed, on this account's real
      // webhook registration, to retry over a window of hours) — that
      // retry is this system's recovery path for a transient n8n
      // outage; there is no separate backend-side retry queue. See the
      // final report for this limitation.
      throw new ServiceUnavailableException('Failed to forward event to n8n');
    }

    await this.recordOutcome(
      existing,
      messageId,
      eventType,
      classification,
      true,
      null,
    );
    return { status: 'forwarded' };
  }

  /** Handles both a `{ event, data }` envelope and a bare message object, since the real envelope shape could not be confirmed. */
  private unwrapMessage(
    envelope: WassengerWebhookEnvelope,
  ): WassengerMessagePayload {
    return isRecord(envelope.data) ? envelope.data : envelope;
  }

  private inferEventType(message: WassengerMessagePayload): string {
    const flow = asString(message.flow);
    if (flow === 'inbound') return 'message:in:new';
    if (flow === 'outbound') return 'message:out:new';
    return 'unknown';
  }

  private async classify(
    eventType: string,
    message: WassengerMessagePayload,
  ): Promise<{
    skippedReason: string | null;
    group: Group | null;
    whatsappGroupId: string | null;
  }> {
    const flow = asString(message.flow);
    const meta = isRecord(message.meta) ? message.meta : {};
    const messageType = asString(message.type);
    const body = asString(message.body) ?? '';
    const whatsappGroupId = asString(message.chat) ?? asString(message.from);

    // `flow` is checked before the event-type allowlist: it's the more
    // specific, authoritative loop-prevention signal straight from
    // Wassenger. Checking the allowlist first would report an outbound
    // message as the generic 'unsupported_event_type' whenever the
    // envelope has no explicit `event` field and inferEventType() has
    // already (correctly) derived 'message:out:new' from this same
    // `flow` value — same outcome either way (never forwarded), but a
    // less useful audit reason.
    if (flow !== 'inbound') {
      // Covers both genuine outbound messages and anything sent by our
      // own automation — never re-process what we (or the CEO) sent.
      return { skippedReason: 'outbound', group: null, whatsappGroupId };
    }
    if (!INBOUND_MESSAGE_EVENT_TYPES.has(eventType)) {
      return {
        skippedReason: 'unsupported_event_type',
        group: null,
        whatsappGroupId,
      };
    }
    if (
      meta.isBroadcast === true ||
      meta.isChannel === true ||
      meta.isNotification === true ||
      meta.isRevoked === true
    ) {
      return {
        skippedReason: 'unsupported_event',
        group: null,
        whatsappGroupId,
      };
    }
    if (meta.isGroup !== true) {
      return { skippedReason: 'private_message', group: null, whatsappGroupId };
    }
    if (!whatsappGroupId) {
      return {
        skippedReason: 'malformed_payload',
        group: null,
        whatsappGroupId: null,
      };
    }
    if (messageType !== 'text' || !body.trim()) {
      return {
        skippedReason: 'unsupported_message_type',
        group: null,
        whatsappGroupId,
      };
    }

    const group =
      await this.groupsService.findByWhatsappGroupId(whatsappGroupId);
    if (!group) {
      // Never auto-create — an unknown group is simply not forwarded.
      return { skippedReason: 'unknown_group', group: null, whatsappGroupId };
    }
    if (!group.active) {
      return { skippedReason: 'not_monitored', group: null, whatsappGroupId };
    }

    return { skippedReason: null, group, whatsappGroupId };
  }

  private async recordOutcome(
    existing: WassengerWebhookEvent | null,
    messageId: string,
    eventType: string,
    classification: { whatsappGroupId: string | null; group: Group | null },
    forwarded: boolean,
    reason: string | null,
  ): Promise<void> {
    const row =
      existing ?? this.events.create({ externalMessageId: messageId });
    row.eventType = eventType;
    row.whatsappGroupId = classification.whatsappGroupId;
    row.groupId = classification.group?.id ?? null;
    row.forwarded = forwarded;
    row.skippedReason = forwarded ? null : reason;
    row.forwardedAt = forwarded ? new Date() : null;
    await this.events.save(row);
  }
}
