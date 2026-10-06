import { MinLength } from 'class-validator';
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
import { Group } from '../../groups/entities/group.entity';

/**
 * Issue-detection keyword for a group (e.g. "payment", "error", "urgent").
 * Stored lowercase/trimmed so lookups are case-insensitive by construction.
 *
 * Only one *active* row may exist per (group, keyword): a keyword can be
 * deactivated and later re-added without hitting a stale unique conflict,
 * enforced via a partial unique index (see migration).
 */
@Entity('keywords')
@Index(['groupId', 'keyword', 'active'])
export class Keyword {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => Group, (group) => group.keywords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ type: 'varchar', length: 80 })
  @MinLength(1)
  keyword: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
