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
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupQueryDto } from './dto/group-query.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupResponseDto } from './serializers/group.serializer';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @ApiOperation({
    summary: 'List groups',
    description:
      'Returns all groups (both monitored and not) with their members and keywords embedded, ' +
      'so the frontend can render "All WhatsApp Groups" and "Monitored Groups" from one call.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: [GroupResponseDto] })
  findAll(@Query() query: GroupQueryDto): Promise<GroupResponseDto[]> {
    return this.groupsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single group, including members and keywords',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: GroupResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Group not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<GroupResponseDto> {
    return this.groupsService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a group',
    description:
      'The new group is always created unmonitored (active = false).',
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: GroupResponseDto })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Duplicate whatsappGroupId',
  })
  create(@Body() dto: CreateGroupDto): Promise<GroupResponseDto> {
    return this.groupsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a group',
    description:
      '{ "active": true } enables monitoring ("Monitor"); { "active": false } disables it ("Remove").',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.OK, type: GroupResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Group not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupDto,
  ): Promise<GroupResponseDto> {
    return this.groupsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a group',
    description:
      'Only succeeds if the group has no historical issues/SLA incidents/EOD reports. ' +
      'Prefer PATCH /groups/:id { "active": false } to stop monitoring without losing history.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Group not found' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Group has historical records and cannot be deleted',
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.groupsService.remove(id);
  }
}
