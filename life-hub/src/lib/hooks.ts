import { useLiveQuery } from 'dexie-react-hooks';
import { db, save } from './db';
export const useKind = (kind: string) => useLiveQuery(() => db.entities.where('kind').equals(kind).filter((e) => !e.deleted).toArray(), [kind], []);
export const dk = (iso: string) => new Date(iso).toLocaleDateString('en-CA'); // local calendar day, e.g. 2026-11-21
export const byAt = (a: { data: { at: string } }, b: { data: { at: string } }) => String(b.data.at).localeCompare(String(a.data.at));
// A synced setting (e.g. your nutrition targets). Falls back to the default until you change it.
export function useSetting<T>(key: string, def: T): [T, (v: T) => void] {
  const row = useKind('setting').find((r) => r.data.key === key);
  return [row ? (row.data.v as T) : def, (v) => void save('system', 'setting', { key, v }, row?.id)];
}
