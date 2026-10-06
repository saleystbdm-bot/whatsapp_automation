import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema for the WhatsApp Operations domain model: groups,
 * team_members, group_members, keywords, issues, sla_incidents,
 * eod_reports, notifications.
 *
 * Design decisions worth calling out for reviewers (see also the entity
 * JSDoc comments, which mirror this):
 *
 * - UUID primary keys via `gen_random_uuid()` (built into PostgreSQL 13+,
 *   no extension required — the project targets postgres:16).
 * - `group_type_enum` is shared across groups.type, issues.group_type and
 *   sla_incidents.group_type: the latter two are denormalized snapshots
 *   of the group's type at the time the row was created, so historical
 *   records stay accurate even if a group's type is later changed.
 * - Idempotency: issues.message_id and sla_incidents.message_id are each
 *   independently UNIQUE. A message maps to at most one SLA incident in
 *   this prototype, enforced by the unique constraint on message_id alone
 *   (not a composite with trigger_type) — see sla_incidents comment below.
 * - eod_reports enforces one report per (member, group, business date)
 *   via a composite unique constraint; report_date is a plain DATE
 *   (business-day, computed by the caller from BUSINESS_TIMEZONE), not a
 *   timestamp, so it never depends on server/UTC time zone.
 * - keywords enforces "no duplicate *active* keyword per group" using a
 *   partial unique index (`WHERE active = true`), so a deactivated
 *   keyword can be re-added later without a stale conflict.
 * - Notification rows are independent of SlaIncident rows: one SLA-missed
 *   event can fan out into two Notification rows (team + CEO) without
 *   creating a second SlaIncident — issue_id/sla_id on notifications are
 *   both nullable, SET NULL on delete of the referenced row.
 */
export class InitialSchema1790133647913 implements MigrationInterface {
  name = 'InitialSchema1790133647913';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------------------------------------------------------------
    // Enum types
    // ---------------------------------------------------------------
    await queryRunner.query(
      `CREATE TYPE "group_type_enum" AS ENUM ('INTERNAL', 'CLIENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "issue_status_enum" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "sla_status_enum" AS ENUM ('OPEN', 'RESPONDED', 'MISSED', 'ESCALATED', 'RESOLVED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "sla_trigger_type_enum" AS ENUM ('MENTION', 'MESSAGE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "eod_status_enum" AS ENUM ('ON_TIME', 'LATE', 'MISSING')`,
    );
    await queryRunner.query(
      `CREATE TYPE "notification_type_enum" AS ENUM ('TEAM_SLA_REMINDER', 'CEO_SLA_ALERT', 'EOD_REMINDER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "notification_status_enum" AS ENUM ('PENDING', 'SENT', 'FAILED')`,
    );

    // ---------------------------------------------------------------
    // groups
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "groups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "whatsapp_group_id" varchar(100) NOT NULL,
        "name" varchar(150) NOT NULL,
        "type" "group_type_enum" NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "sla_minutes" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_groups_whatsapp_group_id" UNIQUE ("whatsapp_group_id"),
        CONSTRAINT "chk_groups_name_not_empty" CHECK (length(btrim("name")) > 0),
        CONSTRAINT "chk_groups_sla_minutes_positive" CHECK ("sla_minutes" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_groups_active" ON "groups" ("active")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_groups_type" ON "groups" ("type")`,
    );

    // ---------------------------------------------------------------
    // team_members
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "team_members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "phone" varchar(20) NOT NULL,
        "role" varchar(60),
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_team_members_phone" UNIQUE ("phone"),
        CONSTRAINT "chk_team_members_name_not_empty" CHECK (length(btrim("name")) > 0),
        CONSTRAINT "chk_team_members_phone_e164" CHECK ("phone" ~ '^\\+[1-9][0-9]{6,14}$')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_team_members_active" ON "team_members" ("active")`,
    );

    // ---------------------------------------------------------------
    // group_members
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "group_members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "group_id" uuid NOT NULL,
        "member_id" uuid NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "responsibility" varchar(30),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_group_members_group" FOREIGN KEY ("group_id")
          REFERENCES "groups" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_group_members_member" FOREIGN KEY ("member_id")
          REFERENCES "team_members" ("id") ON DELETE CASCADE,
        CONSTRAINT "uq_group_members_group_member" UNIQUE ("group_id", "member_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_group_members_group_id" ON "group_members" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_group_members_member_id" ON "group_members" ("member_id")`,
    );

    // ---------------------------------------------------------------
    // keywords
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "keywords" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "group_id" uuid NOT NULL,
        "keyword" varchar(80) NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_keywords_group" FOREIGN KEY ("group_id")
          REFERENCES "groups" ("id") ON DELETE CASCADE,
        CONSTRAINT "chk_keywords_keyword_not_empty" CHECK (length(btrim("keyword")) > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_keywords_group_id" ON "keywords" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_keywords_active" ON "keywords" ("active")`,
    );
    // Partial unique index: only one *active* row per (group, keyword).
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_keywords_group_keyword_active"
      ON "keywords" ("group_id", "keyword")
      WHERE "active" = true
    `);

    // ---------------------------------------------------------------
    // issues
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "issues" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "message_id" varchar(150) NOT NULL,
        "group_id" uuid NOT NULL,
        "group_type" "group_type_enum" NOT NULL,
        "sender_phone" varchar(20) NOT NULL,
        "message" text NOT NULL,
        "status" "issue_status_enum" NOT NULL DEFAULT 'OPEN',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "resolved_at" timestamptz,
        "resolved_by" varchar(20),
        CONSTRAINT "fk_issues_group" FOREIGN KEY ("group_id")
          REFERENCES "groups" ("id") ON DELETE RESTRICT,
        CONSTRAINT "uq_issues_message_id" UNIQUE ("message_id"),
        CONSTRAINT "chk_issues_message_not_empty" CHECK (length(btrim("message")) > 0),
        CONSTRAINT "chk_issues_sender_phone_e164" CHECK ("sender_phone" ~ '^\\+[1-9][0-9]{6,14}$')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_issues_group_id" ON "issues" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_issues_status" ON "issues" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_issues_created_at" ON "issues" ("created_at")`,
    );
    // message_id already has a unique index from the UNIQUE constraint above.

    // ---------------------------------------------------------------
    // sla_incidents
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "sla_incidents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "message_id" varchar(150) NOT NULL,
        "issue_id" uuid,
        "group_id" uuid NOT NULL,
        "group_name" varchar(150) NOT NULL,
        "group_type" "group_type_enum" NOT NULL,
        "trigger_type" "sla_trigger_type_enum" NOT NULL,
        "sender_phone" varchar(20) NOT NULL,
        "message" text NOT NULL,
        "status" "sla_status_enum" NOT NULL DEFAULT 'OPEN',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "sla_deadline" timestamptz NOT NULL,
        "first_response_at" timestamptz,
        "responded_by" varchar(20),
        "escalated_at" timestamptz,
        "resolved_at" timestamptz,
        CONSTRAINT "fk_sla_incidents_group" FOREIGN KEY ("group_id")
          REFERENCES "groups" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_sla_incidents_issue" FOREIGN KEY ("issue_id")
          REFERENCES "issues" ("id") ON DELETE SET NULL,
        CONSTRAINT "uq_sla_incidents_message_id" UNIQUE ("message_id"),
        CONSTRAINT "chk_sla_incidents_message_not_empty" CHECK (length(btrim("message")) > 0),
        CONSTRAINT "chk_sla_incidents_sender_phone_e164" CHECK ("sender_phone" ~ '^\\+[1-9][0-9]{6,14}$')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_sla_incidents_group_id" ON "sla_incidents" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sla_incidents_status" ON "sla_incidents" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sla_incidents_sla_deadline" ON "sla_incidents" ("sla_deadline")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_sla_incidents_created_at" ON "sla_incidents" ("created_at")`,
    );

    // ---------------------------------------------------------------
    // eod_reports
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "eod_reports" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "member_id" uuid NOT NULL,
        "group_id" uuid NOT NULL,
        "report_date" date NOT NULL,
        "message_id" varchar(150),
        "report_content" text,
        "submitted_at" timestamptz,
        "status" "eod_status_enum" NOT NULL DEFAULT 'MISSING',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_eod_reports_member" FOREIGN KEY ("member_id")
          REFERENCES "team_members" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_eod_reports_group" FOREIGN KEY ("group_id")
          REFERENCES "groups" ("id") ON DELETE RESTRICT,
        CONSTRAINT "uq_eod_reports_member_group_date" UNIQUE ("member_id", "group_id", "report_date"),
        CONSTRAINT "uq_eod_reports_message_id" UNIQUE ("message_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_eod_reports_member_id" ON "eod_reports" ("member_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_eod_reports_group_id" ON "eod_reports" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_eod_reports_report_date" ON "eod_reports" ("report_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_eod_reports_status" ON "eod_reports" ("status")`,
    );

    // ---------------------------------------------------------------
    // notifications
    // ---------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" "notification_type_enum" NOT NULL,
        "recipient_phone" varchar(20) NOT NULL,
        "issue_id" uuid,
        "sla_id" uuid,
        "message" text NOT NULL,
        "status" "notification_status_enum" NOT NULL DEFAULT 'PENDING',
        "sent_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_notifications_issue" FOREIGN KEY ("issue_id")
          REFERENCES "issues" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_notifications_sla" FOREIGN KEY ("sla_id")
          REFERENCES "sla_incidents" ("id") ON DELETE SET NULL,
        CONSTRAINT "chk_notifications_message_not_empty" CHECK (length(btrim("message")) > 0),
        CONSTRAINT "chk_notifications_recipient_phone_e164"
          CHECK ("recipient_phone" ~ '^\\+[1-9][0-9]{6,14}$')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_issue_id" ON "notifications" ("issue_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_sla_id" ON "notifications" ("sla_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_status" ON "notifications" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_created_at" ON "notifications" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse dependency order.
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "eod_reports"`);
    await queryRunner.query(`DROP TABLE "sla_incidents"`);
    await queryRunner.query(`DROP TABLE "issues"`);
    await queryRunner.query(`DROP TABLE "keywords"`);
    await queryRunner.query(`DROP TABLE "group_members"`);
    await queryRunner.query(`DROP TABLE "team_members"`);
    await queryRunner.query(`DROP TABLE "groups"`);

    await queryRunner.query(`DROP TYPE "notification_status_enum"`);
    await queryRunner.query(`DROP TYPE "notification_type_enum"`);
    await queryRunner.query(`DROP TYPE "eod_status_enum"`);
    await queryRunner.query(`DROP TYPE "sla_trigger_type_enum"`);
    await queryRunner.query(`DROP TYPE "sla_status_enum"`);
    await queryRunner.query(`DROP TYPE "issue_status_enum"`);
    await queryRunner.query(`DROP TYPE "group_type_enum"`);
  }
}
