# Architecture

**Rule: the app only knows `manifest.json`.** Data is added by the pipeline writing a manifest entry, never by editing app code.

```
OSM (Geofabrik) --planetiler--> nz.pmtiles          (OpenMapTiles schema)
LINZ 8 m DEM  --nzbuild fallback--> nz-8m.pmtiles    (Terrarium PNG, z0-14)
LINZ 1 m LiDAR --nzbuild region--> <region>.pmtiles  (Terrarium PNG, z10-16/17)
                         |
                  public/data/manifest.json
                         |
 browser: PMTiles range requests -> terrain.js (nzterrain:// protocol) -> MapLibre terrain + hillshade
                                    pmtiles://  -> style.js layers (roads, water, buildings, labels)
```

## Terrain level of detail
`terrain.js` answers each tile request in order: regional archives (priority, then finest resolution) -> national fallback -> up-sampled ancestor tile -> stand-in -> flat. A tile outside any LiDAR archive therefore still gets the 8 m surface, and zooming past an archive's max zoom stretches its top level instead of showing holes. Region archives are built over the fallback, so tile edges have no gaps.

## Coordinates
Sources are NZTM2000 (EPSG:2193). The pipeline reprojects once to Web Mercator (EPSG:3857), bilinear, and encodes Terrarium (elevation = R*256 + G + B/256 - 32768). Check each survey's STAC metadata for its vertical datum before mixing surveys.

## Progressive loading
Everything is tiled, range-requested and cached. Low zoom shows 8 m terrain and simplified roads; detailed roads (service, tracks) start at z12-14 and buildings at z13; LiDAR tiles load as you zoom into a region.

## Known limits / next steps
Contours (a `gdal_contour` -> vector tiles overlay), DSM as a second terrain mode, Three.js effects layer, parallel tile building, and a gazetteer for search (the panel currently uses `places.json`).
