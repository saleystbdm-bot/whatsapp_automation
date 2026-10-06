import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { GroupType } from '../src/common/enums/group-type.enum';
import { Issue } from '../src/issues/entities/issue.entity';
import { bootstrapTestApp, uniqueId } from './utils/bootstrap-app';

describe('Groups API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const createdGroupIds: string[] = [];
  const createdIssueIds: string[] = [];
  const createdMemberIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (createdIssueIds.length > 0) {
      await dataSource.query('DELETE FROM issues WHERE id = ANY($1)', [
        createdIssueIds,
      ]);
    }
    if (createdGroupIds.length > 0) {
      await dataSource.query(
        'DELETE FROM group_members WHERE group_id = ANY($1)',
        [createdGroupIds],
      );
      await dataSource.query('DELETE FROM keywords WHERE group_id = ANY($1)', [
        createdGroupIds,
      ]);
      await dataSource.query('DELETE FROM groups WHERE id = ANY($1)', [
        createdGroupIds,
      ]);
    }
    if (createdMemberIds.length > 0) {
      await dataSource.query('DELETE FROM team_members WHERE id = ANY($1)', [
        createdMemberIds,
      ]);
    }
    await app.close();
  });

  async function createGroup(
    overrides: Partial<{
      name: string;
      type: GroupType;
      slaMinutes: number;
    }> = {},
  ) {
    const response = await request(app.getHttpServer())
      .post('/groups')
      .send({
        whatsappGroupId: uniqueId('wa'),
        name: overrides.name ?? 'Test Group',
        type: overrides.type ?? GroupType.INTERNAL,
        slaMinutes: overrides.slaMinutes ?? 30,
      })
      .expect(201);
    createdGroupIds.push(response.body.id);
    return response.body;
  }

  // 3. POST group
  it('POST /groups creates a group, unmonitored by default', async () => {
    const whatsappGroupId = uniqueId('wa');
    const response = await request(app.getHttpServer())
      .post('/groups')
      .send({
        whatsappGroupId,
        name: 'Client ABC',
        type: GroupType.CLIENT,
        slaMinutes: 30,
      })
      .expect(201);
    createdGroupIds.push(response.body.id);

    expect(response.body).toMatchObject({
      whatsappGroupId,
      name: 'Client ABC',
      type: GroupType.CLIENT,
      active: false,
      slaMinutes: 30,
      memberCount: 0,
      members: [],
      keywords: [],
    });
    expect(response.body.id).toBeDefined();
    expect(response.body.createdAt).toBeDefined();
  });

  // 4. Reject duplicate whatsappGroupId
  it('POST /groups rejects a duplicate whatsappGroupId with 409', async () => {
    const group = await createGroup();
    await request(app.getHttpServer())
      .post('/groups')
      .send({
        whatsappGroupId: group.whatsappGroupId,
        name: 'Another Name',
        type: GroupType.INTERNAL,
        slaMinutes: 30,
      })
      .expect(409);
  });

  // 5. Reject invalid group type
  it('POST /groups rejects an invalid group type with 400', async () => {
    await request(app.getHttpServer())
      .post('/groups')
      .send({
        whatsappGroupId: uniqueId('wa'),
        name: 'Bad Type',
        type: 'NOT_A_TYPE',
        slaMinutes: 30,
      })
      .expect(400);
  });

  // 6. Reject invalid SLA
  it('POST /groups rejects a non-positive slaMinutes with 400', async () => {
    await request(app.getHttpServer())
      .post('/groups')
      .send({
        whatsappGroupId: uniqueId('wa'),
        name: 'Bad SLA',
        type: GroupType.INTERNAL,
        slaMinutes: 0,
      })
      .expect(400);
  });

  it('POST /groups rejects missing required fields with 400', async () => {
    await request(app.getHttpServer())
      .post('/groups')
      .send({ name: 'No WhatsApp Id' })
      .expect(400);
  });

  it('POST /groups strips/rejects unknown fields (active cannot be set on create)', async () => {
    await request(app.getHttpServer())
      .post('/groups')
      .send({
        whatsappGroupId: uniqueId('wa'),
        name: 'Attempted Active Override',
        type: GroupType.INTERNAL,
        slaMinutes: 30,
        active: true,
        notAField: 'nope',
      })
      .expect(400); // forbidNonWhitelisted rejects the unknown `notAField`/`active`
  });

  // 1. GET groups
  it('GET /groups returns a list including members/keywords', async () => {
    await createGroup();
    const response = await request(app.getHttpServer())
      .get('/groups')
      .expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('members');
    expect(response.body[0]).toHaveProperty('keywords');
    expect(response.body[0]).toHaveProperty('memberCount');
  });

  // 2. GET group by ID
  it('GET /groups/:id returns a single group', async () => {
    const group = await createGroup({ name: 'Single Fetch Group' });
    const response = await request(app.getHttpServer())
      .get(`/groups/${group.id}`)
      .expect(200);
    expect(response.body.id).toBe(group.id);
    expect(response.body.name).toBe('Single Fetch Group');
  });

  it('GET /groups/:id returns 404 for an unknown group', async () => {
    await request(app.getHttpServer())
      .get('/groups/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  // 7. PATCH group
  it('PATCH /groups/:id updates name/type/slaMinutes', async () => {
    const group = await createGroup();
    const response = await request(app.getHttpServer())
      .patch(`/groups/${group.id}`)
      .send({ name: 'Renamed Group', slaMinutes: 45 })
      .expect(200);
    expect(response.body.name).toBe('Renamed Group');
    expect(response.body.slaMinutes).toBe(45);
  });

  // 8. Enable monitoring
  it('PATCH /groups/:id { active: true } enables monitoring ("Monitor")', async () => {
    const group = await createGroup();
    expect(group.active).toBe(false);
    const response = await request(app.getHttpServer())
      .patch(`/groups/${group.id}`)
      .send({ active: true })
      .expect(200);
    expect(response.body.active).toBe(true);
  });

  // 9. Disable monitoring
  it('PATCH /groups/:id { active: false } disables monitoring ("Remove")', async () => {
    const group = await createGroup();
    await request(app.getHttpServer())
      .patch(`/groups/${group.id}`)
      .send({ active: true })
      .expect(200);
    const response = await request(app.getHttpServer())
      .patch(`/groups/${group.id}`)
      .send({ active: false })
      .expect(200);
    expect(response.body.active).toBe(false);
  });

  it('PATCH /groups/:id returns 404 for an unknown group', async () => {
    await request(app.getHttpServer())
      .patch('/groups/00000000-0000-0000-0000-000000000000')
      .send({ active: true })
      .expect(404);
  });

  // 10. Delete group without historical records
  it('DELETE /groups/:id deletes a group with no historical records', async () => {
    const group = await createGroup();
    await request(app.getHttpServer())
      .delete(`/groups/${group.id}`)
      .expect(204);
    await request(app.getHttpServer()).get(`/groups/${group.id}`).expect(404);
  });

  // 11. Reject deletion when historical records exist
  it('DELETE /groups/:id returns 409 when the group has historical issues', async () => {
    const group = await createGroup();

    const issueRepo = dataSource.getRepository(Issue);
    const issue = await issueRepo.save(
      issueRepo.create({
        messageId: uniqueId('msg'),
        groupId: group.id,
        groupType: group.type,
        senderPhone: '+919566831192',
        message: 'Historical issue blocking deletion',
      }),
    );
    createdIssueIds.push(issue.id);

    await request(app.getHttpServer())
      .delete(`/groups/${group.id}`)
      .expect(409);

    // Group must still exist — the delete must not have partially applied.
    await request(app.getHttpServer()).get(`/groups/${group.id}`).expect(200);
  });

  // 29. Filter groups by active
  it('GET /groups?active=true filters to monitored groups only', async () => {
    const monitored = await createGroup({ name: 'Monitored Filter Group' });
    await request(app.getHttpServer())
      .patch(`/groups/${monitored.id}`)
      .send({ active: true })
      .expect(200);
    const unmonitored = await createGroup({ name: 'Unmonitored Filter Group' });

    const response = await request(app.getHttpServer())
      .get('/groups?active=true')
      .expect(200);
    const ids = response.body.map((g: { id: string }) => g.id);
    expect(ids).toContain(monitored.id);
    expect(ids).not.toContain(unmonitored.id);
  });

  // 30. Filter groups by type
  it('GET /groups?type=CLIENT filters by group type', async () => {
    const client = await createGroup({
      name: 'Client Type Filter',
      type: GroupType.CLIENT,
    });
    const internal = await createGroup({
      name: 'Internal Type Filter',
      type: GroupType.INTERNAL,
    });

    const response = await request(app.getHttpServer())
      .get('/groups?type=CLIENT')
      .expect(200);
    const ids = response.body.map((g: { id: string }) => g.id);
    expect(ids).toContain(client.id);
    expect(ids).not.toContain(internal.id);
  });

  // 31. Search groups
  it('GET /groups?search=... is a case-insensitive name search', async () => {
    const group = await createGroup({ name: 'Zephyr Search Target' });

    const response = await request(app.getHttpServer())
      .get('/groups?search=zephyr')
      .expect(200);
    const ids = response.body.map((g: { id: string }) => g.id);
    expect(ids).toContain(group.id);
  });

  // 33/34/35. Relationship response
  it('GET /groups/:id returns members, keywords, and memberCount together (no extra requests needed)', async () => {
    const group = await createGroup({ name: 'Relationship Response Group' });

    const phone = `+91${Math.floor(1_000_000_000 + Math.random() * 8_999_999_999)}`;
    const createdMember = await request(app.getHttpServer())
      .post('/team-members')
      .send({ name: 'Relationship Member', phone })
      .expect(201);
    createdMemberIds.push(createdMember.body.id);

    await request(app.getHttpServer())
      .post(`/groups/${group.id}/members`)
      .send({ memberId: createdMember.body.id, responsibility: 'PRIMARY' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/groups/${group.id}/keywords`)
      .send({ keyword: 'urgent' })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/groups/${group.id}`)
      .expect(200);
    expect(detail.body.memberCount).toBe(1);
    expect(detail.body.members).toHaveLength(1);
    expect(detail.body.members[0].name).toBe('Relationship Member');
    expect(detail.body.keywords).toHaveLength(1);
    expect(detail.body.keywords[0].keyword).toBe('urgent');
  });
});
