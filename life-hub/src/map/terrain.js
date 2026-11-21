// Multi-archive terrain loader.
// Serves Terrarium-encoded DEM tiles to MapLibre through a custom protocol (nzterrain://z/x/y).
// Lookup order: regional LiDAR archives (best first) -> national fallback -> up-sampled ancestor tile -> remote stand-in -> flat sea level.
// New LiDAR regions are picked up from manifest.json only; this file never changes when data is added.
import { PMTiles } from 'pmtiles';

const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const lat2y = (lat, z) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z; };
const covers = (l, z, x, y) => { const [w, s, e, n] = l.bounds; return z >= l.minzoom && z <= l.maxzoom && x + 1 > lon2x(w, z) && x < lon2x(e, z) && y + 1 > lat2y(n, z) && y < lat2y(s, z); };

async function decode(buf) {
  const bmp = await createImageBitmap(new Blob([buf]));
  const g = new OffscreenCanvas(256, 256).getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  const d = g.getImageData(0, 0, 256, 256).data, out = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) out[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
  return out;
}
async function encode(el) {
  const c = new OffscreenCanvas(256, 256), g = c.getContext('2d'), im = g.createImageData(256, 256);
  for (let i = 0; i < 65536; i++) {
    const v = Math.min(65535.99, Math.max(0, el[i] + 32768)), f = Math.floor(v);
    im.data.set([Math.floor(f / 256), f % 256, Math.floor((v - f) * 256), 255], i * 4);
  }
  g.putImageData(im, 0, 0);
  return (await c.convertToBlob({ type: 'image/png' })).arrayBuffer();
}
// Bilinear up-sample of one quadrant of an ancestor tile (done on elevation values, never on encoded colours).
async function overzoom(buf, dz, ox, oy) {
  const src = await decode(buf), n = 2 ** dz, out = new Float32Array(65536);
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
    const u = Math.min(255, Math.max(0, (ox * 256 + i + 0.5) / n - 0.5)), v = Math.min(255, Math.max(0, (oy * 256 + j + 0.5) / n - 0.5));
    const x0 = Math.floor(u), y0 = Math.floor(v), x1 = Math.min(255, x0 + 1), y1 = Math.min(255, y0 + 1), fx = u - x0, fy = v - y0;
    out[j * 256 + i] = (src[y0 * 256 + x0] * (1 - fx) + src[y0 * 256 + x1] * fx) * (1 - fy) + (src[y1 * 256 + x0] * (1 - fx) + src[y1 * 256 + x1] * fx) * fy;
  }
  return encode(out);
}

export class TerrainSource {
  constructor(cfg, abs) {
    this.remote = cfg.remote || null;
    const list = [...(cfg.regions || [])].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.resolution - b.resolution);
    if (cfg.fallback) list.push(cfg.fallback);
    this.layers = list.map((l) => ({ ...l, pm: new PMTiles(abs(l.url)) }));
    this.last = this.layers.length ? '' : 'stand-in terrain (run the pipeline)';
    this.cache = new Map(); this.flat = null;
  }
  get(z, x, y) {
    const k = `${z}/${x}/${y}`;
    if (!this.cache.has(k)) {
      this.cache.set(k, this._get(z, x, y));
      if (this.cache.size > 600) this.cache.delete(this.cache.keys().next().value);
    }
    return this.cache.get(k);
  }
  async _get(z, x, y) {
    for (let dz = 0; dz <= z; dz++) {
      const pz = z - dz, px = x >> dz, py = y >> dz;
      for (const l of this.layers) {
        if (!covers(l, pz, px, py)) continue;
        let r; try { r = await l.pm.getZxy(pz, px, py); } catch (e) { continue; }
        if (!r) continue;
        if (dz === 0) { this.last = `${l.label} · ${l.resolution} m`; return r.data; }
        return overzoom(r.data, dz, x - (px << dz), y - (py << dz));
      }
    }
    if (this.remote) {
      try {
        const r = await fetch(this.remote.replace('{z}', z).replace('{x}', x).replace('{y}', y));
        if (r.ok) { this.last = 'stand-in terrain (AWS Terrain Tiles)'; return r.arrayBuffer(); }
      } catch (e) { /* fall through to flat */ }
    }
    return (this.flat ||= encode(new Float32Array(65536)));
  }
}
