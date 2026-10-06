import { IsInt, Min, MinLength } from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GroupType } from '../../common/enums/group-type.enum';
import { Keyword } from '../../keywords/entities/keyword.entity';
import { GroupMember } from './group-member.entity';

/**
 * A WhatsApp group known to the system. `whatsappGroupId` is the WhatsApp
 * JID (e.g. `120363414558473367@g.us`) and is never shown in the UI —
 * `name` is the human-readable display name the frontend renders.
 *
 * `active` is the single source of truth for "is this group currently
 * monitored" (Phase 2B decision) — there is deliberately no separate
 * `monitoring_enabled` column. `active = true` means monitored,
 * `active = false` means not monitored. Toggled via `PATCH /groups/:id`.
 */
@Entity('groups')
@Index(['active'])
@Index(['type'])
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'whatsapp_group_id',
    type: 'varchar',
    length: 100,
    unique: true,
  })
  whatsappGroupId: string;

  @Column({ type: 'varchar', length: 150 })
  @MinLength(1)
  name: string;

  @Column({ type: 'enum', enum: GroupType, enumName: 'group_type_enum' })
  type: GroupType;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'sla_minutes', type: 'int' })
  @IsInt()
  @Min(1)
  slaMinutes: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => GroupMember, (groupMember) => groupMember.group)
  groupMembers: GroupMember[];

  @OneToMany(() => Keyword, (keyword) => keyword.group)
  keywords: Keyword[];
}
