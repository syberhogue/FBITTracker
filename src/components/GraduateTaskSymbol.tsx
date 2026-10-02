import { BookOpen, ClipboardList, FilePenLine, Flag, GraduationCap, Users, Newspaper } from 'lucide-react';
import type { GraduateItemType } from '../lib/graduate';

const icons = { Form: FilePenLine, Report: ClipboardList, 'Research Paper': Newspaper, Thesis: BookOpen, Meeting: Users, Course: GraduationCap, Milestone: Flag };
export function GraduateTaskSymbol({ type, size = 14 }: { type: GraduateItemType; size?: number }) {
  const Icon = icons[type];
  return <Icon size={size} aria-hidden="true" strokeWidth={2.3}/>;
}
