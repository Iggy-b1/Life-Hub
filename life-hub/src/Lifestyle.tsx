import { FormEvent, useState } from 'react';
import { save, remove } from './lib/db';
import { useKind, useSetting, dk } from './lib/hooks';
import { award } from './lib/xp';
const f = (e: FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
const days = (d: string) => Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / 864e5);
const adv = (d: string, fr: string) => { const x = new Date(d + 'T00:00:00'); fr === 'weekly' ? x.setDate(x.getDate() + 7) : fr === 'fortnightly' ? x.setDate(x.getDate() + 14) : fr === 'yearly' ? x.setFullYear(x.getFullYear() + 1) : x.setMonth(x.getMonth() + 1); return x.toLocaleDateString('en-CA'); };
const monthly = (a: number, fr: string) => (fr === 'weekly' ? (a * 52) / 12 : fr === 'fortnightly' ? (a * 26) / 12 : fr === 'yearly' ? a / 12 : a);
export function lifeAlerts(es: { kind: string; deleted: boolean; data: any }[]) {
  return es.filter((e) => !e.deleted && (e.kind === 'bill' || e.kind === 'event') && e.data.due && days(e.data.due) <= 7)
    .map((e) => ({ text: `${e.data.name}: ${days(e.data.due) < 0 ? `overdue by ${-days(e.data.due)} days` : `due in ${days(e.data.due)} days`}`, bad: days(e.data.due) < 0 }));
}
export default function Lifestyle({ onBack }: { onBack: () => void }) {
  const exp = useKind('expense'), bills = useKind('bill').sort((a, b) => a.data.due.localeCompare(b.data.due)), goals = useKind('saving'), events = useKind('event').sort((a, b) => a.data.due.localeCompare(b.data.due));
  const [budget, setBudget] = useSetting('budget', 2000), month = dk(new Date().toISOString()).slice(0, 7);
  const spent = exp.filter((e) => dk(e.data.at).startsWith(month)).reduce((s, e) => s + e.data.amount, 0), subs = bills.filter((b) => b.data.type === 'subscription').reduce((s, b) => s + monthly(b.data.amount, b.data.freq), 0);
  async function deposit(e: FormEvent<HTMLFormElement>, g: { id: string; data: { name: string; target: number; saved: number } }) {
    e.preventDefault(); const amt = +f(e).amt; if (!amt) return; const saved = g.data.saved + amt, step = (v: number) => Math.floor(Math.min(100, (v / g.data.target) * 100) / 25);
    await save('lifestyle', 'saving', { ...g.data, saved }, g.id); if (step(saved) > step(g.data.saved)) await award('lifestyle', 'savings milestone', 20); e.currentTarget.reset();
  }
  return <div className="shell"><header><button className="link" onClick={onBack}>Back</button><h1>LIFESTYLE</h1></header>
    <section className="card"><div className="row"><h2>This month</h2><label className="row">Budget $<input type="number" min={0} value={budget} style={{ width: 100 }} onChange={(e) => setBudget(+e.target.value || 0)} /></label></div>
      <div className="row"><span>${spent.toFixed(2)} spent of ${budget}</span><small className="dim">Subscriptions about ${subs.toFixed(2)} a month</small></div><div className="meter"><i style={{ width: `${Math.min(100, (spent / (budget || 1)) * 100)}%` }} /></div>
      <form className="grid2" onSubmit={async (e) => { e.preventDefault(); const v = f(e); await save('lifestyle', 'expense', { amount: +v.amount, cat: v.cat, note: v.note, at: new Date().toISOString() }); await award('lifestyle', 'expense', 5); e.currentTarget.reset(); }}>
        <input name="amount" type="number" step="0.01" min={0} placeholder="Amount" required /><select name="cat" aria-label="Category">{['Food', 'Transport', 'Home', 'Fun', 'Health', 'Other'].map((c) => <option key={c}>{c}</option>)}</select>
        <input name="note" placeholder="Note" /><button className="primary">Add expense</button></form></section>
    <section className="card"><h2>Bills and subscriptions</h2>
      <form className="grid2" onSubmit={async (e) => { e.preventDefault(); const v = f(e); await save('lifestyle', 'bill', { name: v.name.trim(), amount: +v.amount, due: v.due, freq: v.freq, type: v.type }); e.currentTarget.reset(); }}>
        <input name="name" placeholder="Name" required /><input name="amount" type="number" step="0.01" min={0} placeholder="Amount" required /><input name="due" type="date" required aria-label="Next due" />
        <select name="freq" defaultValue="monthly" aria-label="Frequency"><option>weekly</option><option>fortnightly</option><option>monthly</option><option>yearly</option></select>
        <select name="type" aria-label="Type"><option value="bill">Bill</option><option value="subscription">Subscription</option></select><button className="primary">Add</button></form>
      <ul className="log">{bills.map((b) => <li key={b.id} className={days(b.data.due) <= 3 ? 'mis' : ''}><div className="row"><span><b>{b.data.name}</b> ${b.data.amount} {b.data.freq}, next {b.data.due}</span>
        <span className="acts"><button className="link" onClick={async () => { await save('lifestyle', 'bill', { ...b.data, due: adv(b.data.due, b.data.freq) }, b.id); await award('lifestyle', 'bill paid', 5); }}>Paid</button><button className="link" onClick={() => remove(b.id)}>Delete</button></span></div></li>)}</ul></section>
    <section className="card"><h2>Savings goals</h2><form className="grid2" onSubmit={async (e) => { e.preventDefault(); const v = f(e); await save('lifestyle', 'saving', { name: v.name.trim(), target: +v.target, saved: 0 }); e.currentTarget.reset(); }}>
      <input name="name" placeholder="Goal, e.g. Emergency fund" required /><input name="target" type="number" min={1} placeholder="Target $" required /><button className="primary">Add goal</button></form>
      {goals.map((g) => <div key={g.id}><div className="row"><b>{g.data.name}</b><small className="dim">${g.data.saved} of ${g.data.target}</small></div><div className="meter"><i style={{ width: `${Math.min(100, (g.data.saved / g.data.target) * 100)}%` }} /></div>
        <form className="row" onSubmit={(e) => deposit(e, g as never)}><input name="amt" type="number" step="0.01" placeholder="Add savings" style={{ maxWidth: 160 }} /><button className="link">Add</button><button type="button" className="link" onClick={() => remove(g.id)}>Delete</button></form></div>)}</section>
    <section className="card"><h2>Appointments and events</h2><form className="grid2" onSubmit={async (e) => { e.preventDefault(); const v = f(e); await save('lifestyle', 'event', { name: v.name.trim(), due: v.due }); e.currentTarget.reset(); }}>
      <input name="name" placeholder="e.g. Dentist, family dinner" required /><input name="due" type="date" required aria-label="Date" /><button className="primary">Add</button></form>
      <ul className="log">{events.map((v) => <li key={v.id}><div className="row"><span><b>{v.data.name}</b> {v.data.due}</span><button className="link" onClick={() => remove(v.id)}>Delete</button></div></li>)}</ul></section></div>;
}
