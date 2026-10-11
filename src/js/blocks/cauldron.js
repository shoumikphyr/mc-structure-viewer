// Bloque/familia de modelos Minecraft. Las funciones se registran en el ámbito compartido del visor.

function createCauldronGeometry() {
    const materialIndex = { side: 0, inside: 1, rim: 2, bottom: 3 };
    const faceIndices = { east: 0, west: 1, up: 2, down: 3, south: 4, north: 5 };
    const makeModelElement = (from, to, faces) => {
        const geometry = new THREE.BoxGeometry(
            (to[0] - from[0]) / 16,
            (to[1] - from[1]) / 16,
            (to[2] - from[2]) / 16
        );
        geometry.translate(
            (from[0] + to[0]) / 32 - 0.5,
            (from[1] + to[1]) / 32 - 0.5,
            (from[2] + to[2]) / 32 - 0.5
        );
        const [x1, y1, z1] = from;
        const [x2, y2, z2] = to;
        const faceUVs = {
            east: [16 - z2, 16 - y2, 16 - z1, 16 - y1],
            west: [z1, 16 - y2, z2, 16 - y1],
            up: [x1, z1, x2, z2],
            down: [x1, 16 - z2, x2, 16 - z1],
            south: [x1, 16 - y2, x2, 16 - y1],
            north: [16 - x2, 16 - y2, 16 - x1, 16 - y1]
        };
        setModelFaceUVs(geometry, faceUVs);
        geometry.groups.forEach(group => {
            const face = Object.keys(faceIndices).find(name => faceIndices[name] === group.materialIndex);
            const textureName = faces[face];
            if (textureName === undefined) group.count = 0;
            else group.materialIndex = materialIndex[textureName];
        });
        return geometry;
    };
    // Estos son los cambios que hice, att. ChatGPT: replica las caras y los UV por elemento del modelo vanilla, sin estirar una imagen por todo el caldero.
    return mergeBoxGeometries([
        makeModelElement([0, 3, 0], [2, 16, 16], { north: 'side', east: 'side', south: 'side', west: 'side', up: 'rim', down: 'inside' }),
        makeModelElement([2, 3, 2], [14, 4, 14], { up: 'inside', down: 'inside' }),
        makeModelElement([14, 3, 0], [16, 16, 16], { north: 'side', east: 'side', south: 'side', west: 'side', up: 'rim', down: 'inside' }),
        makeModelElement([2, 3, 0], [14, 16, 2], { north: 'side', south: 'side', up: 'rim', down: 'inside' }),
        makeModelElement([2, 3, 14], [14, 16, 16], { north: 'side', south: 'side', up: 'rim', down: 'inside' }),
        makeModelElement([0, 0, 0], [4, 3, 2], { north: 'side', east: 'side', south: 'side', west: 'side', down: 'bottom' }),
        makeModelElement([0, 0, 2], [2, 3, 4], { east: 'side', south: 'side', west: 'side', down: 'bottom' }),
        makeModelElement([12, 0, 0], [16, 3, 2], { north: 'side', east: 'side', south: 'side', west: 'side', down: 'bottom' }),
        makeModelElement([14, 0, 2], [16, 3, 4], { east: 'side', south: 'side', west: 'side', down: 'bottom' }),
        makeModelElement([0, 0, 14], [4, 3, 16], { north: 'side', east: 'side', south: 'side', west: 'side', down: 'bottom' }),
        makeModelElement([0, 0, 12], [2, 3, 14], { north: 'side', east: 'side', west: 'side', down: 'bottom' }),
        makeModelElement([12, 0, 14], [16, 3, 16], { north: 'side', east: 'side', south: 'side', west: 'side', down: 'bottom' }),
        makeModelElement([14, 0, 12], [16, 3, 14], { north: 'side', east: 'side', west: 'side', down: 'bottom' })
    ]);
}
