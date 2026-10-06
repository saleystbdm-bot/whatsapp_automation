import { GroupType } from '../../common/enums/group-type.enum';
import { GroupMember } from '../../groups/entities/group-member.entity';
import { Group } from '../../groups/entities/group.entity';
import { Keyword } from '../../keywords/entities/keyword.entity';
import { TeamMember } from '../../team-members/entities/team-member.entity';
import AppDataSource from '../data-source';

/**
 * Optional development seed. Never run automatically (no hook wires this
 * into `migration:run` or app bootstrap) — invoke explicitly with
 * `npm run seed`. Safe to re-run: every insert is guarded by a lookup on
 * the row's natural unique key, so re-running just no-ops on rows that
 * already exist instead of erroring or duplicating them.
 *
 * This is intentionally kept separate from migrations: migrations define
 * schema, they must never embed environment-specific or example data.
 */
async function seed() {
  const dataSource = await AppDataSource.initialize();

  const teamMembers = dataSource.getRepository(TeamMember);
  const groups = dataSource.getRepository(Group);
  const groupMembers = dataSource.getRepository(GroupMember);
  const keywords = dataSource.getRepository(Keyword);

  async function upsertTeamMember(input: {
    name: string;
    phone: string;
    role: string;
  }) {
    const existing = await teamMembers.findOneBy({ phone: input.phone });
    if (existing) return existing;
    return teamMembers.save(teamMembers.create({ ...input, active: true }));
  }

  async function upsertGroup(input: {
    whatsappGroupId: string;
    name: string;
    type: GroupType;
    slaMinutes: number;
  }) {
    const existing = await groups.findOneBy({
      whatsappGroupId: input.whatsappGroupId,
    });
    if (existing) return existing;
    return groups.save(groups.create({ ...input, active: true }));
  }

  async function upsertGroupMember(input: {
    groupId: string;
    memberId: string;
    responsibility: string;
  }) {
    const existing = await groupMembers.findOneBy({
      groupId: input.groupId,
      memberId: input.memberId,
    });
    if (existing) return existing;
    return groupMembers.save(groupMembers.create({ ...input, active: true }));
  }

  async function upsertKeyword(input: { groupId: string; keyword: string }) {
    const existing = await keywords.findOneBy({
      groupId: input.groupId,
      keyword: input.keyword,
      active: true,
    });
    if (existing) return existing;
    return keywords.save(keywords.create({ ...input, active: true }));
  }

  const harish = await upsertTeamMember({
    name: 'Harish',
    phone: '+919566800001',
    role: 'Engineer',
  });
  const aakash = await upsertTeamMember({
    name: 'Aakash',
    phone: '+919566800002',
    role: 'Engineer',
  });
  const raj = await upsertTeamMember({
    name: 'Raj',
    phone: '+919566800003',
    role: 'Engineer',
  });

  const internalGroup = await upsertGroup({
    whatsappGroupId: '120363414558473367@g.us',
    name: 'Test Whatsapp Automation',
    type: GroupType.INTERNAL,
    slaMinutes: 30,
  });

  const clientGroup = await upsertGroup({
    whatsappGroupId: '120363414558473368@g.us',
    name: 'Client Support',
    type: GroupType.CLIENT,
    slaMinutes: 30,
  });

  await upsertGroupMember({
    groupId: internalGroup.id,
    memberId: harish.id,
    responsibility: 'PRIMARY',
  });
  await upsertGroupMember({
    groupId: internalGroup.id,
    memberId: raj.id,
    responsibility: 'SECONDARY',
  });
  await upsertGroupMember({
    groupId: clientGroup.id,
    memberId: aakash.id,
    responsibility: 'PRIMARY',
  });

  for (const keyword of ['payment', 'api', 'error', 'failed', 'urgent']) {
    await upsertKeyword({ groupId: internalGroup.id, keyword });
  }
  for (const keyword of ['issue', 'not working', 'urgent', 'down']) {
    await upsertKeyword({ groupId: clientGroup.id, keyword });
  }

  console.log('Seed complete.');
  await dataSource.destroy();
}

seed().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
