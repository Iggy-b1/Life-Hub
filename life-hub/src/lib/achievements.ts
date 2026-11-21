import type { Entity } from './db';
import type { TKey } from './xp';
import { dk } from './hooks';
import { BOOKS } from './bible';
const live = (e: Entity[], k: string) => e.filter((x) => x.kind === k && !x.deleted);
const dayCount = (e: Entity[], k: string) => new Set(live(e, k).map((x) => dk(x.data.at))).size;
export type Ach = { key: string; name: string; desc: string; icon: TKey | 'app'; test: (e: Entity[]) => boolean };
export const ACH: Ach[] = [
  { key: 'first-bible', name: 'First Bible Study', desc: 'Save a Bible note', icon: 'faith', test: (e) => live(e, 'bible-note').length >= 1 },
  { key: 'ten-workouts', name: 'First 10 Workouts', desc: 'Log 10 workouts', icon: 'fitness', test: (e) => live(e, 'workout').length >= 10 },
  { key: 'food-30', name: '30 Days of Food Tracking', desc: 'Log meals on 30 different days', icon: 'nutrition', test: (e) => dayCount(e, 'meal') >= 30 },
  { key: 'first-service', name: 'First Service Logged', desc: 'Record a vehicle service', icon: 'vehicles', test: (e) => live(e, 'service').length >= 1 },
  { key: 'first-mission', name: 'Mission Complete', desc: 'Finish a mission', icon: 'mind', test: (e) => live(e, 'mission').some((m) => m.data.status === 'done') },
  { key: 'explorer', name: 'Explorer', desc: 'Discover a place on your map', icon: 'lifestyle', test: (e) => live(e, 'marker').some((m) => m.data.found) },
  { key: 'first-pr', name: 'First Personal Record', desc: 'Set a new best on a lift', icon: 'fitness', test: (e) => live(e, 'workout').some((w) => w.data.prs?.length > 0) },
  { key: 'hydrated', name: 'Well Hydrated', desc: 'Reach your water target in a day', icon: 'nutrition', test: (e) => { const d: Record<string, number> = {}; for (const w of live(e, 'water')) d[dk(w.data.at)] = (d[dk(w.data.at)] || 0) + w.data.ml; return Object.values(d).some((v) => v >= 2000); } },
  { key: 'bible-book', name: 'Complete a Bible Book', desc: 'Read every chapter of one book', icon: 'faith', test: (e) => { const r = live(e, 'bible-read'); return BOOKS.some(([n, c]) => new Set(r.filter((x) => x.data.book === n).map((x) => x.data.ch)).size >= c); } },
  { key: 'savings-25', name: 'First Savings Milestone', desc: 'Reach 25% of a savings goal', icon: 'lifestyle', test: (e) => live(e, 'saving').some((g) => g.data.saved >= g.data.target / 4) },
  { key: 'book-done', name: 'Finished a Book', desc: 'Mark a book as finished', icon: 'mind', test: (e) => live(e, 'book').some((b) => b.data.status === 'done') },
  { key: 'level-5', name: 'Level 5', desc: 'Reach overall level 5', icon: 'app', test: (e) => live(e, 'xp').reduce((s, x) => s + x.data.amount, 0) >= 576 },
];
