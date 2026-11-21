import { db, save } from './db';
export type TKey = 'faith' | 'fitness' | 'nutrition' | 'vehicles' | 'mind' | 'lifestyle';
export const TERRITORIES: Record<TKey, { name: string; color: string; blurb: string }> = {
  faith: { name: 'Faith', color: '#ffb347', blurb: 'Reading, prayer and reflection' },
  fitness: { name: 'Fitness', color: '#ff4a2e', blurb: 'Training, recovery and sleep' },
  nutrition: { name: 'Nutrition', color: '#9be03c', blurb: 'Meals, water and planning' },
  vehicles: { name: 'Vehicles', color: '#2fb4ff', blurb: 'WOF, rego and servicing' },
  mind: { name: 'Mind', color: '#a35bff', blurb: 'Journal, learning and habits' },
  lifestyle: { name: 'Lifestyle', color: '#ffc23a', blurb: 'Money, home and plans' },
};
// Each level needs 25% more XP than the last.
export function levelFor(xp: number) {
  let level = 1, need = 100, left = xp;
  while (left >= need) { left -= need; level++; need = Math.round(need * 1.25); }
  return { level, into: left, need, pct: Math.round((left / need) * 100) };
}
// Daily cap per territory: more training, logging or reading past this earns nothing extra,
// so XP can never push you towards over-exercising, under-eating or "performing" spiritually.
export const DAILY_CAP = 60;
export async function xpToday(t: TKey) {
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const rows = await db.entities.where('kind').equals('xp').filter((e) => !e.deleted && e.territory === t && new Date(e.data.at) >= since).toArray();
  return rows.reduce((s, e) => s + e.data.amount, 0);
}
export async function award(t: TKey, reason: string, amount: number) {
  const give = Math.min(amount, DAILY_CAP - (await xpToday(t)));
  if (give <= 0) return 0;
  await save(t, 'xp', { amount: give, reason, at: new Date().toISOString() });
  return give;
}
