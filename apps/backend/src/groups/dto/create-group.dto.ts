import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { GroupType } from '../../common/enums/group-type.enum';
import { TrimString } from '../../common/validators/trim-string.decorator';

export class CreateGroupDto {
  @ApiProperty({ example: '120363414558473367@g.us' })
  @TrimString()
  @IsString()
  @IsNotEmpty()
  whatsappGroupId: string;

  @ApiProperty({ example: 'Client ABC' })
  @TrimString()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: GroupType, example: GroupType.CLIENT })
  @IsEnum(GroupType)
  type: GroupType;

  @ApiProperty({ example: 30, minimum: 1 })
  @IsInt()
  @Min(1)
  slaMinutes: number;

  // `active` is intentionally not accepted here — a newly created group is
  // always unmonitored (active = false) until explicitly enabled via
  // PATCH /groups/:id. Any `active` field in the request body is silently
  // stripped by the global ValidationPipe's whitelist.
}
