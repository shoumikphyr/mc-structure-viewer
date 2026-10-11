// Bloque/familia de modelos Minecraft. Las funciones se registran en el ámbito compartido del visor.

function createEnchantingTableGeometry() {
    const geometry = new THREE.BoxGeometry(1, 12 / 16, 1);
    geometry.translate(0, -1 / 8, 0);
    const faceIndices = { east: 0, west: 1, up: 2, down: 3, south: 4, north: 5 };
    const faceUVs = {
        east: [0, 4, 16, 16], west: [0, 4, 16, 16],
        north: [0, 4, 16, 16], south: [0, 4, 16, 16],
        up: [0, 0, 16, 16], down: [0, 0, 16, 16]
    };
    const uvs = geometry.attributes.uv.array;
    Object.entries(faceUVs).forEach(([face, rect]) => {
        const offset = faceIndices[face] * 8;
        const [u1, v1, u2, v2] = rect;
        // Estos son los cambios que hice, att. ChatGPT: ordena las cuatro esquinas UV como espera BoxGeometry para que los laterales no se giren ni se crucen.
        [u1 / 16, 1 - v1 / 16, u2 / 16, 1 - v1 / 16,
            u1 / 16, 1 - v2 / 16, u2 / 16, 1 - v2 / 16]
            .forEach((value, index) => { uvs[offset + index] = value; });
    });
    geometry.attributes.uv.needsUpdate = true;
    return geometry;
}
