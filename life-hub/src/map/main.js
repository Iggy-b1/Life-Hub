import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import './styles.css';
import { TerrainSource } from './terrain.js';
import { buildStyle } from './style.js';
import { initUI } from './ui.js';

const abs = (p) => new URL(p, document.baseURI).href;
const manifest = await (await fetch('data/manifest.json', { cache: 'no-store' })).json();
const key = import.meta.env.VITE_LINZ_API_KEY;
const tpl = import.meta.env.VITE_LINZ_AERIAL_URL || 'https://basemaps.linz.govt.nz/v1/tiles/aerial/WebMercatorQuad/{z}/{x}/{y}.webp?api={key}';
const aerialUrl = key ? tpl.replace('{key}', key) : null;

const ts = new TerrainSource(manifest.terrain, abs);
maplibregl.addProtocol('nzterrain', async (p) => {
  const [z, x, y] = p.url.replace('nzterrain://', '').split('/').map(Number);
  return { data: await ts.get(z, x, y) };
});
maplibregl.addProtocol('pmtiles', new Protocol().tile);

const notes = [];
if (!manifest.vector) notes.push('Vector basemap not built: run  python pipeline/nzbuild.py vector');
if (!manifest.terrain.fallback) notes.push('Using stand-in terrain: run  python pipeline/nzbuild.py fallback');
if (!aerialUrl) notes.push('No LINZ key: satellite mode disabled (see .env.example)');
if (notes.length) { const b = document.getElementById('banner'); b.hidden = false; b.innerHTML = notes.join('<br>'); }

const map = new maplibregl.Map({
  container: 'map', hash: true, center: [172.6, -41.3], zoom: 4.8, pitch: 50, maxPitch: 85, minZoom: 3, maxZoom: 19.5,
  style: buildStyle({ vectorUrl: manifest.vector ? abs(manifest.vector.url) : null, aerialUrl, overlays: manifest.overlays || [], abs }),
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
map.on('load', () => {
  map.setTerrain({ source: 'terrain', exaggeration: 1.5 });
  try { map.setSky({ 'sky-color': '#2a1458', 'horizon-color': '#ff7a59', 'fog-color': '#3b1f5e', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.4 }); } catch (e) { /* older engines */ }
  initUI(map, { ts, manifest, hasAerial: !!aerialUrl });
});
