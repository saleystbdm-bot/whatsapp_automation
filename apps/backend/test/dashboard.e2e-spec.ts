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
import { IssuesService } from '../src/issues/issues.service';
import { SlaTriggerType } from '../src/sla/enums/sla-trigger-type.enum';
import { SlaService } from '../src/sla/sla.service';
import { TeamMember } from '../src/team-members/entities/team-member.entity';
import { bootstrapTestApp, testPhone, uniqueId } from './utils/bootstrap-app';

function shiftDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

describe('Dashboard API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let issuesService: IssuesService;
  let slaService: SlaService;
  let eodService: EodService;
  let groupsService: GroupsService;
  let timeZone: string;
  let deadlineHhMm: string;
  let todayDate: string;
  let yesterdayDate: string;
  let tomorrowDate: string;

  const createdGroupIds: string[] = [];
  const createdMemberIds: string[] = [];
  const createdIssueIds: string[] = [];
  const createdSlaIds: string[] = [];
  const createdEodIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    dataSource = app.get(DataSource);
    issuesService = app.get(IssuesService);
    slaService = app.get(SlaService);
    eodService = app.get(EodService);
    groupsService = app.get(GroupsService);

    const config = app.get(ConfigService);
    timeZone = getBusinessTimeZone(config);
    deadlineHhMm = getEodDeadline(config);
    todayDate = toBusinessDateString(new Date(), timeZone);
    yesterdayDate = shiftDateOnly(todayDate, -1);
    tomorrowDate = shiftDateOnly(todayDate, 1);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM notifications WHERE sla_id = ANY($1)', [
      createdSlaIds,
    ]);
    await dataSource.query('DELETE FROM eod_reports WHERE id = ANY($1)', [
      createdEodIds,
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

  function deadlineFor(date: string) {
    return getBusinessDayDeadline(date, timeZone, deadlineHhMm);
  }

  async function createGroup(type: GroupType, name: string, active = true) {
    const groupRepo = dataSource.getRepository(Group);
    const group = await groupRepo.save(
      groupRepo.create({
        whatsappGroupId: uniqueId('wa'),
        name,
        type,
        slaMinutes: 30,
        active,
      }),
    );
    createdGroupIds.push(group.id);
    return group;
  }

  async function createMember(name = 'Dashboard Test Member') {
    const memberRepo = dataSource.getRepository(TeamMember);
    const member = await memberRepo.save(
      memberRepo.create({ name, phone: testPhone(), active: true }),
    );
    createdMemberIds.push(member.id);
    return member;
  }

  async function createIssue(
    groupId: string,
    message = 'Payment API is not working',
  ) {
    const issue = await issuesService.createFromEvent({
      messageId: uniqueId('msg'),
      groupId,
      senderPhone: '+919566831192',
      message,
    });
    createdIssueIds.push(issue.id);
    return issue;
  }

  async function createSla(
    groupId: string,
    overrides: {
      issueId?: string | null;
      slaDeadline?: Date;
      message?: string;
      createdAt?: Date;
    } = {},
  ) {
    const incident = await slaService.createFromEvent({
      messageId: uniqueId('sla-msg'),
      groupId,
      issueId: overrides.issueId,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: overrides.message ?? 'Payment API is not working',
      slaDeadline: overrides.slaDeadline ?? new Date(Date.now() + 30 * 60_000),
      createdAt: overrides.createdAt,
    });
    createdSlaIds.push(incident.id);
    return incident;
  }

  // 1 / 24. Empty dashboard
  it('returns a valid empty-state structure for a group with no activity', async () => {
    const group = await createGroup(GroupType.INTERNAL, 'Empty Activity Group');

    const response = await request(app.getHttpServer())
      .get(`/dashboard?date=${tomorrowDate}`)
      .expect(200);
    expect(response.body.kpis.activeIssues).toBeGreaterThanOrEqual(0);
    expect(response.body.liveOperations).toEqual(expect.any(Array));
    expect(response.body.slaPerformance.total).toBeGreaterThanOrEqual(0);
    expect(response.body.eodSnapshot).toHaveProperty('totalMembers');
    const activity = response.body.groupActivity.find(
      (g: { groupId: string }) => g.groupId === group.id,
    );
    expect(activity).toMatchObject({
      issueCount: 0,
      activeIssueCount: 0,
      slaCount: 0,
      missedSlaCount: 0,
    });
  });

  // 2. dashboard with active issue
  it('counts an OPEN issue in activeIssues and includes it in liveOperations', async () => {
    const group = await createGroup(GroupType.INTERNAL, 'Active Issue Group');
    const issue = await createIssue(group.id, 'Zephyr active issue');

    const response = await request(app.getHttpServer())
      .get(`/dashboard?date=${todayDate}`)
      .expect(200);
    const liveOp = response.body.liveOperations.find(
      (op: { issueId: string }) => op.issueId === issue.id,
    );
    expect(liveOp).toBeDefined();
    expect(liveOp.issueStatus).toBe('OPEN');
    expect(liveOp.slaId).toBeNull();
    expect(liveOp.overdue).toBe(false);
  });

  // 3. resolved issue excluded
  it('excludes a RESOLVED issue from activeIssues and liveOperations', async () => {
    const group = await createGroup(GroupType.INTERNAL, 'Resolved Issue Group');
    const issue = await createIssue(group.id, 'Resolved dashboard issue');
    await request(app.getHttpServer())
      .patch(`/issues/${issue.id}`)
      .send({ status: 'RESOLVED' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/dashboard?date=${todayDate}`)
      .expect(200);
    expect(
      response.body.liveOperations.find(
        (op: { issueId: string }) => op.issueId === issue.id,
      ),
    ).toBeUndefined();

    const activity = response.body.groupActivity.find(
      (g: { groupId: string }) => g.groupId === group.id,
    );
    expect(activity.issueCount).toBe(1);
    expect(activity.activeIssueCount).toBe(0);
  });

  // 4/6. RESPONDED included in compliance, OPEN excluded
  it('SLA responded within deadline is included in compliance; an OPEN SLA is excluded', async () => {
    // Isolated date (see the "identical to SlaService.summary()" test
    // below for why): dashboard.slaPerformance is a *global*, date-scoped
    // figure (no groupId filter on GET /dashboard), so comparing it
    // against anything requires the whole business date to belong to
    // this test alone — otherwise concurrently-running spec files
    // touching "today" make the comparison meaningless, not just flaky.
    const isolatedDate = shiftDateOnly(todayDate, 46);
    const isolatedInstant = new Date(`${isolatedDate}T10:00:00.000Z`);

    const group = await createGroup(GroupType.INTERNAL, 'Compliance Group');
    const responded = await createSla(group.id, {
      message: 'Responded in time',
      createdAt: isolatedInstant,
      slaDeadline: new Date(isolatedInstant.getTime() + 30 * 60_000),
    });
    await slaService.respond(responded.id, '+919566800001');
    await createSla(group.id, {
      message: 'Still open',
      createdAt: isolatedInstant,
      slaDeadline: new Date(isolatedInstant.getTime() + 30 * 60_000),
    });

    const response = await request(app.getHttpServer())
      .get(`/dashboard?date=${isolatedDate}`)
      .expect(200);
    const activity = response.body.groupActivity.find(
      (g: { groupId: string }) => g.groupId === group.id,
    );
    expect(activity.slaCount).toBe(2);
    // compliance denominator is responded+missed only: 1 responded / (1 responded + 0 missed) = 100%,
    // and the OPEN incident must not appear in either bucket.
    expect(response.body.slaPerformance.responded).toBe(1);
    expect(response.body.slaPerformance.missed).toBe(0);
    expect(response.body.slaPerformance.open).toBe(1);
    expect(response.body.slaPerformance.compliancePercentage).toBe(100);
  });

  // 5/8. MISSED included in missed; late response after miss stays MISSED
  it('a missed SLA counts toward slaMissed, and a late response afterward does not undo it', async () => {
    const group = await createGroup(GroupType.INTERNAL, 'Missed SLA Group');
    const incident = await createSla(group.id, {
      slaDeadline: new Date(Date.now() - 60_000),
      message: 'Missed one',
    });
    await slaService.miss(incident.id);
    await slaService.respond(incident.id, '+919566800001'); // late response

    const response = await request(app.getHttpServer())
      .get(`/dashboard?date=${todayDate}`)
      .expect(200);
    const activity = response.body.groupActivity.find(
      (g: { groupId: string }) => g.groupId === group.id,
    );
    expect(activity.missedSlaCount).toBe(1);
    expect(response.body.kpis.slaMissed).toBeGreaterThanOrEqual(1);

    const liveOp = response.body.liveOperations.find(
      (op: { slaId: string }) => op.slaId === incident.id,
    );
    // no issue behind this mention-only SLA, so it shouldn't appear in liveOperations at all
    expect(liveOp).toBeUndefined();
  });

  // 7. SLA summary matches SlaService exactly
  it('dashboard slaPerformance is identical to SlaService.summary() for the same scope', async () => {
    // A date far enough from today/yesterday/tomorrow that no other e2e
    // spec file (which all default to "now") can concurrently pollute
    // it — otherwise this comparison would race against other Jest
    // worker processes touching "today"'s data at the same time.
    const isolatedDate = shiftDateOnly(todayDate, 45);
    const isolatedInstant = new Date(`${isolatedDate}T10:00:00.000Z`);

    const group = await createGroup(GroupType.INTERNAL, 'Summary Parity Group');
    await createSla(group.id, {
      createdAt: isolatedInstant,
      slaDeadline: new Date(isolatedInstant.getTime() + 30 * 60_000),
    });

    const response = await request(app.getHttpServer())
      .get(`/dashboard?date=${isolatedDate}`)
      .expect(200);
    const direct = await slaService.summary({ date: isolatedDate });
    expect(response.body.slaPerformance.total).toBe(direct.total);
    expect(response.body.slaPerformance.responded).toBe(direct.responded);
    expect(response.body.slaPerformance.missed).toBe(direct.missed);
    expect(response.body.slaPerformance.compliancePercentage).toBe(
      direct.compliancePercentage,
    );
    expect(response.body.slaPerformance.averageResponseMinutes).toBe(
      direct.averageResponseMinutes,
    );
  });

  // 9/11/25. Group activity across multiple, mixed-type groups
  it('group activity is correct and isolated per group, across INTERNAL and CLIENT types', async () => {
    const internalGroup = await createGroup(
      GroupType.INTERNAL,
      'Multi Internal Group',
    );
    const clientGroup = await createGroup(
      GroupType.CLIENT,
      'Multi Client Group',
    );
    await createIssue(internalGroup.id, 'Internal group issue');
    await createIssue(clientGroup.id, 'Client group issue A');
    await createIssue(clientGroup.id, 'Client group issue B');

    const response = await request(app.getHttpServer())
      .get(`/dashboard?date=${todayDate}`)
      .expect(200);
    const internalActivity = response.body.groupActivity.find(
      (g: { groupId: string }) => g.groupId === internalGroup.id,
    );
    const clientActivity = response.body.groupActivity.find(
      (g: { groupId: string }) => g.groupId === clientGroup.id,
    );

    expect(internalActivity.groupType).toBe('INTERNAL');
    expect(internalActivity.issueCount).toBe(1);
    expect(clientActivity.groupType).toBe('CLIENT');
    expect(clientActivity.issueCount).toBe(2);
  });

  // 10. monitored vs non-monitored
  it('a non-monitored (active=false) group is excluded from groupActivity', async () => {
    const unmonitored = await createGroup(
      GroupType.INTERNAL,
      'Unmonitored Group',
      false,
    );
    const response = await request(app.getHttpServer())
      .get(`/dashboard?date=${todayDate}`)
      .expect(200);
    expect(
      response.body.groupActivity.find(
        (g: { groupId: string }) => g.groupId === unmonitored.id,
      ),
    ).toBeUndefined();
  });

  // 12/13/14/15/16. EOD snapshot parity with EodService
  it('eodSnapshot matches EodService.summary() exactly (submitted/late/missing/deadline/completion)', async () => {
    // Isolated date, same reasoning as the SLA parity tests above:
    // GET /dashboard's eodSnapshot is global (no groupId filter) and
    // deadlinePassed=true, so it must be a date no other concurrently
    // running e2e spec file (or EOD test above, which uses
    // yesterday/tomorrow) touches.
    const isolatedDate = shiftDateOnly(todayDate, -47);

    const group = await createGroup(GroupType.INTERNAL, 'EOD Parity Group');
    const onTimeMember = await createMember('EOD On Time');
    const lateMember = await createMember('EOD Late');
    const missingMember = await createMember('EOD Missing');
    void missingMember;
    await groupsService.addMember(group.id, { memberId: onTimeMember.id });
    await groupsService.addMember(group.id, { memberId: lateMember.id });
    await groupsService.addMember(group.id, { memberId: missingMember.id });

    const onTimeReport = await eodService.createFromEvent({
      memberId: onTimeMember.id,
      groupId: group.id,
      messageId: uniqueId('eod-msg'),
      reportContent: 'On time EOD',
      submittedAt: new Date(deadlineFor(isolatedDate).getTime() - 3_600_000),
    });
    createdEodIds.push(onTimeReport.id);

    const lateReport = await eodService.createFromEvent({
      memberId: lateMember.id,
      groupId: group.id,
      messageId: uniqueId('eod-msg'),
      reportContent: 'Late EOD',
      submittedAt: new Date(deadlineFor(isolatedDate).getTime() + 3_600_000),
    });
    createdEodIds.push(lateReport.id);

    const response = await request(app.getHttpServer())
      .get(`/dashboard?date=${isolatedDate}`)
      .expect(200);
    const direct = await eodService.summary({ date: isolatedDate });

    expect(response.body.eodSnapshot).toEqual(
      JSON.parse(JSON.stringify(direct)),
    );
    expect(response.body.kpis.eodSubmitted).toBe(direct.submitted);
    expect(response.body.kpis.eodTotalMembers).toBe(direct.totalMembers);
  });

  // 17. dashboard date filter
  it('GET /dashboard?date=... scopes issues/SLA to that business date only', async () => {
    const group = await createGroup(GroupType.INTERNAL, 'Date Scoping Group');
    const yesterdayIssue = await issuesService.createFromEvent({
      messageId: uniqueId('msg'),
      groupId: group.id,
      senderPhone: '+919566831192',
      message: 'Yesterday scoped issue',
      createdAt: new Date(deadlineFor(yesterdayDate).getTime() - 60_000),
    });
    createdIssueIds.push(yesterdayIssue.id);
    const todayIssue = await createIssue(group.id, 'Today scoped issue');

    const yesterdayResponse = await request(app.getHttpServer())
      .get(`/dashboard?date=${yesterdayDate}`)
      .expect(200);
    const yesterdayActivity = yesterdayResponse.body.groupActivity.find(
      (g: { groupId: string }) => g.groupId === group.id,
    );
    expect(yesterdayActivity.issueCount).toBe(1);

    const todayResponse = await request(app.getHttpServer())
      .get(`/dashboard?date=${todayDate}`)
      .expect(200);
    const todayActivity = todayResponse.body.groupActivity.find(
      (g: { groupId: string }) => g.groupId === group.id,
    );
    expect(todayActivity.issueCount).toBe(1);
    expect(
      todayResponse.body.liveOperations.map(
        (op: { issueId: string }) => op.issueId,
      ),
    ).toContain(todayIssue.id);
  });

  // 18. malformed date
  it('GET /dashboard?date=bad-format returns 400', async () => {
    await request(app.getHttpServer())
      .get('/dashboard?date=22-09-2026')
      .expect(400);
  });

  // 19. business timezone boundary (defaults to today via BUSINESS_TIMEZONE, not server/UTC)
  it('GET /dashboard with no date defaults to the current business date, not a UTC date', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .expect(200);
    expect(response.body.date).toBe(todayDate);
  });

  // 20. no duplicate counting from joins — one issue with three team members is still 1 issue
  it('an issue in a group with three team members is counted once, not three times', async () => {
    const group = await createGroup(GroupType.INTERNAL, 'Triple Member Group');
    const memberA = await createMember('Member A');
    const memberB = await createMember('Member B');
    const memberC = await createMember('Member C');
    await groupsService.addMember(group.id, { memberId: memberA.id });
    await groupsService.addMember(group.id, { memberId: memberB.id });
    await groupsService.addMember(group.id, { memberId: memberC.id });

    await createIssue(group.id, 'Single issue, three members');

    const response = await request(app.getHttpServer())
      .get(`/dashboard?date=${todayDate}`)
      .expect(200);
    const activity = response.body.groupActivity.find(
      (g: { groupId: string }) => g.groupId === group.id,
    );
    expect(activity.issueCount).toBe(1);
    expect(activity.memberCount).toBe(3);
  });

  // 21. issue OPEN + SLA RESPONDED remains valid (SLA responded != issue resolved)
  it('an issue stays OPEN even though its linked SLA is RESPONDED', async () => {
    const group = await createGroup(GroupType.INTERNAL, 'Independence Group');
    const issue = await createIssue(group.id, 'Independence issue');
    const incident = await createSla(group.id, {
      issueId: issue.id,
      message: 'Independence issue',
    });
    await slaService.respond(incident.id, '+919566800001');

    const response = await request(app.getHttpServer())
      .get(`/dashboard?date=${todayDate}`)
      .expect(200);
    const liveOp = response.body.liveOperations.find(
      (op: { issueId: string }) => op.issueId === issue.id,
    );
    expect(liveOp.issueStatus).toBe('OPEN');
    expect(liveOp.slaStatus).toBe('RESPONDED');
    expect(liveOp.overdue).toBe(false);
  });

  // 22. no raw entity leakage
  it('response contains only the documented stable fields, no raw entity leakage', async () => {
    const response = await request(app.getHttpServer())
      .get(`/dashboard?date=${todayDate}`)
      .expect(200);
    expect(Object.keys(response.body).sort()).toEqual(
      [
        'date',
        'eodSnapshot',
        'groupActivity',
        'kpis',
        'liveOperations',
        'slaPerformance',
      ].sort(),
    );
    expect(Object.keys(response.body.kpis).sort()).toEqual(
      [
        'activeIssues',
        'slaCompliancePercentage',
        'slaMissed',
        'eodSubmitted',
        'eodTotalMembers',
      ].sort(),
    );
  });

  // 23. Swagger endpoint
  it('Swagger document includes GET /dashboard', async () => {
    const response = await request(app.getHttpServer())
      .get('/api-docs-json')
      .expect(200);
    expect(Object.keys(response.body.paths)).toContain('/dashboard');
    expect(response.body.paths['/dashboard']).toHaveProperty('get');
  });
});
