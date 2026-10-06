import type { MonitoredGroup, WhatsAppGroup } from '../types/domain';
import { findTeamMembers } from './team';

export const ALL_GROUPS: WhatsAppGroup[] = [
  {
    id: 'group-client-abc',
    whatsappGroupId: '120363410000000001@g.us',
    name: 'Client ABC',
    memberCount: 24,
    type: 'CLIENT',
  },
  {
    id: 'group-client-xyz',
    whatsappGroupId: '120363410000000002@g.us',
    name: 'Client XYZ',
    memberCount: 18,
    type: 'CLIENT',
  },
  {
    id: 'group-sales-team',
    whatsappGroupId: '120363410000000003@g.us',
    name: 'Sales Team',
    memberCount: 12,
    type: 'INTERNAL',
  },
  {
    id: 'group-marketing',
    whatsappGroupId: '120363410000000004@g.us',
    name: 'Marketing',
    memberCount: 9,
    type: 'INTERNAL',
  },
  {
    id: 'group-sales-support',
    whatsappGroupId: '120363410000000005@g.us',
    name: 'Sales Support',
    memberCount: 15,
    type: 'CLIENT',
  },
];

export const MONITORED_GROUPS: MonitoredGroup[] = [
  {
    id: 'group-whatsapp-automation',
    whatsappGroupId: '120363414558473367@g.us',
    name: 'Test Whatsapp Automation',
    memberCount: 122,
    type: 'INTERNAL',
    slaMinutes: 30,
    active: true,
    responsibleTeam: findTeamMembers(['Harish', 'Aakash', 'Raj']),
    keywords: ['payment', 'API', 'error', 'failed', 'urgent'],
  },
  {
    id: 'group-client-support',
    whatsappGroupId: '120363414558473368@g.us',
    name: 'Client Support',
    memberCount: 86,
    type: 'CLIENT',
    slaMinutes: 30,
    active: true,
    responsibleTeam: findTeamMembers(['Aakash', 'Kiran']),
    keywords: ['issue', 'not working', 'urgent', 'down'],
  },
  {
    id: 'group-production-team',
    whatsappGroupId: '120363414558473369@g.us',
    name: 'Production Team',
    memberCount: 54,
    type: 'INTERNAL',
    slaMinutes: 30,
    active: true,
    responsibleTeam: findTeamMembers(['Raj', 'Harish']),
    keywords: ['deployment', 'server', 'outage', 'error'],
  },
];
