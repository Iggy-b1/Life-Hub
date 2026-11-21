import { GROUPS, applyVis } from './style.js';

export async function initUI(map, { ts, manifest, hasAerial }) {
  const groups = { ...GROUPS };
  for (const o of manifest.overlays || []) groups[`ov-${o.id}`] = o.label;
  const st = { mode: 'night', vis: {}, ex: 1.5, terrain: true };
  const places = await (await fetch('data/places.json')).json();
  const $ = (s) => document.querySelector(s);
  $('#panel').innerHTML = `<h1>NZ EXPLORER</h1>
  <div class="row"><button id="m-night" class="on">Night</button><button id="m-sat" ${hasAerial ? '' : 'disabled title="Add a LINZ key to .env"'}>Satellite</button></div>
  <h4>Go to</h4><select id="fly">${places.map((p, i) => `<option value="${i}">${p.n}</option>`).join('')}</select>
  <h4>Camera</h4><div class="row"><button data-p="0">Flat</button><button data-p="60">3D</button><button data-p="82">Horizon</button></div>
  <h4>3D terrain</h4><label><input type="checkbox" id="t3d" checked> Enabled</label>
  <label>Exaggeration <span id="exv">1.5×</span></label><input type="range" id="ex" min="1" max="5" step="0.1" value="1.5">
  <h4>Layers</h4>${Object.entries(groups).map(([k, v]) => `<label><input type="checkbox" data-g="${k}" checked> ${v}</label>`).join('')}`;

  const apply = () => applyVis(map, st);
  $('#m-night').onclick = () => { st.mode = 'night'; $('#m-night').classList.add('on'); $('#m-sat').classList.remove('on'); apply(); };
  $('#m-sat').onclick = () => { st.mode = 'sat'; $('#m-sat').classList.add('on'); $('#m-night').classList.remove('on'); apply(); };
  document.querySelectorAll('[data-g]').forEach((c) => (c.onchange = () => { st.vis[c.dataset.g] = c.checked; apply(); }));
  document.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => map.easeTo({ pitch: +b.dataset.p, duration: 800 })));
  $('#fly').onchange = (e) => { const p = places[+e.target.value]; map.flyTo({ center: p.c, zoom: p.z, pitch: p.p ?? 65, bearing: p.b ?? 0, duration: 3000 }); };
  const terrain = () => map.setTerrain(st.terrain ? { source: 'terrain', exaggeration: st.ex } : null);
  $('#t3d').onchange = (e) => { st.terrain = e.target.checked; terrain(); };
  $('#ex').oninput = (e) => { st.ex = +e.target.value; $('#exv').textContent = st.ex.toFixed(1) + '×'; if (st.terrain) terrain(); };

  // live readout: coordinates, elevation under the cursor, camera, and which elevation dataset is serving
  let pos = map.getCenter(), raf = 0;
  const draw = () => {
    raf = 0;
    const el = map.queryTerrainElevation(pos);
    $('#hud').textContent = `${pos.lat.toFixed(5)}°, ${pos.lng.toFixed(5)}°  ·  ${el == null ? '–' : Math.round(el) + ' m'}  ·  zoom ${map.getZoom().toFixed(1)}  ·  pitch ${Math.round(map.getPitch())}°  ·  bearing ${Math.round(map.getBearing())}°  ·  elevation: ${ts.last || 'loading'}`;
  };
  map.on('mousemove', (e) => { pos = e.lngLat; raf ||= requestAnimationFrame(draw); });
  map.on('moveend', draw); draw();

  // click any vector feature to inspect it
  map.on('click', (e) => {
    const f = map.queryRenderedFeatures(e.point).find((x) => x.source !== 'terrain' && x.properties && Object.keys(x.properties).length);
    const box = $('#info');
    if (!f) { box.hidden = true; return; }
    const rows = Object.entries(f.properties).slice(0, 12).map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('');
    box.innerHTML = `<b>${f.properties.name || f.layer.id}</b> <small>${f.sourceLayer || f.layer.id}</small>${rows}`;
    box.hidden = false;
  });
}
