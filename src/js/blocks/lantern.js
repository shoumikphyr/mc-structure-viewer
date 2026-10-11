// Bloque/familia de modelos Minecraft. Las funciones se registran en el ámbito compartido del visor.

function createLanternGeometry(hanging = false) {
    const bodyGeo = new THREE.BoxGeometry(6 / 16, 7 / 16, 6 / 16);
    setBoxUVs(bodyGeo,
        [0 / 16, 2 / 16, 6 / 16, 9 / 16],
        [0 / 16, 9 / 16, 6 / 16, 15 / 16],
        [0 / 16, 9 / 16, 6 / 16, 15 / 16]
    );

    const capGeo = new THREE.BoxGeometry(4 / 16, 2 / 16, 4 / 16);
    setBoxUVs(capGeo,
        [1 / 16, 0 / 16, 5 / 16, 2 / 16],
        [1 / 16, 10 / 16, 5 / 16, 14 / 16],
        [1 / 16, 10 / 16, 5 / 16, 14 / 16]
    );

    const setPlaneAtlasUv = (geometry, rect) => {
        const [u0, v0, u1, v1] = rect.map(value => value / 16);
        const uv = geometry.attributes.uv.array;
        [u0, 1 - v0, u1, 1 - v0, u0, 1 - v1, u1, 1 - v1]
            .forEach((value, index) => { uv[index] = value; });
        geometry.attributes.uv.needsUpdate = true;
    };

    const handleA = new THREE.PlaneGeometry(3 / 16, (hanging ? 4 : 2) / 16);
    const handleB = new THREE.PlaneGeometry(3 / 16, (hanging ? 6 : 2) / 16);
    setPlaneAtlasUv(handleA, hanging ? [11, 1, 14, 5] : [11, 1, 14, 3]);
    setPlaneAtlasUv(handleB, hanging ? [11, 6, 14, 12] : [11, 10, 14, 12]);
    handleA.rotateY(Math.PI / 4);
    handleB.rotateY(-Math.PI / 4);

    bodyGeo.translate(0, hanging ? -0.5 + 4.5 / 16 : -0.5 + 3.5 / 16, 0);
    capGeo.translate(0, hanging ? -0.5 + 9 / 16 : -0.5 + 8 / 16, 0);
    const handleY = hanging ? -0.5 + 13 / 16 : -0.5 + 10 / 16;
    handleA.translate(0, handleY, 0);
    handleB.translate(0, handleY, 0);
    return mergeBoxGeometries([bodyGeo, capGeo, handleA, handleB]);
}
