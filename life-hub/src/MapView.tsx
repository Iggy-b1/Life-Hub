import { FormEvent, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, save, remove } from './lib/db';
import { TERRITORIES, TKey, award } from './lib/xp';

type D = { name: string; desc: string; note: string; lng: number; lat: number; fav: boolean; found: boolean; paid?: boolean };
type P = { id?: string; territory: TKey; d: D };
const KEYS = Object.keys(TERRITORIES) as TKey[];

function Editor({ p, onClose }: { p: P; onClose: () => void }) {
  const [t, setT] = useState(p.territory), [d, setD] = useState(p.d);
  const set = (k: keyof D, v: string | boolean) => setD({ ...d, [k]: v });
  async function done(e: FormEvent) {
    e.preventDefault(); if (!d.name.trim()) return;
    const first = d.found && !d.paid; // XP once per marker, so ticking it on and off earns nothing extra
    await save(t, 'marker', { ...d, name: d.name.trim(), paid: d.paid || d.found }, p.id);
    if (first) await award(t, 'discovery', 15); onClose();
  }
  return <form className="editor" onSubmit={done} style={{ ['--c' as string]: TERRITORIES[t].color }}>
    <div className="row"><h2>{p.id ? 'Edit marker' : 'New marker'}</h2>
      <button type="button" className={`star ${d.fav ? 'on' : ''}`} aria-pressed={d.fav} aria-label="Favourite" onClick={() => set('fav', !d.fav)}>★</button></div>
    <input value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="Name this place" required autoFocus />
    <select value={t} onChange={(e) => setT(e.target.value as TKey)}>{KEYS.map((k) => <option key={k} value={k}>{TERRITORIES[k].name}</option>)}</select>
    <textarea value={d.desc} onChange={(e) => set('desc', e.target.value)} placeholder="Description" rows={2} />
    <textarea value={d.note} onChange={(e) => set('note', e.target.value)} placeholder="Private notes" rows={2} />
    <label className="row"><input type="checkbox" checked={d.found} onChange={(e) => set('found', e.target.checked)} /> Discovered (I've been here)</label>
    <small className="dim">{d.lat.toFixed(4)}, {d.lng.toFixed(4)}</small>
    <div className="row"><button type="button" className="link" onClick={onClose}>Close</button>
      {p.id && <button type="button" className="link warn" onClick={async () => { await remove(p.id!); onClose(); }}>Delete</button>}
      <button className="primary">Save</button></div></form>;
}

export default function MapView({ onBack }: { onBack: () => void }) {
  const box = useRef<HTMLDivElement>(null), map = useRef<maplibregl.Map>(), pins = useRef<maplibregl.Marker[]>([]);
  const [q, setQ] = useState(''), [hideFound, setHide] = useState(false), [off, setOff] = useState<TKey[]>([]), [edit, setEdit] = useState<P | null>(null);
  const rows = useLiveQuery(() => db.entities.where('kind').equals('marker').filter((e) => !e.deleted).toArray(), [], []);
  const all: P[] = rows.map((e) => ({ id: e.id, territory: e.territory as TKey, d: e.data as D }));
  const needle = q.trim().toLowerCase();
  const shown = all.filter((m) => !off.includes(m.territory) && !(hideFound && m.d.found) && (!needle || `${m.d.name} ${m.d.desc} ${m.d.note}`.toLowerCase().includes(needle)));
  const found = all.filter((m) => m.d.found).length;
  const go = (p: P) => map.current?.flyTo({ center: [p.d.lng, p.d.lat], zoom: Math.max(map.current.getZoom(), 12) });

  useEffect(() => {
    const m = new maplibregl.Map({ container: box.current!, center: [172.6, -41.3], zoom: 5, minZoom: 3.5,
      style: { version: 8, sources: { base: { type: 'raster', tileSize: 256, attribution: '© OpenStreetMap contributors © CARTO',
        tiles: ['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png`) } }, layers: [{ id: 'base', type: 'raster', source: 'base' }] } });
    m.addControl(new maplibregl.NavigationControl(), 'top-right'); m.addControl(new maplibregl.ScaleControl(), 'bottom-right');
    m.on('click', (e) => setEdit({ territory: 'lifestyle', d: { name: '', desc: '', note: '', lng: e.lngLat.lng, lat: e.lngLat.lat, fav: false, found: false } }));
    map.current = m; return () => m.remove();
  }, []);

  useEffect(() => {
    pins.current.forEach((p) => p.remove());
    pins.current = shown.map((p) => {
      const el = document.createElement('button');
      el.className = `pin${p.d.found ? ' found' : ''}${p.d.fav ? ' fav' : ''}`; el.title = el.ariaLabel = p.d.name;
      el.style.backgroundImage = `url(/assets/icons/${p.territory}.png)`;
      el.onclick = (ev) => { ev.stopPropagation(); setEdit(p); };
      return new maplibregl.Marker({ element: el }).setLngLat([p.d.lng, p.d.lat]).addTo(map.current!);
    });
  }, [JSON.stringify(shown)]);

  return <div className="mapwrap"><div ref={box} className="mapbox" />
    <aside className="side"><div className="row"><button className="link" onClick={onBack}>Back</button><h1>MY MAP</h1></div>
      <p className="dim">{found} of {all.length} discovered</p><div className="meter"><i style={{ width: `${all.length ? (found / all.length) * 100 : 0}%` }} /></div>
      <input type="search" placeholder="Search your map" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="row"><label className="row"><input type="checkbox" checked={hideFound} onChange={(e) => setHide(e.target.checked)} /> Hide found</label>
        <button className="link" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}>Full screen</button></div>
      <ul className="cats">{KEYS.map((t) => { const mine = all.filter((m) => m.territory === t), nxt = mine.find((m) => !m.d.found), T = TERRITORIES[t];
        return <li key={t} className={off.includes(t) ? 'off' : ''} style={{ ['--c' as string]: T.color }}>
          <button className="cat" aria-pressed={!off.includes(t)} onClick={() => setOff(off.includes(t) ? off.filter((x) => x !== t) : [...off, t])}>
            <img src={`/assets/icons/${t}.png`} alt="" width="28" height="28" /><span>{T.name}</span><small>{mine.filter((m) => m.d.found).length}/{mine.length}</small></button>
          <button className="nxt" disabled={!nxt} aria-label={`Next undiscovered ${T.name}`} onClick={() => nxt && go(nxt)}>›</button></li>; })}</ul>
      {needle && <ul className="results">{shown.slice(0, 8).map((p) => <li key={p.id}><button className="link" onClick={() => { go(p); setEdit(p); }}>{p.d.name}</button></li>)}</ul>}
      <p className="dim">Tap anywhere on the map to pin a place.</p></aside>
    {edit && <Editor key={`${edit.id}-${edit.d.lng}`} p={edit} onClose={() => setEdit(null)} />}</div>;
}
