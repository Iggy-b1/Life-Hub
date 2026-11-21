import { FormEvent, useState } from 'react';
import { save, remove } from './lib/db';
import { useKind, useSetting, dk, byAt } from './lib/hooks';
import { award } from './lib/xp';
type T = { kcal: number; p: number; c: number; f: number; water: number };
const DEF: T = { kcal: 2200, p: 140, c: 250, f: 70, water: 2000 };
const Bar = ({ label, v, of, unit }: { label: string; v: number; of: number; unit: string }) => <div><div className="row"><span>{label}</span><small className="dim">{Math.round(v)} of {of} {unit}</small></div>
  <div className="meter"><i style={{ width: `${Math.min(100, (v / of) * 100)}%` }} /></div></div>;

export default function Nutrition({ onBack }: { onBack: () => void }) {
  const meals = useKind('meal'), water = useKind('water'), [t, setT] = useSetting<T>('nutTargets', DEF), [edit, setEdit] = useState(false);
  const td = dk(new Date().toISOString()), today = meals.filter((m) => dk(m.data.at) === td).sort(byAt);
  const sum = (k: string) => today.reduce((s, m) => s + (+m.data[k] || 0), 0);
  const ml = water.filter((w) => dk(w.data.at) === td).reduce((s, w) => s + w.data.ml, 0);
  const f = (e: FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
  async function drink(n: number) { await save('nutrition', 'water', { ml: n, at: new Date().toISOString() }); if (ml < t.water && ml + n >= t.water) await award('nutrition', 'hydration', 15); }
  return <div className="shell"><header><button className="link" onClick={onBack}>Back</button><h1>NUTRITION</h1>
    <button className="link" style={{ marginLeft: 'auto' }} onClick={() => setEdit(!edit)}>{edit ? 'Close targets' : 'Edit targets'}</button></header>
    {edit && <form className="card" onSubmit={(e) => { e.preventDefault(); const v = f(e); setT({ kcal: +v.kcal, p: +v.p, c: +v.c, f: +v.f, water: +v.water }); setEdit(false); }}>
      <div className="grid2">{([['kcal', 'Calories'], ['p', 'Protein (g)'], ['c', 'Carbs (g)'], ['f', 'Fat (g)'], ['water', 'Water (ml)']] as const).map(([k, l]) => <label key={k}>{l}<input name={k} type="number" min={0} defaultValue={t[k]} required /></label>)}</div>
      <small className="dim">These are your own numbers. Not sure what suits you? A doctor or dietitian can help set them.</small><button className="primary">Save targets</button></form>}
    <section className="card"><h2>Today</h2><Bar label="Calories" v={sum('kcal')} of={t.kcal} unit="kcal" /><Bar label="Protein" v={sum('p')} of={t.p} unit="g" />
      <Bar label="Carbs" v={sum('c')} of={t.c} unit="g" /><Bar label="Fat" v={sum('f')} of={t.f} unit="g" />
      <small className="dim">XP rewards logging, not eating less. Eating under your target earns nothing extra.</small></section>
    <section className="card"><h2>Water</h2><Bar label="Today" v={ml} of={t.water} unit="ml" />
      <div className="acts"><button className="link" onClick={() => drink(250)}>+250 ml</button><button className="link" onClick={() => drink(500)}>+500 ml</button><button className="link" onClick={() => drink(750)}>+750 ml</button></div></section>
    <form className="card" onSubmit={async (e) => { e.preventDefault(); const v = f(e); await save('nutrition', 'meal', { text: v.name.trim(), kcal: +v.kcal || 0, p: +v.p || 0, c: +v.c || 0, f: +v.f || 0, at: new Date().toISOString() }); await award('nutrition', 'meal', 10); e.currentTarget.reset(); }}>
      <h2>Log a meal</h2><input name="name" placeholder="What did you eat?" required />
      <div className="grid2"><input name="kcal" type="number" min={0} placeholder="kcal" /><input name="p" type="number" min={0} placeholder="Protein g" /><input name="c" type="number" min={0} placeholder="Carbs g" /><input name="f" type="number" min={0} placeholder="Fat g" /></div>
      <button className="primary">Save meal</button></form>
    <section><h2>Today's meals</h2>{today.length ? <ul className="log">{today.map((m) => <li key={m.id}><div className="row"><span><b>{m.data.text}</b> {m.data.kcal ? `${m.data.kcal} kcal, ` : ''}{m.data.p || 0} P, {m.data.c || 0} C, {m.data.f || 0} F</span>
      <button className="link" onClick={() => remove(m.id)}>Delete</button></div></li>)}</ul> : <p className="dim">No meals logged today.</p>}</section></div>;
}
