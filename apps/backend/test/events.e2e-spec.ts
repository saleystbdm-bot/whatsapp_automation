import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import request from 'supertest';
import {
  getBusinessTimeZone,
  getEodDeadline,
} from '../src/common/config/business-config.util';
import {
  getBusinessDayDeadline,
  toBusinessDateString,
} from '../src/common/date/business-day.util';
import { GroupType } from '../src/common/enums/group-type.enum';
import { EodStatus } from '../src/eod/enums/eod-status.enum';
import { Group } from '../src/groups/entities/group.entity';
import { GroupsService } from '../src/groups/groups.service';
import { IssueStatus } from '../src/issues/enums/issue-status.enum';
import { NotificationType } from '../src/notifications/enums/notification-type.enum';
import { NotificationStatus } from '../src/notifications/enums/notification-status.enum';
import { SlaTriggerType } from '../src/sla/enums/sla-trigger-type.enum';
import { SlaStatus } from '../src/sla/enums/sla-status.enum';
import { TeamMember } from '../src/team-members/entities/team-member.entity';
import { bootstrapTestApp, testPhone, uniqueId } from './utils/bootstrap-app';

const SECRET_HEADER = 'X-N8N-Webhook-Secret';

describe('Events API (n8n boundary, e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let groupsService: GroupsService;
  let secret: string;
  let ceoPhone: string;
  let timeZone: string;
  let deadlineHhMm: string;
  let internalGroupId: string;
  let internalGroupName: string;
  let clientGroupId: string;
  let internalSlaMinutes: number;
  let memberId: string;
  let memberPhone: string;

  const createdGroupIds: string[] = [];
  const createdMemberIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    dataSource = app.get(DataSource);
    groupsService = app.get(GroupsService);

    const config = app.get(ConfigService);
    secret = config.get<string>('N8N_WEBHOOK_SHARED_SECRET', '');
    ceoPhone = config.get<string>('CEO_PHONE_NUMBER', '+10000000000');
    timeZone = getBusinessTimeZone(config);
    deadlineHhMm = getEodDeadline(config);
    if (!secret) {
      throw new Error(
        'N8N_WEBHOOK_SHARED_SECRET must be set in the test environment for events.e2e-spec.ts to run meaningfully',
      );
    }

    const groupRepo = dataSource.getRepository(Group);
    internalSlaMinutes = 30;
    const internalGroup = await groupRepo.save(
      groupRepo.create({
        whatsappGroupId: uniqueId('wa'),
        name: 'Events E2E Internal Group',
        type: GroupType.INTERNAL,
        slaMinutes: internalSlaMinutes,
        active: true,
      }),
    );
    internalGroupId = internalGroup.id;
    internalGroupName = internalGroup.name;
    createdGroupIds.push(internalGroup.id);

    const clientGroup = await groupRepo.save(
      groupRepo.create({
        whatsappGroupId: uniqueId('wa'),
        name: 'Events E2E Client Group',
        type: GroupType.CLIENT,
        slaMinutes: 30,
        active: true,
      }),
    );
    clientGroupId = clientGroup.id;
    createdGroupIds.push(clientGroup.id);

    const memberRepo = dataSource.getRepository(TeamMember);
    const member = await memberRepo.save(
      memberRepo.create({
        name: 'Events E2E Member',
        phone: testPhone(),
        active: true,
      }),
    );
    memberId = member.id;
    memberPhone = member.phone;
    createdMemberIds.push(member.id);
    await groupsService.addMember(internalGroupId, { memberId });
  });

  afterAll(async () => {
    await dataSource.query(
      'DELETE FROM notifications WHERE sla_id IN (SELECT id FROM sla_incidents WHERE group_id = ANY($1))',
      [createdGroupIds],
    );
    await dataSource.query(
      'DELETE FROM sla_incidents WHERE group_id = ANY($1)',
      [createdGroupIds],
    );
    await dataSource.query('DELETE FROM issues WHERE group_id = ANY($1)', [
      createdGroupIds,
    ]);
    await dataSource.query('DELETE FROM eod_reports WHERE group_id = ANY($1)', [
      createdGroupIds,
    ]);
    await dataSource.query(
      'DELETE FROM group_members WHERE group_id = ANY($1)',
      [createdGroupIds],
    );
    await dataSource.query('DELETE FROM groups WHERE id = ANY($1)', [
      createdGroupIds,
    ]);
    if (createdMemberIds.length > 0) {
      await dataSource.query('DELETE FROM team_members WHERE id = ANY($1)', [
        createdMemberIds,
      ]);
    }
    await app.close();
  });

  function authHeaders(overrideSecret?: string): Record<string, string> {
    return { [SECRET_HEADER]: overrideSecret ?? secret };
  }

  // -------------------------------------------------------------------
  // Authentication (Part 21)
  // -------------------------------------------------------------------

  describe('authentication', () => {
    it('rejects a request with no secret header', async () => {
      await request(app.getHttpServer())
        .post('/events/issues')
        .send({
          messageId: uniqueId('msg'),
          groupId: internalGroupId,
          senderPhone: testPhone(),
          message: 'no secret',
        })
        .expect(401);
    });

    it('rejects a request with the wrong secret', async () => {
      await request(app.getHttpServer())
        .post('/events/issues')
        .set(authHeaders('definitely-wrong-secret'))
        .send({
          messageId: uniqueId('msg'),
          groupId: internalGroupId,
          senderPhone: testPhone(),
          message: 'wrong secret',
        })
        .expect(401);
    });

    it('accepts a request with the correct secret', async () => {
      await request(app.getHttpServer())
        .post('/events/issues')
        .set(authHeaders())
        .send({
          messageId: uniqueId('msg'),
          groupId: internalGroupId,
          senderPhone: testPhone(),
          message: 'correct secret',
        })
        .expect(201);
    });
  });

  // -------------------------------------------------------------------
  // Issue event (Part 4)
  // -------------------------------------------------------------------

  describe('POST /events/issues', () => {
    it('creates an issue and returns the stable IssueDetailResponse shape', async () => {
      const messageId = uniqueId('msg');
      const response = await request(app.getHttpServer())
        .post('/events/issues')
        .set(authHeaders())
        .send({
          messageId,
          groupId: internalGroupId,
          senderPhone: testPhone(),
          message: 'Payment API is not working',
        })
        .expect(201);

      expect(response.body.status).toBe(IssueStatus.OPEN);
      expect(response.body.groupId).toBe(internalGroupId);
      expect(response.body.messageId).toBe(messageId);
      expect(Array.isArray(response.body.timeline)).toBe(true);
    });

    it('is idempotent on messageId — a duplicate delivery creates only one Issue', async () => {
      const messageId = uniqueId('msg');
      const payload = {
        messageId,
        groupId: internalGroupId,
        senderPhone: testPhone(),
        message: 'Duplicate delivery test',
      };

      const first = await request(app.getHttpServer())
        .post('/events/issues')
        .set(authHeaders())
        .send(payload)
        .expect(201);
      const second = await request(app.getHttpServer())
        .post('/events/issues')
        .set(authHeaders())
        .send(payload)
        .expect(201);

      expect(second.body.id).toBe(first.body.id);
      const rows = await dataSource.query(
        'SELECT id FROM issues WHERE message_id = $1',
        [messageId],
      );
      expect(rows).toHaveLength(1);
    });

    it('rejects an unknown group with 404', async () => {
      await request(app.getHttpServer())
        .post('/events/issues')
        .set(authHeaders())
        .send({
          messageId: uniqueId('msg'),
          groupId: '00000000-0000-0000-0000-000000000000',
          senderPhone: testPhone(),
          message: 'unknown group',
        })
        .expect(404);
    });

    it('rejects a malformed payload with 400', async () => {
      await request(app.getHttpServer())
        .post('/events/issues')
        .set(authHeaders())
        .send({ groupId: internalGroupId, senderPhone: testPhone() })
        .expect(400);
    });

    it('handles concurrent duplicate deliveries safely — exactly one Issue is created', async () => {
      const messageId = uniqueId('msg');
      const payload = {
        messageId,
        groupId: internalGroupId,
        senderPhone: testPhone(),
        message: 'Concurrent duplicate test',
      };

      await Promise.all([
        request(app.getHttpServer())
          .post('/events/issues')
          .set(authHeaders())
          .send(payload),
        request(app.getHttpServer())
          .post('/events/issues')
          .set(authHeaders())
          .send(payload),
      ]);

      const rows = await dataSource.query(
        'SELECT id FROM issues WHERE message_id = $1',
        [messageId],
      );
      expect(rows).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------
  // SLA event (Part 5, 17, 18, 19)
  // -------------------------------------------------------------------

  describe('POST /events/sla', () => {
    it('creates a MENTION SLA for an INTERNAL group with a backend-computed deadline', async () => {
      const messageId = uniqueId('msg');
      const before = Date.now();
      const response = await request(app.getHttpServer())
        .post('/events/sla')
        .set(authHeaders())
        .send({
          messageId,
          groupId: internalGroupId,
          triggerType: SlaTriggerType.MENTION,
          senderPhone: testPhone(),
          message: '@Harish can you check this?',
        })
        .expect(201);

      expect(response.body.status).toBe(SlaStatus.OPEN);
      expect(response.body.triggerType).toBe(SlaTriggerType.MENTION);
      const deadline = new Date(response.body.slaDeadline).getTime();
      const createdAt = new Date(response.body.createdAt).getTime();
      // Deadline must equal createdAt + the group's configured slaMinutes —
      // never a value n8n could have supplied itself.
      expect(deadline - createdAt).toBe(internalSlaMinutes * 60_000);
      expect(createdAt).toBeGreaterThanOrEqual(before - 1000);
    });

    it('creates a MESSAGE SLA for a CLIENT group without requiring a mention', async () => {
      const messageId = uniqueId('msg');
      const response = await request(app.getHttpServer())
        .post('/events/sla')
        .set(authHeaders())
        .send({
          messageId,
          groupId: clientGroupId,
          triggerType: SlaTriggerType.MESSAGE,
          senderPhone: testPhone(),
          message: 'Client login is down',
        })
        .expect(201);

      expect(response.body.status).toBe(SlaStatus.OPEN);
      expect(response.body.triggerType).toBe(SlaTriggerType.MESSAGE);
      expect(response.body.groupType).toBe(GroupType.CLIENT);
    });

    it('is idempotent on messageId for both MENTION and MESSAGE triggers', async () => {
      for (const triggerType of [
        SlaTriggerType.MENTION,
        SlaTriggerType.MESSAGE,
      ]) {
        const messageId = uniqueId('msg');
        const payload = {
          messageId,
          groupId: internalGroupId,
          triggerType,
          senderPhone: testPhone(),
          message: `Duplicate ${triggerType} SLA`,
        };
        const first = await request(app.getHttpServer())
          .post('/events/sla')
          .set(authHeaders())
          .send(payload)
          .expect(201);
        const second = await request(app.getHttpServer())
          .post('/events/sla')
          .set(authHeaders())
          .send(payload)
          .expect(201);
        expect(second.body.id).toBe(first.body.id);
        const rows = await dataSource.query(
          'SELECT id FROM sla_incidents WHERE message_id = $1',
          [messageId],
        );
        expect(rows).toHaveLength(1);
      }
    });

    it('handles concurrent duplicate deliveries safely — exactly one SLA incident is created', async () => {
      const messageId = uniqueId('msg');
      const payload = {
        messageId,
        groupId: internalGroupId,
        triggerType: SlaTriggerType.MENTION,
        senderPhone: testPhone(),
        message: 'Concurrent duplicate SLA',
      };

      await Promise.all([
        request(app.getHttpServer())
          .post('/events/sla')
          .set(authHeaders())
          .send(payload),
        request(app.getHttpServer())
          .post('/events/sla')
          .set(authHeaders())
          .send(payload),
      ]);

      const rows = await dataSource.query(
        'SELECT id FROM sla_incidents WHERE message_id = $1',
        [messageId],
      );
      expect(rows).toHaveLength(1);
    });

    it('rejects an unknown group with 404', async () => {
      await request(app.getHttpServer())
        .post('/events/sla')
        .set(authHeaders())
        .send({
          messageId: uniqueId('msg'),
          groupId: '00000000-0000-0000-0000-000000000000',
          triggerType: SlaTriggerType.MESSAGE,
          senderPhone: testPhone(),
          message: 'unknown group',
        })
        .expect(404);
    });
  });

  // -------------------------------------------------------------------
  // SLA responded event (Part 6)
  // -------------------------------------------------------------------

  describe('PATCH /events/sla/:messageId/responded', () => {
    async function createSla(overrides: { createdAt?: string } = {}) {
      const messageId = uniqueId('msg');
      await request(app.getHttpServer())
        .post('/events/sla')
        .set(authHeaders())
        .send({
          messageId,
          groupId: internalGroupId,
          triggerType: SlaTriggerType.MENTION,
          senderPhone: testPhone(),
          message: 'Responded test',
          ...overrides,
        })
        .expect(201);
      return messageId;
    }

    it('marks RESPONDED when the reply arrives before the deadline', async () => {
      const messageId = await createSla();
      const response = await request(app.getHttpServer())
        .patch(`/events/sla/${messageId}/responded`)
        .set(authHeaders())
        .send({ respondedBy: memberPhone })
        .expect(200);
      expect(response.body.status).toBe(SlaStatus.RESPONDED);
      expect(response.body.respondedBy).toBe(memberPhone);
    });

    it('marks MISSED (not RESPONDED) when the reply arrives after the deadline with no prior MISS event', async () => {
      // slaMinutes=30, backdate the trigger so the deadline has already passed.
      const createdAt = new Date(Date.now() - 60 * 60_000).toISOString();
      const messageId = await createSla({ createdAt });
      const response = await request(app.getHttpServer())
        .patch(`/events/sla/${messageId}/responded`)
        .set(authHeaders())
        .send({})
        .expect(200);
      expect(response.body.status).toBe(SlaStatus.MISSED);
      expect(response.body.firstResponseAt).not.toBeNull();
    });

    it('a response after an explicit MISS event never un-misses the incident', async () => {
      const messageId = await createSla();
      await request(app.getHttpServer())
        .patch(`/events/sla/${messageId}/missed`)
        .set(authHeaders())
        .send({})
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/events/sla/${messageId}/responded`)
        .set(authHeaders())
        .send({ respondedBy: memberPhone })
        .expect(200);

      expect(response.body.status).toBe(SlaStatus.MISSED);
      // The late response timestamp is still recorded, even though status stays MISSED.
      expect(response.body.firstResponseAt).not.toBeNull();
    });

    it('is idempotent — a duplicate responded event never overwrites the first response time', async () => {
      const messageId = await createSla();
      const first = await request(app.getHttpServer())
        .patch(`/events/sla/${messageId}/responded`)
        .set(authHeaders())
        .send({ respondedBy: memberPhone })
        .expect(200);
      const second = await request(app.getHttpServer())
        .patch(`/events/sla/${messageId}/responded`)
        .set(authHeaders())
        .send({ respondedBy: testPhone() })
        .expect(200);
      expect(second.body.firstResponseAt).toBe(first.body.firstResponseAt);
      expect(second.body.respondedBy).toBe(first.body.respondedBy);
    });

    it('returns 404 for an unknown messageId', async () => {
      await request(app.getHttpServer())
        .patch('/events/sla/does-not-exist/responded')
        .set(authHeaders())
        .send({})
        .expect(404);
    });
  });

  // -------------------------------------------------------------------
  // SLA missed event + notification fan-out (Part 7, 8, 9, 10, 11)
  // -------------------------------------------------------------------

  describe('PATCH /events/sla/:messageId/missed', () => {
    async function createSla() {
      const messageId = uniqueId('msg');
      await request(app.getHttpServer())
        .post('/events/sla')
        .set(authHeaders())
        .send({
          messageId,
          groupId: internalGroupId,
          triggerType: SlaTriggerType.MENTION,
          senderPhone: testPhone(),
          message: 'Missed fan-out test',
        })
        .expect(201);
      return messageId;
    }

    it('marks the incident MISSED and fans out exactly one CEO + one per active team member notification', async () => {
      const messageId = await createSla();
      const response = await request(app.getHttpServer())
        .patch(`/events/sla/${messageId}/missed`)
        .set(authHeaders())
        .send({})
        .expect(200);

      expect(response.body.sla.status).toBe(SlaStatus.MISSED);
      const notifications = response.body.notifications as Array<
        Record<string, unknown>
      >;

      const ceoNotifications = notifications.filter(
        (n) => n.type === NotificationType.CEO_SLA_ALERT,
      );
      const teamNotifications = notifications.filter(
        (n) => n.type === NotificationType.TEAM_SLA_REMINDER,
      );
      expect(ceoNotifications).toHaveLength(1);
      expect(teamNotifications).toHaveLength(1); // exactly one active member on this group

      // Part 9: CEO message must contain the human-readable group name, not the raw groupId/whatsappGroupId.
      expect(String(ceoNotifications[0].message)).toContain(internalGroupName);
      expect(String(ceoNotifications[0].message)).not.toContain(
        internalGroupId,
      );
      expect(ceoNotifications[0].recipientPhone).toBe(ceoPhone);

      expect(teamNotifications[0].recipientPhone).toBe(memberPhone);

      // Every notification references this SLA incident, and no other.
      for (const notification of notifications) {
        expect(notification.slaId).toBe(response.body.sla.id);
      }

      // Notifications are created as intent only — never claimed as already sent.
      for (const notification of notifications) {
        expect(notification.status).toBe(NotificationStatus.PENDING);
        expect(notification.sentAt).toBeNull();
      }

      // Exactly one SLA incident exists for this message — the notification fan-out never creates another.
      const slaRows = await dataSource.query(
        'SELECT id FROM sla_incidents WHERE id = $1',
        [response.body.sla.id],
      );
      expect(slaRows).toHaveLength(1);
    });

    it('is idempotent — a duplicate missed event never creates a second SLA incident or duplicate notifications', async () => {
      const messageId = await createSla();
      const first = await request(app.getHttpServer())
        .patch(`/events/sla/${messageId}/missed`)
        .set(authHeaders())
        .send({})
        .expect(200);
      const second = await request(app.getHttpServer())
        .patch(`/events/sla/${messageId}/missed`)
        .set(authHeaders())
        .send({})
        .expect(200);

      expect(second.body.sla.status).toBe(SlaStatus.MISSED);
      // The second call is a no-op transition, so it fans out no *new* notifications.
      expect(second.body.notifications).toHaveLength(0);

      const notificationRows = await dataSource.query(
        'SELECT id FROM notifications WHERE sla_id = $1',
        [first.body.sla.id],
      );
      expect(notificationRows).toHaveLength(2); // still exactly CEO + 1 team member, not doubled

      const slaRows = await dataSource.query(
        'SELECT id FROM sla_incidents WHERE id = $1',
        [first.body.sla.id],
      );
      expect(slaRows).toHaveLength(1);
    });

    it('returns 404 for an unknown messageId', async () => {
      await request(app.getHttpServer())
        .patch('/events/sla/does-not-exist/missed')
        .set(authHeaders())
        .send({})
        .expect(404);
    });
  });

  // -------------------------------------------------------------------
  // EOD event (Part 12)
  // -------------------------------------------------------------------

  describe('POST /events/eod', () => {
    // eod_reports has a unique constraint on (member, group, business date)
    // — every sub-test that submits a report needs its own member so they
    // don't collide with each other via that constraint (all these tests
    // run on the same business date).
    async function createEligibleMember() {
      const memberRepo = dataSource.getRepository(TeamMember);
      const member = await memberRepo.save(
        memberRepo.create({
          name: 'EOD Event E2E Member',
          phone: testPhone(),
          active: true,
        }),
      );
      createdMemberIds.push(member.id);
      await groupsService.addMember(internalGroupId, { memberId: member.id });
      return member.id;
    }

    it('records an EOD submission and lets the backend compute ON_TIME/LATE', async () => {
      const messageId = uniqueId('eod-msg');
      const response = await request(app.getHttpServer())
        .post('/events/eod')
        .set(authHeaders())
        .send({
          messageId,
          memberId,
          groupId: internalGroupId,
          reportContent: '1. Fixed payment API issue',
          submittedAt: new Date().toISOString(),
        })
        .expect(201);

      expect([EodStatus.ON_TIME, EodStatus.LATE]).toContain(
        response.body.status,
      );
      expect(response.body.reportContent).toBe('1. Fixed payment API issue');
      expect(response.body.reminders).toEqual([]);
    });

    it('is idempotent on messageId', async () => {
      const messageId = uniqueId('eod-msg');
      const payload = {
        messageId,
        memberId: await createEligibleMember(),
        groupId: internalGroupId,
        reportContent: 'Duplicate EOD submission',
        submittedAt: new Date().toISOString(),
      };
      const first = await request(app.getHttpServer())
        .post('/events/eod')
        .set(authHeaders())
        .send(payload)
        .expect(201);
      const second = await request(app.getHttpServer())
        .post('/events/eod')
        .set(authHeaders())
        .send(payload)
        .expect(201);
      expect(second.body.id).toBe(first.body.id);
      const rows = await dataSource.query(
        'SELECT id FROM eod_reports WHERE message_id = $1',
        [messageId],
      );
      expect(rows).toHaveLength(1);
    });

    it('computes LATE when submittedAt is after the business deadline', async () => {
      // Pick yesterday's business date and submit 1 hour after *that*
      // date's own deadline — unambiguously LATE regardless of what time
      // it is right now when this test runs.
      const yesterday = toBusinessDateString(
        new Date(Date.now() - 24 * 60 * 60_000),
        timeZone,
      );
      const yesterdayDeadline = getBusinessDayDeadline(
        yesterday,
        timeZone,
        deadlineHhMm,
      );
      const submittedAt = new Date(
        yesterdayDeadline.getTime() + 60 * 60_000,
      ).toISOString();
      const response = await request(app.getHttpServer())
        .post('/events/eod')
        .set(authHeaders())
        .send({
          messageId: uniqueId('eod-msg'),
          memberId: await createEligibleMember(),
          groupId: internalGroupId,
          reportContent: 'Late submission',
          submittedAt,
        })
        .expect(201);
      expect(response.body.status).toBe(EodStatus.LATE);
    });

    it('rejects a CLIENT-group submission with 400', async () => {
      await request(app.getHttpServer())
        .post('/events/eod')
        .set(authHeaders())
        .send({
          messageId: uniqueId('eod-msg'),
          memberId,
          groupId: clientGroupId,
          reportContent: 'Should be rejected',
          submittedAt: new Date().toISOString(),
        })
        .expect(400);
    });

    it('rejects submission from an inactive member with 400', async () => {
      const memberRepo = dataSource.getRepository(TeamMember);
      const inactiveMember = await memberRepo.save(
        memberRepo.create({
          name: 'Inactive Member',
          phone: testPhone(),
          active: false,
        }),
      );
      createdMemberIds.push(inactiveMember.id);
      await groupsService.addMember(internalGroupId, {
        memberId: inactiveMember.id,
      });

      await request(app.getHttpServer())
        .post('/events/eod')
        .set(authHeaders())
        .send({
          messageId: uniqueId('eod-msg'),
          memberId: inactiveMember.id,
          groupId: internalGroupId,
          reportContent: 'Should be rejected',
          submittedAt: new Date().toISOString(),
        })
        .expect(400);
    });

    it('rejects submission from a non-member of the group with 400', async () => {
      const memberRepo = dataSource.getRepository(TeamMember);
      const outsider = await memberRepo.save(
        memberRepo.create({
          name: 'Non Member',
          phone: testPhone(),
          active: true,
        }),
      );
      createdMemberIds.push(outsider.id);
      // Deliberately never added as a group member.

      await request(app.getHttpServer())
        .post('/events/eod')
        .set(authHeaders())
        .send({
          messageId: uniqueId('eod-msg'),
          memberId: outsider.id,
          groupId: internalGroupId,
          reportContent: 'Should be rejected',
          submittedAt: new Date().toISOString(),
        })
        .expect(400);
    });

    it('rejects an unknown group with 404', async () => {
      await request(app.getHttpServer())
        .post('/events/eod')
        .set(authHeaders())
        .send({
          messageId: uniqueId('eod-msg'),
          memberId,
          groupId: '00000000-0000-0000-0000-000000000000',
          reportContent: 'unknown group',
          submittedAt: new Date().toISOString(),
        })
        .expect(404);
    });
  });

  // -------------------------------------------------------------------
  // Notification dispatch boundary (Part 11, 24)
  // -------------------------------------------------------------------

  describe('POST /events/notifications', () => {
    it('transitions an existing PENDING notification to SENT without creating a new row', async () => {
      const messageId = uniqueId('msg');
      await request(app.getHttpServer())
        .post('/events/sla')
        .set(authHeaders())
        .send({
          messageId,
          groupId: internalGroupId,
          triggerType: SlaTriggerType.MENTION,
          senderPhone: testPhone(),
          message: 'Notification dispatch test',
        })
        .expect(201);
      const missed = await request(app.getHttpServer())
        .patch(`/events/sla/${messageId}/missed`)
        .set(authHeaders())
        .send({})
        .expect(200);

      const notificationId = missed.body.notifications[0].id as string;
      const beforeCount = await dataSource.query(
        'SELECT id FROM notifications WHERE sla_id = $1',
        [missed.body.sla.id],
      );

      const response = await request(app.getHttpServer())
        .post('/events/notifications')
        .set(authHeaders())
        .send({ notificationId, status: NotificationStatus.SENT })
        .expect(200);

      expect(response.body.status).toBe(NotificationStatus.SENT);
      expect(response.body.sentAt).not.toBeNull();
      expect(response.body.id).toBe(notificationId);

      const afterCount = await dataSource.query(
        'SELECT id FROM notifications WHERE sla_id = $1',
        [missed.body.sla.id],
      );
      expect(afterCount).toHaveLength(beforeCount.length);
    });

    it('returns 404 for an unknown notificationId', async () => {
      await request(app.getHttpServer())
        .post('/events/notifications')
        .set(authHeaders())
        .send({
          notificationId: '00000000-0000-0000-0000-000000000000',
          status: NotificationStatus.SENT,
        })
        .expect(404);
    });
  });
});
