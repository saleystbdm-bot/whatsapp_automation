/**
 * Shape of a Wassenger message resource — confirmed directly against the
 * live account via `GET /v1/chat/:deviceId/messages`, not invented. The
 * exact webhook delivery ENVELOPE (whether the message is wrapped as
 * `{ event, data }` or posted as this object directly) could not be
 * confirmed — Wassenger's webhook tutorial content is gated behind
 * account login and was not reachable. WassengerWebhookService handles
 * both shapes defensively (see `unwrapMessage`).
 *
 * This is intentionally a plain TypeScript interface, not a
 * class-validator DTO: the project's global ValidationPipe uses
 * `forbidNonWhitelisted: true`, which would reject any field this
 * interface doesn't happen to list — a real risk here given the
 * envelope itself is unconfirmed. The controller accepts the raw body
 * as `unknown` and this service narrows it defensively instead.
 */
export interface WassengerMessagePayload {
  id?: unknown;
  type?: unknown;
  subtype?: unknown;
  /** 'inbound' | 'outbound' — the field used to prevent forwarding-loop risk. */
  flow?: unknown;
  /** The chat this message belongs to — a group WID (…@g.us) for group messages. */
  from?: unknown;
  chat?: unknown;
  /** The actual sender's WhatsApp id (…@c.us) — distinct from `from`/`chat` for group messages. */
  author?: unknown;
  fromNumber?: unknown;
  body?: unknown;
  date?: unknown;
  timestamp?: unknown;
  device?: { id?: unknown };
  meta?: {
    isGroup?: unknown;
    isBroadcast?: unknown;
    isChannel?: unknown;
    isNotification?: unknown;
    isRevoked?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface WassengerWebhookEnvelope {
  event?: unknown;
  data?: WassengerMessagePayload;
  [key: string]: unknown;
}
