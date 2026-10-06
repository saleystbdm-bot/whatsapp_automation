import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { GroupType } from '../common/enums/group-type.enum';
import { Keyword } from '../keywords/entities/keyword.entity';
import { TeamMember } from '../team-members/entities/team-member.entity';
import { TeamMembersService } from '../team-members/team-members.service';
import { testPhone, uniqueId } from '../test-utils/fixtures';
import { typeOrmTestConfig } from '../test-utils/typeorm-test.config';
import { GroupMember } from './entities/group-member.entity';
import { Group } from './entities/group.entity';
import { GroupsService } from './groups.service';

describe('GroupsService (integration)', () => {
  let module: TestingModule;
  let groupsService: GroupsService;
  let teamMembersService: TeamMembersService;
  const createdGroupIds: string[] = [];
  const createdMemberIds: string[] = [];

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(
          typeOrmTestConfig([Group, GroupMember, TeamMember, Keyword]),
        ),
        TypeOrmModule.forFeature([Group, GroupMember, TeamMember]),
      ],
      providers: [GroupsService, TeamMembersService],
    }).compile();
    groupsService = module.get(GroupsService);
    teamMembersService = module.get(TeamMembersService);
  });

  afterAll(async () => {
    const dataSource = module.get(DataSource);
    if (createdGroupIds.length > 0) {
      await dataSource.query(
        'DELETE FROM group_members WHERE group_id = ANY($1)',
        [createdGroupIds],
      );
      await dataSource.query('DELETE FROM groups WHERE id = ANY($1)', [
        createdGroupIds,
      ]);
    }
    if (createdMemberIds.length > 0) {
      await dataSource.query('DELETE FROM team_members WHERE id = ANY($1)', [
        createdMemberIds,
      ]);
    }
    await module.close();
  });

  it('creates a group unmonitored by default (active = false)', async () => {
    const whatsappGroupId = uniqueId('wa');
    const group = await groupsService.create({
      whatsappGroupId,
      name: 'Test Whatsapp Automation',
      type: GroupType.INTERNAL,
      slaMinutes: 30,
    });
    createdGroupIds.push(group.id);

    expect(group.id).toBeDefined();
    expect(group.name).toBe('Test Whatsapp Automation');
    expect(group.whatsappGroupId).toBe(whatsappGroupId);
    expect(group.active).toBe(false);
    expect(group.memberCount).toBe(0);
    expect(group.members).toEqual([]);
    expect(group.keywords).toEqual([]);
  });

  it('rejects a duplicate whatsapp_group_id with a ConflictException', async () => {
    const whatsappGroupId = uniqueId('wa');
    const first = await groupsService.create({
      whatsappGroupId,
      name: 'Client ABC',
      type: GroupType.CLIENT,
      slaMinutes: 30,
    });
    createdGroupIds.push(first.id);

    await expect(
      groupsService.create({
        whatsappGroupId,
        name: 'Duplicate Group Id',
        type: GroupType.CLIENT,
        slaMinutes: 30,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a non-positive SLA duration at the database layer', async () => {
    await expect(
      groupsService.create({
        whatsappGroupId: uniqueId('wa'),
        name: 'Bad SLA Group',
        type: GroupType.INTERNAL,
        slaMinutes: 0,
      }),
    ).rejects.toThrow(QueryFailedError);
  });

  it('enables and disables monitoring via update({ active })', async () => {
    const group = await groupsService.create({
      whatsappGroupId: uniqueId('wa'),
      name: 'Monitoring Toggle Group',
      type: GroupType.INTERNAL,
      slaMinutes: 30,
    });
    createdGroupIds.push(group.id);
    expect(group.active).toBe(false);

    const enabled = await groupsService.update(group.id, { active: true });
    expect(enabled.active).toBe(true);

    const disabled = await groupsService.update(group.id, { active: false });
    expect(disabled.active).toBe(false);
  });

  it('throws NotFoundException for an unknown group id', async () => {
    await expect(
      groupsService.findOne('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(NotFoundException);
  });

  it('adds a team member to a group and reflects it in the group detail response', async () => {
    const group = await groupsService.create({
      whatsappGroupId: uniqueId('wa'),
      name: 'Production Team',
      type: GroupType.INTERNAL,
      slaMinutes: 30,
    });
    createdGroupIds.push(group.id);

    const member = await teamMembersService.create({
      name: 'Raj',
      phone: testPhone(),
    });
    createdMemberIds.push(member.id);

    const membership = await groupsService.addMember(group.id, {
      memberId: member.id,
      responsibility: 'PRIMARY',
    });
    expect(membership.id).toBeDefined();
    expect(membership.active).toBe(true);

    const detail = await groupsService.findOne(group.id);
    expect(detail.memberCount).toBe(1);
    expect(detail.members[0].memberId).toBe(member.id);
    expect(detail.members[0].responsibility).toBe('PRIMARY');
  });

  it('rejects a duplicate (group, member) membership with a ConflictException', async () => {
    const group = await groupsService.create({
      whatsappGroupId: uniqueId('wa'),
      name: 'Sales Team',
      type: GroupType.INTERNAL,
      slaMinutes: 30,
    });
    createdGroupIds.push(group.id);

    const member = await teamMembersService.create({
      name: 'Kiran',
      phone: testPhone(),
    });
    createdMemberIds.push(member.id);

    await groupsService.addMember(group.id, { memberId: member.id });

    await expect(
      groupsService.addMember(group.id, { memberId: member.id }),
    ).rejects.toThrow(ConflictException);
  });

  it('removes a membership', async () => {
    const group = await groupsService.create({
      whatsappGroupId: uniqueId('wa'),
      name: 'Removable Membership Group',
      type: GroupType.INTERNAL,
      slaMinutes: 30,
    });
    createdGroupIds.push(group.id);

    const member = await teamMembersService.create({
      name: 'Temp Member',
      phone: testPhone(),
    });
    createdMemberIds.push(member.id);

    await groupsService.addMember(group.id, { memberId: member.id });
    await groupsService.removeMember(group.id, member.id);

    const members = await groupsService.findMembersForGroup(group.id);
    expect(members).toHaveLength(0);
  });

  it('deletes a group with no historical records', async () => {
    const group = await groupsService.create({
      whatsappGroupId: uniqueId('wa'),
      name: 'Deletable Group',
      type: GroupType.INTERNAL,
      slaMinutes: 30,
    });

    await groupsService.remove(group.id);
    await expect(groupsService.findOne(group.id)).rejects.toThrow(
      NotFoundException,
    );
  });
});
