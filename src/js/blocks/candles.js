// Bloque/familia de modelos Minecraft. Las funciones se registran en el ámbito compartido del visor.

function createCandleGeometry(count) {
    const offsets = {
        1: [[0, 0]],
        2: [[-2, -2], [2, 2]],
        3: [[-2, -2], [2, -2], [0, 2]],
        4: [[-2, -2], [2, -2], [-2, 2], [2, 2]]
    }[Math.max(1, Math.min(4, Number(count) || 1))];

    function setAtlasUv(geometry, rect) {
        const [u0, v0, u1, v1] = rect.map(value => value / 16);
        const uv = geometry.attributes.uv.array;
        [u0, 1 - v0, u1, 1 - v0, u0, 1 - v1, u1, 1 - v1]
            .forEach((value, index) => { uv[index] = value; });
        geometry.attributes.uv.needsUpdate = true;
    }

    const candleParts = [];
    offsets.forEach(([x, z]) => {
        const body = new THREE.BoxGeometry(2 / 16, 6 / 16, 2 / 16);
        setBoxUVs(body, [0 / 16, 8 / 16, 2 / 16, 14 / 16], [0 / 16, 6 / 16, 2 / 16, 8 / 16], [0 / 16, 14 / 16, 2 / 16, 16 / 16]);
        body.translate(x / 16, -0.5 + 3 / 16, z / 16);
        candleParts.push(body);

        [Math.PI / 4, -Math.PI / 4].forEach(angle => {
            const wick = new THREE.PlaneGeometry(1 / 16, 1 / 16);
            setAtlasUv(wick, [0, 5, 1, 6]);
            wick.rotateY(angle);
            wick.translate(x / 16, -0.5 + 6.5 / 16, z / 16);
            candleParts.push(wick);
        });
    });
    return mergeBoxGeometries(candleParts);
}
