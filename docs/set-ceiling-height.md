# set Ceiling Height

Set the height of the projected horizontal ceiling plane above the floor.

```sig
Render.setCeilingHeight(1)
```

## Parameters

* **height** — the ceiling height in tile units. The default is `1`, so the ceiling is one tile above the floor.

## ~hint
* Ceiling height is independent from wall height.
* A ceiling at or below the camera position is not projected.
* Different ceiling and wall heights can intentionally leave a visible gap or overlap in the 3D view.
* Enable textured ceiling rendering with [set ceiling rendering](/set-ceiling-rendering-enabled).
## ~

## Example

```blocks
Render.setWallHeight(1)
Render.setCeilingHeight(1)
Render.setCeilingRenderingEnabled(true)
```

```package
pxt-raycasting=github:aqeeaqee/pxt-raycasting
```
