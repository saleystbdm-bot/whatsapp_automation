import type { TeamMember } from '../types/domain';

export const TEAM_MEMBERS: TeamMember[] = [
  { id: 'team-harish', name: 'Harish', phone: '+91 90000 10001' },
  { id: 'team-aakash', name: 'Aakash', phone: '+91 90000 10002' },
  { id: 'team-raj', name: 'Raj', phone: '+91 90000 10003' },
  { id: 'team-kiran', name: 'Kiran', phone: '+91 90000 10004' },
];

export function findTeamMembers(names: string[]): TeamMember[] {
  return TEAM_MEMBERS.filter((member) => names.includes(member.name));
}
