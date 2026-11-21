import { FormEvent, lazy, Suspense, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Session } from '@supabase/supabase-js';
import { sb } from './lib/supabase';
import { db, save, startSync, exportAll } from './lib/db';
import { TERRITORIES, TKey, levelFor, award } from './lib/xp';

const MapView = lazy(() => import('./MapView'));
const QUICK = [
  { kind: 'workout', t: 'fitness' as TKey, label: 'Log workout', ph: 'Bench press 3×8 at 60 kg', xp: 25 },
  { kind: 'meal', t: 'nutrition' as TKey, label: 'Log meal', ph: 'Chicken and rice, 650 kcal, 45 g protein', xp: 10 },
  { kind: 'bible-note', t: 'faith' as TKey, label: 'Bible note', ph: 'Passage, and what stood out to you', xp: 15 },
  { kind: 'odometer', t: 'vehicles' as TKey, label: 'Update odometer', ph: 'Reading in km', xp: 10 },
];

function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in'); const [msg, setMsg] = useState('');
  async function go(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget), c = { email: String(f.get('email')), password: String(f.get('password')) };
    const { error } = mode === 'in' ? await sb!.auth.signInWithPassword(c) : await sb!.auth.signUp(c);
    setMsg(error ? error.message : mode === 'up' ? 'Check your email to confirm, then sign in.' : '');
  }
  return <main className="auth"><img src="/assets/icons/app.png" alt="" width="96" />
    <h1>LIFE HUB</h1><p className="dim">One account on every device.</p>
    <form onSubmit={go}><input name="email" type="email" placeholder="Email" required autoComplete="email" />
      <input name="password" type="password" placeholder="Password (8+ characters)" minLength={8} required autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
      <button className="primary">{mode === 'in' ? 'Sign in' : 'Create account'}</button></form>
    {msg && <p role="alert" className="warn">{msg}</p>}
    <button className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}</button></main>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null); const [ready, setReady] = useState(!sb);
  const [online, setOnline] = useState(navigator.onLine); const [view, setView] = useState(location.hash === '#map' ? 'map' : 'home'); const [open, setOpen] = useState<(typeof QUICK)[number] | null>(null);
  useEffect(() => {
    if (!sb) return; sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s)); return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { const u = () => setOnline(navigator.onLine); addEventListener('online', u); addEventListener('offline', u); return () => { removeEventListener('online', u); removeEventListener('offline', u); }; }, []);
  useEffect(() => (session ? startSync() : undefined), [session]);

  const xp = useLiveQuery(() => db.entities.where('kind').equals('xp').filter((e) => !e.deleted).toArray(), [], []);
  const recent = useLiveQuery(() => db.entities.orderBy('updated_at').reverse().filter((e) => !e.deleted && e.kind !== 'xp').limit(8).toArray(), [], []);
  if (!ready) return null; if (sb && !session) return <Auth />;
  if (view === 'map') return <Suspense fallback={null}><MapView onBack={() => { setView('home'); location.hash = ''; }} /></Suspense>;

  const per = (t: TKey) => xp.filter((e) => e.territory === t).reduce((s, e) => s + e.data.amount, 0);
  const total = xp.reduce((s, e) => s + e.data.amount, 0), L = levelFor(total);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!open) return; const text = String(new FormData(e.currentTarget).get('text')).trim(); if (!text) return;
    await save(open.t, open.kind, { text, at: new Date().toISOString() }); await award(open.t, open.kind, open.xp); setOpen(null);
  }
  return <div className="shell">
    <header><img src="/assets/icons/app.png" alt="Life Hub" height="40" /><span className={`pill ${online ? '' : 'off'}`}>{!sb ? 'Local only' : online ? 'Synced' : 'Offline: saving here'}</span>
      <nav><button className="link" onClick={() => { setView('map'); location.hash = 'map'; }}>My map</button><a href="/map.html">3D terrain</a><button className="link" onClick={exportAll}>Export backup</button>{sb && <button className="link" onClick={() => sb!.auth.signOut()}>Sign out</button>}</nav></header>

    <section className="hud" aria-label="Player level"><div className="lvl"><small>Level</small><b>{L.level}</b></div>
      <div className="bar"><div className="meter" role="progressbar" aria-valuenow={L.pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${L.pct}%` }} /></div>
        <p>{L.into} / {L.need} XP to level {L.level + 1}. {total} XP in total.</p></div></section>

    <section className="quick" aria-label="Quick log">{QUICK.map((q) => <button key={q.kind} style={{ ['--c' as string]: TERRITORIES[q.t].color }} onClick={() => setOpen(q)}>{q.label}</button>)}</section>

    <section className="terr">{(Object.keys(TERRITORIES) as TKey[]).map((t) => { const l = levelFor(per(t)), T = TERRITORIES[t];
      return <article key={t} style={{ ['--c' as string]: T.color }}><img src={`/assets/icons/${t}.png`} alt="" width="72" height="72" />
        <div><h2>{T.name}</h2><p className="dim">{T.blurb}</p><div className="meter"><i style={{ width: `${l.pct}%` }} /></div><small>Level {l.level}</small></div></article>; })}</section>
    <p className="dim note">Faith XP records what you've done, not how close you are to God. Each territory stops earning after 60 XP a day, so more is never better.</p>

    <section><h2>Recent activity</h2>{recent.length ? <ul className="log">{recent.map((e) => <li key={e.id} style={{ ['--c' as string]: TERRITORIES[e.territory as TKey]?.color }}><b>{e.kind}</b> {e.data.text}</li>)}</ul>
      : <p className="dim">Nothing yet. Use a quick log above to start your first mission.</p>}</section>

    {open && <div className="sheet" onClick={() => setOpen(null)}><form onClick={(e) => e.stopPropagation()} onSubmit={submit}>
      <h2>{open.label}</h2><input name="text" autoFocus placeholder={open.ph} required /><div><button type="button" className="link" onClick={() => setOpen(null)}>Cancel</button><button className="primary">Save</button></div></form></div>}
  </div>;
}
