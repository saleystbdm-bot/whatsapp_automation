import { Matches, MinLength } from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { E164_PHONE_REGEX } from '../../common/constants/phone.constant';
import { GroupType } from '../../common/enums/group-type.enum';
import { Group } from '../../groups/entities/group.entity';
import { IssueStatus } from '../enums/issue-status.enum';

/**
 * An issue/problem detected in a monitored WhatsApp group.
 *
 * `messageId` is the idempotency key: n8n's webhook can redeliver the same
 * WhatsApp message more than once, and the unique constraint on this
 * column is what guarantees `POST /events/issues` never creates a
 * duplicate Issue for it.
 *
 * `groupType` is captured at creation time (denormalized from Group) so
 * historical issues keep the group type they had when reported, even if
 * the group's configuration changes later.
 *
 * Issue lifecycle (OPEN → IN_PROGRESS → RESOLVED) is intentionally
 * independent of SLA state — see SlaIncident. A team responding to an
 * issue changes the *SLA* status, never this entity's status.
 */
@Entity('issues')
@Index(['groupId'])
@Index(['status'])
@Index(['createdAt'])
export class Issue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id', type: 'varchar', length: 150, unique: true })
  messageId: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => Group, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({
    name: 'group_type',
    type: 'enum',
    enum: GroupType,
    enumName: 'group_type_enum',
  })
  groupType: GroupType;

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
    enum: IssueStatus,
    enumName: 'issue_status_enum',
    default: IssueStatus.OPEN,
  })
  status: IssueStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by', type: 'varchar', length: 20, nullable: true })
  resolvedBy: string | null;
}
