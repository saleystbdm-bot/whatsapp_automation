import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { GroupType } from '../src/common/enums/group-type.enum';
import { Group } from '../src/groups/entities/group.entity';
import { IssueStatus } from '../src/issues/enums/issue-status.enum';
import { IssuesService } from '../src/issues/issues.service';
import { bootstrapTestApp, uniqueId } from './utils/bootstrap-app';

describe('Issues API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let issuesService: IssuesService;
  let groupId: string;
  let groupName: string;
  const createdGroupIds: string[] = [];
  const createdIssueIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    dataSource = app.get(DataSource);
    issuesService = app.get(IssuesService);

    const groupRepo = dataSource.getRepository(Group);
    const group = await groupRepo.save(
      groupRepo.create({
        whatsappGroupId: uniqueId('wa'),
        name: 'Issues E2E Group',
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
    await dataSource.query(
      'DELETE FROM sla_incidents WHERE issue_id = ANY($1)',
      [createdIssueIds],
    );
    await dataSource.query('DELETE FROM issues WHERE id = ANY($1)', [
      createdIssueIds,
    ]);
    await dataSource.query('DELETE FROM groups WHERE id = ANY($1)', [
      createdGroupIds,
    ]);
    await app.close();
  });

  async function createIssue(
    message = 'Payment API is not working',
    overrides: Partial<{ createdAt: Date }> = {},
  ) {
    const issue = await issuesService.createFromEvent({
      messageId: uniqueId('msg'),
      groupId,
      senderPhone: '+919566831192',
      message,
      createdAt: overrides.createdAt,
    });
    createdIssueIds.push(issue.id);
    return issue;
  }

  // 1. Create issue from event
  it('createFromEvent creates an issue', async () => {
    const issue = await createIssue('Event-created issue');
    expect(issue.id).toBeDefined();
    expect(issue.status).toBe(IssueStatus.OPEN);
    expect(issue.groupType).toBe(GroupType.INTERNAL);
  });

  // 2. Duplicate message event is idempotent
  it('createFromEvent is idempotent on messageId', async () => {
    const messageId = uniqueId('msg');
    const first = await issuesService.createFromEvent({
      messageId,
      groupId,
      senderPhone: '+919566831192',
      message: 'Duplicate delivery',
    });
    createdIssueIds.push(first.id);

    const second = await issuesService.createFromEvent({
      messageId,
      groupId,
      senderPhone: '+919566831192',
      message: 'Duplicate delivery',
    });

    expect(second.id).toBe(first.id);
  });

  // 16. Missing group rejected
  it('createFromEvent rejects an unknown group', async () => {
    await expect(
      issuesService.createFromEvent({
        messageId: uniqueId('msg'),
        groupId: '00000000-0000-0000-0000-000000000000',
        senderPhone: '+919566831192',
        message: 'Orphan attempt',
      }),
    ).rejects.toThrow();
  });

  // 3. Get issues
  it('GET /issues returns a list with groupName/groupType/sla', async () => {
    await createIssue();
    const response = await request(app.getHttpServer())
      .get('/issues')
      .expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    const item = response.body.find(
      (i: { groupId: string }) => i.groupId === groupId,
    );
    expect(item.groupName).toBe(groupName);
    expect(item.groupType).toBe(GroupType.INTERNAL);
    expect(item).toHaveProperty('sla');
  });

  // 4. Get issue
  it('GET /issues/:id returns detail with responsibleTeam and timeline', async () => {
    const issue = await createIssue('Detail fetch issue');
    const response = await request(app.getHttpServer())
      .get(`/issues/${issue.id}`)
      .expect(200);
    expect(response.body.id).toBe(issue.id);
    expect(response.body.message).toBe('Detail fetch issue');
    expect(Array.isArray(response.body.responsibleTeam)).toBe(true);
    expect(response.body.timeline[0]).toMatchObject({
      label: 'Issue reported',
    });
  });

  it('GET /issues/:id returns 404 for an unknown issue', async () => {
    await request(app.getHttpServer())
      .get('/issues/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  // 5. Search issues
  it('GET /issues?search=... is a case-insensitive message search', async () => {
    const issue = await createIssue('Zephyr search target message');
    const response = await request(app.getHttpServer())
      .get('/issues?search=zephyr')
      .expect(200);
    expect(response.body.map((i: { id: string }) => i.id)).toContain(issue.id);
  });

  // 6. Filter by status
  it('GET /issues?status=RESOLVED filters by status', async () => {
    const issue = await createIssue('Status filter issue');
    await request(app.getHttpServer())
      .patch(`/issues/${issue.id}`)
      .send({ status: 'RESOLVED' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/issues?status=RESOLVED')
      .expect(200);
    expect(response.body.map((i: { id: string }) => i.id)).toContain(issue.id);
    const openResponse = await request(app.getHttpServer())
      .get('/issues?status=OPEN')
      .expect(200);
    expect(openResponse.body.map((i: { id: string }) => i.id)).not.toContain(
      issue.id,
    );
  });

  // 7. Filter by group
  it('GET /issues?groupId=... filters by group', async () => {
    const issue = await createIssue('Group filter issue');
    const response = await request(app.getHttpServer())
      .get(`/issues?groupId=${groupId}`)
      .expect(200);
    expect(
      response.body.every((i: { groupId: string }) => i.groupId === groupId),
    ).toBe(true);
    expect(response.body.map((i: { id: string }) => i.id)).toContain(issue.id);
  });

  // 8. Filter by group type
  it('GET /issues?groupType=CLIENT filters by group type', async () => {
    const groupRepo = dataSource.getRepository(Group);
    const clientGroup = await groupRepo.save(
      groupRepo.create({
        whatsappGroupId: uniqueId('wa'),
        name: 'Client Type Filter Group',
        type: GroupType.CLIENT,
        slaMinutes: 30,
        active: true,
      }),
    );
    createdGroupIds.push(clientGroup.id);

    const clientIssue = await issuesService.createFromEvent({
      messageId: uniqueId('msg'),
      groupId: clientGroup.id,
      senderPhone: '+919566831192',
      message: 'Client group issue',
    });
    createdIssueIds.push(clientIssue.id);

    const internalIssue = await createIssue(
      'Internal group issue for type filter',
    );

    const response = await request(app.getHttpServer())
      .get('/issues?groupType=CLIENT')
      .expect(200);
    const ids = response.body.map((i: { id: string }) => i.id);
    expect(ids).toContain(clientIssue.id);
    expect(ids).not.toContain(internalIssue.id);
  });

  // 9. Filter by date
  it('GET /issues?date=YYYY-MM-DD filters to that business day', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60_000);
    const oldIssue = await createIssue('Yesterday issue', {
      createdAt: yesterday,
    });
    const todayIssue = await createIssue('Today issue');

    const todayStr = new Date().toISOString().slice(0, 10);
    const response = await request(app.getHttpServer())
      .get(`/issues?date=${todayStr}`)
      .expect(200);
    const ids = response.body.map((i: { id: string }) => i.id);
    expect(ids).toContain(todayIssue.id);
    expect(ids).not.toContain(oldIssue.id);
  });

  it('GET /issues?date=bad-format returns 400', async () => {
    await request(app.getHttpServer())
      .get('/issues?date=22-09-2026')
      .expect(400);
  });

  // 10. OPEN → IN_PROGRESS
  it('PATCH /issues/:id OPEN → IN_PROGRESS', async () => {
    const issue = await createIssue('Transition test A');
    const response = await request(app.getHttpServer())
      .patch(`/issues/${issue.id}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect(response.body.status).toBe('IN_PROGRESS');
    expect(response.body.resolvedAt).toBeNull();
  });

  // 11. OPEN → RESOLVED
  it('PATCH /issues/:id OPEN → RESOLVED', async () => {
    const issue = await createIssue('Transition test B');
    const response = await request(app.getHttpServer())
      .patch(`/issues/${issue.id}`)
      .send({ status: 'RESOLVED', resolvedBy: '+919566800001' })
      .expect(200);
    expect(response.body.status).toBe('RESOLVED');
    expect(response.body.resolvedAt).not.toBeNull();
    expect(response.body.resolvedBy).toBe('+919566800001');
  });

  // 12. IN_PROGRESS → RESOLVED
  it('PATCH /issues/:id IN_PROGRESS → RESOLVED', async () => {
    const issue = await createIssue('Transition test C');
    await request(app.getHttpServer())
      .patch(`/issues/${issue.id}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    const response = await request(app.getHttpServer())
      .patch(`/issues/${issue.id}`)
      .send({ status: 'RESOLVED' })
      .expect(200);
    expect(response.body.status).toBe('RESOLVED');
  });

  // 13. Reject RESOLVED → OPEN
  it('PATCH /issues/:id rejects RESOLVED → OPEN with 400', async () => {
    const issue = await createIssue('Terminal test A');
    await request(app.getHttpServer())
      .patch(`/issues/${issue.id}`)
      .send({ status: 'RESOLVED' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/issues/${issue.id}`)
      .send({ status: 'OPEN' })
      .expect(400);
  });

  // 14. Reject RESOLVED → IN_PROGRESS
  it('PATCH /issues/:id rejects RESOLVED → IN_PROGRESS with 400', async () => {
    const issue = await createIssue('Terminal test B');
    await request(app.getHttpServer())
      .patch(`/issues/${issue.id}`)
      .send({ status: 'RESOLVED' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/issues/${issue.id}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(400);
  });

  // 15. Resolve records resolvedAt
  it('PATCH /issues/:id resolving records resolvedAt', async () => {
    const issue = await createIssue('resolvedAt test');
    const before = await request(app.getHttpServer())
      .get(`/issues/${issue.id}`)
      .expect(200);
    expect(before.body.resolvedAt).toBeNull();

    const after = await request(app.getHttpServer())
      .patch(`/issues/${issue.id}`)
      .send({ status: 'RESOLVED' })
      .expect(200);
    expect(after.body.resolvedAt).not.toBeNull();
  });

  it('PATCH /issues/:id returns 404 for an unknown issue', async () => {
    await request(app.getHttpServer())
      .patch('/issues/00000000-0000-0000-0000-000000000000')
      .send({ status: 'IN_PROGRESS' })
      .expect(404);
  });

  it('GET /issues/:id has sla: null when no SLA incident references the issue', async () => {
    const issue = await createIssue('No SLA linked issue');
    const detail = await request(app.getHttpServer())
      .get(`/issues/${issue.id}`)
      .expect(200);
    expect(detail.body.sla).toBeNull();
  });
});
