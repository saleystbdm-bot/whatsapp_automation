import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { GroupType } from '../src/common/enums/group-type.enum';
import { Group } from '../src/groups/entities/group.entity';
import { GroupsService } from '../src/groups/groups.service';
import { IssuesService } from '../src/issues/issues.service';
import { SlaTriggerType } from '../src/sla/enums/sla-trigger-type.enum';
import { SlaService } from '../src/sla/sla.service';
import { TeamMember } from '../src/team-members/entities/team-member.entity';
import { bootstrapTestApp, testPhone, uniqueId } from './utils/bootstrap-app';

function inMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

describe('SLA API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let slaService: SlaService;
  let issuesService: IssuesService;
  let groupsService: GroupsService;
  let groupId: string;
  let groupName: string;
  const createdGroupIds: string[] = [];
  const createdIssueIds: string[] = [];
  const createdSlaIds: string[] = [];
  const createdMemberIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    dataSource = app.get(DataSource);
    slaService = app.get(SlaService);
    issuesService = app.get(IssuesService);
    groupsService = app.get(GroupsService);

    const groupRepo = dataSource.getRepository(Group);
    const group = await groupRepo.save(
      groupRepo.create({
        whatsappGroupId: uniqueId('wa'),
        name: 'SLA E2E Group',
        type: GroupType.INTERNAL,
        slaMinutes: 30,
        active: true,
      }),
    );
    groupId = group.id;
    groupName = group.name;
    createdGroupIds.push(group.id);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM notifications WHERE sla_id = ANY($1)', [
      createdSlaIds,
    ]);
    await dataSource.query('DELETE FROM sla_incidents WHERE id = ANY($1)', [
      createdSlaIds,
    ]);
    await dataSource.query('DELETE FROM issues WHERE id = ANY($1)', [
      createdIssueIds,
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

  async function createIncident(
    overrides: {
      slaDeadline?: Date;
      triggerType?: SlaTriggerType;
      issueId?: string | null;
      message?: string;
    } = {},
  ) {
    const incident = await slaService.createFromEvent({
      messageId: uniqueId('sla-msg'),
      groupId,
      issueId: overrides.issueId,
      triggerType: overrides.triggerType ?? SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: overrides.message ?? 'Payment API is not working',
      slaDeadline: overrides.slaDeadline ?? inMinutes(30),
    });
    createdSlaIds.push(incident.id);
    return incident;
  }

  async function createIssue() {
    const issue = await issuesService.createFromEvent({
      messageId: uniqueId('msg'),
      groupId,
      senderPhone: '+919566831192',
      message: 'Payment API is not working',
    });
    createdIssueIds.push(issue.id);
    return issue;
  }

  // 17. Create SLA from event
  it('createFromEvent creates an SLA incident snapshotting group name/type', async () => {
    const incident = await createIncident();
    expect(incident.status).toBe('OPEN');
    expect(incident.groupName).toBe(groupName);
    expect(incident.groupType).toBe(GroupType.INTERNAL);
  });

  // 18. Duplicate message event is idempotent
  it('createFromEvent is idempotent on messageId', async () => {
    const messageId = uniqueId('sla-msg');
    const first = await slaService.createFromEvent({
      messageId,
      groupId,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: 'Duplicate SLA delivery',
      slaDeadline: inMinutes(30),
    });
    createdSlaIds.push(first.id);
    const second = await slaService.createFromEvent({
      messageId,
      groupId,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: 'Duplicate SLA delivery',
      slaDeadline: inMinutes(30),
    });
    expect(second.id).toBe(first.id);
  });

  // 29. Missing group rejected
  it('createFromEvent rejects an unknown group', async () => {
    await expect(
      slaService.createFromEvent({
        messageId: uniqueId('sla-msg'),
        groupId: '00000000-0000-0000-0000-000000000000',
        triggerType: SlaTriggerType.MESSAGE,
        senderPhone: '+919566831192',
        message: 'Orphan SLA',
        slaDeadline: inMinutes(30),
      }),
    ).rejects.toThrow();
  });

  // 19. Get SLA list
  it('GET /sla returns a list with elapsed/remaining minutes', async () => {
    await createIncident();
    const response = await request(app.getHttpServer()).get('/sla').expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    const item = response.body.find(
      (i: { groupId: string }) => i.groupId === groupId,
    );
    expect(typeof item.elapsedMinutes).toBe('number');
    expect(typeof item.remainingMinutes).toBe('number');
  });

  // 20. Get SLA detail
  it('GET /sla/:id returns a single incident', async () => {
    const incident = await createIncident({ message: 'Detail fetch SLA' });
    const response = await request(app.getHttpServer())
      .get(`/sla/${incident.id}`)
      .expect(200);
    expect(response.body.id).toBe(incident.id);
    expect(response.body.message).toBe('Detail fetch SLA');
  });

  it('GET /sla/:id returns 404 for an unknown incident', async () => {
    await request(app.getHttpServer())
      .get('/sla/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  // 21. Filter by status
  it('GET /sla?status=MISSED filters by status', async () => {
    const incident = await createIncident({ slaDeadline: inMinutes(-1) });
    await request(app.getHttpServer())
      .patch(`/sla/${incident.id}`)
      .send({ action: 'MISS' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/sla?status=MISSED')
      .expect(200);
    expect(response.body.map((i: { id: string }) => i.id)).toContain(
      incident.id,
    );
  });

  // 22. Filter by group
  it('GET /sla?groupId=... filters by group', async () => {
    const incident = await createIncident();
    const response = await request(app.getHttpServer())
      .get(`/sla?groupId=${groupId}`)
      .expect(200);
    expect(
      response.body.every((i: { groupId: string }) => i.groupId === groupId),
    ).toBe(true);
    expect(response.body.map((i: { id: string }) => i.id)).toContain(
      incident.id,
    );
  });

  // 23. Filter by group type
  it('GET /sla?groupType=CLIENT filters by group type', async () => {
    const groupRepo = dataSource.getRepository(Group);
    const clientGroup = await groupRepo.save(
      groupRepo.create({
        whatsappGroupId: uniqueId('wa'),
        name: 'SLA Client Type Group',
        type: GroupType.CLIENT,
        slaMinutes: 30,
        active: true,
      }),
    );
    createdGroupIds.push(clientGroup.id);

    const clientIncident = await slaService.createFromEvent({
      messageId: uniqueId('sla-msg'),
      groupId: clientGroup.id,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: 'Client group SLA',
      slaDeadline: inMinutes(30),
    });
    createdSlaIds.push(clientIncident.id);

    const response = await request(app.getHttpServer())
      .get('/sla?groupType=CLIENT')
      .expect(200);
    expect(response.body.map((i: { id: string }) => i.id)).toContain(
      clientIncident.id,
    );
  });

  // 24. Filter by trigger type
  it('GET /sla?triggerType=MENTION filters by trigger type', async () => {
    const mentionIncident = await createIncident({
      triggerType: SlaTriggerType.MENTION,
    });
    const response = await request(app.getHttpServer())
      .get('/sla?triggerType=MENTION')
      .expect(200);
    expect(response.body.map((i: { id: string }) => i.id)).toContain(
      mentionIncident.id,
    );
    expect(
      response.body.every(
        (i: { triggerType: string }) => i.triggerType === 'MENTION',
      ),
    ).toBe(true);
  });

  // 25. Mark SLA responded
  it('PATCH /sla/:id { action: RESPOND } marks it responded', async () => {
    const incident = await createIncident();
    const response = await request(app.getHttpServer())
      .patch(`/sla/${incident.id}`)
      .send({ action: 'RESPOND', respondedBy: '+919566800001' })
      .expect(200);
    expect(response.body.status).toBe('RESPONDED');
    expect(response.body.firstResponseAt).not.toBeNull();
    expect(response.body.respondedBy).toBe('+919566800001');
  });

  // 26. First response timestamp cannot be overwritten
  it('a second RESPOND action does not overwrite firstResponseAt', async () => {
    const incident = await createIncident();
    const first = await request(app.getHttpServer())
      .patch(`/sla/${incident.id}`)
      .send({ action: 'RESPOND', respondedBy: '+919566800001' })
      .expect(200);
    const second = await request(app.getHttpServer())
      .patch(`/sla/${incident.id}`)
      .send({ action: 'RESPOND', respondedBy: '+919566899999' })
      .expect(200);
    expect(second.body.firstResponseAt).toBe(first.body.firstResponseAt);
    expect(second.body.respondedBy).toBe('+919566800001');
  });

  // 27. Mark SLA missed
  it('PATCH /sla/:id { action: MISS } marks it missed and sets escalatedAt', async () => {
    const incident = await createIncident({ slaDeadline: inMinutes(-1) });
    const response = await request(app.getHttpServer())
      .patch(`/sla/${incident.id}`)
      .send({ action: 'MISS' })
      .expect(200);
    expect(response.body.status).toBe('MISSED');
    expect(response.body.escalatedAt).not.toBeNull();
  });

  // 28. MISSED does not become RESPONDED after late response
  it('a RESPOND action after MISS does not flip status back to RESPONDED', async () => {
    const incident = await createIncident({ slaDeadline: inMinutes(-1) });
    await request(app.getHttpServer())
      .patch(`/sla/${incident.id}`)
      .send({ action: 'MISS' })
      .expect(200);
    const response = await request(app.getHttpServer())
      .patch(`/sla/${incident.id}`)
      .send({ action: 'RESPOND', respondedBy: '+919566800001' })
      .expect(200);
    expect(response.body.status).toBe('MISSED');
    expect(response.body.firstResponseAt).not.toBeNull();
  });

  it('PATCH /sla/:id rejects an arbitrary status field / unknown action shape with 400', async () => {
    const incident = await createIncident();
    await request(app.getHttpServer())
      .patch(`/sla/${incident.id}`)
      .send({ status: 'RESPONDED' })
      .expect(400); // `status` is not whitelisted; `action` is required
  });

  // 30. SLA can exist without issueId for mention-only events
  it('SLA can exist without issueId for a mention-only event', async () => {
    const incident = await createIncident({
      triggerType: SlaTriggerType.MENTION,
      issueId: null,
    });
    expect(incident.issueId).toBeNull();
    const response = await request(app.getHttpServer())
      .get(`/sla/${incident.id}`)
      .expect(200);
    expect(response.body.issueId).toBeNull();
  });

  // 31. SLA with issueId correctly references issue
  it('SLA with issueId correctly references the issue, reflected in GET /issues/:id', async () => {
    const issue = await createIssue();
    const incident = await createIncident({ issueId: issue.id });

    const issueDetail = await request(app.getHttpServer())
      .get(`/issues/${issue.id}`)
      .expect(200);
    expect(issueDetail.body.sla.id).toBe(incident.id);
  });

  // 32. SLA group name snapshot is preserved
  it('SLA group_name snapshot is preserved even if the group is later renamed', async () => {
    const incident = await createIncident();
    await request(app.getHttpServer())
      .patch(`/groups/${groupId}`)
      .send({ name: 'Renamed After SLA Created' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/sla/${incident.id}`)
      .expect(200);
    expect(response.body.groupName).toBe(groupName);

    // restore the name so other tests in this file aren't affected
    await request(app.getHttpServer())
      .patch(`/groups/${groupId}`)
      .send({ name: groupName })
      .expect(200);
  });

  // 38/39/40/41. Notifications
  it('a missed SLA creates one CEO_SLA_ALERT and one TEAM_SLA_REMINDER per active responsible member, all referencing the SLA', async () => {
    const memberPhone = testPhone();
    const memberRepo = dataSource.getRepository(TeamMember);
    const member = await memberRepo.save(
      memberRepo.create({
        name: 'Notif Member',
        phone: memberPhone,
        active: true,
      }),
    );
    createdMemberIds.push(member.id);
    await groupsService.addMember(groupId, {
      memberId: member.id,
      responsibility: 'PRIMARY',
    });

    const incident = await createIncident({
      slaDeadline: inMinutes(-1),
      message: 'Notification fan-out test',
    });
    await request(app.getHttpServer())
      .patch(`/sla/${incident.id}`)
      .send({ action: 'MISS' })
      .expect(200);

    const notifications = await dataSource.query<
      { type: string; recipient_phone: string; sla_id: string }[]
    >(
      'SELECT type, recipient_phone, sla_id FROM notifications WHERE sla_id = $1',
      [incident.id],
    );
    expect(notifications.every((n) => n.sla_id === incident.id)).toBe(true);
    expect(notifications.some((n) => n.type === 'CEO_SLA_ALERT')).toBe(true);
    expect(
      notifications.some(
        (n) =>
          n.type === 'TEAM_SLA_REMINDER' && n.recipient_phone === memberPhone,
      ),
    ).toBe(true);

    // 40. Multiple notifications do not create multiple SLA incidents
    const [{ count }] = await dataSource.query<{ count: number }[]>(
      'SELECT count(*)::int AS count FROM sla_incidents WHERE id = $1',
      [incident.id],
    );
    expect(count).toBe(1);
  });

  // 33/34/35/36. SLA summary
  it('GET /sla/summary returns counts, compliance percentage, and average response time', async () => {
    const groupRepo = dataSource.getRepository(Group);
    const summaryGroup = await groupRepo.save(
      groupRepo.create({
        whatsappGroupId: uniqueId('wa'),
        name: 'Summary Scoped Group',
        type: GroupType.INTERNAL,
        slaMinutes: 30,
        active: true,
      }),
    );
    createdGroupIds.push(summaryGroup.id);

    async function createFor(groupIdForIncident: string, deadline: Date) {
      const incident = await slaService.createFromEvent({
        messageId: uniqueId('sla-msg'),
        groupId: groupIdForIncident,
        triggerType: SlaTriggerType.MESSAGE,
        senderPhone: '+919566831192',
        message: 'Summary test',
        slaDeadline: deadline,
      });
      createdSlaIds.push(incident.id);
      return incident;
    }

    const openIncident = await createFor(summaryGroup.id, inMinutes(30));

    const respondedIncident = await createFor(summaryGroup.id, inMinutes(30));
    await slaService.respond(respondedIncident.id, '+919566800001');

    const missedIncident = await createFor(summaryGroup.id, inMinutes(-1));
    await slaService.miss(missedIncident.id);

    const response = await request(app.getHttpServer())
      .get(`/sla/summary?groupId=${summaryGroup.id}`)
      .expect(200);

    expect(response.body.total).toBe(3);
    expect(response.body.open).toBe(1);
    expect(response.body.responded).toBe(1);
    expect(response.body.missed).toBe(1);
    // 36. OPEN incidents excluded from compliance denominator: 1 responded / (1 responded + 1 missed) = 50%
    expect(response.body.compliancePercentage).toBe(50);
    // 35. average response time computed only from the responded incident
    expect(response.body.averageResponseMinutes).not.toBeNull();
    expect(response.body.averageResponseMinutes).toBeGreaterThanOrEqual(0);

    void openIncident;
  });

  // 37. Invalid timestamps handled safely — summary must not throw even if
  // a firstResponseAt somehow predates createdAt (defensive data-integrity guard).
  it('GET /sla/summary tolerates a corrupt firstResponseAt without throwing', async () => {
    const incident = await createIncident();
    await dataSource.query(
      "UPDATE sla_incidents SET first_response_at = created_at - interval '10 minutes' WHERE id = $1",
      [incident.id],
    );

    const response = await request(app.getHttpServer())
      .get(`/sla/summary?groupId=${groupId}`)
      .expect(200);
    expect(response.status).toBe(200);
    expect(typeof response.body.total).toBe('number');
  });
});
