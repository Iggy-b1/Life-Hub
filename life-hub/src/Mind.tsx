import { FormEvent, useState } from 'react';
import { save, remove } from './lib/db';
import { useKind, dk, byAt } from './lib/hooks';
import { award } from './lib/xp';
const NEXT = { want: 'reading', reading: 'done', done: 'want' } as const;
const label = { want: 'Want to read', reading: 'Reading', done: 'Finished' } as const;
const form = (e: FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;

export default function Mind({ onBack }: { onBack: () => void }) {
  const journal = useKind('journal').sort(byAt), habits = useKind('habit'), logs = useKind('habit-log'), books = useKind('book');
  const [tab, setTab] = useState(0), today = dk(new Date().toISOString());
  const streak = (id: string) => { const days = new Set(logs.filter((l) => l.data.habitId === id).map((l) => l.data.day)); const d = new Date(); let n = 0;
    if (!days.has(dk(d.toISOString()))) d.setDate(d.getDate() - 1); while (days.has(dk(d.toISOString()))) { n++; d.setDate(d.getDate() - 1); } return n; };
  async function check(id: string) {
    const l = logs.find((x) => x.data.habitId === id && x.data.day === today); if (l) return remove(l.id);
    await save('mind', 'habit-log', { habitId: id, day: today, at: new Date().toISOString() }); await award('mind', 'habit', 5);
  }
  async function step(b: { id: string; data: { status: keyof typeof NEXT; paid?: boolean } }) {
    const status = NEXT[b.data.status]; await save('mind', 'book', { ...b.data, status, paid: b.data.paid || status === 'done' }, b.id);
    if (status === 'done' && !b.data.paid) await award('mind', 'book finished', 20);
  }
  return <div className="shell"><header><button className="link" onClick={onBack}>Back</button><h1>MIND</h1></header>
    <div className="acts">{['Journal', 'Habits', 'Books'].map((t, i) => <button key={t} className={i === tab ? 'primary' : 'link'} onClick={() => setTab(i)}>{t}</button>)}</div>
    {tab === 0 && <><form className="card" onSubmit={async (e) => { e.preventDefault(); const f = form(e); await save('mind', 'journal', { text: f.text.trim(), mood: +f.mood, energy: +f.energy, at: new Date().toISOString() }); await award('mind', 'journal', 10); e.currentTarget.reset(); }}>
      <textarea name="text" rows={4} placeholder="How was today? What's on your mind?" required /><div className="grid2">
        <label>Mood<select name="mood" defaultValue="3"><option value="5">Great</option><option value="4">Good</option><option value="3">Okay</option><option value="2">Low</option><option value="1">Very low</option></select></label>
        <label>Energy<select name="energy" defaultValue="3"><option value="5">High</option><option value="4">Good</option><option value="3">Okay</option><option value="2">Low</option><option value="1">Drained</option></select></label></div>
      <button className="primary">Save entry</button></form>
      <ul className="log">{journal.map((j) => <li key={j.id}><div className="row"><b>{dk(j.data.at)}</b><small className="dim">mood {j.data.mood}/5, energy {j.data.energy}/5</small></div>
        <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{j.data.text}</p><button className="link" onClick={() => remove(j.id)}>Delete</button></li>)}</ul></>}
    {tab === 1 && <><form className="card" onSubmit={async (e) => { e.preventDefault(); await save('mind', 'habit', { name: form(e).name.trim() }); e.currentTarget.reset(); }}>
      <input name="name" placeholder="New habit, e.g. Read 10 pages" required /><button className="primary">Add habit</button></form>
      {habits.length ? <ul className="log">{habits.map((h) => { const on = logs.some((l) => l.data.habitId === h.id && l.data.day === today);
        return <li key={h.id}><div className="row"><span><b>{h.data.name}</b> <small className="dim">{streak(h.id)} day streak</small></span>
          <span className="acts"><button className={on ? 'primary' : 'link'} aria-pressed={on} onClick={() => check(h.id)}>{on ? 'Done today' : 'Mark done'}</button><button className="link" onClick={() => remove(h.id)}>Delete</button></span></div></li>; })}</ul>
        : <p className="dim">No habits yet. Start with one small thing.</p>}</>}
    {tab === 2 && <><form className="card" onSubmit={async (e) => { e.preventDefault(); const f = form(e); await save('mind', 'book', { title: f.title.trim(), author: f.author, status: 'want' }); e.currentTarget.reset(); }}>
      <div className="grid2"><input name="title" placeholder="Book title" required /><input name="author" placeholder="Author" /></div><button className="primary">Add book</button></form>
      {books.length ? <ul className="log">{books.map((b) => <li key={b.id}><div className="row"><span><b>{b.data.title}</b> <small className="dim">{b.data.author}</small></span>
        <span className="acts"><button className="link" onClick={() => step(b as never)}>{label[b.data.status as keyof typeof label]} (change)</button><button className="link" onClick={() => remove(b.id)}>Delete</button></span></div></li>)}</ul>
        : <p className="dim">Add a book to start your reading list.</p>}</>}</div>;
}
