import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GroupType } from '../common/enums/group-type.enum';
import { Group } from '../groups/entities/group.entity';
import { GroupsService } from '../groups/groups.service';
import { WassengerWebhookEvent } from './entities/wassenger-webhook-event.entity';
import { N8nForwarderService } from './n8n-forwarder.service';
import { WassengerWebhookService } from './wassenger-webhook.service';

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1',
    whatsappGroupId: '120363000000000001@g.us',
    name: 'Test Group',
    type: GroupType.INTERNAL,
    active: true,
    slaMinutes: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    groupMembers: [],
    keywords: [],
    ...overrides,
  };
}

function baseMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    type: 'text',
    flow: 'inbound',
    from: '120363000000000001@g.us',
    chat: '120363000000000001@g.us',
    author: '919566800001@c.us',
    fromNumber: '+919566800001',
    body: 'Payment API is not working',
    date: '2026-10-10T10:00:00.000Z',
    meta: { isGroup: true },
    ...overrides,
  };
}

describe('WassengerWebhookService', () => {
  let eventsRepo: { findOneBy: jest.Mock; create: jest.Mock; save: jest.Mock };
  let groupsService: { findByWhatsappGroupId: jest.Mock };
  let forwarder: {
    forward: jest.Mock<
      Promise<{ ok: boolean; status?: number; error?: string }>,
      [unknown]
    >;
  };
  let service: WassengerWebhookService;

  beforeEach(() => {
    eventsRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn((partial: Record<string, unknown>) => ({ ...partial })),
      save: jest.fn((row: unknown) => Promise.resolve(row)),
    };
    groupsService = { findByWhatsappGroupId: jest.fn() };
    forwarder = {
      forward: jest.fn<
        Promise<{ ok: boolean; status?: number; error?: string }>,
        [unknown]
      >(),
    };

    service = new WassengerWebhookService(
      eventsRepo as unknown as import('typeorm').Repository<WassengerWebhookEvent>,
      groupsService as unknown as GroupsService,
      forwarder as unknown as N8nForwarderService,
    );
  });

  it('forwards an inbound group text message for an active (monitored) group', async () => {
    groupsService.findByWhatsappGroupId.mockResolvedValue(
      makeGroup({ active: true }),
    );
    forwarder.forward.mockResolvedValue({ ok: true, status: 200 });

    const result = await service.handle(baseMessage());

    expect(result).toEqual({ status: 'forwarded' });
    expect(forwarder.forward).toHaveBeenCalledTimes(1);
    const sent = forwarder.forward.mock.calls[0][0] as {
      id: string;
      _monitoring: { groupId: string };
    };
    expect(sent.id).toBe('msg-1');
    expect(sent._monitoring.groupId).toBe('group-1');
    expect(eventsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ forwarded: true, skippedReason: null }),
    );
  });

  it('does not forward a message for a group that exists but is not monitored (active=false)', async () => {
    groupsService.findByWhatsappGroupId.mockResolvedValue(
      makeGroup({ active: false }),
    );

    const result = await service.handle(baseMessage());

    expect(result).toEqual({ status: 'skipped', reason: 'not_monitored' });
    expect(forwarder.forward).not.toHaveBeenCalled();
  });

  it('does not forward a message for an unknown group, and never creates one', async () => {
    groupsService.findByWhatsappGroupId.mockResolvedValue(null);

    const result = await service.handle(baseMessage());

    expect(result).toEqual({ status: 'skipped', reason: 'unknown_group' });
    expect(forwarder.forward).not.toHaveBeenCalled();
  });

  it('does not forward a private (non-group) message', async () => {
    const result = await service.handle(
      baseMessage({ meta: { isGroup: false } }),
    );

    expect(result).toEqual({ status: 'skipped', reason: 'private_message' });
    expect(groupsService.findByWhatsappGroupId).not.toHaveBeenCalled();
    expect(forwarder.forward).not.toHaveBeenCalled();
  });

  it('does not forward an outbound message (loop prevention)', async () => {
    const result = await service.handle(baseMessage({ flow: 'outbound' }));

    expect(result).toEqual({ status: 'skipped', reason: 'outbound' });
    expect(groupsService.findByWhatsappGroupId).not.toHaveBeenCalled();
    expect(forwarder.forward).not.toHaveBeenCalled();
  });

  it('does not forward a broadcast/channel/notification message', async () => {
    const result = await service.handle(
      baseMessage({ meta: { isGroup: true, isBroadcast: true } }),
    );
    expect(result).toEqual({ status: 'skipped', reason: 'unsupported_event' });
  });

  it('does not forward an unsupported webhook event type (e.g. group:update)', async () => {
    const result = await service.handle({
      event: 'group:update',
      data: baseMessage(),
    });
    expect(result).toEqual({
      status: 'skipped',
      reason: 'unsupported_event_type',
    });
    expect(groupsService.findByWhatsappGroupId).not.toHaveBeenCalled();
  });

  it('rejects a malformed payload with no message id', async () => {
    await expect(service.handle({ body: 'no id here' })).rejects.toThrow(
      BadRequestException,
    );
    expect(eventsRepo.save).not.toHaveBeenCalled();
  });

  it('skips safely when the group id cannot be determined from the payload', async () => {
    const result = await service.handle(
      baseMessage({ from: undefined, chat: undefined }),
    );
    expect(result).toEqual({ status: 'skipped', reason: 'malformed_payload' });
  });

  it('is idempotent: a message already successfully forwarded is never forwarded again', async () => {
    eventsRepo.findOneBy.mockResolvedValue({
      externalMessageId: 'msg-1',
      forwarded: true,
    });

    const result = await service.handle(baseMessage());

    expect(result).toEqual({ status: 'duplicate' });
    expect(groupsService.findByWhatsappGroupId).not.toHaveBeenCalled();
    expect(forwarder.forward).not.toHaveBeenCalled();
  });

  it('retries forwarding on redelivery of a message whose first forward attempt failed', async () => {
    const existingRow = {
      externalMessageId: 'msg-1',
      forwarded: false,
      skippedReason: 'forward_failed',
    };
    eventsRepo.findOneBy.mockResolvedValue(existingRow);
    groupsService.findByWhatsappGroupId.mockResolvedValue(
      makeGroup({ active: true }),
    );
    forwarder.forward.mockResolvedValue({ ok: true, status: 200 });

    const result = await service.handle(baseMessage());

    expect(result).toEqual({ status: 'forwarded' });
    expect(forwarder.forward).toHaveBeenCalledTimes(1);
    // Reuses the existing row rather than creating a second one.
    expect(eventsRepo.create).not.toHaveBeenCalled();
  });

  it('propagates a 503 when forwarding to n8n fails, so Wassenger retries later', async () => {
    groupsService.findByWhatsappGroupId.mockResolvedValue(
      makeGroup({ active: true }),
    );
    forwarder.forward.mockResolvedValue({ ok: false, error: 'timed out' });

    await expect(service.handle(baseMessage())).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(eventsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        forwarded: false,
        skippedReason: 'forward_failed',
      }),
    );
  });

  it('handles a bare-message payload with no {event, data} envelope', async () => {
    groupsService.findByWhatsappGroupId.mockResolvedValue(
      makeGroup({ active: true }),
    );
    forwarder.forward.mockResolvedValue({ ok: true, status: 200 });

    // No top-level `event` field — the service must infer it from `flow`.
    const result = await service.handle(baseMessage());
    expect(result).toEqual({ status: 'forwarded' });
  });
});
