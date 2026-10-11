// Bloque/familia de modelos Minecraft. Las funciones se registran en el ámbito compartido del visor.

function createAmethystGeometry(blockId) {
    // The vanilla phase textures carry the crystal silhouettes; each phase uses the same full-size crossed planes.
    const width = (14.4 / 16) / Math.cos(Math.PI / 4);
    const planeA = new THREE.PlaneGeometry(width, 1);
    const planeB = new THREE.PlaneGeometry(width, 1);
    planeA.rotateY(Math.PI / 4);
    planeB.rotateY(-Math.PI / 4);
    return mergeBoxGeometries([planeA, planeB]);
}
