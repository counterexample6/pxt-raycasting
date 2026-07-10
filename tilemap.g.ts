// Auto-generated code. Do not edit.
namespace myImages {

    helpers._registerFactory("image", function(name: string) {
        switch(helpers.stringTrim(name)) {
            case "myTiles.transparency16":return img`
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . 
`;
            case "myTiles.tile1":
            case "myTile":return img`
1 2 3 5 1 2 3 5 1 2 3 5 1 2 3 5 
2 3 5 1 2 3 5 1 2 3 5 1 2 3 5 1 
3 5 1 2 3 5 1 2 3 5 1 2 3 5 1 2 
5 1 2 3 5 1 2 3 5 1 2 3 5 1 2 3 
1 2 3 5 1 2 3 5 1 2 3 5 1 2 3 5 
2 3 5 1 2 3 5 1 2 3 5 1 2 3 5 1 
3 5 1 2 3 5 1 2 3 5 1 2 3 5 1 2 
5 1 2 3 5 1 2 3 5 1 2 3 5 1 2 3 
1 2 3 5 1 2 3 5 1 2 3 5 1 2 3 5 
2 3 5 1 2 3 5 1 2 3 5 1 2 3 5 1 
3 5 1 2 3 5 1 2 3 5 1 2 3 5 1 2 
5 1 2 3 5 1 2 3 5 1 2 3 5 1 2 3 
1 2 3 5 1 2 3 5 1 2 3 5 1 2 3 5 
2 3 5 1 2 3 5 1 2 3 5 1 2 3 5 1 
3 5 1 2 3 5 1 2 3 5 1 2 3 5 1 2 
5 1 2 3 5 1 2 3 5 1 2 3 5 1 2 3 
`;
            case "myTiles.tile2":
            case "myTile0":return img`
d d d d d d d d d d d d d d d d 
d d d d d d d d d d d d d d d d 
d d d d d d d d d d d d d d d d 
1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 
d d d d d d d d d d d d d d d d 
d d d d d d d d d d d d d d d d 
d d d d d d d d d d d d d d d d 
1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 
d d d d d d d d d d d d d d d d 
d d d d d d d d d d d d d d d d 
d d d d d d d d d d d d d d d d 
1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 
d d d d d d d d d d d d d d d d 
d d d d d d d d d d d d d d d d 
d d d d d d d d d d d d d d d d 
1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 
`;
        }
        return null;
    })

    helpers._registerFactory("animation", function(name: string) {
        switch(helpers.stringTrim(name)) {

        }
        return null;
    })

    helpers._registerFactory("song", function(name: string) {
        switch(helpers.stringTrim(name)) {

        }
        return null;
    })

    helpers._registerFactory("json", function(name: string) {
        switch(helpers.stringTrim(name)) {

        }
        return null;
    })

}
// Auto-generated code. Do not edit.

// Auto-generated code. Do not edit.
namespace myTiles {
    //% fixedInstance jres blockIdentity=images._tile
    export const transparency16 = image.ofBuffer(hex``);
    //% fixedInstance jres blockIdentity=images._tile
    export const tile1 = image.ofBuffer(hex``);
    //% fixedInstance jres blockIdentity=images._tile
    export const tile2 = image.ofBuffer(hex``);

    helpers._registerFactory("tilemap", function(name: string) {
        switch(helpers.stringTrim(name)) {
            case "level1":
            case "level1":return tiles.createTilemap(hex`1000100001010101010101010101010101010101010606060606060606060606060606010106020202020202020202020202060101060206060606060606060606020601010602060202020606050505060206010106020602060606060606050602060101060206020606060606060506020601010602060606060606060606060206010106020606060606060606060602060101060206030606060606060406020601010602060306060606060604060206010106020603030306060404040602060101060206060606060606060606020601010602020202020202020202020206010106060606060606060606060606060101010101010101010101010101010101`, img`
2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 
2 . . . . . . . . . . . . . . 2 
2 . . . . . . . . . . . . . . 2 
2 . . . . . . . . . . . . . . 2 
2 . . . 2 2 2 . . 2 2 2 . . . 2 
2 . . . 2 . . . . . . 2 . . . 2 
2 . . . 2 . . . . . . 2 . . . 2 
2 . . . . . . . . . . . . . . 2 
2 . . . . . . . . . . . . . . 2 
2 . . . 2 . . . . . . 2 . . . 2 
2 . . . 2 . . . . . . 2 . . . 2 
2 . . . 2 2 2 . . 2 2 2 . . . 2 
2 . . . . . . . . . . . . . . 2 
2 . . . . . . . . . . . . . . 2 
2 . . . . . . . . . . . . . . 2 
2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 
`, [myTiles.transparency16,myTiles.tile1,sprites.castle.tileGrass2,sprites.builtin.brick,sprites.dungeon.hazardLava0,myTiles.tile2,sprites.vehicle.roadHorizontal], TileScale.Sixteen);
        }
        return null;
    })

    helpers._registerFactory("tile", function(name: string) {
        switch(helpers.stringTrim(name)) {
            case "transparency16":return myTiles.transparency16;
            case "myTile":
            case "tile1":return myTiles.tile1;
            case "myTile0":
            case "tile2":return myTiles.tile2;
        }
        return null;
    })

}
// Auto-generated code. Do not edit.
