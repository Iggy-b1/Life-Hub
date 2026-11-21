# Adding data

## A new LiDAR region
1. Find its prefix: `aws s3 ls --no-sign-request s3://nz-elevation/` (folders are region/survey/dem_1m/2193).
2. Add an entry to `pipeline/regions.json`:
   `"waikato": {"label":"Waikato LiDAR","s3_prefix":"waikato/","bounds":[174.5,-38.6,176.2,-36.9],"minzoom":10,"maxzoom":16,"priority":10}`
3. `python pipeline/nzbuild.py region waikato`. Done. The app picks it up from the manifest.

Use `--maxzoom 17` for a city-sized region (about 4x the storage). Overlapping surveys: later-sorted survey folders paint on top.

## A new feature layer (buildings from LINZ, forests, farmland, rivers, ...)
1. Convert to vector tiles, e.g. `tippecanoe -o public/data/overlays/rivers.pmtiles -zg --drop-densest-as-needed rivers.geojson`
2. Add to `manifest.json`:
```json
"overlays": [{
  "id": "rivers", "label": "LINZ rivers",
  "source": {"type": "vector", "url": "pmtiles://data/overlays/rivers.pmtiles"},
  "layers": [{"id": "rivers-line", "type": "line", "source-layer": "rivers", "paint": {"line-color": "#5b8cff", "line-width": 1.5}}]
}]
```
It appears in the Layers list automatically, below the labels, and existing layers are untouched.

## A different imagery source
Set `VITE_LINZ_AERIAL_URL` in `.env`, or add a raster overlay the same way.
