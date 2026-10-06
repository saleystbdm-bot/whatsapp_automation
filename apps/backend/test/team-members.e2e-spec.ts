import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { GroupType } from '../src/common/enums/group-type.enum';
import { EodReport } from '../src/eod/entities/eod-report.entity';
import { EodStatus } from '../src/eod/enums/eod-status.enum';
import { Group } from '../src/groups/entities/group.entity';
import { bootstrapTestApp, testPhone, uniqueId } from './utils/bootstrap-app';

describe('Team Members API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const createdMemberIds: string[] = [];
  const createdGroupIds: string[] = [];
  const createdReportIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (createdReportIds.length > 0) {
      await dataSource.query('DELETE FROM eod_reports WHERE id = ANY($1)', [
        createdReportIds,
      ]);
    }
    if (createdMemberIds.length > 0) {
      await dataSource.query('DELETE FROM team_members WHERE id = ANY($1)', [
        createdMemberIds,
      ]);
    }
    if (createdGroupIds.length > 0) {
      await dataSource.query('DELETE FROM groups WHERE id = ANY($1)', [
        createdGroupIds,
      ]);
    }
    await app.close();
  });

  async function createMember(
    overrides: Partial<{ name: string; role: string }> = {},
  ) {
    const response = await request(app.getHttpServer())
      .post('/team-members')
      .send({
        name: overrides.name ?? 'Test Member',
        phone: testPhone(),
        role: overrides.role,
      })
      .expect(201);
    createdMemberIds.push(response.body.id);
    return response.body;
  }

  // 14. POST team member
  it('POST /team-members creates a team member, active by default', async () => {
    const phone = testPhone();
    const response = await request(app.getHttpServer())
      .post('/team-members')
      .send({ name: 'Harish', phone, role: 'Developer' })
      .expect(201);
    createdMemberIds.push(response.body.id);

    expect(response.body).toMatchObject({
      name: 'Harish',
      phone,
      role: 'Developer',
      active: true,
    });
    expect(response.body.id).toBeDefined();
  });

  it('POST /team-members rejects a phone that is not E.164 with 400', async () => {
    await request(app.getHttpServer())
      .post('/team-members')
      .send({ name: 'Bad Phone', phone: '919566831192' })
      .expect(400);
  });

  it('POST /team-members rejects a missing name with 400', async () => {
    await request(app.getHttpServer())
      .post('/team-members')
      .send({ phone: testPhone() })
      .expect(400);
  });

  // 15. Reject duplicate phone
  it('POST /team-members rejects a duplicate phone with 409', async () => {
    const member = await createMember();
    await request(app.getHttpServer())
      .post('/team-members')
      .send({ name: 'Someone Else', phone: member.phone })
      .expect(409);
  });

  // 12. GET team members
  it('GET /team-members returns a list', async () => {
    await createMember();
    const response = await request(app.getHttpServer())
      .get('/team-members')
      .expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  // 13. GET team member
  it('GET /team-members/:id returns a single team member', async () => {
    const member = await createMember({ name: 'Single Fetch Member' });
    const response = await request(app.getHttpServer())
      .get(`/team-members/${member.id}`)
      .expect(200);
    expect(response.body.name).toBe('Single Fetch Member');
  });

  it('GET /team-members/:id returns 404 for an unknown id', async () => {
    await request(app.getHttpServer())
      .get('/team-members/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  // 16. PATCH team member
  it('PATCH /team-members/:id updates name/role', async () => {
    const member = await createMember();
    const response = await request(app.getHttpServer())
      .patch(`/team-members/${member.id}`)
      .send({ name: 'Renamed Member', role: 'Lead' })
      .expect(200);
    expect(response.body.name).toBe('Renamed Member');
    expect(response.body.role).toBe('Lead');
  });

  it('PATCH /team-members/:id rejects changing phone to one already in use with 409', async () => {
    const memberA = await createMember();
    const memberB = await createMember();
    await request(app.getHttpServer())
      .patch(`/team-members/${memberB.id}`)
      .send({ phone: memberA.phone })
      .expect(409);
  });

  // 17. Disable team member
  it('PATCH /team-members/:id { active: false } disables a team member', async () => {
    const member = await createMember();
    const response = await request(app.getHttpServer())
      .patch(`/team-members/${member.id}`)
      .send({ active: false })
      .expect(200);
    expect(response.body.active).toBe(false);
  });

  // 32. Filter team members
  it('GET /team-members?active=false filters by active status', async () => {
    const inactive = await createMember();
    await request(app.getHttpServer())
      .patch(`/team-members/${inactive.id}`)
      .send({ active: false })
      .expect(200);
    const active = await createMember();

    const response = await request(app.getHttpServer())
      .get('/team-members?active=false')
      .expect(200);
    const ids = response.body.map((m: { id: string }) => m.id);
    expect(ids).toContain(inactive.id);
    expect(ids).not.toContain(active.id);
  });

  it('GET /team-members?search=... matches by name or phone', async () => {
    const member = await createMember({ name: 'Zephyr Team Search Target' });

    const byName = await request(app.getHttpServer())
      .get('/team-members?search=zephyr')
      .expect(200);
    expect(byName.body.map((m: { id: string }) => m.id)).toContain(member.id);

    const byPhone = await request(app.getHttpServer())
      .get(`/team-members?search=${encodeURIComponent(member.phone.slice(-6))}`)
      .expect(200);
    expect(byPhone.body.map((m: { id: string }) => m.id)).toContain(member.id);
  });

  it('DELETE /team-members/:id deletes a member with no historical records', async () => {
    const member = await createMember();
    await request(app.getHttpServer())
      .delete(`/team-members/${member.id}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/team-members/${member.id}`)
      .expect(404);
  });

  // 18. Reject deletion when historical records exist
  it('DELETE /team-members/:id returns 409 when the member has historical EOD reports', async () => {
    const member = await createMember();

    const groupRepo = dataSource.getRepository(Group);
    const group = await groupRepo.save(
      groupRepo.create({
        whatsappGroupId: uniqueId('wa'),
        name: 'EOD History Group',
        type: GroupType.INTERNAL,
        slaMinutes: 30,
        active: true,
      }),
    );
    createdGroupIds.push(group.id);

    const eodRepo = dataSource.getRepository(EodReport);
    const report = await eodRepo.save(
      eodRepo.create({
        memberId: member.id,
        groupId: group.id,
        reportDate: '2026-09-22',
        status: EodStatus.ON_TIME,
        submittedAt: new Date(),
        reportContent: 'Historical report blocking deletion',
      }),
    );
    createdReportIds.push(report.id);

    await request(app.getHttpServer())
      .delete(`/team-members/${member.id}`)
      .expect(409);
    await request(app.getHttpServer())
      .get(`/team-members/${member.id}`)
      .expect(200);
  });
});
