import { getBusinessDayDeadline, toBusinessDateString } from '../../common/date/business-day.util';
import { GroupType } from '../../common/enums/group-type.enum';
import { EodReport } from '../../eod/entities/eod-report.entity';
import { EodStatus } from '../../eod/enums/eod-status.enum';
import { GroupMember } from '../../groups/entities/group-member.entity';
import { Group } from '../../groups/entities/group.entity';
import { Issue } from '../../issues/entities/issue.entity';
import { IssueStatus } from '../../issues/enums/issue-status.enum';
import { Notification } from '../../notifications/entities/notification.entity';
import { NotificationStatus } from '../../notifications/enums/notification-status.enum';
import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { SlaIncident } from '../../sla/entities/sla-incident.entity';
import { SlaStatus } from '../../sla/enums/sla-status.enum';
import { SlaTriggerType } from '../../sla/enums/sla-trigger-type.enum';
import { TeamMember } from '../../team-members/entities/team-member.entity';
import AppDataSource from '../data-source';

/**
 * Demo data for showcasing the dashboard. Adds realistic issues, SLA
 * incidents, notifications and EOD reports relative to *now*, so the
 * "today" views are populated. Run with `npm run seed:demo`.
 *
 * Idempotent: every demo row uses a `demo-` message id, and re-running
 * skips anything already present. Existing real data is never modified.
 * Not run by migrations or app bootstrap.
 */
const MIN = 60_000;

async function seedDemo() {
  const ds = await AppDataSource.initialize();
  const now = Date.now();
  const timeZone = process.env.BUSINESS_TIMEZONE ?? 'Asia/Kolkata';
  const deadlineHhMm = process.env.EOD_DEADLINE ?? '19:00';
  const ceoPhone = process.env.CEO_PHONE_NUMBER ?? '+10000000000';

  const members = ds.getRepository(TeamMember);
  const groups = ds.getRepository(Group);
  const groupMembers = ds.getRepository(GroupMember);
  const issues = ds.getRepository(Issue);
  const slas = ds.getRepository(SlaIncident);
  const eods = ds.getRepository(EodReport);
  const notifications = ds.getRepository(Notification);

  async function member(name: string, phone: string) {
    return (await members.findOneBy({ phone })) ?? members.save(members.create({ name, phone, role: 'Engineer', active: true }));
  }
  async function group(whatsappGroupId: string, name: string, type: GroupType, slaMinutes: number) {
    return (await groups.findOneBy({ whatsappGroupId })) ?? groups.save(groups.create({ whatsappGroupId, name, type, slaMinutes, active: true }));
  }
  async function membership(groupId: string, memberId: string, responsibility: string) {
    if (await groupMembers.findOneBy({ groupId, memberId })) return;
    await groupMembers.save(groupMembers.create({ groupId, memberId, responsibility, active: true }));
  }

  const harish = await member('Harish', '+919566800001');
  const aakash = await member('Aakash', '+919566800002');
  const raj = await member('Raj', '+919566800003');
  const kiran = await member('Kiran', '+919566800004');
  const priya = await member('Priya', '+919566800005');

  const internal = await group('120363414558473367@g.us', 'Test Whatsapp Automation', GroupType.INTERNAL, 30);
  const support = await group('120363414558473368@g.us', 'Client Support', GroupType.CLIENT, 30);
  const acme = await group('120363500000000001@g.us', 'Acme Corp Support', GroupType.CLIENT, 15);
  const sales = await group('120363500000000002@g.us', 'Sales & Ops', GroupType.INTERNAL, 30);

  await membership(internal.id, harish.id, 'PRIMARY');
  await membership(internal.id, raj.id, 'SECONDARY');
  await membership(internal.id, kiran.id, 'SECONDARY');
  await membership(support.id, aakash.id, 'PRIMARY');
  await membership(acme.id, aakash.id, 'PRIMARY');
  await membership(acme.id, priya.id, 'SECONDARY');
  await membership(sales.id, priya.id, 'PRIMARY');
  await membership(sales.id, harish.id, 'SECONDARY');

  const phoneOf = { harish: harish.phone, aakash: aakash.phone, raj: raj.phone, kiran: kiran.phone, priya: priya.phone };

  // ---- Issues + SLA incidents -------------------------------------------
  async function addIssue(opts: {
    key: string; group: Group; sender: string; message: string; status: IssueStatus;
    createdAgoMin: number; resolvedAgoMin?: number; resolvedBy?: string;
  }): Promise<Issue> {
    const messageId = `demo-${opts.key}`;
    const existing = await issues.findOneBy({ messageId });
    if (existing) return existing;
    const createdAt = new Date(now - opts.createdAgoMin * MIN);
    return issues.save(issues.create({
      messageId, groupId: opts.group.id, groupType: opts.group.type, senderPhone: opts.sender,
      message: opts.message, status: opts.status, createdAt,
      resolvedAt: opts.resolvedAgoMin !== undefined ? new Date(now - opts.resolvedAgoMin * MIN) : null,
      resolvedBy: opts.resolvedBy ?? null,
    }));
  }

  async function addSla(opts: {
    key: string; issue: Issue | null; group: Group; trigger: SlaTriggerType; sender: string; message: string;
    status: SlaStatus; createdAgoMin: number; respondedAgoMin?: number; respondedBy?: string; missedAgoMin?: number;
  }): Promise<SlaIncident> {
    const messageId = `demo-${opts.key}`;
    const existing = await slas.findOneBy({ messageId });
    if (existing) return existing;
    const createdAt = new Date(now - opts.createdAgoMin * MIN);
    return slas.save(slas.create({
      messageId, issueId: opts.issue?.id ?? null, groupId: opts.group.id, groupName: opts.group.name,
      groupType: opts.group.type, triggerType: opts.trigger, senderPhone: opts.sender, message: opts.message,
      status: opts.status, createdAt,
      slaDeadline: new Date(createdAt.getTime() + opts.group.slaMinutes * MIN),
      firstResponseAt: opts.respondedAgoMin !== undefined ? new Date(now - opts.respondedAgoMin * MIN) : null,
      respondedBy: opts.respondedBy ?? null,
      escalatedAt: opts.missedAgoMin !== undefined ? new Date(now - opts.missedAgoMin * MIN) : null,
    }));
  }

  // Missed SLA: one CEO alert + one team reminder per active responsible member
  const payment = await addIssue({ key: 'payment-500', group: internal, sender: phoneOf.raj, message: 'Payment gateway returning 500 errors on checkout', status: IssueStatus.OPEN, createdAgoMin: 40 });
  const paymentSla = await addSla({ key: 'payment-500', issue: payment, group: internal, trigger: SlaTriggerType.MESSAGE, sender: phoneOf.raj, message: payment.message, status: SlaStatus.MISSED, createdAgoMin: 40, missedAgoMin: 10 });
  const existingCeo = await notifications.findOneBy({ slaId: paymentSla.id, type: NotificationType.CEO_SLA_ALERT });
  if (!existingCeo) {
    const summary = `SLA missed in ${internal.name}: ${payment.message}`;
    await notifications.save(notifications.create({ type: NotificationType.CEO_SLA_ALERT, recipientPhone: ceoPhone, message: summary, slaId: paymentSla.id, issueId: payment.id, status: NotificationStatus.SENT, sentAt: new Date(now - 9 * MIN) }));
    for (const phone of [harish.phone, raj.phone]) {
      await notifications.save(notifications.create({ type: NotificationType.TEAM_SLA_REMINDER, recipientPhone: phone, message: summary, slaId: paymentSla.id, issueId: payment.id, status: NotificationStatus.PENDING }));
    }
  }

  const login = await addIssue({ key: 'portal-login', group: acme, sender: '+919800000011', message: 'Customer portal login failing with invalid token', status: IssueStatus.IN_PROGRESS, createdAgoMin: 12 });
  await addSla({ key: 'portal-login', issue: login, group: acme, trigger: SlaTriggerType.MESSAGE, sender: '+919800000011', message: login.message, status: SlaStatus.OPEN, createdAgoMin: 12 });

  const invoice = await addIssue({ key: 'invoice-pdf', group: support, sender: '+919800000012', message: 'Invoice PDF is blank for March statements', status: IssueStatus.RESOLVED, createdAgoMin: 190, resolvedAgoMin: 120, resolvedBy: aakash.phone });
  await addSla({ key: 'invoice-pdf', issue: invoice, group: support, trigger: SlaTriggerType.MESSAGE, sender: '+919800000012', message: invoice.message, status: SlaStatus.RESPONDED, createdAgoMin: 190, respondedAgoMin: 175, respondedBy: aakash.phone });

  const deploy = await addIssue({ key: 'staging-deploy', group: internal, sender: phoneOf.harish, message: 'Staging deploy failed on the migration step', status: IssueStatus.OPEN, createdAgoMin: 50 });
  await addSla({ key: 'staging-deploy', issue: deploy, group: internal, trigger: SlaTriggerType.MESSAGE, sender: phoneOf.harish, message: deploy.message, status: SlaStatus.RESPONDED, createdAgoMin: 50, respondedAgoMin: 40, respondedBy: raj.phone });

  const dbTimeout = await addIssue({ key: 'db-timeout', group: acme, sender: '+919800000013', message: 'Urgent: database connection timeouts from the order service', status: IssueStatus.OPEN, createdAgoMin: 6 });
  await addSla({ key: 'db-timeout', issue: dbTimeout, group: acme, trigger: SlaTriggerType.MESSAGE, sender: '+919800000013', message: dbTimeout.message, status: SlaStatus.OPEN, createdAgoMin: 6 });

  await addSla({ key: 'pr-review', issue: null, group: sales, trigger: SlaTriggerType.MENTION, sender: phoneOf.priya, message: '@Harish please review the pricing PR #142', status: SlaStatus.RESPONDED, createdAgoMin: 65, respondedAgoMin: 52, respondedBy: harish.phone });

  // ---- EOD reports (computed MISSING/PENDING for anyone without a row) ----
  const reportDate = toBusinessDateString(new Date(now), timeZone);
  const deadline = getBusinessDayDeadline(reportDate, timeZone, deadlineHhMm);

  async function addEod(key: string, memberRow: TeamMember, group_: Group, status: EodStatus, submittedAt: Date, content: string) {
    const messageId = `demo-eod-${key}`;
    if (await eods.findOneBy({ messageId })) return;
    if (await eods.findOneBy({ memberId: memberRow.id, groupId: group_.id, reportDate })) return;
    await eods.save(eods.create({ memberId: memberRow.id, groupId: group_.id, reportDate, messageId, reportContent: content, submittedAt, status }));
  }
  await addEod('harish', harish, internal, EodStatus.ON_TIME, new Date(deadline.getTime() - 90 * MIN), '1. Fixed payment gateway timeout\n2. Reviewed staging migration plan');
  await addEod('raj', raj, internal, EodStatus.LATE, new Date(deadline.getTime() + 40 * MIN), '1. Investigated checkout 500s\n2. Pending database rollback');
  await addEod('priya', priya, sales, EodStatus.ON_TIME, new Date(deadline.getTime() - 150 * MIN), '1. Pricing sheet updated\n2. Client call notes shared');
  // Aakash submits in Client Support — not an INTERNAL group, so he is not EOD-eligible.
  // Kiran has no row: the backend shows him as MISSING after the deadline, PENDING before it.

  console.log(`Demo data ready for business date ${reportDate}.`);
  await ds.destroy();
}

seedDemo().catch((error: unknown) => {
  console.error('Demo seed failed:', error);
  process.exit(1);
});
