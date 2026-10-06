import { Matches, MinLength } from 'class-validator';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { E164_PHONE_REGEX } from '../../common/constants/phone.constant';

@Entity('team_members')
export class TeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  @MinLength(1)
  name: string;

  /**
   * Canonical E.164 format (e.g. `+919566831192`). See
   * common/constants/phone.constant.ts for the normalization contract.
   * Unique + indexed: a team member is identified by their WhatsApp phone.
   */
  @Column({ type: 'varchar', length: 20, unique: true })
  @Matches(E164_PHONE_REGEX, {
    message: 'phone must be in E.164 format, e.g. +919566831192',
  })
  phone: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  role: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
