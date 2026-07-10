# set Ceiling Tilemap

Use a second Tilemap as the material layer for projected ceilings.

```sig
Render.setCeilingTilemap(tilemap`ceiling`)
```

## Parameters

* **ceilingTilemap** — a Tilemap with the same width, height, and tile scale as the active world Tilemap.

## ~hint
* Paint ceiling material independently in a second Tilemap from the Tilemap editor.
* The ceiling layer has its own tileset, so its tile images can differ from the world floor and wall tiles.
* Empty cells in the ceiling layer leave the scene background visible, allowing open sky.
* Use [set empty ceiling tiles use floor tiles](/set-ceiling-uses-floor-tiles) to make empty cells reuse the world Tilemap cell's texture instead.
* A layer with different dimensions or tile scale is ignored and does not replace the current ceiling layer.
* Use [clear ceiling tilemap](/set-ceiling-tilemap) to return to the default shared-material behavior.
## ~

## Example

```blocks
Render.setCeilingTilemap(tilemap`ceiling`)
Render.setWallAndCeilingHeight(1)
Render.setCeilingRenderingEnabled(true)
```

```package
pxt-raycasting=github:aqeeaqee/pxt-raycasting
```
