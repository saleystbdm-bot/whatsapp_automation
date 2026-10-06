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
import { EodService } from '../src/eod/eod.service';
import { Group } from '../src/groups/entities/group.entity';
import { GroupsService } from '../src/groups/groups.service';
import { TeamMember } from '../src/team-members/entities/team-member.entity';
import { bootstrapTestApp, testPhone, uniqueId } from './utils/bootstrap-app';

function shiftDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

describe('EOD API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let eodService: EodService;
  let groupsService: GroupsService;
  let timeZone: string;
  let deadlineHhMm: string;
  let todayDate: string;
  let yesterdayDate: string;
  let tomorrowDate: string;
  let groupId: string;
  const createdGroupIds: string[] = [];
  const createdMemberIds: string[] = [];
  const createdReportIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    dataSource = app.get(DataSource);
    eodService = app.get(EodService);
    groupsService = app.get(GroupsService);

    const config = app.get(ConfigService);
    timeZone = getBusinessTimeZone(config);
    deadlineHhMm = getEodDeadline(config);
    todayDate = toBusinessDateString(new Date(), timeZone);
    yesterdayDate = shiftDateOnly(todayDate, -1);
    tomorrowDate = shiftDateOnly(todayDate, 1);

    const groupRepo = dataSource.getRepository(Group);
    const group = await groupRepo.save(
      groupRepo.create({
        whatsappGroupId: uniqueId('wa'),
        name: 'EOD E2E Internal Group',
        type: GroupType.INTERNAL,
        slaMinutes: 30,
        active: true,
      }),
    );
    groupId = group.id;
    createdGroupIds.push(group.id);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM eod_reports WHERE id = ANY($1)', [
      createdReportIds,
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

  function deadlineFor(date: string) {
    return getBusinessDayDeadline(date, timeZone, deadlineHhMm);
  }

  async function createMember() {
    const memberRepo = dataSource.getRepository(TeamMember);
    const member = await memberRepo.save(
      memberRepo.create({
        name: 'EOD E2E Member',
        phone: testPhone(),
        active: true,
      }),
    );
    createdMemberIds.push(member.id);
    await groupsService.addMember(groupId, { memberId: member.id });
    return member;
  }

  async function submitReport(
    memberId: string,
    submittedAt: Date,
    content = 'EOD report content',
  ) {
    const report = await eodService.createFromEvent({
      memberId,
      groupId,
      messageId: uniqueId('eod-msg'),
      reportContent: content,
      submittedAt,
    });
    createdReportIds.push(report.id);
    return report;
  }

  // 17. GET /eod filters
  it('GET /eod defaults to today and returns stable DTO fields (no raw entity leakage)', async () => {
    const response = await request(app.getHttpServer()).get('/eod').expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    if (response.body.length > 0) {
      const row = response.body[0];
      expect(Object.keys(row).sort()).toEqual(
        [
          'deadline',
          'groupId',
          'groupName',
          'id',
          'memberId',
          'memberName',
          'missing',
          'phone',
          'reportContent',
          'reportDate',
          'status',
          'submittedAt',
        ].sort(),
      );
    }
  });

  it('GET /eod?date=... filters by explicit business date', async () => {
    const member = await createMember();
    const report = await submitReport(
      member.id,
      new Date(deadlineFor(yesterdayDate).getTime() - 3_600_000),
    );

    const response = await request(app.getHttpServer())
      .get(`/eod?date=${yesterdayDate}`)
      .expect(200);
    const ids = response.body.map((r: { id: string | null }) => r.id);
    expect(ids).toContain(report.id);
  });

  it('GET /eod?groupId=... filters to that group', async () => {
    const otherGroupRepo = dataSource.getRepository(Group);
    const otherGroup = await otherGroupRepo.save(
      otherGroupRepo.create({
        whatsappGroupId: uniqueId('wa'),
        name: 'EOD Other Internal Group',
        type: GroupType.INTERNAL,
        slaMinutes: 30,
        active: true,
      }),
    );
    createdGroupIds.push(otherGroup.id);

    const response = await request(app.getHttpServer())
      .get(`/eod?date=${tomorrowDate}&groupId=${otherGroup.id}`)
      .expect(200);
    expect(response.body).toEqual([]);
  });

  it('GET /eod?memberId=... filters to that member', async () => {
    const member = await createMember();
    const response = await request(app.getHttpServer())
      .get(`/eod?date=${tomorrowDate}&memberId=${member.id}`)
      .expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].memberId).toBe(member.id);
  });

  it('GET /eod?status=MISSING and ?status=PENDING filter correctly', async () => {
    await createMember();

    const missingResponse = await request(app.getHttpServer())
      .get(`/eod?date=${yesterdayDate}&status=MISSING`)
      .expect(200);
    expect(
      missingResponse.body.every(
        (r: { status: string }) => r.status === 'MISSING',
      ),
    ).toBe(true);

    const pendingResponse = await request(app.getHttpServer())
      .get(`/eod?date=${tomorrowDate}&status=PENDING`)
      .expect(200);
    expect(
      pendingResponse.body.every(
        (r: { status: string }) => r.status === 'PENDING',
      ),
    ).toBe(true);
    expect(pendingResponse.body.length).toBeGreaterThan(0);
  });

  it('GET /eod?date=bad-format returns 400', async () => {
    await request(app.getHttpServer()).get('/eod?date=22-09-2026').expect(400);
  });

  // 18/19. Route disambiguation: GET /eod/:date vs GET /eod/:id vs GET /eod/summary
  it('GET /eod/:date (path param) returns the same shape as GET /eod?date=...', async () => {
    const response = await request(app.getHttpServer())
      .get(`/eod/${tomorrowDate}`)
      .expect(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('GET /eod/:id returns a single report with detail fields including reminders', async () => {
    const member = await createMember();
    const report = await submitReport(
      member.id,
      new Date(deadlineFor(yesterdayDate).getTime() - 3_600_000),
      'Detail route test',
    );

    const response = await request(app.getHttpServer())
      .get(`/eod/${report.id}`)
      .expect(200);
    expect(response.body.id).toBe(report.id);
    expect(response.body.reportContent).toBe('Detail route test');
    expect(Array.isArray(response.body.reminders)).toBe(true);
  });

  it('GET /eod/:id returns 404 for an unknown (but valid-shaped) UUID', async () => {
    await request(app.getHttpServer())
      .get('/eod/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /eod/not-a-date-or-uuid returns 400', async () => {
    await request(app.getHttpServer()).get('/eod/not-a-real-value').expect(400);
  });

  // 20/21/22/23/24. GET /eod/summary
  it('GET /eod/summary is not swallowed by the :param route and returns summary counts', async () => {
    const response = await request(app.getHttpServer())
      .get(`/eod/summary?date=${tomorrowDate}&groupId=${groupId}`)
      .expect(200);
    expect(response.body).toHaveProperty('totalMembers');
    expect(response.body).toHaveProperty('completionPercentage');
    // 23. deadlinePassed false before the deadline
    expect(response.body.deadlinePassed).toBe(false);
  });

  it('GET /eod/summary reflects deadlinePassed = true for a past date', async () => {
    const response = await request(app.getHttpServer())
      .get(`/eod/summary?date=${yesterdayDate}&groupId=${groupId}`)
      .expect(200);
    // 24. deadlinePassed true after deadline
    expect(response.body.deadlinePassed).toBe(true);
  });

  it('GET /eod/summary counts and completionPercentage are consistent with GET /eod', async () => {
    const scopedGroupRepo = dataSource.getRepository(Group);
    const scopedGroup = await scopedGroupRepo.save(
      scopedGroupRepo.create({
        whatsappGroupId: uniqueId('wa'),
        name: 'EOD Summary Consistency Group',
        type: GroupType.INTERNAL,
        slaMinutes: 30,
        active: true,
      }),
    );
    createdGroupIds.push(scopedGroup.id);

    const memberRepo = dataSource.getRepository(TeamMember);
    const onTimeMember = await memberRepo.save(
      memberRepo.create({
        name: 'Summary On Time',
        phone: testPhone(),
        active: true,
      }),
    );
    const missingMember = await memberRepo.save(
      memberRepo.create({
        name: 'Summary Missing',
        phone: testPhone(),
        active: true,
      }),
    );
    createdMemberIds.push(onTimeMember.id, missingMember.id);
    await groupsService.addMember(scopedGroup.id, {
      memberId: onTimeMember.id,
    });
    await groupsService.addMember(scopedGroup.id, {
      memberId: missingMember.id,
    });

    const report = await eodService.createFromEvent({
      memberId: onTimeMember.id,
      groupId: scopedGroup.id,
      messageId: uniqueId('eod-msg'),
      reportContent: 'On time submission',
      submittedAt: new Date(
        getBusinessDayDeadline(
          yesterdayDate,
          timeZone,
          deadlineHhMm,
        ).getTime() - 3_600_000,
      ),
    });
    createdReportIds.push(report.id);

    const summary = await request(app.getHttpServer())
      .get(`/eod/summary?date=${yesterdayDate}&groupId=${scopedGroup.id}`)
      .expect(200);
    expect(summary.body.totalMembers).toBe(2);
    expect(summary.body.submitted).toBe(1);
    expect(summary.body.onTime).toBe(1);
    expect(summary.body.missing).toBe(1);
    // 22. completion percentage: 1/2 * 100 = 50
    expect(summary.body.completionPercentage).toBe(50);
  });

  // 30. Swagger contains EOD endpoints
  it('Swagger document includes the EOD endpoints', async () => {
    const response = await request(app.getHttpServer())
      .get('/api-docs-json')
      .expect(200);
    const paths = Object.keys(response.body.paths);
    expect(paths).toContain('/eod');
    expect(paths).toContain('/eod/summary');
    expect(paths).toContain('/eod/{param}');
  });
});
