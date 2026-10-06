import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  getBusinessTimeZone,
  getEodDeadline,
} from '../common/config/business-config.util';
import {
  getBusinessDayDeadline,
  toBusinessDateString,
} from '../common/date/business-day.util';
import { GroupType } from '../common/enums/group-type.enum';
import { GroupsService } from '../groups/groups.service';
import { buildFullTestModule } from '../test-utils/build-full-test-module';
import { createTestGroup, testPhone, uniqueId } from '../test-utils/fixtures';
import { TeamMembersService } from '../team-members/team-members.service';
import { EOD_PENDING } from './enums/eod-display-status';
import { EodStatus } from './enums/eod-status.enum';
import { EodService } from './eod.service';

/**
 * Shifts a YYYY-MM-DD date-only string by `days` (may be negative),
 * correctly across month/year boundaries. Used instead of hard-coded
 * calendar dates so these tests never depend on *when* they happen to
 * run — "yesterday" and "tomorrow" are always unambiguously before/after
 * today's deadline, whatever today actually is.
 */
function shiftDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

describe('EodService (integration)', () => {
  let module: TestingModule;
  let eodService: EodService;
  let groupsService: GroupsService;
  let teamMembersService: TeamMembersService;
  let dataSource: DataSource;
  let timeZone: string;
  let deadlineHhMm: string;
  let todayDate: string;
  let yesterdayDate: string;
  let tomorrowDate: string;

  let internalGroupId: string;
  let secondInternalGroupId: string;
  let clientGroupId: string;
  const createdGroupIds: string[] = [];
  const createdMemberIds: string[] = [];
  const createdReportIds: string[] = [];

  beforeAll(async () => {
    module = await buildFullTestModule().compile();
    eodService = module.get(EodService);
    groupsService = module.get(GroupsService);
    teamMembersService = module.get(TeamMembersService);
    dataSource = module.get(DataSource);

    const config = module.get(ConfigService);
    timeZone = getBusinessTimeZone(config);
    deadlineHhMm = getEodDeadline(config);
    todayDate = toBusinessDateString(new Date(), timeZone);
    yesterdayDate = shiftDateOnly(todayDate, -1);
    tomorrowDate = shiftDateOnly(todayDate, 1);

    const internalGroup = await createTestGroup(dataSource, {
      name: 'EOD Internal Group A',
      type: GroupType.INTERNAL,
    });
    internalGroupId = internalGroup.id;
    createdGroupIds.push(internalGroup.id);

    const secondInternalGroup = await createTestGroup(dataSource, {
      name: 'EOD Internal Group B',
      type: GroupType.INTERNAL,
    });
    secondInternalGroupId = secondInternalGroup.id;
    createdGroupIds.push(secondInternalGroup.id);

    const clientGroup = await createTestGroup(dataSource, {
      name: 'EOD Client Group',
      type: GroupType.CLIENT,
    });
    clientGroupId = clientGroup.id;
    createdGroupIds.push(clientGroup.id);
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
    await module.close();
  });

  async function createMemberInGroup(
    groupId: string,
    overrides: { active?: boolean; membershipActive?: boolean } = {},
  ) {
    const member = await teamMembersService.create({
      name: 'EOD Test Member',
      phone: testPhone(),
    });
    createdMemberIds.push(member.id);
    if (overrides.active === false) {
      await teamMembersService.update(member.id, { active: false });
    }
    await groupsService.addMember(groupId, {
      memberId: member.id,
      active: overrides.membershipActive ?? true,
    });
    return member;
  }

  function deadlineFor(date: string) {
    return getBusinessDayDeadline(date, timeZone, deadlineHhMm);
  }

  it('creates an ON_TIME report when submittedAt is before the business-day deadline', async () => {
    const member = await createMemberInGroup(internalGroupId);
    const submittedAt = new Date(
      deadlineFor(yesterdayDate).getTime() - 60 * 60_000,
    ); // 1h before deadline
    const report = await eodService.createFromEvent({
      memberId: member.id,
      groupId: internalGroupId,
      messageId: uniqueId('eod-msg'),
      reportContent: 'Fixed payment API issue',
      submittedAt,
    });
    createdReportIds.push(report.id);

    expect(report.status).toBe(EodStatus.ON_TIME);
    expect(report.reportDate).toBe(yesterdayDate);
    expect(report.reportContent).toBe('Fixed payment API issue');
  });

  it('creates a LATE report when submittedAt is after the business-day deadline', async () => {
    const member = await createMemberInGroup(internalGroupId);
    const submittedAt = new Date(
      deadlineFor(yesterdayDate).getTime() + 60 * 60_000,
    ); // 1h after deadline
    const report = await eodService.createFromEvent({
      memberId: member.id,
      groupId: internalGroupId,
      messageId: uniqueId('eod-msg'),
      reportContent: 'Submitted late',
      submittedAt,
    });
    createdReportIds.push(report.id);

    expect(report.status).toBe(EodStatus.LATE);
  });

  it('is idempotent on messageId', async () => {
    const member = await createMemberInGroup(internalGroupId);
    const messageId = uniqueId('eod-msg');
    const submittedAt = new Date(
      deadlineFor(yesterdayDate).getTime() - 60 * 60_000,
    );

    const first = await eodService.createFromEvent({
      memberId: member.id,
      groupId: internalGroupId,
      messageId,
      reportContent: 'First delivery',
      submittedAt,
    });
    createdReportIds.push(first.id);

    const second = await eodService.createFromEvent({
      memberId: member.id,
      groupId: internalGroupId,
      messageId,
      reportContent: 'First delivery',
      submittedAt,
    });
    expect(second.id).toBe(first.id);
  });

  it('is idempotent on (member, group, date) even with a different messageId', async () => {
    const member = await createMemberInGroup(internalGroupId);
    const submittedAt = new Date(
      deadlineFor(yesterdayDate).getTime() - 60 * 60_000,
    );

    const first = await eodService.createFromEvent({
      memberId: member.id,
      groupId: internalGroupId,
      messageId: uniqueId('eod-msg'),
      reportContent: 'Original submission',
      submittedAt,
    });
    createdReportIds.push(first.id);

    const second = await eodService.createFromEvent({
      memberId: member.id,
      groupId: internalGroupId,
      messageId: uniqueId('eod-msg'), // different message id, same day
      reportContent: 'Resubmission attempt',
      submittedAt,
    });

    expect(second.id).toBe(first.id);
    expect(second.reportContent).toBe('Original submission');
  });

  it('rejects submission for a CLIENT group', async () => {
    const member = await teamMembersService.create({
      name: 'Client Group Member',
      phone: testPhone(),
    });
    createdMemberIds.push(member.id);
    await groupsService.addMember(clientGroupId, { memberId: member.id });

    await expect(
      eodService.createFromEvent({
        memberId: member.id,
        groupId: clientGroupId,
        messageId: uniqueId('eod-msg'),
        reportContent: 'Should be rejected',
        submittedAt: new Date(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects submission from an inactive team member', async () => {
    const member = await createMemberInGroup(internalGroupId, {
      active: false,
    });
    await expect(
      eodService.createFromEvent({
        memberId: member.id,
        groupId: internalGroupId,
        messageId: uniqueId('eod-msg'),
        reportContent: 'Should be rejected',
        submittedAt: new Date(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects submission from a member not belonging to the group', async () => {
    const member = await teamMembersService.create({
      name: 'Unaffiliated Member',
      phone: testPhone(),
    });
    createdMemberIds.push(member.id);

    await expect(
      eodService.createFromEvent({
        memberId: member.id,
        groupId: internalGroupId,
        messageId: uniqueId('eod-msg'),
        reportContent: 'Should be rejected',
        submittedAt: new Date(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown member or unknown group', async () => {
    const member = await createMemberInGroup(internalGroupId);
    await expect(
      eodService.createFromEvent({
        memberId: '00000000-0000-0000-0000-000000000000',
        groupId: internalGroupId,
        messageId: uniqueId('eod-msg'),
        reportContent: 'Unknown member',
        submittedAt: new Date(),
      }),
    ).rejects.toThrow();

    await expect(
      eodService.createFromEvent({
        memberId: member.id,
        groupId: '00000000-0000-0000-0000-000000000000',
        messageId: uniqueId('eod-msg'),
        reportContent: 'Unknown group',
        submittedAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it('rejects whitespace-only report content and an empty messageId', async () => {
    const member = await createMemberInGroup(internalGroupId);
    await expect(
      eodService.createFromEvent({
        memberId: member.id,
        groupId: internalGroupId,
        messageId: uniqueId('eod-msg'),
        reportContent: '   ',
        submittedAt: new Date(),
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      eodService.createFromEvent({
        memberId: member.id,
        groupId: internalGroupId,
        messageId: '   ',
        reportContent: 'Valid content',
        submittedAt: new Date(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('a member with no submission is MISSING once the deadline has passed (yesterday)', async () => {
    const member = await createMemberInGroup(internalGroupId);
    const rows = await eodService.getDateStatus(yesterdayDate, {
      memberId: member.id,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(EodStatus.MISSING);
    expect(rows[0].missing).toBe(true);
    expect(rows[0].id).toBeNull();
  });

  it('a member with no submission is PENDING, not MISSING, before the deadline (tomorrow)', async () => {
    const member = await createMemberInGroup(internalGroupId);
    const rows = await eodService.getDateStatus(tomorrowDate, {
      memberId: member.id,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(EOD_PENDING);
    expect(rows[0].missing).toBe(false);
  });

  it('a member in two internal groups is counted once, not twice', async () => {
    const member = await teamMembersService.create({
      name: 'Dual Group Member',
      phone: testPhone(),
    });
    createdMemberIds.push(member.id);
    await groupsService.addMember(internalGroupId, { memberId: member.id });
    await groupsService.addMember(secondInternalGroupId, {
      memberId: member.id,
    });

    const rows = await eodService.getDateStatus(tomorrowDate, {
      memberId: member.id,
    });
    expect(rows).toHaveLength(1);
  });

  it('CLIENT group members are excluded from eligibility entirely', async () => {
    const member = await teamMembersService.create({
      name: 'Client Only Member',
      phone: testPhone(),
    });
    createdMemberIds.push(member.id);
    await groupsService.addMember(clientGroupId, { memberId: member.id });

    const rows = await eodService.getDateStatus(tomorrowDate, {
      memberId: member.id,
    });
    expect(rows).toHaveLength(0);
  });

  it('an inactive membership excludes the member from eligibility', async () => {
    const member = await createMemberInGroup(internalGroupId, {
      membershipActive: false,
    });
    const rows = await eodService.getDateStatus(tomorrowDate, {
      memberId: member.id,
    });
    expect(rows).toHaveLength(0);
  });

  it('summary: deadlinePassed is false before the deadline and true after it', async () => {
    const before = await eodService.summary({ date: tomorrowDate });
    expect(before.deadlinePassed).toBe(false);

    const after = await eodService.summary({ date: yesterdayDate });
    expect(after.deadlinePassed).toBe(true);
  });

  it('summary: counts and completionPercentage are computed correctly and scoped by group', async () => {
    const scopedGroup = await createTestGroup(dataSource, {
      name: 'EOD Summary Scoped Group',
      type: GroupType.INTERNAL,
    });
    createdGroupIds.push(scopedGroup.id);

    const onTimeMember = await createMemberInGroup(scopedGroup.id);
    const lateMember = await createMemberInGroup(scopedGroup.id);
    const missingMember = await createMemberInGroup(scopedGroup.id);
    void missingMember;

    const onTimeReport = await eodService.createFromEvent({
      memberId: onTimeMember.id,
      groupId: scopedGroup.id,
      messageId: uniqueId('eod-msg'),
      reportContent: 'On time',
      submittedAt: new Date(deadlineFor(yesterdayDate).getTime() - 60 * 60_000),
    });
    createdReportIds.push(onTimeReport.id);

    const lateReport = await eodService.createFromEvent({
      memberId: lateMember.id,
      groupId: scopedGroup.id,
      messageId: uniqueId('eod-msg'),
      reportContent: 'Late',
      submittedAt: new Date(deadlineFor(yesterdayDate).getTime() + 60 * 60_000),
    });
    createdReportIds.push(lateReport.id);

    const summary = await eodService.summary({
      date: yesterdayDate,
      groupId: scopedGroup.id,
    });
    expect(summary.totalMembers).toBe(3);
    expect(summary.onTime).toBe(1);
    expect(summary.late).toBe(1);
    expect(summary.missing).toBe(1);
    expect(summary.submitted).toBe(2);
    // 2 / 3 * 100 = 66.7
    expect(summary.completionPercentage).toBeCloseTo(66.7, 1);
  });

  it('summary: completionPercentage is 0 when totalMembers is 0', async () => {
    const emptyGroup = await createTestGroup(dataSource, {
      name: 'EOD Empty Group',
      type: GroupType.INTERNAL,
    });
    createdGroupIds.push(emptyGroup.id);

    const summary = await eodService.summary({
      date: tomorrowDate,
      groupId: emptyGroup.id,
    });
    expect(summary.totalMembers).toBe(0);
    expect(summary.completionPercentage).toBe(0);
  });

  it('findOne returns detail with reminders (empty, since nothing creates EOD_REMINDER notifications yet)', async () => {
    const member = await createMemberInGroup(internalGroupId);
    const report = await eodService.createFromEvent({
      memberId: member.id,
      groupId: internalGroupId,
      messageId: uniqueId('eod-msg'),
      reportContent: 'Detail fetch test',
      submittedAt: new Date(deadlineFor(yesterdayDate).getTime() - 60 * 60_000),
    });
    createdReportIds.push(report.id);

    const detail = await eodService.findOne(report.id);
    expect(detail.memberName).toBe('EOD Test Member');
    expect(detail.reminders).toEqual([]);
  });
});
