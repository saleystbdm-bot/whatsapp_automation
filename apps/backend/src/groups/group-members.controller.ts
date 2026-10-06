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
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AddGroupMemberDto } from './dto/add-group-member.dto';
import { UpdateGroupMemberDto } from './dto/update-group-member.dto';
import { GroupsService } from './groups.service';
import { GroupMemberSummaryDto } from './serializers/group.serializer';

/**
 * Sub-resource of a group: which team members are responsible for it.
 * `:memberId` in PATCH/DELETE refers to the TeamMember's id (the natural
 * identifier a caller has), not the internal group_members join-row id.
 */
@ApiTags('group-members')
@Controller('groups/:groupId/members')
export class GroupMembersController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all members (including inactive) assigned to a group',
  })
  @ApiParam({ name: 'groupId', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: [GroupMemberSummaryDto] })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Group not found' })
  findAll(
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<GroupMemberSummaryDto[]> {
    return this.groupsService.findMembersForGroup(groupId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a team member to a group' })
  @ApiParam({ name: 'groupId', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.CREATED, type: GroupMemberSummaryDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Group or team member not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Duplicate membership',
  })
  addMember(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: AddGroupMemberDto,
  ): Promise<GroupMemberSummaryDto> {
    return this.groupsService.addMember(groupId, dto);
  }

  @Patch(':memberId')
  @ApiOperation({
    summary: "Update a member's responsibility or active status within a group",
  })
  @ApiParam({ name: 'groupId', format: 'uuid' })
  @ApiParam({ name: 'memberId', format: 'uuid', description: 'TeamMember id' })
  @ApiResponse({ status: HttpStatus.OK, type: GroupMemberSummaryDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Group, team member, or membership not found',
  })
  updateMember(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateGroupMemberDto,
  ): Promise<GroupMemberSummaryDto> {
    return this.groupsService.updateMember(groupId, memberId, dto);
  }

  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a team member from a group' })
  @ApiParam({ name: 'groupId', format: 'uuid' })
  @ApiParam({ name: 'memberId', format: 'uuid', description: 'TeamMember id' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Group, team member, or membership not found',
  })
  removeMember(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<void> {
    return this.groupsService.removeMember(groupId, memberId);
  }
}
