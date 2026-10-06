import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { E164_PHONE_REGEX } from '../../common/constants/phone.constant';
import { IssueStatus } from '../enums/issue-status.enum';

export class UpdateIssueDto {
  @ApiPropertyOptional({
    enum: IssueStatus,
    description:
      'Allowed transitions: OPEN→IN_PROGRESS, OPEN→RESOLVED, IN_PROGRESS→RESOLVED. ' +
      'RESOLVED is terminal (no reopen in this phase).',
  })
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @ApiPropertyOptional({
    example: '+919566831192',
    description:
      'Who resolved it (E.164 phone). Only applied when status is being set to RESOLVED.',
  })
  @IsOptional()
  @Matches(E164_PHONE_REGEX, {
    message: 'resolvedBy must be in E.164 format, e.g. +919566831192',
  })
  resolvedBy?: string;
}
