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

/**
 * Durable idempotency/audit record for the Wassenger webhook receiver —
 * see the migration for why this is a real table, not an in-memory set.
 */
@Entity('wassenger_webhook_events')
@Index(['groupId'])
@Index(['receivedAt'])
export class WassengerWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'external_message_id',
    type: 'varchar',
    length: 150,
    unique: true,
  })
  externalMessageId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType: string;

  @Column({
    name: 'whatsapp_group_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  whatsappGroupId: string | null;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId: string | null;

  @ManyToOne(() => Group, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'group_id' })
  group: Group | null;

  @Column({ type: 'boolean', default: false })
  forwarded: boolean;

  @Column({
    name: 'skipped_reason',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  skippedReason: string | null;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'forwarded_at', type: 'timestamptz', nullable: true })
  forwardedAt: Date | null;
}
