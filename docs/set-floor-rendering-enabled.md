# set Floor Rendering Enabled

Enable or disable projected floor-tile rendering in raycasting view.

```sig
Render.setFloorRenderingEnabled(true)
```

## Parameters

* **enabled** — `true` renders the lower half of the raycasting view using the image assigned to each tilemap location. `false` leaves the scene background visible beneath walls.

## ~hint
* Floor rendering is enabled by default.
* It only applies to `raycastingView`; normal tilemap mode is unchanged.
* Floor textures come from the current tilemap tileset. If tilemap contents or tiles are changed at runtime, call [refresh Tilemap](/refresh-tilemap).
* This renders floors only. It does not render a textured ceiling.
## ~

## Example

```blocks
controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
    Render.setFloorRenderingEnabled(false)
})
controller.B.onEvent(ControllerButtonEvent.Released, function () {
    Render.setFloorRenderingEnabled(true)
})
Render.setViewMode(ViewMode.raycastingView)
```

```package
pxt-raycasting=github:aqeeaqee/pxt-raycasting
```
