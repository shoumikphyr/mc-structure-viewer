// Bloque/familia de modelos Minecraft. Las funciones se registran en el ámbito compartido del visor.

function createStairGeometry() {
    // Estos son los cambios que hice, att. ChatGPT: restauro las proporciones anteriores y conservo el cálculo de unión en esquinas.
    const g1 = new THREE.BoxGeometry(0.98, 0.49, 0.98); g1.translate(0, -0.245, 0);
    const g2 = new THREE.BoxGeometry(0.98, 0.49, 0.49); g2.translate(0, 0.245, 0.245);
    return mergeBoxGeometries([g1, g2]);
}

function createOuterStairGeometry(isLeft = false) {
    // Estos son los cambios que hice, att. ChatGPT: las escaleras interiores y exteriores usan variantes espejo para izquierda/derecha.
    const g1 = new THREE.BoxGeometry(0.98, 0.49, 0.98); g1.translate(0, -0.245, 0);
    const g2 = new THREE.BoxGeometry(0.49, 0.49, 0.49); g2.translate(isLeft ? -0.245 : 0.245, 0.245, 0.245);
    return mergeBoxGeometries([g1, g2]);
}

function createInnerStairGeometry(isLeft = false) {
    const g1 = new THREE.BoxGeometry(0.98, 0.49, 0.98); g1.translate(0, -0.245, 0);
    const g2 = new THREE.BoxGeometry(0.98, 0.49, 0.49); g2.translate(0, 0.245, 0.245);
    const g3 = new THREE.BoxGeometry(0.49, 0.49, 0.49); g3.translate(isLeft ? -0.245 : 0.245, 0.245, -0.245);
    return mergeBoxGeometries([g1, g2, g3]);
}
