// GTA-inspired night style over the OpenMapTiles schema (the schema Planetiler produces).
// Every layer carries metadata.group; the UI toggles groups, so new layers/overlays appear in the panel automatically.
export const GROUPS = { roads: 'Roads', tracks: 'Walking tracks', buildings: 'Buildings', water: 'Rivers & lakes', land: 'Land cover', hillshade: 'Hillshade', labels: 'Labels' };
const C = { bg: '#0f0b1c', water: '#16286a', waterLine: '#2f4fc0', wood: '#133127', grass: '#1d2e22', farm: '#262d1f', wet: '#173a3a', sand: '#4a3d33', rock: '#352f3d', ice: '#9aa6c9', res: '#1d1630', ind: '#241a35', park: '#17382b', bld: '#3a2f5c', text: '#ffe8d2', halo: '#0f0b1c' };
const ROAD = { motorway: ['#ff9a3c', 3.2, 4], trunk: ['#ff7a59', 2.6, 5], primary: ['#ffc46b', 2.2, 7], secondary: ['#f2b6a0', 1.8, 9], tertiary: ['#c9a5c9', 1.4, 11], minor: ['#8d7fae', 1, 12], service: ['#6c6091', 0.7, 14] };
const rw = (w) => ['interpolate', ['exponential', 1.5], ['zoom'], 5, w * 0.25, 10, w * 1.1, 14, w * 3.5, 18, w * 12];

export function buildStyle({ vectorUrl, aerialUrl, overlays = [], abs }) {
  const L = [];
  const add = (group, l, sat) => L.push({ ...l, metadata: { group, sat } });
  const nz = (id, layer, extra) => ({ id, source: 'nz', 'source-layer': layer, ...extra });
  const V = !!vectorUrl;

  add('bg', { id: 'bg', type: 'background', paint: { 'background-color': C.bg } });
  if (aerialUrl) add('aerial', { id: 'aerial', type: 'raster', source: 'aerial', layout: { visibility: 'none' } });

  if (V) {
    const lc = { wood: C.wood, grass: C.grass, farmland: C.farm, wetland: C.wet, sand: C.sand, rock: C.rock, ice: C.ice };
    add('land', nz('landcover', 'landcover', { type: 'fill', paint: { 'fill-color': ['match', ['get', 'class'], ...Object.entries(lc).flat(), C.grass] } }), 'hide');
    add('land', nz('landuse', 'landuse', { type: 'fill', paint: { 'fill-color': ['match', ['get', 'class'], 'residential', C.res, 'industrial', C.ind, 'commercial', C.ind, 'cemetery', C.park, 'pitch', C.park, '#1c1730'], 'fill-opacity': 0.85 } }), 'hide');
    add('land', nz('park', 'park', { type: 'fill', paint: { 'fill-color': C.park, 'fill-opacity': 0.7 } }), 'hide');
  }
  add('hillshade', { id: 'hillshade', type: 'hillshade', source: 'hill', paint: { 'hillshade-exaggeration': 0.75, 'hillshade-shadow-color': '#05020d', 'hillshade-highlight-color': '#ffb27a', 'hillshade-accent-color': '#3b1f5e', 'hillshade-illumination-direction': 315 } });

  if (V) {
    add('water', nz('water', 'water', { type: 'fill', paint: { 'fill-color': C.water } }), 'hide');
    add('water', nz('waterway', 'waterway', { type: 'line', minzoom: 8, paint: { 'line-color': C.waterLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 16, 4] } }));
    const T = (id, extra) => nz(id, 'transportation', extra);
    const notTunnel = ['!=', ['get', 'brunnel'], 'tunnel'];
    add('roads', T('tunnels', { type: 'line', minzoom: 11, filter: ['==', ['get', 'brunnel'], 'tunnel'], paint: { 'line-color': '#6c6091', 'line-dasharray': [2, 2], 'line-width': rw(1.5) } }));
    add('roads', T('rail', { type: 'line', minzoom: 8, filter: ['==', ['get', 'class'], 'rail'], paint: { 'line-color': '#5d4f80', 'line-dasharray': [3, 2], 'line-width': rw(0.6) } }));
    add('roads', T('ferry', { type: 'line', filter: ['==', ['get', 'class'], 'ferry'], paint: { 'line-color': '#4a6bd6', 'line-dasharray': [2, 3], 'line-width': 1.2 } }));
    add('roads', T('bridge-case', { type: 'line', minzoom: 11, filter: ['==', ['get', 'brunnel'], 'bridge'], paint: { 'line-color': '#d8c8f0', 'line-width': rw(4.5) } }));
    for (const [c, [, w, mz]] of Object.entries(ROAD)) add('roads', T(`${c}-case`, { type: 'line', minzoom: mz, filter: ['all', ['==', ['get', 'class'], c], notTunnel], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#07040f', 'line-width': rw(w + 1.2) } }));
    for (const [c, [col, w, mz]] of Object.entries(ROAD)) add('roads', T(c, { type: 'line', minzoom: mz, filter: ['all', ['==', ['get', 'class'], c], notTunnel], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': col, 'line-width': rw(w) } }));
    add('tracks', T('track', { type: 'line', minzoom: 12, filter: ['==', ['get', 'class'], 'track'], paint: { 'line-color': '#f0b27a', 'line-dasharray': [2, 1.5], 'line-width': rw(0.6) } }));
    add('tracks', T('path', { type: 'line', minzoom: 12, filter: ['==', ['get', 'class'], 'path'], paint: { 'line-color': '#9be3a4', 'line-dasharray': [1.5, 1.5], 'line-width': rw(0.5) } }));
    add('buildings', nz('buildings', 'building', { type: 'fill-extrusion', minzoom: 13, paint: { 'fill-extrusion-color': C.bld, 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 5], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': 0.9 } }));
  }

  // overlays registered in manifest.json: { id, label, source:{...maplibre source}, layers:[...] }
  const ov = [];
  for (const o of overlays) for (const l of o.layers) ov.push({ ...l, source: `ov-${o.id}`, metadata: { group: `ov-${o.id}` } });

  if (V) {
    const font = { 'text-font': ['Open Sans Regular,Arial Unicode MS Regular'] };
    const paint = { 'text-color': C.text, 'text-halo-color': C.halo, 'text-halo-width': 1.5 };
    const place = (id, cls, mz, s0, s1) => add('labels', nz(id, 'place', { type: 'symbol', minzoom: mz, filter: ['in', ['get', 'class'], ['literal', cls]], layout: { 'text-field': ['get', 'name'], ...font, 'text-size': ['interpolate', ['linear'], ['zoom'], mz, s0, 14, s1] }, paint }));
    place('place-city', ['city'], 3, 12, 24); place('place-town', ['town'], 6, 11, 17); place('place-village', ['village', 'suburb', 'neighbourhood', 'hamlet'], 10, 10, 14);
    add('labels', nz('water-name', 'water_name', { type: 'symbol', layout: { 'text-field': ['get', 'name'], ...font, 'text-size': 12 }, paint: { ...paint, 'text-color': '#7d98ff' } }));
    add('labels', nz('peaks', 'mountain_peak', { type: 'symbol', minzoom: 9, layout: { 'text-field': ['concat', ['coalesce', ['get', 'name'], ''], '\n▲ ', ['to-string', ['coalesce', ['get', 'ele'], '']], ' m'], ...font, 'text-size': 11, 'text-anchor': 'top' }, paint: { ...paint, 'text-color': '#ffb27a' } }));
    add('labels', nz('road-names', 'transportation_name', { type: 'symbol', minzoom: 12, layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name'], ['get', 'ref']], ...font, 'text-size': 11 }, paint }));
  }
  const i = L.findIndex((l) => l.metadata.group === 'labels');
  L.splice(i < 0 ? L.length : i, 0, ...ov);

  const sources = {
    terrain: { type: 'raster-dem', tiles: ['nzterrain://{z}/{x}/{y}'], tileSize: 256, maxzoom: 17, encoding: 'terrarium', attribution: '© LINZ CC BY 4.0 (elevation)' },
    hill: { type: 'raster-dem', tiles: ['nzterrain://{z}/{x}/{y}'], tileSize: 256, maxzoom: 17, encoding: 'terrarium' },
  };
  if (V) sources.nz = { type: 'vector', url: `pmtiles://${vectorUrl}`, maxzoom: 14, attribution: '© OpenStreetMap contributors © OpenMapTiles' };
  if (aerialUrl) sources.aerial = { type: 'raster', tiles: [aerialUrl], tileSize: 256, maxzoom: 19, attribution: '© <a href="https://www.linz.govt.nz/linz-copyright">LINZ CC BY 4.0</a> Imagery Basemap contributors' };
  for (const o of overlays) {
    const s = { ...o.source };
    if (s.url?.startsWith('pmtiles://')) s.url = 'pmtiles://' + abs(s.url.slice(10));
    sources[`ov-${o.id}`] = s;
  }
  return { version: 8, glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf', sources, layers: L };
}

// visibility = group toggle AND mode rule (satellite mode hides painted ground so imagery shows)
export function applyVis(map, st) {
  for (const l of map.getStyle().layers) {
    const g = l.metadata?.group, sat = st.mode === 'sat';
    if (g === 'bg') continue;
    const on = g === 'aerial' ? sat : st.vis[g] !== false && !(sat && l.metadata.sat === 'hide');
    map.setLayoutProperty(l.id, 'visibility', on ? 'visible' : 'none');
  }
}
