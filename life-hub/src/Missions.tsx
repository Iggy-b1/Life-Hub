import { FormEvent, useState } from 'react';
import { save, remove } from './lib/db';
import { useKind } from './lib/hooks';
import { TERRITORIES, TKey, award } from './lib/xp';
const DIFF = { easy: 10, medium: 20, hard: 40 } as const;
type M = { title: string; desc: string; type: string; diff: keyof typeof DIFF; deadline: string; progress: number; status: 'active' | 'paused' | 'done'; paid?: boolean };
type Row = { id: string; t: TKey; d: M };

export default function Missions() {
  const rows = useKind('mission'), [form, setForm] = useState(false);
  const list: Row[] = rows.map((e) => ({ id: e.id, t: e.territory as TKey, d: e.data as M })).sort((a, b) => Number(a.d.status === 'done') - Number(b.d.status === 'done'));
  const put = (m: Row, p: Partial<M>) => save(m.t, 'mission', { ...m.d, ...p }, m.id);
  async function bump(m: Row, to: number) {
    const p = Math.max(0, Math.min(100, to)), done = p >= 100;
    await put(m, { progress: p, status: done ? 'done' : m.d.status === 'done' ? 'active' : m.d.status, paid: m.d.paid || done });
    if (done && !m.d.paid) await award(m.t, 'mission', DIFF[m.d.diff]);
  }
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    await save(f.territory, 'mission', { title: f.title.trim(), desc: f.desc, type: f.type, diff: f.diff, deadline: f.deadline, progress: 0, status: 'active' }); setForm(false);
  }
  return <section><div className="row"><h2>Missions</h2><button className="link" onClick={() => setForm(!form)}>{form ? 'Cancel' : 'New mission'}</button></div>
    {form && <form className="card" onSubmit={add}><input name="title" placeholder="Mission title" required autoFocus />
      <textarea name="desc" rows={2} placeholder="Description" />
      <div className="grid2"><select name="territory" aria-label="Territory">{(Object.keys(TERRITORIES) as TKey[]).map((k) => <option key={k} value={k}>{TERRITORIES[k].name}</option>)}</select>
        <select name="type" aria-label="Type"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="long-term">Long-term</option><option value="custom">Custom</option></select>
        <select name="diff" aria-label="Difficulty" defaultValue="medium"><option value="easy">Easy, 10 XP</option><option value="medium">Medium, 20 XP</option><option value="hard">Hard, 40 XP</option></select>
        <input name="deadline" type="date" aria-label="Deadline" /></div><button className="primary">Start mission</button></form>}
    {list.length ? <ul className="log">{list.map((m) => <li key={m.id} className={`mis ${m.d.status}`} style={{ ['--c' as string]: TERRITORIES[m.t].color }}>
      <div className="row"><b>{m.d.title}</b><small>{m.d.type}, {m.d.diff}, {DIFF[m.d.diff]} XP</small></div>
      {m.d.desc && <p className="dim">{m.d.desc}</p>}
      <div className="meter"><i style={{ width: `${m.d.progress}%` }} /></div>
      <div className="row"><small className="dim">{m.d.status === 'paused' ? 'Paused' : m.d.status === 'done' ? 'Completed' : m.d.deadline ? `Due ${m.d.deadline}` : `${m.d.progress}%`}</small>
        <span className="acts">{m.d.status !== 'done' && <><button className="link" onClick={() => bump(m, m.d.progress + 25)}>+25%</button>
          <button className="link" onClick={() => put(m, { status: m.d.status === 'paused' ? 'active' : 'paused' })}>{m.d.status === 'paused' ? 'Resume' : 'Pause'}</button>
          <button className="link" onClick={() => bump(m, 100)}>Complete</button></>}
          <button className="link" onClick={() => { const t = prompt('Edit mission title', m.d.title); if (t?.trim()) put(m, { title: t.trim() }); }}>Edit</button>
          <button className="link" onClick={() => remove(m.id)}>Delete</button></span></div></li>)}</ul>
      : <p className="dim">No missions yet. Start one to give today a target.</p>}</section>;
}
