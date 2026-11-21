import type { Entity } from './db';
import type { TKey } from './xp';
const live = (e: Entity[], k: string) => e.filter((x) => x.kind === k && !x.deleted);
const dayCount = (e: Entity[], k: string) => new Set(live(e, k).map((x) => String(x.data.at).slice(0, 10))).size;
export type Ach = { key: string; name: string; desc: string; icon: TKey | 'app'; test: (e: Entity[]) => boolean };
export const ACH: Ach[] = [
  { key: 'first-bible', name: 'First Bible Study', desc: 'Save a Bible note', icon: 'faith', test: (e) => live(e, 'bible-note').length >= 1 },
  { key: 'ten-workouts', name: 'First 10 Workouts', desc: 'Log 10 workouts', icon: 'fitness', test: (e) => live(e, 'workout').length >= 10 },
  { key: 'food-30', name: '30 Days of Food Tracking', desc: 'Log meals on 30 different days', icon: 'nutrition', test: (e) => dayCount(e, 'meal') >= 30 },
  { key: 'first-service', name: 'First Service Logged', desc: 'Record a vehicle service', icon: 'vehicles', test: (e) => live(e, 'service').length >= 1 },
  { key: 'first-mission', name: 'Mission Complete', desc: 'Finish a mission', icon: 'mind', test: (e) => live(e, 'mission').some((m) => m.data.status === 'done') },
  { key: 'explorer', name: 'Explorer', desc: 'Discover a place on your map', icon: 'lifestyle', test: (e) => live(e, 'marker').some((m) => m.data.found) },
  { key: 'level-5', name: 'Level 5', desc: 'Reach overall level 5', icon: 'app', test: (e) => live(e, 'xp').reduce((s, x) => s + x.data.amount, 0) >= 576 },
];
