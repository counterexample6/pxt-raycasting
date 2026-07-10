# set Wall Height

Set the height used when projecting raycast walls.

```sig
Render.setWallHeight(1)
```

## Parameters

* **height** — the wall height as a tile multiplier. The default is `1`, which is the extension's original wall height.

## ~hint
* This is equivalent to setting the existing `wallZScale` Attribute.
* It does not automatically change ceiling height. Use [set ceiling height](/set-ceiling-height) when a ceiling is enabled.
* Values below `1` create shorter walls; values above `1` create taller walls.
## ~

## Example

```blocks
Render.setWallHeight(1.5)
Render.setCeilingHeight(1.5)
Render.setCeilingRenderingEnabled(true)
```

```package
pxt-raycasting=github:aqeeaqee/pxt-raycasting
```
