import { FormEvent, useState } from 'react';
import { save, remove } from './lib/db';
import { useKind, useSetting, dk, byAt } from './lib/hooks';
import { award } from './lib/xp';
const SEED = ['Barbell squat', 'Bench press', 'Deadlift', 'Overhead press', 'Barbell row', 'Pull-up', 'Push-up', 'Dip', 'Lat pulldown', 'Leg press', 'Romanian deadlift', 'Dumbbell curl', 'Triceps pushdown', 'Lunge', 'Plank', 'Hip thrust'];
type S = { reps: number; kg: number }; type Ex = { name: string; sets: S[] };
type W = { data: { ex: Ex[]; at: string } };
const best = (list: W[]) => { const m: Record<string, { kg: number; reps: number; at: string }> = {};
  for (const w of list) for (const e of w.data.ex) for (const s of e.sets) if (s.kg > 0 && (!m[e.name] || s.kg > m[e.name].kg)) m[e.name] = { ...s, at: w.data.at }; return m; };

export default function Fitness({ onBack }: { onBack: () => void }) {
  const all = useKind('workout'), lifts = all.filter((w) => w.data.ex) as unknown as (W & { id: string })[], custom = useKind('exercise'), bw = useKind('bodyweight').sort(byAt), sl = useKind('sleep').sort(byAt);
  const [target, setTarget] = useSetting('fitTarget', 3), [ex, setEx] = useState<Ex[]>([]), [pick, setPick] = useState(SEED[0]), [fresh, setFresh] = useState('');
  const names = [...SEED, ...custom.map((c) => String(c.data.name))], pr = best(lifts);
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const week = all.filter((w) => new Date(w.data.at) >= mon).length;
  const setSet = (i: number, j: number, k: keyof S, v: number) => setEx(ex.map((e, a) => (a === i ? { ...e, sets: e.sets.map((s, b) => (b === j ? { ...s, [k]: v } : s)) } : e)));
  async function finish() {
    const clean = ex.map((e) => ({ ...e, sets: e.sets.filter((s) => s.reps > 0) })).filter((e) => e.sets.length); if (!clean.length) return;
    const prs = clean.filter((e) => Math.max(...e.sets.map((s) => s.kg)) > Math.max(0, pr[e.name]?.kg ?? 0)).map((e) => e.name);
    const text = clean.map((e) => `${e.name} ${e.sets.map((s) => `${s.reps}×${s.kg}kg`).join(', ')}`).join('; ');
    await save('fitness', 'workout', { ex: clean, prs, text, at: new Date().toISOString() });
    await award('fitness', 'workout', 25); if (prs.length) await award('fitness', 'personal record', 10); setEx([]);
  }
  const num = (e: FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
  return <div className="shell"><header><button className="link" onClick={onBack}>Back</button><h1>FITNESS</h1></header>
    <section className="card"><div className="row"><b>This week: {week} of {target} sessions</b>
      <label className="row">Goal <input type="number" min={1} max={7} value={target} style={{ width: 70 }} onChange={(e) => setTarget(Math.min(7, Math.max(1, +e.target.value || 1)))} /></label></div>
      <div className="meter"><i style={{ width: `${Math.min(100, (week / target) * 100)}%` }} /></div>
      <small className="dim">Rest days are part of training. XP stops at 60 a day and nothing rewards training more than your goal.</small></section>

    <section className="card"><h2>Log a workout</h2>
      <div className="grid2"><select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Exercise">{names.map((n) => <option key={n}>{n}</option>)}</select>
        <button className="link" onClick={() => setEx([...ex, { name: pick, sets: [{ reps: 8, kg: 0 }] }])}>Add exercise</button>
        <input value={fresh} onChange={(e) => setFresh(e.target.value)} placeholder="New exercise name" />
        <button className="link" onClick={async () => { if (fresh.trim()) { await save('fitness', 'exercise', { name: fresh.trim() }); setPick(fresh.trim()); setFresh(''); } }}>Save to my list</button></div>
      {ex.map((e, i) => <div key={i} className="card"><div className="row"><b>{e.name}</b><button className="link" onClick={() => setEx(ex.filter((_, a) => a !== i))}>Remove</button></div>
        {e.sets.map((s, j) => <div key={j} className="grid2"><label>Reps<input type="number" min={0} value={s.reps} onChange={(ev) => setSet(i, j, 'reps', +ev.target.value)} /></label>
          <label>Weight (kg)<input type="number" min={0} step="0.5" value={s.kg} onChange={(ev) => setSet(i, j, 'kg', +ev.target.value)} /></label></div>)}
        <button className="link" onClick={() => setEx(ex.map((x, a) => (a === i ? { ...x, sets: [...x.sets, { ...x.sets[x.sets.length - 1] }] } : x)))}>Add set</button></div>)}
      {ex.length > 0 && <button className="primary" onClick={finish}>Finish workout</button>}</section>

    <section><h2>Personal records</h2>{Object.keys(pr).length ? <div className="chips">{Object.entries(pr).map(([n, r]) => <span key={n} className="chip ok">{n}: {r.kg} kg × {r.reps}</span>)}</div>
      : <p className="dim">Your heaviest lifts appear here after your first logged workout.</p>}</section>

    <div className="grid2">
      <form className="card" onSubmit={async (e) => { e.preventDefault(); const f = num(e); if (+f.kg > 0) await save('fitness', 'bodyweight', { kg: +f.kg, at: new Date().toISOString() }); e.currentTarget.reset(); }}>
        <h2>Bodyweight</h2><input name="kg" type="number" step="0.1" placeholder="kg" required /><button className="primary">Save</button>
        <small className="dim">{bw.slice(0, 5).map((b) => `${b.data.kg} kg (${dk(b.data.at)})`).join(', ') || 'No entries yet. Tracking only; it earns no XP.'}</small></form>
      <form className="card" onSubmit={async (e) => { e.preventDefault(); const f = num(e); await save('fitness', 'sleep', { hours: +f.hours, quality: +f.q, at: new Date().toISOString() }); e.currentTarget.reset(); }}>
        <h2>Sleep</h2><div className="grid2"><input name="hours" type="number" step="0.25" min={0} max={24} placeholder="Hours" required />
          <select name="q" aria-label="Quality"><option value="3">Okay</option><option value="5">Great</option><option value="4">Good</option><option value="2">Poor</option><option value="1">Awful</option></select></div><button className="primary">Save</button>
        <small className="dim">{sl.length ? `Last 7 nights average ${(sl.slice(0, 7).reduce((t, s) => t + s.data.hours, 0) / Math.min(7, sl.length)).toFixed(1)} h` : 'No entries yet.'}</small></form></div>

    <section><h2>Workout history</h2>{all.length ? <ul className="log">{[...all].sort(byAt).slice(0, 12).map((w) => <li key={w.id}><div className="row"><span><b>{dk(w.data.at)}</b> {w.data.text}{w.data.prs?.length ? ` (new best: ${w.data.prs.join(', ')})` : ''}</span>
      <button className="link" onClick={() => remove(w.id)}>Delete</button></div></li>)}</ul> : <p className="dim">No workouts yet. Add an exercise above to start.</p>}</section></div>;
}
