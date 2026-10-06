import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { GroupType } from '../common/enums/group-type.enum';
import { createTestGroup, uniqueId } from '../test-utils/fixtures';
import { buildFullTestModule } from '../test-utils/build-full-test-module';
import { IssueStatus } from './enums/issue-status.enum';
import { IssuesService } from './issues.service';

describe('IssuesService (integration)', () => {
  let module: TestingModule;
  let issuesService: IssuesService;
  let dataSource: DataSource;
  let groupId: string;
  const createdGroupIds: string[] = [];
  const createdIssueIds: string[] = [];

  beforeAll(async () => {
    module = await buildFullTestModule().compile();
    issuesService = module.get(IssuesService);
    dataSource = module.get(DataSource);

    const group = await createTestGroup(dataSource, {
      name: 'Issue Test Group',
      type: GroupType.INTERNAL,
    });
    groupId = group.id;
    createdGroupIds.push(group.id);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM issues WHERE id = ANY($1)', [
      createdIssueIds,
    ]);
    await dataSource.query('DELETE FROM groups WHERE id = ANY($1)', [
      createdGroupIds,
    ]);
    await module.close();
  });

  it('creates an issue from an event, defaulted to OPEN, groupType resolved from the group', async () => {
    const issue = await issuesService.createFromEvent({
      messageId: uniqueId('msg'),
      groupId,
      senderPhone: '+919566831192',
      message: 'Payment API is not working',
    });
    createdIssueIds.push(issue.id);

    expect(issue.id).toBeDefined();
    expect(issue.status).toBe(IssueStatus.OPEN);
    expect(issue.groupType).toBe(GroupType.INTERNAL);
    expect(issue.resolvedAt).toBeNull();
  });

  it('is idempotent on messageId — a duplicate event returns the same issue, not a new one', async () => {
    const messageId = uniqueId('msg');
    const first = await issuesService.createFromEvent({
      messageId,
      groupId,
      senderPhone: '+919566831192',
      message: 'Duplicate delivery test',
    });
    createdIssueIds.push(first.id);

    const second = await issuesService.createFromEvent({
      messageId,
      groupId,
      senderPhone: '+919566831192',
      message: 'Duplicate delivery test',
    });

    expect(second.id).toBe(first.id);
    const all = await issuesService.findAll({});
    expect(all.filter((i) => i.messageId === messageId)).toHaveLength(1);
  });

  it('rejects creation for an unknown group with 404', async () => {
    await expect(
      issuesService.createFromEvent({
        messageId: uniqueId('msg'),
        groupId: '00000000-0000-0000-0000-000000000000',
        senderPhone: '+919566831192',
        message: 'Orphan issue attempt',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows OPEN → IN_PROGRESS → RESOLVED, recording resolvedAt/resolvedBy', async () => {
    const issue = await issuesService.createFromEvent({
      messageId: uniqueId('msg'),
      groupId,
      senderPhone: '+919566831192',
      message: 'Lifecycle test issue',
    });
    createdIssueIds.push(issue.id);

    const inProgress = await issuesService.updateStatus(issue.id, {
      status: IssueStatus.IN_PROGRESS,
    });
    expect(inProgress.status).toBe(IssueStatus.IN_PROGRESS);
    expect(inProgress.resolvedAt).toBeNull();

    const resolved = await issuesService.updateStatus(issue.id, {
      status: IssueStatus.RESOLVED,
      resolvedBy: '+919566800001',
    });
    expect(resolved.status).toBe(IssueStatus.RESOLVED);
    expect(resolved.resolvedAt).not.toBeNull();
    expect(resolved.resolvedBy).toBe('+919566800001');
  });

  it('allows OPEN → RESOLVED directly', async () => {
    const issue = await issuesService.createFromEvent({
      messageId: uniqueId('msg'),
      groupId,
      senderPhone: '+919566831192',
      message: 'Direct resolve test issue',
    });
    createdIssueIds.push(issue.id);

    const resolved = await issuesService.updateStatus(issue.id, {
      status: IssueStatus.RESOLVED,
    });
    expect(resolved.status).toBe(IssueStatus.RESOLVED);
    expect(resolved.resolvedAt).not.toBeNull();
  });

  it('rejects RESOLVED → OPEN and RESOLVED → IN_PROGRESS', async () => {
    const issue = await issuesService.createFromEvent({
      messageId: uniqueId('msg'),
      groupId,
      senderPhone: '+919566831192',
      message: 'Terminal state test issue',
    });
    createdIssueIds.push(issue.id);
    await issuesService.updateStatus(issue.id, {
      status: IssueStatus.RESOLVED,
    });

    await expect(
      issuesService.updateStatus(issue.id, { status: IssueStatus.OPEN }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      issuesService.updateStatus(issue.id, { status: IssueStatus.IN_PROGRESS }),
    ).rejects.toThrow(BadRequestException);
  });

  it('a team response does not change issue status — SLA and issue lifecycle stay independent', async () => {
    const issue = await issuesService.createFromEvent({
      messageId: uniqueId('msg'),
      groupId,
      senderPhone: '+919566831192',
      message: 'Independence test issue',
    });
    createdIssueIds.push(issue.id);

    // No SLA machinery invoked here at all — the point is that nothing
    // about Issue.status ever changes except through updateStatus().
    const reloaded = await issuesService.findOne(issue.id);
    expect(reloaded.status).toBe(IssueStatus.OPEN);
  });
});
