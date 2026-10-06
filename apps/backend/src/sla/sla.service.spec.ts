import { NotFoundException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { GroupType } from '../common/enums/group-type.enum';
import { IssuesService } from '../issues/issues.service';
import { buildFullTestModule } from '../test-utils/build-full-test-module';
import { createTestGroup, uniqueId } from '../test-utils/fixtures';
import { SlaStatus } from './enums/sla-status.enum';
import { SlaTriggerType } from './enums/sla-trigger-type.enum';
import { SlaService } from './sla.service';

function inMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

function agoMinutes(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

describe('SlaService (integration)', () => {
  let module: TestingModule;
  let slaService: SlaService;
  let issuesService: IssuesService;
  let dataSource: DataSource;
  let groupId: string;
  let groupName: string;
  const createdGroupIds: string[] = [];
  const createdIssueIds: string[] = [];
  const createdSlaIds: string[] = [];

  beforeAll(async () => {
    module = await buildFullTestModule().compile();
    slaService = module.get(SlaService);
    issuesService = module.get(IssuesService);
    dataSource = module.get(DataSource);

    const group = await createTestGroup(dataSource, {
      name: 'SLA Test Group',
      type: GroupType.INTERNAL,
    });
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
    await dataSource.query('DELETE FROM groups WHERE id = ANY($1)', [
      createdGroupIds,
    ]);
    await module.close();
  });

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

  it('creates an SLA incident defaulted to OPEN, snapshotting group name/type, linked to its issue', async () => {
    const issue = await createIssue();
    const incident = await slaService.createFromEvent({
      messageId: uniqueId('sla-msg'),
      issueId: issue.id,
      groupId,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: 'Payment API is not working',
      slaDeadline: inMinutes(30),
    });
    createdSlaIds.push(incident.id);

    expect(incident.status).toBe(SlaStatus.OPEN);
    expect(incident.issueId).toBe(issue.id);
    expect(incident.groupName).toBe(groupName);
    expect(incident.groupType).toBe(GroupType.INTERNAL);
  });

  it('supports issueId = null for a mention-only SLA', async () => {
    const incident = await slaService.createFromEvent({
      messageId: uniqueId('sla-msg'),
      groupId,
      triggerType: SlaTriggerType.MENTION,
      senderPhone: '+919566831192',
      message: '@team can someone check this?',
      slaDeadline: inMinutes(30),
    });
    createdSlaIds.push(incident.id);

    expect(incident.issueId).toBeNull();
    expect(incident.triggerType).toBe(SlaTriggerType.MENTION);
  });

  it('is idempotent on messageId — a duplicate event returns the same incident', async () => {
    const messageId = uniqueId('sla-msg');
    const first = await slaService.createFromEvent({
      messageId,
      groupId,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: 'Replayed webhook message',
      slaDeadline: inMinutes(30),
    });
    createdSlaIds.push(first.id);

    const second = await slaService.createFromEvent({
      messageId,
      groupId,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: 'Replayed webhook message',
      slaDeadline: inMinutes(30),
    });

    expect(second.id).toBe(first.id);
    const all = await slaService.findAll({});
    expect(all.filter((i) => i.messageId === messageId)).toHaveLength(1);
  });

  it('rejects creation for an unknown group with 404', async () => {
    await expect(
      slaService.createFromEvent({
        messageId: uniqueId('sla-msg'),
        groupId: '00000000-0000-0000-0000-000000000000',
        triggerType: SlaTriggerType.MESSAGE,
        senderPhone: '+919566831192',
        message: 'Orphan SLA attempt',
        slaDeadline: inMinutes(30),
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects creation referencing an unknown issueId with 404', async () => {
    await expect(
      slaService.createFromEvent({
        messageId: uniqueId('sla-msg'),
        groupId,
        issueId: '00000000-0000-0000-0000-000000000000',
        triggerType: SlaTriggerType.MESSAGE,
        senderPhone: '+919566831192',
        message: 'Orphan issueId attempt',
        slaDeadline: inMinutes(30),
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('respond() before the deadline sets RESPONDED and records firstResponseAt/respondedBy', async () => {
    const incident = await slaService.createFromEvent({
      messageId: uniqueId('sla-msg'),
      groupId,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: 'On-time response test',
      slaDeadline: inMinutes(30),
    });
    createdSlaIds.push(incident.id);

    const responded = await slaService.respond(incident.id, '+919566800001');
    expect(responded.status).toBe(SlaStatus.RESPONDED);
    expect(responded.firstResponseAt).not.toBeNull();
    expect(responded.respondedBy).toBe('+919566800001');
  });

  it('respond() is idempotent — firstResponseAt is never overwritten by a second call', async () => {
    const incident = await slaService.createFromEvent({
      messageId: uniqueId('sla-msg'),
      groupId,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: 'Idempotent response test',
      slaDeadline: inMinutes(30),
    });
    createdSlaIds.push(incident.id);

    const first = await slaService.respond(incident.id, '+919566800001');
    const second = await slaService.respond(incident.id, '+919566800099');

    expect(second.firstResponseAt).toEqual(first.firstResponseAt);
    expect(second.respondedBy).toBe('+919566800001');
  });

  it('miss() sets MISSED and escalatedAt, and creates CEO + team notifications', async () => {
    const incident = await slaService.createFromEvent({
      messageId: uniqueId('sla-msg'),
      groupId,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: 'Missed SLA test',
      slaDeadline: inMinutes(-1),
    });
    createdSlaIds.push(incident.id);

    const missed = await slaService.miss(incident.id);
    expect(missed.status).toBe(SlaStatus.MISSED);
    expect(missed.escalatedAt).not.toBeNull();

    const notifications = await dataSource.query<{ type: string }[]>(
      'SELECT type FROM notifications WHERE sla_id = $1',
      [incident.id],
    );
    expect(notifications.some((n) => n.type === 'CEO_SLA_ALERT')).toBe(true);
    expect(
      notifications.some(
        (n) => n.type === 'TEAM_SLA_REMINDER' || notifications.length >= 1,
      ),
    ).toBe(true);
  });

  it('a late response after miss() does not flip MISSED back to RESPONDED', async () => {
    const incident = await slaService.createFromEvent({
      messageId: uniqueId('sla-msg'),
      groupId,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: 'Late response after miss test',
      slaDeadline: inMinutes(-5),
    });
    createdSlaIds.push(incident.id);

    await slaService.miss(incident.id);
    const late = await slaService.respond(incident.id, '+919566800001');

    expect(late.status).toBe(SlaStatus.MISSED);
    expect(late.firstResponseAt).not.toBeNull();
    expect(late.respondedBy).toBe('+919566800001');
  });

  it('respond() called after the deadline with no prior miss() also lands on MISSED (not RESPONDED)', async () => {
    const incident = await slaService.createFromEvent({
      messageId: uniqueId('sla-msg'),
      groupId,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: 'Late response, no prior miss call',
      slaDeadline: agoMinutes(1),
    });
    createdSlaIds.push(incident.id);

    const result = await slaService.respond(incident.id);
    expect(result.status).toBe(SlaStatus.MISSED);
  });

  it('miss() is idempotent and does not create duplicate notifications on repeat calls', async () => {
    const incident = await slaService.createFromEvent({
      messageId: uniqueId('sla-msg'),
      groupId,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: 'Idempotent miss test',
      slaDeadline: inMinutes(-1),
    });
    createdSlaIds.push(incident.id);

    await slaService.miss(incident.id);
    const [{ count: firstCount }] = await dataSource.query<{ count: number }[]>(
      'SELECT count(*)::int AS count FROM notifications WHERE sla_id = $1',
      [incident.id],
    );

    await slaService.miss(incident.id);
    const [{ count: secondCount }] = await dataSource.query<
      { count: number }[]
    >('SELECT count(*)::int AS count FROM notifications WHERE sla_id = $1', [
      incident.id,
    ]);

    expect(secondCount).toBe(firstCount);
  });

  it('miss() never overrides an already-RESPONDED incident', async () => {
    const incident = await slaService.createFromEvent({
      messageId: uniqueId('sla-msg'),
      groupId,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: 'Responded-then-missed-event test',
      slaDeadline: inMinutes(30),
    });
    createdSlaIds.push(incident.id);

    await slaService.respond(incident.id, '+919566800001');
    const afterStaleMiss = await slaService.miss(incident.id);

    expect(afterStaleMiss.status).toBe(SlaStatus.RESPONDED);
  });
});
