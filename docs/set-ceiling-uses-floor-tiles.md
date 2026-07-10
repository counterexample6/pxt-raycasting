# set Empty Ceiling Tiles Use Floor Tiles

Choose what is drawn when a ceiling cell has no material assigned.

```sig
Render.setCeilingUsesFloorTiles(true)
```

## Parameters

* **enabled** — `true` reuses the corresponding world Tilemap cell's texture. `false` leaves unassigned ceiling cells transparent so the scene background appears as sky.

## ~hint
* The default is `false`, so empty ceiling-layer cells show the background.
* This affects empty cells in a ceiling Tilemap and every cell when no ceiling Tilemap is assigned.
* Assigned ceiling Tilemap cells always use their own ceiling-layer tileset image.
## ~

## Example

```blocks
Render.setCeilingTilemap(tilemap`ceiling`)
Render.setCeilingUsesFloorTiles(true)
Render.setCeilingRenderingEnabled(true)
```

```package
pxt-raycasting=github:aqeeaqee/pxt-raycasting
```
