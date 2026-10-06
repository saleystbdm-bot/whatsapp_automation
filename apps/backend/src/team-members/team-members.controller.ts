import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { TeamMemberQueryDto } from './dto/team-member-query.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { TeamMemberResponseDto } from './serializers/team-member.serializer';
import { TeamMembersService } from './team-members.service';

@ApiTags('team-members')
@Controller('team-members')
export class TeamMembersController {
  constructor(private readonly teamMembersService: TeamMembersService) {}

  @Get()
  @ApiOperation({ summary: 'List team members' })
  @ApiResponse({ status: HttpStatus.OK, type: [TeamMemberResponseDto] })
  findAll(
    @Query() query: TeamMemberQueryDto,
  ): Promise<TeamMemberResponseDto[]> {
    return this.teamMembersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single team member' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: TeamMemberResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Team member not found',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TeamMemberResponseDto> {
    return this.teamMembersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a team member' })
  @ApiResponse({ status: HttpStatus.CREATED, type: TeamMemberResponseDto })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Duplicate phone' })
  create(@Body() dto: CreateTeamMemberDto): Promise<TeamMemberResponseDto> {
    return this.teamMembersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a team member' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: TeamMemberResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Team member not found',
  })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Duplicate phone' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamMemberDto,
  ): Promise<TeamMemberResponseDto> {
    return this.teamMembersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a team member',
    description:
      'Only succeeds if the member has no historical EOD reports. ' +
      'Prefer PATCH /team-members/:id { "active": false } to deactivate without losing history.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Team member not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Team member has historical EOD reports and cannot be deleted',
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.teamMembersService.remove(id);
  }
}
