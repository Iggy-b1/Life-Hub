import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
export const useKind = (kind: string) => useLiveQuery(() => db.entities.where('kind').equals(kind).filter((e) => !e.deleted).toArray(), [kind], []);
