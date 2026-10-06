import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { GroupType } from '../src/common/enums/group-type.enum';
import { bootstrapTestApp, uniqueId } from './utils/bootstrap-app';

describe('Keywords API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let groupId: string;
  const createdGroupIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    dataSource = app.get(DataSource);

    const group = await request(app.getHttpServer())
      .post('/groups')
      .send({
        whatsappGroupId: uniqueId('wa'),
        name: 'Keywords Test Group',
        type: GroupType.INTERNAL,
        slaMinutes: 30,
      })
      .expect(201);
    groupId = group.body.id;
    createdGroupIds.push(groupId);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM keywords WHERE group_id = ANY($1)', [
      createdGroupIds,
    ]);
    await dataSource.query('DELETE FROM groups WHERE id = ANY($1)', [
      createdGroupIds,
    ]);
    await app.close();
  });

  it('POST /groups/:groupId/keywords returns 404 for an unknown group', async () => {
    await request(app.getHttpServer())
      .post('/groups/00000000-0000-0000-0000-000000000000/keywords')
      .send({ keyword: 'payment' })
      .expect(404);
  });

  // 24. Add keyword + 25. Normalize keyword
  it('POST /groups/:groupId/keywords adds a keyword, normalized to lowercase/trimmed', async () => {
    const response = await request(app.getHttpServer())
      .post(`/groups/${groupId}/keywords`)
      .send({ keyword: '  Payment  ' })
      .expect(201);

    expect(response.body.keyword).toBe('payment');
    expect(response.body.active).toBe(true);
    expect(response.body.groupId).toBe(groupId);
  });

  it('POST /groups/:groupId/keywords rejects an empty keyword with 400', async () => {
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/keywords`)
      .send({ keyword: '   ' })
      .expect(400);
  });

  // 26. Reject duplicate active keyword
  it('POST /groups/:groupId/keywords rejects a duplicate active keyword with 409', async () => {
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/keywords`)
      .send({ keyword: 'urgent' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/keywords`)
      .send({ keyword: 'Urgent' })
      .expect(409);
  });

  // 23. List keywords
  it('GET /groups/:groupId/keywords lists keywords for a group', async () => {
    await request(app.getHttpServer())
      .post(`/groups/${groupId}/keywords`)
      .send({ keyword: 'error' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/groups/${groupId}/keywords`)
      .expect(200);
    expect(response.body.map((k: { keyword: string }) => k.keyword)).toContain(
      'error',
    );
  });

  // 27. Deactivate keyword
  it('PATCH /groups/:groupId/keywords/:keywordId deactivates a keyword', async () => {
    const created = await request(app.getHttpServer())
      .post(`/groups/${groupId}/keywords`)
      .send({ keyword: 'failed' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .patch(`/groups/${groupId}/keywords/${created.body.id}`)
      .send({ active: false })
      .expect(200);

    expect(response.body.active).toBe(false);
  });

  // 28. Re-add previously deactivated keyword
  it('re-adding a keyword after deactivating the previous one succeeds', async () => {
    const first = await request(app.getHttpServer())
      .post(`/groups/${groupId}/keywords`)
      .send({ keyword: 'down' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/groups/${groupId}/keywords/${first.body.id}`)
      .send({ active: false })
      .expect(200);

    const second = await request(app.getHttpServer())
      .post(`/groups/${groupId}/keywords`)
      .send({ keyword: 'down' })
      .expect(201);

    expect(second.body.id).not.toBe(first.body.id);
    expect(second.body.active).toBe(true);
  });

  it('DELETE /groups/:groupId/keywords/:keywordId deletes a keyword', async () => {
    const created = await request(app.getHttpServer())
      .post(`/groups/${groupId}/keywords`)
      .send({ keyword: 'deleteme' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/groups/${groupId}/keywords/${created.body.id}`)
      .expect(204);

    const response = await request(app.getHttpServer())
      .get(`/groups/${groupId}/keywords`)
      .expect(200);
    expect(
      response.body.find((k: { id: string }) => k.id === created.body.id),
    ).toBeUndefined();
  });
});
