import { TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { GroupType } from '../common/enums/group-type.enum';
import { IssuesService } from '../issues/issues.service';
import { SlaService } from '../sla/sla.service';
import { SlaTriggerType } from '../sla/enums/sla-trigger-type.enum';
import { buildFullTestModule } from '../test-utils/build-full-test-module';
import { createTestGroup, uniqueId } from '../test-utils/fixtures';
import { NotificationStatus } from './enums/notification-status.enum';
import { NotificationType } from './enums/notification-type.enum';
import { NotificationsService } from './notifications.service';

describe('NotificationsService (integration)', () => {
  let module: TestingModule;
  let notificationsService: NotificationsService;
  let issuesService: IssuesService;
  let slaService: SlaService;
  let dataSource: DataSource;
  let groupId: string;
  const createdGroupIds: string[] = [];
  const createdIssueIds: string[] = [];
  const createdSlaIds: string[] = [];
  const createdNotificationIds: string[] = [];

  beforeAll(async () => {
    module = await buildFullTestModule().compile();
    notificationsService = module.get(NotificationsService);
    issuesService = module.get(IssuesService);
    slaService = module.get(SlaService);
    dataSource = module.get(DataSource);

    const group = await createTestGroup(dataSource, {
      name: 'Notification Test Group',
      type: GroupType.INTERNAL,
    });
    groupId = group.id;
    createdGroupIds.push(group.id);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM notifications WHERE id = ANY($1)', [
      createdNotificationIds,
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

  it('creates a notification', async () => {
    const notification = await notificationsService.create({
      type: NotificationType.EOD_REMINDER,
      recipientPhone: '+919566831192',
      message: 'Please submit your EOD report.',
    });
    createdNotificationIds.push(notification.id);

    expect(notification.id).toBeDefined();
    expect(notification.status).toBe(NotificationStatus.PENDING);
  });

  it('an SLA-missed event can fan out into two notifications without duplicating the SLA incident', async () => {
    const issue = await issuesService.createFromEvent({
      messageId: uniqueId('msg'),
      groupId,
      senderPhone: '+919566831192',
      message: 'Payment API is not working',
    });
    createdIssueIds.push(issue.id);

    const incident = await slaService.createFromEvent({
      messageId: uniqueId('sla-msg'),
      issueId: issue.id,
      groupId,
      triggerType: SlaTriggerType.MESSAGE,
      senderPhone: '+919566831192',
      message: 'Payment API is not working',
      slaDeadline: new Date(),
    });
    createdSlaIds.push(incident.id);

    const teamNotification = await notificationsService.create({
      type: NotificationType.TEAM_SLA_REMINDER,
      recipientPhone: '+919566800001',
      message: 'SLA missed for: Payment API is not working',
      slaId: incident.id,
    });
    const ceoNotification = await notificationsService.create({
      type: NotificationType.CEO_SLA_ALERT,
      recipientPhone: '+919566800099',
      message: 'CEO alert: SLA missed for Payment API is not working',
      slaId: incident.id,
    });
    createdNotificationIds.push(teamNotification.id, ceoNotification.id);

    const forIncident = await notificationsService.findForSlaIncident(
      incident.id,
    );
    expect(forIncident).toHaveLength(2);

    // Exactly one SlaIncident row still exists for this message — the two
    // notifications did not create a second incident.
    const rows = await dataSource.query<{ count: number }[]>(
      'SELECT count(*)::int AS count FROM sla_incidents WHERE id = $1',
      [incident.id],
    );
    expect(rows[0].count).toBe(1);
  });
});
