# set Ceiling Rendering Enabled

Enable or disable projected ceiling-tile rendering in raycasting view.

```sig
Render.setCeilingRenderingEnabled(true)
```

## Parameters

* **enabled** — `true` renders the upper half of the raycasting view using the image assigned to each tilemap location. `false` leaves the scene background visible above walls.

## ~hint
* Ceiling rendering is disabled by default, preserving the appearance and performance of existing projects.
* It only applies to `raycastingView`; normal tilemap mode is unchanged.
* Unassigned ceiling cells leave the scene background visible. Assign materials with [set ceiling tilemap](/set-ceiling-tilemap), or use [set empty ceiling tiles use floor tiles](/set-ceiling-uses-floor-tiles) to reuse world tile textures.
* If tilemap contents or tiles are changed at runtime, call [refresh Tilemap](/refresh-tilemap).
* Use [set wall and ceiling height](/set-wall-and-ceiling-height) to change the room height.
## ~

## Example

```blocks
Render.setWallAndCeilingHeight(1)
Render.setCeilingRenderingEnabled(true)
Render.setViewMode(ViewMode.raycastingView)
```

```package
pxt-raycasting=github:aqeeaqee/pxt-raycasting
```
