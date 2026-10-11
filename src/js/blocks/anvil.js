// Bloque/familia de modelos Minecraft. Las funciones se registran en el ámbito compartido del visor.

function createAnvilGeometry() {
    const uv = (rect, rotation = 0) => ({ uv: rect, rotation });
    const base = createVanillaModelBox([2, 0, 2], [14, 4, 14], {
        down: uv([2, 2, 14, 14], 180), up: uv([2, 2, 14, 14], 180),
        north: [2, 12, 14, 16], south: [2, 12, 14, 16],
        west: uv([0, 2, 4, 14], 90), east: uv([4, 2, 0, 14], 270)
    });
    const collar = createVanillaModelBox([4, 4, 3], [12, 5, 13], {
        up: uv([4, 3, 12, 13], 180), north: [4, 11, 12, 12], south: [4, 11, 12, 12],
        west: uv([4, 3, 5, 13], 90), east: uv([5, 3, 4, 13], 270)
    });
    const neck = createVanillaModelBox([6, 5, 4], [10, 10, 12], {
        north: [6, 6, 10, 11], south: [6, 6, 10, 11],
        west: uv([5, 4, 10, 12], 90), east: uv([10, 4, 5, 12], 270)
    });
    const head = createVanillaModelBox([3, 10, 0], [13, 16, 16], {
        down: uv([3, 0, 13, 16], 180), up: uv([3, 0, 13, 16], 180),
        north: [3, 0, 13, 6], south: [3, 0, 13, 6],
        west: uv([10, 0, 16, 16], 90), east: uv([16, 0, 10, 16], 270)
    });

    const topFace = head.groups.find(group => group.materialIndex === 2 && group.count > 0);
    [base, collar, neck, head].forEach(part => {
        part.groups.forEach(group => { group.materialIndex = 0; });
    });
    if (topFace) topFace.materialIndex = 1;
    return mergeBoxGeometries([base, collar, neck, head]);
}
