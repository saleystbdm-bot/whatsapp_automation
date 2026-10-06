import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { GroupType } from '../src/common/enums/group-type.enum';
import { bootstrapTestApp, testPhone, uniqueId } from './utils/bootstrap-app';

describe('Group Members API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let groupId: string;
  const createdGroupIds: string[] = [];
  const createdMemberIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    dataSource = app.get(DataSource);

    const group = await request(app.getHttpServer())
      .post('/groups')
      .send({
        whatsappGroupId: uniqueId('wa'),
        name: 'Group Members Test Group',
        type: GroupType.INTERNAL,
        slaMinutes: 30,
      })
      .expect(201);
    groupId = group.body.id;
    createdGroupIds.push(groupId);
  });

  afterAll(async () => {
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

  async function createMember() {
    const response = await request(app.getHttpServer())
      .post('/team-members')
      .send({ name: 'Group Member Fixture', phone: testPhone() })
      .expect(201);
    createdMemberIds.push(response.body.id);
    return response.body;
  }

  // 19. Add member to group
  it('POST /groups/:groupId/members adds a member to a group', async () => {
    const member = await createMember();
    const response = await request(app.getHttpServer())
      .post(`/groups/${groupId}/members`)
      .send({ memberId: member.id, responsibility: 'PRIMARY' })
      .expect(201);

    expect(response.body.memberId).toBe(member.id);
    expect(response.body.responsibility).toBe('PRIMARY');
    expect(response.body.active).toBe(true);
  });

  it('POST /groups/:groupId/members returns 404 for an unknown group', async () => {
    const member = await createMember();
    await request(app.getHttpServer())
      .post('/groups/00000000-0000-0000-0000-000000000000/members')
      .send({ memberId: member.id })
      .expect(404);
  });

  it('POST /groups/:groupId/members returns 404 for an unknown team member', async () => {
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/members`)
      .send({ memberId: '00000000-0000-0000-0000-000000000000' })
      .expect(404);
  });

  // 20. Reject duplicate membership
  it('POST /groups/:groupId/members rejects a duplicate membership with 409', async () => {
    const member = await createMember();
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/members`)
      .send({ memberId: member.id })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/groups/${groupId}/members`)
      .send({ memberId: member.id })
      .expect(409);
  });

  it('GET /groups/:groupId/members lists members', async () => {
    const member = await createMember();
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/members`)
      .send({ memberId: member.id })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/groups/${groupId}/members`)
      .expect(200);
    expect(
      response.body.map((m: { memberId: string }) => m.memberId),
    ).toContain(member.id);
  });

  // 21. Update membership
  it('PATCH /groups/:groupId/members/:memberId updates responsibility and active status', async () => {
    const member = await createMember();
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/members`)
      .send({ memberId: member.id })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/groups/${groupId}/members/${member.id}`)
      .send({ responsibility: 'SECONDARY', active: false })
      .expect(200);

    expect(response.body.responsibility).toBe('SECONDARY');
    expect(response.body.active).toBe(false);
  });

  it('PATCH /groups/:groupId/members/:memberId returns 404 for a non-member', async () => {
    const member = await createMember();
    await request(app.getHttpServer())
      .patch(`/groups/${groupId}/members/${member.id}`)
      .send({ responsibility: 'PRIMARY' })
      .expect(404);
  });

  // 22. Remove membership
  it('DELETE /groups/:groupId/members/:memberId removes a membership', async () => {
    const member = await createMember();
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/members`)
      .send({ memberId: member.id })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/groups/${groupId}/members/${member.id}`)
      .expect(204);

    const response = await request(app.getHttpServer())
      .get(`/groups/${groupId}/members`)
      .expect(200);
    expect(
      response.body.map((m: { memberId: string }) => m.memberId),
    ).not.toContain(member.id);
  });

  it('DELETE /groups/:groupId/members/:memberId returns 404 for a non-member', async () => {
    const member = await createMember();
    await request(app.getHttpServer())
      .delete(`/groups/${groupId}/members/${member.id}`)
      .expect(404);
  });
});
