import Dexie, { Table } from 'dexie';
import { sb } from './supabase';
export type Entity = { id: string; territory: string; kind: string; data: any; updated_at: string; deleted: boolean; dirty?: 0 | 1 };
class DB extends Dexie {
  entities!: Table<Entity, string>; meta!: Table<{ k: string; v: string }, string>;
  constructor() { super('lifehub'); this.version(1).stores({ entities: 'id,territory,kind,dirty,updated_at', meta: 'k' }); }
}
export const db = new DB();

// Every write lands on this device first (works offline), then syncs in the background.
export async function save(territory: string, kind: string, data: any, id: string = crypto.randomUUID()) {
  await db.entities.put({ id, territory, kind, data, updated_at: new Date().toISOString(), deleted: false, dirty: 1 });
  void sync(); return id;
}
export async function remove(id: string) {
  const e = await db.entities.get(id); if (e) { await db.entities.put({ ...e, deleted: true, dirty: 1 }); void sync(); }
}

let busy = false;
export async function sync(): Promise<void> {
  if (!sb || busy || !navigator.onLine) return;
  const { data: { session } } = await sb.auth.getSession(); if (!session) return;
  busy = true;
  try {
    const dirty = await db.entities.where('dirty').equals(1).toArray();
    if (dirty.length) {
      const { error } = await sb.from('entities').upsert(dirty.map(({ dirty: _d, ...r }) => ({ ...r, user_id: session.user.id })));
      if (error) throw error;
      await db.entities.bulkPut(dirty.map((r) => ({ ...r, dirty: 0 as const })));
    }
    const cursor = (await db.meta.get('cursor'))?.v ?? '1970-01-01T00:00:00Z';
    const { data, error } = await sb.from('entities').select('id,territory,kind,data,updated_at,deleted')
      .gt('updated_at', cursor).order('updated_at').limit(1000);
    if (error) throw error;
    if (data?.length) {
      const keep = new Set(await db.entities.where('dirty').equals(1).primaryKeys()); // never clobber unsent local edits
      await db.entities.bulkPut(data.filter((r) => !keep.has(r.id)).map((r) => ({ ...r, dirty: 0 as const })));
      await db.meta.put({ k: 'cursor', v: data[data.length - 1].updated_at });
      if (data.length === 1000) setTimeout(sync, 0);
    }
  } catch (e) { console.warn('sync will retry', e); } finally { busy = false; }
}

export function startSync() {
  const client = sb; if (!client) return () => {};
  void sync();
  const ch = client.channel('entities').on('postgres_changes', { event: '*', schema: 'public', table: 'entities' }, () => void sync()).subscribe();
  const on = () => void sync(); window.addEventListener('online', on);
  const t = setInterval(on, 60000);
  return () => { client.removeChannel(ch); window.removeEventListener('online', on); clearInterval(t); };
}

export async function exportAll() {
  const rows = await db.entities.filter((e) => !e.deleted).toArray();
  const url = URL.createObjectURL(new Blob([JSON.stringify({ exported: new Date().toISOString(), rows }, null, 2)], { type: 'application/json' }));
  Object.assign(document.createElement('a'), { href: url, download: `life-hub-backup-${new Date().toISOString().slice(0, 10)}.json` }).click();
  URL.revokeObjectURL(url);
}
