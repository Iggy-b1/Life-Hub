# NZ Explorer

A 3D, game-style map of all of New Zealand. MapLibre GL JS renders it; PMTiles files supply the data. Terrain uses the best elevation available per area: 1 m LiDAR where it exists, a national 8 m model everywhere else, so there are no blank patches.

## Run it (no data needed)
```bash
npm install
cp .env.example .env     # optional: add a free LINZ key for satellite mode
npm run dev              # http://localhost:5173
```
Before you build any data you get 3D terrain from public AWS Terrain Tiles as a stand-in, plus a banner saying which pipeline step is next.

## Build the real data
Install: Node 20+, Java 21+, [Miniconda](https://docs.conda.io/en/latest/miniconda.html).
```bash
conda env create -f pipeline/environment.yml && conda activate nzmap
python pipeline/nzbuild.py check
python pipeline/nzbuild.py vector            # roads, tracks, water, buildings, towns (~0.5-1 GB)
python pipeline/nzbuild.py fallback          # national 8 m elevation   (est. 2-5 GB)
python pipeline/nzbuild.py region bay-of-plenty   # 1 m LiDAR pilot     (est. 3-8 GB at z16)
python pipeline/nzbuild.py status
```
Reload the page after each step. Each step registers itself in `public/data/manifest.json`.

## Use
Drag to pan, right-drag or Ctrl-drag to rotate and tilt, scroll to zoom. Hover for elevation, click any feature for its attributes. The panel has Night/Satellite, 3D terrain and exaggeration, camera presets, and layer toggles.

## Things to check
- `FALLBACK_PREFIX` in `pipeline/nzbuild.py` (the 8 m DEM folder in `s3://nz-elevation`) and `s3_prefix` in `pipeline/regions.json` are best guesses. If a sync finds nothing, the script prints an `aws s3 ls` hint.
- Label fonts come from the MapLibre demo server. Self-host glyphs for production.
- Credit LINZ (CC BY 4.0) and OpenStreetMap contributors. Attribution is already wired into the map.

See `docs/ARCHITECTURE.md` and `docs/ADDING_DATA.md`.
