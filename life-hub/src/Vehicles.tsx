import { FormEvent, useState } from 'react';
import { save, remove } from './lib/db';
import { useKind } from './lib/hooks';
import { award } from './lib/xp';
export type V = { name: string; make: string; rego: string; wof: string; regoExp: string; ins: string; odo: number; nextKm: number; nextDate: string };
export const left = (d?: string) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 864e5) : null);
export function vehicleAlerts(vs: { d: V }[]) {
  const out: { text: string; bad: boolean }[] = [];
  for (const { d } of vs) {
    for (const [label, date] of [['WOF', d.wof], ['Registration', d.regoExp], ['Insurance', d.ins], ['Service', d.nextDate]] as const) {
      const n = left(date); if (n !== null && n <= 30) out.push({ text: `${d.name}: ${label} ${n < 0 ? `overdue by ${-n} days` : `due in ${n} days`}`, bad: n < 0 });
    }
    if (d.nextKm && d.odo >= d.nextKm - 500) out.push({ text: `${d.name}: service due at ${d.nextKm} km`, bad: d.odo >= d.nextKm });
  }
  return out;
}
const FIELDS: [keyof V, string, string][] = [['name', 'Nickname', 'text'], ['make', 'Make and model', 'text'], ['rego', 'Plate', 'text'], ['wof', 'WOF expiry', 'date'], ['regoExp', 'Registration expiry', 'date'],
  ['ins', 'Insurance expiry', 'date'], ['odo', 'Odometer (km)', 'number'], ['nextKm', 'Next service at (km)', 'number'], ['nextDate', 'Next service by', 'date']];
const Chip = ({ label, date }: { label: string; date: string }) => { const n = left(date); if (n === null) return null;
  return <span className={`chip ${n < 0 ? 'bad' : n <= 30 ? 'warn' : 'ok'}`}>{label} {date}</span>; };

export default function Vehicles({ onBack }: { onBack: () => void }) {
  const vs = useKind('vehicle').map((e) => ({ id: e.id, d: e.data as V })), ss = useKind('service');
  const [form, setForm] = useState<string | null>(null), [svc, setSvc] = useState<string | null>(null);
  async function saveV(e: FormEvent<HTMLFormElement>, id?: string) {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    await save('vehicles', 'vehicle', { name: f.name, make: f.make, rego: f.rego, wof: f.wof, regoExp: f.regoExp, ins: f.ins, odo: +f.odo || 0, nextKm: +f.nextKm || 0, nextDate: f.nextDate }, id); setForm(null);
  }
  async function addS(e: FormEvent<HTMLFormElement>, v: { id: string; d: V }) {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>, km = +f.km || 0;
    await save('vehicles', 'service', { vehicleId: v.id, date: f.date, km, cost: +f.cost || 0, desc: f.desc, at: new Date().toISOString() });
    if (km > v.d.odo) await save('vehicles', 'vehicle', { ...v.d, odo: km }, v.id);
    await award('vehicles', 'service', 20); setSvc(null);
  }
  const VForm = ({ v, id }: { v?: V; id?: string }) => <form className="card" onSubmit={(e) => saveV(e, id)}><div className="grid2">{FIELDS.map(([k, l, t]) =>
    <label key={k}>{l}<input name={k} type={t} defaultValue={v ? String(v[k] || '') : ''} required={k === 'name'} /></label>)}</div>
    <div className="row"><button type="button" className="link" onClick={() => setForm(null)}>Cancel</button><button className="primary">Save vehicle</button></div></form>;
  return <div className="shell"><header><button className="link" onClick={onBack}>Back</button><h1>VEHICLES</h1>
    <button className="primary" style={{ marginLeft: 'auto' }} onClick={() => setForm('new')}>Add vehicle</button></header>
    {form === 'new' && <VForm />}
    {!vs.length && form !== 'new' && <p className="dim">No vehicles yet. Add one to track WOF, registration, insurance and servicing.</p>}
    {vs.map((v) => { const hist = ss.filter((s) => s.data.vehicleId === v.id).sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
      return form === v.id ? <VForm key={v.id} v={v.d} id={v.id} /> : <article className="card veh" key={v.id}>
        <div className="row"><h2>{v.d.name}</h2><small className="dim">{v.d.make} {v.d.rego && `(${v.d.rego})`}, {v.d.odo.toLocaleString()} km</small></div>
        <div className="chips"><Chip label="WOF" date={v.d.wof} /><Chip label="Rego" date={v.d.regoExp} /><Chip label="Insurance" date={v.d.ins} /><Chip label="Service" date={v.d.nextDate} /></div>
        <div className="row"><span className="acts"><button className="link" onClick={() => setSvc(svc === v.id ? null : v.id)}>Log service</button><button className="link" onClick={() => setForm(v.id)}>Edit</button></span>
          <button className="link" onClick={() => confirm(`Delete ${v.d.name}?`) && remove(v.id)}>Delete</button></div>
        {svc === v.id && <form className="grid2" onSubmit={(e) => addS(e, v)}><input name="date" type="date" required aria-label="Date" /><input name="km" type="number" placeholder="Odometer km" /><input name="cost" type="number" step="0.01" placeholder="Cost" />
          <input name="desc" placeholder="What was done" required /><button className="primary">Save service</button></form>}
        {hist.length > 0 && <ul className="log">{hist.map((s) => <li key={s.id}><b>{s.data.date}</b> {s.data.desc}, {s.data.km} km, ${s.data.cost}</li>)}
          <li className="dim">Total spent: ${hist.reduce((t, s) => t + (s.data.cost || 0), 0).toFixed(2)}</li></ul>}</article>; })}</div>;
}
