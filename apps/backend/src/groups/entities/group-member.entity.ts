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
import { TeamMember } from '../../team-members/entities/team-member.entity';
import { Group } from './group.entity';

/**
 * Join entity: which team members are responsible for which monitored
 * group. `responsibility` is a free-form short label (e.g. PRIMARY,
 * SECONDARY, SUPPORT) — intentionally not an enum for this phase, per
 * product decision to avoid over-engineering roles.
 */
@Entity('group_members')
@Index(['groupId', 'memberId'], { unique: true })
export class GroupMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => Group, (group) => group.groupMembers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @ManyToOne(() => TeamMember, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member: TeamMember;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'varchar', length: 30, nullable: true })
  responsibility: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
