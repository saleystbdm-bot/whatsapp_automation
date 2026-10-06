import { Matches, MinLength } from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { E164_PHONE_REGEX } from '../../common/constants/phone.constant';
import { Issue } from '../../issues/entities/issue.entity';
import { SlaIncident } from '../../sla/entities/sla-incident.entity';
import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationType } from '../enums/notification-type.enum';

/**
 * A single notification attempt/delivery record (e.g. one WhatsApp message
 * sent to the CEO or to a responsible team member). This is intentionally
 * a separate concept from SlaIncident: one SLA-missed event can and
 * normally does produce *two* Notification rows (one TEAM_SLA_REMINDER,
 * one CEO_SLA_ALERT) — that fan-out must never duplicate the SlaIncident
 * itself.
 */
@Entity('notifications')
@Index(['issueId'])
@Index(['slaId'])
@Index(['status'])
@Index(['createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    enumName: 'notification_type_enum',
  })
  type: NotificationType;

  @Column({ name: 'recipient_phone', type: 'varchar', length: 20 })
  @Matches(E164_PHONE_REGEX, {
    message: 'recipientPhone must be in E.164 format, e.g. +919566831192',
  })
  recipientPhone: string;

  @Column({ name: 'issue_id', type: 'uuid', nullable: true })
  issueId: string | null;

  @ManyToOne(() => Issue, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'issue_id' })
  issue: Issue | null;

  @Column({ name: 'sla_id', type: 'uuid', nullable: true })
  slaId: string | null;

  @ManyToOne(() => SlaIncident, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sla_id' })
  sla: SlaIncident | null;

  @Column({ type: 'text' })
  @MinLength(1)
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    enumName: 'notification_status_enum',
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
