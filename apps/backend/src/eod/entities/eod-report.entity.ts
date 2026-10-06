import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Group } from '../../groups/entities/group.entity';
import { TeamMember } from '../../team-members/entities/team-member.entity';
import { EodStatus } from '../enums/eod-status.enum';

/**
 * A team member's end-of-day report for one business date, for one
 * (internal) group. EOD only applies to internal team members/groups —
 * that rule is enforced by the service layer (a later phase), not the
 * schema, since the DB has no way to know which groups are "internal for
 * EOD purposes" beyond Group.type.
 *
 * `reportDate` is a plain `date` column (no time component) representing
 * the *business* date, computed by the caller from BUSINESS_TIMEZONE —
 * deliberately not derived from `createdAt`/UTC-now, so a report submitted
 * at 11:55 PM IST and one submitted at 12:05 AM IST the next day are never
 * accidentally attributed to the same or wrong business day because of a
 * UTC boundary crossing.
 *
 * Unique constraint: one report per (member, group, business date) — a
 * team member cannot have two EOD reports for the same group on the same
 * day. `messageId` additionally guards against the same WhatsApp
 * submission message being processed twice (nullable: a MISSING report is
 * synthesized by the system before any message ever arrives).
 */
@Entity('eod_reports')
@Index(['memberId', 'groupId', 'reportDate'], { unique: true })
@Index(['status'])
export class EodReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @ManyToOne(() => TeamMember, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'member_id' })
  member: TeamMember;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => Group, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  /** Business date (BUSINESS_TIMEZONE), not a UTC timestamp. */
  @Column({ name: 'report_date', type: 'date' })
  reportDate: string;

  @Column({
    name: 'message_id',
    type: 'varchar',
    length: 150,
    nullable: true,
    unique: true,
  })
  messageId: string | null;

  @Column({ name: 'report_content', type: 'text', nullable: true })
  reportContent: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({
    type: 'enum',
    enum: EodStatus,
    enumName: 'eod_status_enum',
    default: EodStatus.MISSING,
  })
  status: EodStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
