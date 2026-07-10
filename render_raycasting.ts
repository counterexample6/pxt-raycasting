//% shim=pxt::updateScreen
function updateScreen(img: Image) { }

/**
 * The active 2.5D renderer.
 *
 * World positions and direction vectors use FP8 fixed-point values while the
 * tilemap stores one tile per integer world unit. Each raycasting frame draws
 * optional ceiling and floor tiles, DDA wall columns, then scene sprites.
 * `render_blocks.ts` exposes the supported public API for this implementation.
 */
enum ViewMode {
    //% block="TileMap Mode"
    tilemapView,
    //% block="Raycasting Mode"
    raycastingView,
}

namespace Render {
    const SH = screen.height, SHHalf = SH / 2
    const SW = screen.width, SWHalf = SW / 2
    // FP8 world/vector scale. Keep all projection calculations in this unit
    // until the final image-coordinate conversion.
    export const fpx = 8
    const fpx2=fpx*2
    const fpx2_4 = fpx2 - 4
    const fpx_scale = 2 ** fpx
    export function tofpx(n: number) { return (n * fpx_scale) | 0 }
    // Fixed-point representations of 1.0 and 1.0 squared for DDA math.
    const one = 1 << fpx
    const one2 = 1 << (fpx + fpx)
    const FPX_MAX = (1 << fpx) - 1

    /** Per-sprite vertical state. Values are FP8 pixels and keyed by sprite ID. */
    class MotionSet1D {
        p: number
        v: number = 0
        a: number = 0
        constructor(public offset: number) {
            this.p = offset
        }

        /** Advance one vertical-motion step and clamp movement that passes the offset. */
        advance(deltaTime: number): boolean {
            if (this.v == 0 && this.p == this.offset)
                return false

            this.v += this.a * deltaTime
            this.p += this.v * deltaTime
            if ((this.a >= 0 && this.v > 0 && this.p > this.offset) ||
                (this.a <= 0 && this.v < 0 && this.p < this.offset)) {
                this.p = this.offset
                this.v = 0
            }
            return true
        }
    }

    /** Reused result of one wall DDA traversal; avoids allocating once per column. */
    class WallRayHit {
        mapX: number
        mapY: number
        mapStepX: number
        mapStepY: number
        sideWallHit: boolean
        tileIndex: number

        constructor() {
            this.mapX = 0
            this.mapY = 0
            this.mapStepX = 0
            this.mapStepY = 0
            this.sideWallHit = false
            this.tileIndex = 0
        }
    }

    /** Reused draw-bound cache shared by neighboring wall columns. */
    class WallColumnCache {
        drawStart: number
        drawHeight: number
        lastDist: number
        lastTexX: number
        lastMapX: number
        lastMapY: number

        constructor() {
            this.drawStart = 0
            this.drawHeight = 0
            this.reset()
        }

        reset() {
            this.lastDist = -1
            this.lastTexX = -1
            this.lastMapX = -1
            this.lastMapY = -1
        }
    }

    // A one-tile-high wall fills the viewport when viewed one tile away.
    export const defaultFov = SW / SH / 2

    export class RayCastingRender{

        // Off-screen 3D frame buffer; copied to the hardware screen each frame.
        private tempScreen: Image = image.create(SW, SH)
        private tempBackground: scene.BackgroundLayer //for "see through" when scene popped out

        // Camera orientation and projection-plane vectors in FP8.
        velocityAngle: number = 2
        velocity: number = 3
        protected _viewMode=ViewMode.raycastingView
        protected dirXFpx: number
        protected dirYFpx: number
        protected planeX: number
        protected planeY: number
        protected _angle: number
        protected _fov: number
        protected _wallZScale: number = 1
        protected _floorRenderingEnabled = true
        protected _ceilingRenderingEnabled = false
        // Ceiling-plane height in tile units; separate from the wall multiplier.
        protected _ceilingHeight = 1
        // When false, unassigned ceiling material cells leave the sky/background visible.
        protected _ceilingUsesFloorTiles = false
        cameraSway = 0
        protected isWalking=false
        protected cameraOffsetX = 0
        protected cameraOffsetZ_fpx = 0

        // Scene sprites taken over by the 3D renderer and their attached state.
        sprSelf: Sprite
        sprites: Sprite[] = []
        sprites2D: Sprite[] = []
        spriteParticles: particles.ParticleSource[] = []
        spriteLikes: SpriteLike[] = []
        spriteAnimations: Animations[] = []
        protected spriteMotionZ: MotionSet1D[] = []
        protected sayRederers: sprites.BaseSpriteSayRenderer[] = []
        protected sayEndTimes: number[] = []

        // Cached tilemap data and tileset images used by wall, floor, and ceiling sampling.
        protected tilemapScaleSize = 1 << TileScale.Sixteen
        map: tiles.TileMapData
        mapData:Array<number>
        bg: Image
        textures: Image[]
        private ceilingTilemap: tiles.TileMapData
        private ceilingMapData: number[]
        private ceilingTextures: Image[]
        protected oldRender: scene.Renderable
        protected myRender: scene.Renderable

        // Per-frame projection state. `dist` stores wall depth by screen column
        // so sprite drawing can correctly reject columns behind a wall.
        protected wallHeightInView: number
        protected wallWidthInView: number
        protected dist: number[] = []
        private wallRayHit = new WallRayHit()
        private wallColumnCache = new WallColumnCache()
        cameraRangeAngle:number
        viewZPos:number
        selfXFpx:number
        selfYFpx:number

        // Reused scratch state for sprite-to-camera transforms and overlays.
        protected invDet: number
        camera: scene.Camera
        tempSprite: Sprite = sprites.create(img`0`)
        protected transformX: number[] = []
        protected transformY: number[] = []
        protected angleSelfToSpr: number[] = []

        onSpriteDirectionUpdateHandler: (spr: Sprite, dir: number) => void

        get xFpx(): number {
            return Fx.add(this.sprSelf._x, Fx.div(this.sprSelf._width, Fx.twoFx8)) as any as number / this.tilemapScaleSize
        }

        // set xFpx(v: number) {
        //     this.sprSelf._x = v * this.tilemapScaleSize as any as Fx8
        // }

        get yFpx(): number {
            return Fx.add(this.sprSelf._y, Fx.div(this.sprSelf._height, Fx.twoFx8)) as any as number / this.tilemapScaleSize
        }

        // set yFpx(v: number) {
        //     this.sprSelf._y = v * this.tilemapScaleSize as any as Fx8
        // }

        get dirX(): number {
            return this.dirXFpx / fpx_scale
        }

        get dirY(): number {
            return this.dirYFpx / fpx_scale
        }

        set dirX(v: number) {
            this.dirXFpx = v * fpx_scale
        }

        set dirY(v: number) {
            this.dirYFpx = v * fpx_scale
        }

        sprXFx8(spr: Sprite) {
            return Fx.add(spr._x, Fx.div(spr._width, Fx.twoFx8)) as any as number / this.tilemapScaleSize
        }

        sprYFx8(spr: Sprite) {
            return Fx.add(spr._y, Fx.div(spr._height, Fx.twoFx8)) as any as number / this.tilemapScaleSize
        }

        get fov(): number {
            return this._fov
        }

        set fov(fov: number) {
            this._fov = fov
            this.wallHeightInView = (SW << (fpx - 1)) / this._fov
            this.wallWidthInView = this.wallHeightInView >> fpx // not fpx  // wallSize / this.fov * 4 / 3 * 2
            this.cameraRangeAngle = Math.atan(this.fov) + .1 //tolerance for spr center just out of camera

            this.setVectors()
        }

        get viewAngle(): number {
            return this._angle
        }
        set viewAngle(angle: number) {
            this._angle = angle
            this.setVectors()
            this.updateSelfImage()
        }

        get wallZScale(): number {
            return this._wallZScale
        }
        set wallZScale(v: number) {
            this._wallZScale = v
        }

        /** Wall height in tile units; an alias for the existing wall multiplier. */
        get wallHeight(): number {
            return this._wallZScale
        }

        set wallHeight(height: number) {
            this._wallZScale = height
        }

        get floorRenderingEnabled(): boolean {
            return this._floorRenderingEnabled
        }

        set floorRenderingEnabled(enabled: boolean) {
            this._floorRenderingEnabled = enabled
        }

        get ceilingRenderingEnabled(): boolean {
            return this._ceilingRenderingEnabled
        }

        set ceilingRenderingEnabled(enabled: boolean) {
            this._ceilingRenderingEnabled = enabled
        }

        /** Height of the horizontal ceiling plane in tile units above the floor. */
        get ceilingHeight(): number {
            return this._ceilingHeight
        }

        set ceilingHeight(height: number) {
            this._ceilingHeight = Math.max(0, height)
        }

        get ceilingUsesFloorTiles(): boolean {
            return this._ceilingUsesFloorTiles
        }

        set ceilingUsesFloorTiles(enabled: boolean) {
            this._ceilingUsesFloorTiles = enabled
        }

        /** Assign a same-sized Tilemap layer whose tiles override ceiling materials. */
        setCeilingTilemap(tilemap: tiles.TileMapData): boolean {
            if (!this.isCompatibleCeilingTilemap(tilemap))
                return false

            this.ceilingTilemap = tilemap
            this.ceilingMapData = ((tilemap as any).data as Buffer).toArray(NumberFormat.Int8LE)
            this.ceilingTextures = tilemap.getTileset()
            return true
        }

        clearCeilingTilemap() {
            this.ceilingTilemap = undefined
            this.ceilingMapData = undefined
            this.ceilingTextures = undefined
        }

        hasCeilingTilemap(): boolean {
            return !!this.ceilingTilemap
        }

        getMotionZ(spr: Sprite, offsetZ: number = 0) {
            let motionZ = this.spriteMotionZ[spr.id]
            if (!motionZ) {
                motionZ = new MotionSet1D(tofpx(offsetZ))
                this.spriteMotionZ[spr.id] = motionZ
            }
            return motionZ
        }

        getZOffset(spr: Sprite) {
            return this.getMotionZ(spr).offset / fpx_scale
        }

        setZOffset(spr: Sprite, offsetZ: number, duration: number = 500) {
            const motionZ = this.getMotionZ(spr, offsetZ)

            motionZ.offset = tofpx(offsetZ)
            if (motionZ.p != motionZ.offset) {
                if (duration === 0)
                    motionZ.p = motionZ.offset
                else if(motionZ.v==0)
                    this.move(spr, (motionZ.offset - motionZ.p) / fpx_scale * 1000 / duration, 0)
            }
        }

        getMotionZPosition(spr: Sprite) {
            return this.getMotionZ(spr).p / fpx_scale
        }

        // Sprite image height represents its vertical size in the 2.5D view.
        isOverlapZ(sprite1: Sprite, sprite2: Sprite): boolean {
            const p1 = this.getMotionZPosition(sprite1)
            const p2 = this.getMotionZPosition(sprite2)
            if (p1 < p2) {
                if (p1 + sprite1.height > p2) return true
            } else {
                if (p2 + sprite2.height > p1) return true
            }
            return false
        }

        move(spr: Sprite, v: number, a: number) {
            const motionZ = this.getMotionZ(spr)

            motionZ.v = tofpx(v)
            motionZ.a = tofpx(a)
        }

        jump(spr: Sprite, v: number, a: number) {
            const motionZ = this.getMotionZ(spr)
            if (motionZ.p != motionZ.offset)
                return

            motionZ.v = tofpx(v)
            motionZ.a = tofpx(a)
        }

        jumpWithHeightAndDuration(spr: Sprite, height: number, duration: number) {
            const motionZ = this.getMotionZ(spr)
            if (motionZ.p != motionZ.offset)
                return

            // height= -v*v/a/2
            // duration = -v/a*2 *1000
            const v = height * 4000 / duration
            const a = -v * 2000 / duration
            motionZ.v = tofpx(v)
            motionZ.a = tofpx(a)
        }

        get viewMode(): ViewMode {
            return this._viewMode
        }

        set viewMode(v: ViewMode) {
            this._viewMode = v
        }

        updateViewZPos() {
            this.viewZPos = this.spriteMotionZ[this.sprSelf.id].p + (this.sprSelf._height as any as number) - (2 << fpx)
        }

        takeoverSceneSprites() {
            const sc_allSprites = game.currentScene().allSprites
            for (let i=0;i<sc_allSprites.length;) {
                const spr=sc_allSprites[i]
                if (spr instanceof Sprite) {
                    const sprList = (spr.flags & sprites.Flag.RelativeToCamera) ? this.sprites2D:this.sprites
                    if (sprList.indexOf(spr) < 0) {
                        sprList.push(spr as Sprite)
                        this.getMotionZ(spr, 0)
                        spr.onDestroyed(() => {
                            this.sprites.removeElement(spr as Sprite)   //can be in one of 2 lists
                            this.sprites2D.removeElement(spr as Sprite) //can be in one of 2 lists
                            const sayRenderer = this.sayRederers[spr.id]
                            if (sayRenderer) {
                                this.sayRederers.removeElement(sayRenderer)
                                sayRenderer.destroy()
                            }
                        })
                    }
                } else if(spr instanceof particles.ParticleSource){
                    const particle = (spr as particles.ParticleSource)
                    if (this.spriteParticles.indexOf(particle) < 0 && particle.anchor instanceof Sprite) {
                        const spr = (particle.anchor as Sprite)
                        if(this.sprites.indexOf(spr)>=0){
                            this.spriteParticles[spr.id]=particle
                            particle.anchor=this.tempSprite
                        }
                    }
                } else {
                    if (this.spriteLikes.indexOf(spr) < 0)
                        this.spriteLikes.push(spr)
                }
                sc_allSprites.removeElement(spr)
            }
            this.sprites.forEach((spr) => {
                if (spr)
                    this.takeoverSayRenderOfSprite(spr)
            })
        }
        takeoverSayRenderOfSprite(sprite: Sprite) {
            const sprite_as_any = (sprite as any)
            if (sprite_as_any.sayRenderer) {
                this.sayRederers[sprite.id] = sprite_as_any.sayRenderer
                this.sayEndTimes[sprite.id] = sprite_as_any.sayEndTime;
                sprite_as_any.sayRenderer = undefined
                sprite_as_any.sayEndTime = undefined
            }
        }

        tilemapLoaded() {
            // Cache raw tile IDs and tileset images once per loaded tilemap.
            const sc = game.currentScene()
            this.refreshTilemap()
            this.oldRender = sc.tileMap.renderable
            this.spriteLikes.removeElement(this.oldRender)
            sc.allSprites.removeElement(this.oldRender)

            let frameCallback_update = sc.eventContext.registerFrameHandler(scene.PRE_RENDER_UPDATE_PRIORITY + 1, () => {
                const dt = sc.eventContext.deltaTime;
                // sc.camera.update();  // already did in scene
                for (const s of this.sprites)
                    s.__update(sc.camera, dt);
                this.sprSelf.__update(sc.camera, dt)
            })

            let frameCallback_draw = sc.eventContext.registerFrameHandler(scene.RENDER_SPRITES_PRIORITY + 1, () => {
                if (this._viewMode == ViewMode.raycastingView) {
                    if (!this.tempBackground) {
                        this.tempScreen.drawImage(game.currentScene().background.image, 0, 0)
                        this.render()
                        screen.fill(0)
                        this.sprites2D.forEach(spr => spr.__draw(sc.camera))
                        this.spriteLikes.forEach(spr => spr.__draw(sc.camera))
                        this.tempScreen.drawTransparentImage(screen, 0, 0)
                    }
                } else {
                    screen.drawImage(game.currentScene().background.image, 0, 0)
                    this.oldRender.__drawCore(sc.camera)
                    this.sprites.forEach(spr => spr.__draw(sc.camera))
                    this.sprSelf.__draw(sc.camera)
                    this.sprites2D.forEach(spr => spr.__draw(sc.camera))
                    this.spriteLikes.forEach(spr => spr.__draw(sc.camera))
                }
            })

            sc.tileMap.addEventListener(tiles.TileMapEvent.Unloaded, data => {
                sc.eventContext.unregisterFrameHandler(frameCallback_update)
                sc.eventContext.unregisterFrameHandler(frameCallback_draw)
            })
        }

        constructor() {
            this._angle = 0
            this.fov = defaultFov
            this.camera = new scene.Camera()

            const sc = game.currentScene()
            if (!sc.tileMap) {
                sc.tileMap = new tiles.TileMap();
            } else {
                this.tilemapLoaded()
            }
            game.currentScene().tileMap.addEventListener(tiles.TileMapEvent.Loaded, data => this.tilemapLoaded())

            //self sprite
            this.sprSelf = sprites.create(image.create(this.tilemapScaleSize >> 1, this.tilemapScaleSize >> 1), SpriteKind.Player)
            this.takeoverSceneSprites()
            this.sprites.removeElement(this.sprSelf)
            this.updateViewZPos()
            scene.cameraFollowSprite(this.sprSelf)
            this.updateSelfImage()

            game.onUpdate(function () {
                this.updateControls()
            })

            game.onUpdateInterval(400, ()=>{
                for (let i = 0; i < this.sprites.length;) {
                    const spr = this.sprites[i]
                    if (spr.flags & sprites.Flag.RelativeToCamera) {
                        this.sprites.removeElement(spr)
                        this.sprites2D.push(spr)
                    } else {i++}
                }
                for (let i = 0; i < this.sprites2D.length;) {
                    const spr = this.sprites2D[i]
                    if (!(spr.flags & sprites.Flag.RelativeToCamera)) {
                        this.sprites2D.removeElement(spr)
                        this.sprites.push(spr)
                    } else {i++}
                }
                this.takeoverSceneSprites() // in case some one new
            })


            game.onUpdateInterval(25, () => {
                if(this.cameraSway&&this.isWalking){
                    this.cameraOffsetX = (Math.sin(control.millis() / 150) * this.cameraSway * 3)|0
                    this.cameraOffsetZ_fpx = tofpx(Math.cos(control.millis() / 75) * this.cameraSway)|0
                }
            });
            control.__screen.setupUpdate(() => {
                if(this.viewMode==ViewMode.raycastingView)
                    updateScreen(this.tempScreen)
                else
                    updateScreen(screen)
            })

            game.addScenePushHandler((oldScene) => {
                this.tempBackground = oldScene.background.addLayer(this.tempScreen, 0, BackgroundAlignment.Center)
                control.__screen.setupUpdate(() => { updateScreen(screen) })
            })
            game.addScenePopHandler((oldScene) => {
                ((oldScene.background as any)._layers as scene.BackgroundLayer[]).removeElement(this.tempBackground)
                this.tempBackground=undefined
                control.__screen.setupUpdate(() => {
                    if (this.viewMode == ViewMode.raycastingView)
                        updateScreen(this.tempScreen)
                    else
                        updateScreen(screen)
                })
            })
        }

        private setVectors() {
            const sin = Math.sin(this._angle)
            const cos = Math.cos(this._angle)
            this.dirXFpx = tofpx(cos)
            this.dirYFpx = tofpx(sin)
            this.planeX = tofpx(sin * this._fov)
            this.planeY = tofpx(cos * -this._fov)
        }

        // Draw the hidden controller sprite as a 2D directional marker.
        public updateSelfImage() {
            const img = this.sprSelf.image
            img.fill(6)
            const arrowLength = img.width / 2
            img.drawLine(arrowLength, arrowLength, arrowLength + this.dirX * arrowLength, arrowLength + this.dirY * arrowLength, 2)
            img.fillRect(arrowLength - 1, arrowLength - 1, 2, 2, 2)
        }

        updateControls() {
            if (this.velocityAngle !== 0) {
                const dx = controller.dx(this.velocityAngle)
                if (dx) {
                    this.viewAngle += dx
                }
            }
            if (this.velocity !== 0) {
                this.isWalking=true
                const dy = controller.dy(this.velocity)
                if (dy) {
                    const nx = this.xFpx - Math.round(this.dirXFpx * dy)
                    const ny = this.yFpx - Math.round(this.dirYFpx * dy)
                    this.sprSelf.setPosition((nx * this.tilemapScaleSize / fpx_scale), (ny * this.tilemapScaleSize / fpx_scale))
                }else{
                    this.isWalking =false
                }
            }

            for (const spr of this.sprites) {
                this.updateMotionZ(spr)
            }
            this.updateMotionZ(this.sprSelf)
        }

        updateMotionZ(spr:Sprite){
            const motionZ = this.spriteMotionZ[spr.id]
            if (motionZ.advance(game.eventContext().deltaTime) && spr === this.sprSelf)
                this.updateViewZPos()
        }

        render() {
            // based on https://lodev.org/cgtutor/raycasting.html

            this.updateRenderFrameState()

            if (this.ceilingRenderingEnabled)
                this.renderCeilingTiles()

            if (this.floorRenderingEnabled)
                this.renderFloorTiles()

            // Raycast walls and populate the depth buffer used by sprites.
            this.wallColumnCache.reset()
            for (let x = 0; x < SW; x++)
                this.renderWallColumn(x)

            this.drawSprites()
        }

        /** Refresh camera-derived values that must remain consistent for one frame. */
        private updateRenderFrameState() {
            this.selfXFpx = this.xFpx
            this.selfYFpx = this.yFpx
            this.viewZPos = this.spriteMotionZ[this.sprSelf.id].p
                + (this.sprSelf._height as any as number)
                - (2 << fpx)
                + this.cameraOffsetZ_fpx
        }

        /** Cast, project, texture, and draw one screen-column wall slice. */
        private renderWallColumn(x: number) {
            const cameraX = one - Math.idiv(((x + this.cameraOffsetX) << fpx) << 1, SW)
            let rayDirX = this.dirXFpx + (this.planeX * cameraX >> fpx)
            let rayDirY = this.dirYFpx + (this.planeY * cameraX >> fpx)

            // Avoid division by zero during DDA.
            if (rayDirX == 0) rayDirX = 1
            if (rayDirY == 0) rayDirY = 1
            if (!this.raycastWall(rayDirX, rayDirY))
                return

            const hit = this.wallRayHit
            let perpWallDist: number
            let wallX: number
            if (!hit.sideWallHit) {
                perpWallDist = Math.idiv(((hit.mapX << fpx) - this.selfXFpx + (1 - hit.mapStepX << fpx - 1)) << fpx, rayDirX)
                wallX = this.selfYFpx + (perpWallDist * rayDirY >> fpx)
            } else {
                perpWallDist = Math.idiv(((hit.mapY << fpx) - this.selfYFpx + (1 - hit.mapStepY << fpx - 1)) << fpx, rayDirY)
                wallX = this.selfXFpx + (perpWallDist * rayDirX >> fpx)
            }
            wallX &= FPX_MAX

            const tex = this.textures[hit.tileIndex]
            if (!tex)
                return

            const texX = (wallX * tex.width) >> fpx
            const cache = this.wallColumnCache
            if (perpWallDist !== cache.lastDist && (texX !== cache.lastTexX || hit.mapX !== cache.lastMapX || hit.mapY !== cache.lastMapY)) {
                const lineHeight = this.wallHeightInView / perpWallDist
                const drawEnd = lineHeight * this.viewZPos / this.tilemapScaleSize / fpx_scale
                cache.drawStart = drawEnd - lineHeight * this._wallZScale + 1
                cache.drawHeight = Math.ceil(drawEnd) - Math.ceil(cache.drawStart) + 1
                cache.drawStart += SHHalf
                cache.lastDist = perpWallDist
                cache.lastTexX = texX
                cache.lastMapX = hit.mapX
                cache.lastMapY = hit.mapY
            }

            // Keep adjacent columns aligned despite fractional draw bounds.
            this.tempScreen.blitRow(x, cache.drawStart, tex, texX, cache.drawHeight)
            this.dist[x] = perpWallDist
        }

        /**
         * Traverse the tilemap with DDA until a wall is found. Returns false for
         * rays that leave the map; otherwise records the hit in `wallRayHit`.
         */
        private raycastWall(rayDirX: number, rayDirY: number): boolean {
            const hit = this.wallRayHit
            let mapX = this.selfXFpx >> fpx
            let mapY = this.selfYFpx >> fpx
            const deltaDistX = Math.abs(Math.idiv(one2, rayDirX))
            const deltaDistY = Math.abs(Math.idiv(one2, rayDirY))
            let sideDistX: number
            let sideDistY: number
            let mapStepX: number
            let mapStepY: number
            let sideWallHit: boolean

            if (rayDirX < 0) {
                mapStepX = -1
                sideDistX = ((this.selfXFpx - (mapX << fpx)) * deltaDistX) >> fpx
            } else {
                mapStepX = 1
                sideDistX = (((mapX << fpx) + one - this.selfXFpx) * deltaDistX) >> fpx
            }
            if (rayDirY < 0) {
                mapStepY = -1
                sideDistY = ((this.selfYFpx - (mapY << fpx)) * deltaDistY) >> fpx
            } else {
                mapStepY = 1
                sideDistY = (((mapY << fpx) + one - this.selfYFpx) * deltaDistY) >> fpx
            }

            while (true) {
                if (sideDistX < sideDistY) {
                    sideDistX += deltaDistX
                    mapX += mapStepX
                    sideWallHit = false
                } else {
                    sideDistY += deltaDistY
                    mapY += mapStepY
                    sideWallHit = true
                }

                if (this.map.isOutsideMap(mapX, mapY))
                    return false
                if (this.map.isWall(mapX, mapY)) {
                    hit.mapX = mapX
                    hit.mapY = mapY
                    hit.mapStepX = mapStepX
                    hit.mapStepY = mapStepY
                    hit.sideWallHit = sideWallHit
                    hit.tileIndex = this.mapData[4 + mapX + mapY * this.map.width]
                    return true
                }
            }
        }

        private renderFloorTiles() {
            const posZ = (SH * this.viewZPos / this.tilemapScaleSize) | 0
            if (posZ <= 0)
                return

            for (let yFloor = SHHalf + 1; yFloor < SH; yFloor++) {
                const rowDistance = (posZ / (yFloor - SHHalf)) | 0
                const floorStepX = -Math.idiv(rowDistance * this.planeX, SWHalf)
                const floorStepY = -Math.idiv(rowDistance * this.planeY, SWHalf)
                let floorX = this.selfXFpx * fpx_scale + (rowDistance * (this.dirXFpx + this.planeX)) + floorStepX * this.cameraOffsetX
                let floorY = this.selfYFpx * fpx_scale + (rowDistance * (this.dirYFpx + this.planeY)) + floorStepY * this.cameraOffsetX

                for (let xFloor = 0; xFloor < SW; xFloor++) {
                    const mapX = floorX >> fpx2
                    const mapY = floorY >> fpx2
                    if (mapX >= 0 && mapX < this.map.width && mapY >= 0 && mapY < this.map.height) {
                        const tileType = this.mapData[4 + mapX + mapY * this.map.width]
                        const floorTex = this.textures[tileType]
                        if (floorTex) {
                            const tx = Math.idiv((floorX & (one2 - 1)) * floorTex.width, one2)
                            const ty = Math.idiv((floorY & (one2 - 1)) * floorTex.height, one2)
                            this.tempScreen.setPixel(xFloor, yFloor, floorTex.getPixel(tx, ty))
                        }
                    }
                    floorX += floorStepX
                    floorY += floorStepY
                }
            }
        }

        /** Project tile textures onto the horizontal ceiling plane above the camera. */
        private renderCeilingTiles() {
            const ceilingZ = tofpx(this._ceilingHeight * this.tilemapScaleSize) - this.viewZPos
            const posZ = (SH * ceilingZ / this.tilemapScaleSize) | 0
            if (posZ <= 0)
                return

            for (let yCeiling = SHHalf - 1; yCeiling >= 0; yCeiling--) {
                const rowDistance = (posZ / (SHHalf - yCeiling)) | 0
                const ceilingStepX = -Math.idiv(rowDistance * this.planeX, SWHalf)
                const ceilingStepY = -Math.idiv(rowDistance * this.planeY, SWHalf)
                let ceilingX = this.selfXFpx * fpx_scale + (rowDistance * (this.dirXFpx + this.planeX)) + ceilingStepX * this.cameraOffsetX
                let ceilingY = this.selfYFpx * fpx_scale + (rowDistance * (this.dirYFpx + this.planeY)) + ceilingStepY * this.cameraOffsetX

                for (let xCeiling = 0; xCeiling < SW; xCeiling++) {
                    const mapX = ceilingX >> fpx2
                    const mapY = ceilingY >> fpx2
                    if (mapX >= 0 && mapX < this.map.width && mapY >= 0 && mapY < this.map.height) {
                        const tileType = this.mapData[4 + mapX + mapY * this.map.width]
                        const ceilingTex = this.getCeilingTexture(mapX, mapY, tileType)
                        if (ceilingTex) {
                            const tx = Math.idiv((ceilingX & (one2 - 1)) * ceilingTex.width, one2)
                            const ty = Math.idiv((ceilingY & (one2 - 1)) * ceilingTex.height, one2)
                            this.tempScreen.setPixel(xCeiling, yCeiling, ceilingTex.getPixel(tx, ty))
                        }
                    }
                    ceilingX += ceilingStepX
                    ceilingY += ceilingStepY
                }
            }
        }

        /** Refresh world caches and discard an overlay that no longer matches the world map. */
        refreshTilemap() {
            this.map = game.currentScene().tileMap.data
            this.mapData = ((this.map as any).data as Buffer).toArray(NumberFormat.Int8LE)
            this.tilemapScaleSize = 1 << this.map.scale
            this.textures = this.map.getTileset()
            if (this.ceilingTilemap && !this.isCompatibleCeilingTilemap(this.ceilingTilemap))
                this.clearCeilingTilemap()
        }

        /** Validate that an overlay addresses the same tile coordinates as the world map. */
        private isCompatibleCeilingTilemap(tilemap: tiles.TileMapData): boolean {
            return !!tilemap && !!this.map
                && tilemap.width == this.map.width
                && tilemap.height == this.map.height
                && tilemap.scale == this.map.scale
        }

        /** Resolve a ceiling material, leaving empty cells transparent unless floor fallback is enabled. */
        private getCeilingTexture(mapX: number, mapY: number, baseTileType: number): Image {
            if (this.ceilingMapData) {
                const ceilingTileType = this.ceilingMapData[4 + mapX + mapY * this.map.width]
                if (ceilingTileType) {
                    const ceilingTexture = this.ceilingTextures[ceilingTileType]
                    if (ceilingTexture)
                        return ceilingTexture
                }
            }
            return this._ceilingUsesFloorTiles ? this.textures[baseTileType] : undefined
        }

        /** Store one sprite's camera-space transform and report whether it is in view. */
        private transformSpriteForCamera(spr: Sprite, invDet: number): boolean {
            const spriteX = this.sprXFx8(spr) - this.xFpx
            const spriteY = this.sprYFx8(spr) - this.yFpx
            this.angleSelfToSpr[spr.id] = Math.atan2(spriteX, spriteY)
            this.transformX[spr.id] = invDet * (this.dirYFpx * spriteX - this.dirXFpx * spriteY) >> fpx
            this.transformY[spr.id] = invDet * (-this.planeY * spriteX + this.planeX * spriteY) >> fpx
            const angleInCamera = Math.atan2(this.transformX[spr.id] * this.fov, this.transformY[spr.id])
            return angleInCamera > -this.cameraRangeAngle && angleInCamera < this.cameraRangeAngle
        }

        drawSprites(){
            // Transform sprites into camera space, then draw far-to-near using
            // the wall depth buffer produced by `render()`.
            const invDet = one2 / (this.planeX * this.dirYFpx - this.dirXFpx * this.planeY)

            this.sprites
                .filter(spr => this.transformSpriteForCamera(spr, invDet))
                .sort((spr1, spr2) => {   // far to near
                    return (this.transformY[spr2.id] - this.transformY[spr1.id])
                }).forEach((spr, index) => {
                    this.drawSprite(spr, index, this.transformX[spr.id], this.transformY[spr.id], this.angleSelfToSpr[spr.id])
                })
        }

        registerOnSpriteDirectionUpdate(handler: (spr: Sprite, dir: number) => void) {
            this.onSpriteDirectionUpdateHandler = handler
        }

        drawSprite(spr: Sprite, index: number, transformX: number, transformY: number, myAngle:number) {
            const spriteScreenX = Math.ceil((SWHalf) * (1 - transformX / transformY))-this.cameraOffsetX;
            const spriteScreenHalfWidth = Math.idiv((spr._width as any as number) / this.tilemapScaleSize / 2 * this.wallWidthInView, transformY)  //origin: (texSpr.width / 2 << fpx) / transformY / this.fov / 3 * 2 * 4
            const spriteScreenLeft = spriteScreenX - spriteScreenHalfWidth
            const spriteScreenRight = spriteScreenX + spriteScreenHalfWidth

            //calculate drawing range in X direction
            //assume there is one range only
            let blitX = 0, blitWidth = 0
            for (let sprX = 0; sprX < SW; sprX++) {
                if (this.dist[sprX] > transformY) {
                    if (blitWidth == 0)
                        blitX = sprX
                    blitWidth++
                } else if (blitWidth > 0) {
                    if (blitX <= spriteScreenRight && blitX + blitWidth >= spriteScreenLeft)
                        break
                    else
                        blitX = 0, blitWidth = 0;
                }
            }
            // this.tempScreen.print([this.getxFx8(spr), this.getyFx8(spr)].join(), 0,index*10+10)
            const blitXSpr = Math.max(blitX, spriteScreenLeft)
            const blitWidthSpr = Math.min(blitX + blitWidth, spriteScreenRight) - blitXSpr
            if (blitWidthSpr <= 0)
                return

            const lineHeight = Math.idiv(this.wallHeightInView, transformY)
            const drawStart = SHHalf + (lineHeight * ((this.viewZPos - this.spriteMotionZ[spr.id].p - (spr._height as any as number)) / this.tilemapScaleSize) >> fpx)

            //for textures=image[][], abandoned
            //    const texSpr = spr.getTexture(Math.floor(((Math.atan2(spr.vxFx8, spr.vyFx8) - myAngle) / Math.PI / 2 + 2-.25) * spr.textures.length +.5) % spr.textures.length)
            //for deal in user code
            if (this.onSpriteDirectionUpdateHandler)
                this.onSpriteDirectionUpdateHandler(spr, ((Math.atan2(spr._vx as any as number, spr._vy as any as number) - myAngle) / Math.PI / 2 + 2 - .25))
            //for CharacterAnimation ext.
            //     const iTexture = Math.floor(((Math.atan2(spr._vx as any as number, spr._vy as any as number) - myAngle) / Math.PI / 2 + 2 - .25) * 4 + .5) % 4
            //     const characterAniDirs = [Predicate.MovingLeft,Predicate.MovingDown, Predicate.MovingRight, Predicate.MovingUp]
            //     character.setCharacterState(spr, character.rule(characterAniDirs[iTexture]))
            //for this.spriteAnimations
            const texSpr = !this.spriteAnimations[spr.id] ? spr.image : this.spriteAnimations[spr.id].getFrameByDir(((Math.atan2(spr._vx as any as number, spr._vy as any as number) - myAngle) / Math.PI / 2 + 2 - .25))

            const sprTexRatio = texSpr.width / spriteScreenHalfWidth / 2
                helpers.imageBlit(
                this.tempScreen,
                blitXSpr,
                drawStart,
                blitWidthSpr,
                lineHeight * spr.height / this.tilemapScaleSize,
                texSpr,
                (blitXSpr - (spriteScreenX - spriteScreenHalfWidth)) * sprTexRatio
                ,
                0,
                blitWidthSpr * sprTexRatio, texSpr.height, true, false)

            const sayRender = this.sayRederers[spr.id]
            const particle = this.spriteParticles[spr.id]
            const sayOrParticle = !!sayRender || !!particle
            if (sayOrParticle) {
                screen.fill(0)
                //sayText
                if (sayRender) {
                    if (this.sayEndTimes[spr.id] && control.millis() > this.sayEndTimes[spr.id]) {
                        this.sayRederers[spr.id] = undefined
                    } else {
                        this.tempSprite.x = SWHalf
                        this.tempSprite.y = SHHalf + 2
                        this.camera.drawOffsetX = 0
                        this.camera.drawOffsetY = 0
                        sayRender.draw(screen, this.camera, this.tempSprite)
                    }
                }
                //particle
                if (particle) {
                    if (particle.lifespan) {
                        //debug
                        // this.tempScreen.print([spr.id].join(), 0,index*10+10)
                        this.tempSprite.x = SWHalf
                        this.tempSprite.y = SHHalf + spr.height
                        this.camera.drawOffsetX = 0//spr.x-SWHalf
                        this.camera.drawOffsetY = 0//spr.y-SH
                        particle.__draw(this.camera)
                    } else {
                        this.spriteParticles[spr.id] = undefined
                    }
                }
                //update screen for this spr
                const fpx_div_transformy = Math.roundWithPrecision(transformY / 4 / fpx_scale, 2)
                const height = (SH / fpx_div_transformy)
                const blitXSaySrc = ((blitX - spriteScreenX) * fpx_div_transformy) + SWHalf
                const blitWidthSaySrc = (blitWidth * fpx_div_transformy)
                if (blitXSaySrc <= 0) { //imageBlit considers negative value as 0
                    helpers.imageBlit(
                        this.tempScreen,
                        spriteScreenX - SWHalf / fpx_div_transformy, drawStart - height / 2, (blitWidthSaySrc + blitXSaySrc) / fpx_div_transformy, height,
                        screen,
                        0, 0, blitWidthSaySrc + blitXSaySrc, SH, true, false)
                } else {
                    helpers.imageBlit(
                        this.tempScreen,
                        blitX, drawStart - height / 2, blitWidth, height,
                        screen,
                        blitXSaySrc, 0, blitWidthSaySrc, SH,
                        true, false)
                }
            }
            // const ms = control.benchmark(() => {
            // }); this.tempScreen.print(ms.toString(), 0, 30 + index * 10, 15)
        }
    }

    //%fixedinstance
    export const raycastingRender = new Render.RayCastingRender()
}
