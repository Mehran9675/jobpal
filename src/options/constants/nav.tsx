import type { ReactNode } from 'react';
import {
  IconBriefcase,
  IconCpu,
  IconFile,
  IconGauge,
  IconMessage,
  IconPalette,
  IconSettings,
  IconShield,
  IconUser,
} from '@/ui/components/Icons';

export interface NavItem {
  id: string;
  label: string;
  section: string;
  icon: ReactNode;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', section: 'Overview', icon: <IconGauge /> },
  { id: 'profile', label: 'My profile', section: 'Career data', icon: <IconUser /> },
  { id: 'documents', label: 'Documents', section: 'Career data', icon: <IconFile /> },
  { id: 'applications', label: 'Applications', section: 'Career data', icon: <IconBriefcase /> },
  { id: 'templates', label: 'Resume designs', section: 'Documents', icon: <IconPalette /> },
  { id: 'ai', label: 'AI providers', section: 'Intelligence', icon: <IconCpu /> },
  { id: 'prompts', label: 'Prompts & style', section: 'Intelligence', icon: <IconMessage /> },
  { id: 'settings', label: 'Settings', section: 'System', icon: <IconSettings /> },
  { id: 'terms', label: 'Terms and privacy', section: 'System', icon: <IconShield /> },
];

export const NAV_SECTIONS: string[] = [...new Set(NAV_ITEMS.map((item) => item.section))];
