import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
// null = local-only mode (everything still works on this device, just no login or sync)
export const sb = url && key ? createClient(url, key) : null;
