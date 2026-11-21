import { FormEvent, useState } from 'react';
import { save, remove } from './lib/db';
import { useKind, dk, byAt } from './lib/hooks';
import { award } from './lib/xp';
import { BOOKS, TOTAL_CHAPTERS } from './lib/bible';
const TYPES = { prayer: 'Prayer request', gratitude: 'Gratitude', sermon: 'Sermon note', study: 'Study note', bookmark: 'Scripture bookmark' } as const;
type K = keyof typeof TYPES;

export default function Faith({ onBack }: { onBack: () => void }) {
  const reads = useKind('bible-read'), notes = useKind('faith-note').sort(byAt), church = useKind('church');
  const [bi, setBi] = useState(0), [type, setType] = useState<K>('prayer'), [show, setShow] = useState<K | 'all'>('all');
  const [name, count] = BOOKS[bi], mine = reads.filter((r) => r.data.book === name), done = new Set(mine.map((r) => r.data.ch));
  const total = new Set(reads.map((r) => `${r.data.book}:${r.data.ch}`)).size, today = dk(new Date().toISOString()), churchToday = church.some((c) => dk(c.data.at) === today);
  async function toggle(ch: number) {
    const r = mine.find((x) => x.data.ch === ch);
    if (r) return remove(r.id);
    await save('faith', 'bible-read', { book: name, ch, at: new Date().toISOString() }); await award('faith', 'reading', 5);
  }
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    await save('faith', 'faith-note', { type, text: f.text.trim(), ref: f.ref, answered: false, at: new Date().toISOString() }); await award('faith', 'note', 10); e.currentTarget.reset();
  }
  return <div className="shell"><header><button className="link" onClick={onBack}>Back</button><h1>FAITH</h1></header>
    <p className="dim note">This is a place to record your time in the Word and in prayer. XP and badges only count what you've done; they say nothing about your standing with God.</p>
    <section className="card"><div className="row"><h2>Bible reading</h2><small className="dim">{total} of {TOTAL_CHAPTERS} chapters</small></div>
      <div className="meter"><i style={{ width: `${(total / TOTAL_CHAPTERS) * 100}%` }} /></div>
      <select value={bi} onChange={(e) => setBi(+e.target.value)} aria-label="Book">{BOOKS.map(([n], i) => <option key={n} value={i}>{n}</option>)}</select>
      <small className="dim">{name}: {done.size} of {count} chapters read. Tap a chapter to mark it read.</small>
      <div className="chs">{Array.from({ length: count }, (_, i) => i + 1).map((c) => <button key={c} className={done.has(c) ? 'on' : ''} aria-pressed={done.has(c)} onClick={() => toggle(c)}>{c}</button>)}</div></section>
    <section className="card"><div className="row"><h2>Church</h2><small className="dim">{church.length} visits logged</small></div>
      <button className="primary" disabled={churchToday} onClick={async () => { await save('faith', 'church', { at: new Date().toISOString() }); await award('faith', 'church', 10); }}>{churchToday ? 'Logged for today' : 'I went to church today'}</button></section>
    <form className="card" onSubmit={add}><h2>Journal</h2>
      <select value={type} onChange={(e) => setType(e.target.value as K)} aria-label="Type">{(Object.keys(TYPES) as K[]).map((k) => <option key={k} value={k}>{TYPES[k]}</option>)}</select>
      <input name="ref" placeholder="Scripture reference (optional), e.g. Psalm 23" /><textarea name="text" rows={3} placeholder="Write here" required /><button className="primary">Save entry</button></form>
    <section><div className="row"><h2>Entries</h2><select value={show} onChange={(e) => setShow(e.target.value as K | 'all')} aria-label="Filter"><option value="all">All</option>{(Object.keys(TYPES) as K[]).map((k) => <option key={k} value={k}>{TYPES[k]}</option>)}</select></div>
      {notes.filter((n) => show === 'all' || n.data.type === show).length ? <ul className="log">{notes.filter((n) => show === 'all' || n.data.type === show).map((n) => <li key={n.id}>
        <div className="row"><b>{TYPES[n.data.type as K]}{n.data.ref ? `, ${n.data.ref}` : ''}</b><small className="dim">{dk(n.data.at)}</small></div><p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{n.data.text}</p>
        <span className="acts">{n.data.type === 'prayer' && <button className="link" onClick={() => save('faith', 'faith-note', { ...n.data, answered: !n.data.answered }, n.id)}>{n.data.answered ? 'Answered (undo)' : 'Mark answered'}</button>}
          <button className="link" onClick={() => remove(n.id)}>Delete</button></span></li>)}</ul> : <p className="dim">Nothing here yet.</p>}</section></div>;
}
