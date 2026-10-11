// Bloque/familia de modelos Minecraft. Las funciones se registran en el ámbito compartido del visor.

function createGrindstoneWheelGeometry() {
    return createVanillaModelBox([4, 4, 2], [12, 16, 14], {
        east: [0, 0, 12, 12], west: [0, 0, 12, 12],
        north: [0, 0, 8, 12], south: [0, 0, 8, 12],
        up: [0, 0, 8, 12], down: [0, 0, 8, 12]
    });
}

function createGrindstoneLegGeometry() {
    const uv = {
        north: [2, 9, 4, 16], east: [10, 16, 6, 9],
        south: [12, 9, 14, 16], west: [6, 9, 10, 16], down: [12, 6, 14, 10]
    };
    const left = createVanillaModelBox([2, 0, 6], [4, 7, 10], {
        ...uv, north: [12, 9, 14, 16], south: [2, 9, 4, 16]
    });
    const right = createVanillaModelBox([12, 0, 6], [14, 7, 10], uv);
    return mergeBoxGeometries([left, right]);
}

function createGrindstonePivotGeometry() {
    const uv = { north: [6, 0, 8, 6], south: [6, 0, 8, 6], up: [8, 0, 10, 6], down: [8, 0, 10, 6] };
    const left = createVanillaModelBox([2, 7, 5], [4, 13, 11], { ...uv, west: [0, 0, 6, 6] });
    const right = createVanillaModelBox([12, 7, 5], [14, 13, 11], { ...uv, east: [0, 0, 6, 6] });
    return mergeBoxGeometries([left, right]);
}
