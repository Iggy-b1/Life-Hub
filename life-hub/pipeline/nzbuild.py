#!/usr/bin/env python3
"""NZ Explorer data pipeline.

  python pipeline/nzbuild.py check              verify tools
  python pipeline/nzbuild.py vector             OSM -> public/data/nz.pmtiles (roads, water, buildings, places...)
  python pipeline/nzbuild.py fallback           national 8 m DEM -> public/data/terrain/nz-8m.pmtiles
  python pipeline/nzbuild.py region <id>        1 m LiDAR region (see regions.json) laid over the fallback
  python pipeline/nzbuild.py status             what is registered in manifest.json
"""
import argparse, io, json, math, os, shutil, sqlite3, subprocess, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW, WORK = ROOT / 'data' / 'raw', ROOT / 'data' / 'work'
PUB = ROOT / 'public' / 'data'
MAN = PUB / 'manifest.json'
BUCKET = 's3://nz-elevation'
# Confirm with:  aws s3 ls --no-sign-request s3://nz-elevation/new-zealand/new-zealand/
FALLBACK_PREFIX = os.environ.get('FALLBACK_PREFIX', 'new-zealand/new-zealand/dem_8m/2193/')
NZ_BOUNDS = [165.8, -47.6, 178.7, -34.0]
NODATA, ORIGIN = -9999.0, 20037508.342789244


def sh(cmd, cwd=None):
    print('+', *map(str, cmd), flush=True)
    subprocess.run([str(c) for c in cmd], check=True, cwd=cwd)


def manifest(): return json.loads(MAN.read_text())
def save_manifest(m): MAN.write_text(json.dumps(m, indent=2, ensure_ascii=False) + '\n')
def size(p): return f'{p.stat().st_size / 1e9:.2f} GB'


# ---------- tools ----------
def check(_):
    for t in ('java', 'aws', 'gdalbuildvrt'): print(f'{t:14}', shutil.which(t) or 'MISSING')
    for m in ('rasterio', 'numpy', 'PIL', 'pmtiles'):
        try: __import__(m); print(f'{m:14} ok')
        except ImportError: print(f'{m:14} MISSING')


# ---------- vector (roads, water, landcover, buildings, places, peaks) ----------
def vector(a):
    WORK.mkdir(parents=True, exist_ok=True); PUB.mkdir(parents=True, exist_ok=True)
    jar = WORK / 'planetiler.jar'
    if not jar.exists():
        print('Downloading planetiler.jar ...')
        urllib.request.urlretrieve('https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar', jar)
    out = PUB / 'nz.pmtiles'
    sh(['java', f'-Xmx{a.mem}', '-jar', jar, '--download', '--area=new-zealand', f'--output={out}', '--force'], cwd=WORK)
    m = manifest(); m['vector'] = {'url': 'data/nz.pmtiles', 'schema': 'openmaptiles', 'maxzoom': 14}; save_manifest(m)
    print('vector tiles:', size(out))


# ---------- elevation ----------
def sync(prefix, dest, patterns):
    dest.mkdir(parents=True, exist_ok=True)
    cmd = ['aws', 's3', 'sync', '--no-sign-request', f'{BUCKET}/{prefix}', dest, '--exclude', '*']
    for p in patterns: cmd += ['--include', p]
    sh(cmd)
    files = sorted(p for p in dest.rglob('*') if p.suffix in ('.tif', '.tiff'))
    if not files:
        sys.exit(f'No GeoTIFFs found under {BUCKET}/{prefix}\nExplore the bucket:  aws s3 ls --no-sign-request {BUCKET}/{prefix.split("/")[0]}/')
    return files


def make_vrt(files, out):
    WORK.mkdir(parents=True, exist_ok=True)
    lst = out.with_suffix('.txt'); lst.write_text('\n'.join(map(str, files)))
    sh(['gdalbuildvrt', '-overwrite', '-input_file_list', lst, out]); return out


def enc(a):
    import numpy as np; from PIL import Image
    v = np.clip(a + 32768.0, 0, 65535.99); f = np.floor(v)
    rgb = np.dstack([(f // 256), f % 256, (v - f) * 256]).astype('uint8')
    b = io.BytesIO(); Image.fromarray(rgb, 'RGB').save(b, 'PNG', compress_level=6); return b.getvalue()


def dec(b):
    import numpy as np; from PIL import Image
    im = np.asarray(Image.open(io.BytesIO(b)).convert('RGB'), dtype='float32')
    return im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768


def tile_of(lon, lat, z):
    n = 2 ** z; r = math.radians(lat)
    return (max(0, min(n - 1, int((lon + 180) / 360 * n))), max(0, min(n - 1, int((1 - math.asinh(math.tan(r)) / math.pi) / 2 * n))))


def build_tiles(layers, name, bounds, minz, maxz):
    """layers: DEM rasters, lowest priority first. Higher-priority rasters overwrite wherever they have valid data.
    Max zoom is cut straight from the sources; lower zooms are averaged up from child tiles (never from encoded colours)."""
    import numpy as np, rasterio
    from rasterio.enums import Resampling
    from rasterio.transform import Affine
    from rasterio.vrt import WarpedVRT
    from rasterio.windows import Window
    WORK.mkdir(parents=True, exist_ok=True)
    mb = WORK / f'{name}.mbtiles'; mb.unlink(missing_ok=True)
    db = sqlite3.connect(mb)
    db.executescript('CREATE TABLE metadata(name text,value text);CREATE TABLE tiles(zoom_level integer,tile_column integer,tile_row integer,tile_data blob);CREATE UNIQUE INDEX t ON tiles(zoom_level,tile_column,tile_row);')
    w, s, e, n = bounds
    x0, y0 = tile_of(w, n, maxz); x1, y1 = tile_of(e, s, maxz)
    res = ORIGIN * 2 / 256 / 2 ** maxz
    T = Affine(res, 0, -ORIGIN + x0 * 256 * res, 0, -res, ORIGIN - y0 * 256 * res)
    srcs = [rasterio.open(p) for p in layers]
    vr = [WarpedVRT(x, crs='EPSG:3857', transform=T, width=(x1 - x0 + 1) * 256, height=(y1 - y0 + 1) * 256,
                    resampling=Resampling.bilinear, src_nodata=x.nodata if x.nodata is not None else NODATA, nodata=NODATA) for x in srcs]
    cnt = 0
    for ty in range(y0, y1 + 1):
        for tx in range(x0, x1 + 1):
            win = Window((tx - x0) * 256, (ty - y0) * 256, 256, 256); out = None
            for v in vr:
                a = v.read(1, window=win).astype('float32'); ok = (a != NODATA) & np.isfinite(a)
                if ok.any(): out = np.where(ok, a, 0 if out is None else out)
            if out is None: continue
            db.execute('INSERT INTO tiles VALUES(?,?,?,?)', (maxz, tx, 2 ** maxz - 1 - ty, enc(out))); cnt += 1
            if cnt % 500 == 0: db.commit(); print(f'  z{maxz}: {cnt} tiles', end='\r', flush=True)
    db.commit(); print(f'  z{maxz}: {cnt} tiles')
    for z in range(maxz - 1, minz - 1, -1):
        k = 2 ** (z + 1)
        parents = {(c >> 1, (k - 1 - r) >> 1) for c, r in db.execute('SELECT tile_column,tile_row FROM tiles WHERE zoom_level=?', (z + 1,))}
        for px, py in parents:
            big = np.zeros((512, 512), 'float32')
            for i in (0, 1):
                for j in (0, 1):
                    row = db.execute('SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?', (z + 1, 2 * px + i, k - 1 - (2 * py + j))).fetchone()
                    if row: big[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = dec(row[0])
            db.execute('INSERT INTO tiles VALUES(?,?,?,?)', (z, px, 2 ** z - 1 - py, enc(big.reshape(256, 2, 256, 2).mean(axis=(1, 3)))))
        db.commit(); print(f'  z{z} done')
    meta = {'name': name, 'format': 'png', 'minzoom': minz, 'maxzoom': maxz, 'bounds': ','.join(map(str, bounds)), 'type': 'baselayer', 'version': '1', 'description': 'Terrarium-encoded DEM'}
    db.executemany('INSERT INTO metadata VALUES(?,?)', [(k, str(v)) for k, v in meta.items()]); db.commit(); db.close()
    out = PUB / 'terrain' / f'{name}.pmtiles'; out.parent.mkdir(parents=True, exist_ok=True); out.unlink(missing_ok=True)
    try:
        from pmtiles.convert import mbtiles_to_pmtiles
        mbtiles_to_pmtiles(str(mb), str(out), maxz)
    except ImportError:
        sh(['pmtiles', 'convert', mb, out])
    mb.unlink(); print(f'{name}: {size(out)}'); return out


def register(entry, fallback=False):
    m = manifest(); t = m['terrain']
    if fallback: t['fallback'] = entry
    else: t['regions'] = [r for r in t['regions'] if r['id'] != entry['id']] + [entry]
    save_manifest(m)


def fallback(a):
    files = sync(FALLBACK_PREFIX, RAW / 'fallback', ['*.tif', '*.tiff'])
    v = make_vrt(files, WORK / 'fallback.vrt')
    build_tiles([v], 'nz-8m', NZ_BOUNDS, 0, 14)
    register({'id': 'nz-8m', 'label': 'National 8 m DEM', 'url': 'data/terrain/nz-8m.pmtiles', 'resolution': 8, 'minzoom': 0, 'maxzoom': 14, 'bounds': NZ_BOUNDS}, fallback=True)


def region(a):
    cfg = json.loads((ROOT / 'pipeline' / 'regions.json').read_text())[a.id]
    fb = WORK / 'fallback.vrt'
    if not fb.exists(): sys.exit('Run the `fallback` step first (regions are laid over it so tile edges have no holes).')
    files = sync(cfg['s3_prefix'], RAW / 'lidar' / a.id, ['*dem_1m/2193/*.tif', '*dem_1m/2193/*.tiff'])  # later surveys sort last and paint on top
    lv = make_vrt(files, WORK / f'{a.id}.vrt')
    mx = a.maxzoom or cfg.get('maxzoom', 16)
    build_tiles([fb, lv], a.id, cfg['bounds'], cfg.get('minzoom', 10), mx)
    register({'id': a.id, 'label': cfg['label'], 'url': f'data/terrain/{a.id}.pmtiles', 'resolution': 1, 'priority': cfg.get('priority', 0), 'minzoom': cfg.get('minzoom', 10), 'maxzoom': mx, 'bounds': cfg['bounds']})


def status(_):
    m = manifest(); print('vector :', m['vector'] and m['vector']['url'])
    print('fallback:', m['terrain']['fallback'] and m['terrain']['fallback']['url'])
    for r in m['terrain']['regions']: print('region  :', r['id'], f"z{r['minzoom']}-{r['maxzoom']}")


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = p.add_subparsers(dest='cmd', required=True)
    sp.add_parser('check').set_defaults(f=check); sp.add_parser('fallback').set_defaults(f=fallback); sp.add_parser('status').set_defaults(f=status)
    v = sp.add_parser('vector'); v.add_argument('--mem', default='4g'); v.set_defaults(f=vector)
    r = sp.add_parser('region'); r.add_argument('id'); r.add_argument('--maxzoom', type=int); r.set_defaults(f=region)
    a = p.parse_args(); a.f(a)
