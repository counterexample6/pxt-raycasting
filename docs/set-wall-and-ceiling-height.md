# set Wall and Ceiling Height

Set the matching height of projected walls and the ceiling plane.

```sig
Render.setWallAndCeilingHeight(1)
```

## Parameters

* **height** — the shared wall and ceiling height in tile units. The default is `1`.

## ~hint
* Wall and ceiling heights always change together, keeping their edges aligned.
* Values below `1` create a shorter room; values above `1` create a taller room.
* The existing `wallZScale` Attribute also updates this shared value for compatibility.
* Ceiling rendering remains disabled by default. Enable it with [set ceiling rendering](/set-ceiling-rendering-enabled).
## ~

## Example

```blocks
Render.setWallAndCeilingHeight(1.5)
Render.setCeilingRenderingEnabled(true)
```

```package
pxt-raycasting=github:aqeeaqee/pxt-raycasting
```
