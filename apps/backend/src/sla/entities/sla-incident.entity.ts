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
import { GroupType } from '../../common/enums/group-type.enum';
import { Group } from '../../groups/entities/group.entity';
import { Issue } from '../../issues/entities/issue.entity';
import { SlaStatus } from '../enums/sla-status.enum';
import { SlaTriggerType } from '../enums/sla-trigger-type.enum';

/**
 * Tracks whether a monitored-group message was responded to within its
 * SLA window. This is deliberately a separate concept from Issue: SLA asks
 * "did someone respond in time?", Issue asks "is the problem fixed?". A
 * response moves this entity to RESPONDED — it never touches Issue.status.
 *
 * `messageId` is the idempotency key for `POST /events/sla`, mirroring
 * Issue.messageId. In this prototype a single WhatsApp message maps to at
 * most one SLA incident (enforced by the unique constraint on this column
 * alone, not a composite with `triggerType`): n8n decides once, per
 * message, whether it is a MENTION or a MESSAGE trigger, then reports it
 * exactly once. `groupName`/`groupType` are denormalized snapshots (same
 * reasoning as Issue.groupType) so historical incidents read correctly
 * even if the group is later renamed or reconfigured.
 */
@Entity('sla_incidents')
@Index(['groupId'])
@Index(['status'])
@Index(['slaDeadline'])
@Index(['createdAt'])
export class SlaIncident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id', type: 'varchar', length: 150, unique: true })
  messageId: string;

  @Column({ name: 'issue_id', type: 'uuid', nullable: true })
  issueId: string | null;

  @ManyToOne(() => Issue, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'issue_id' })
  issue: Issue | null;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => Group, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ name: 'group_name', type: 'varchar', length: 150 })
  groupName: string;

  @Column({
    name: 'group_type',
    type: 'enum',
    enum: GroupType,
    enumName: 'group_type_enum',
  })
  groupType: GroupType;

  @Column({
    name: 'trigger_type',
    type: 'enum',
    enum: SlaTriggerType,
    enumName: 'sla_trigger_type_enum',
  })
  triggerType: SlaTriggerType;

  @Column({ name: 'sender_phone', type: 'varchar', length: 20 })
  @Matches(E164_PHONE_REGEX, {
    message: 'senderPhone must be in E.164 format, e.g. +919566831192',
  })
  senderPhone: string;

  @Column({ type: 'text' })
  @MinLength(1)
  message: string;

  @Column({
    type: 'enum',
    enum: SlaStatus,
    enumName: 'sla_status_enum',
    default: SlaStatus.OPEN,
  })
  status: SlaStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'sla_deadline', type: 'timestamptz' })
  slaDeadline: Date;

  @Column({ name: 'first_response_at', type: 'timestamptz', nullable: true })
  firstResponseAt: Date | null;

  @Column({ name: 'responded_by', type: 'varchar', length: 20, nullable: true })
  respondedBy: string | null;

  @Column({ name: 'escalated_at', type: 'timestamptz', nullable: true })
  escalatedAt: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
