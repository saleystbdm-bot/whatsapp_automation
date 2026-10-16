import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Durable idempotency/audit record for the Wassenger webhook receiver
 * (see src/webhooks). Wassenger's own retry behavior on a failed
 * delivery has been observed (via its /v1/webhooks registration on the
 * live account) to retry over a window of *hours*, not seconds — an
 * in-memory dedup set would not survive a backend restart across that
 * window, so this needs to be a real table, not a cache.
 *
 * `external_message_id` is Wassenger's own message id — the one stable
 * identifier available across redelivery attempts. `forwarded` is only
 * set true once the n8n forward actually succeeds (2xx); a message that
 * was deliberately skipped (unmonitored group, outbound, private, etc.)
 * is recorded with `forwarded = false` and a `skipped_reason`, purely
 * for audit — it is never retried, since the decision not to forward is
 * itself a successful outcome, not a failure.
 */
export class WassengerWebhookEvents1791636176023 implements MigrationInterface {
  name = 'WassengerWebhookEvents1791636176023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "wassenger_webhook_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "external_message_id" varchar(150) NOT NULL,
        "event_type" varchar(50) NOT NULL,
        "whatsapp_group_id" varchar(100),
        "group_id" uuid,
        "forwarded" boolean NOT NULL DEFAULT false,
        "skipped_reason" varchar(50),
        "received_at" timestamptz NOT NULL DEFAULT now(),
        "forwarded_at" timestamptz,
        CONSTRAINT "uq_wassenger_webhook_events_external_message_id" UNIQUE ("external_message_id"),
        CONSTRAINT "fk_wassenger_webhook_events_group" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_wassenger_webhook_events_group_id" ON "wassenger_webhook_events" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_wassenger_webhook_events_received_at" ON "wassenger_webhook_events" ("received_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "wassenger_webhook_events"`);
  }
}
