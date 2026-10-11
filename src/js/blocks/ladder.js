// Bloque/familia de modelos Minecraft. Las funciones se registran en el ámbito compartido del visor.

function createLadderGeometry() {
    // Estos son los cambios que hice, att. ChatGPT: la escalera plana queda en el borde de apoyo, contra el bloque y no hacia el aire.
    const geometry = new THREE.PlaneGeometry(0.98, 0.98);
    geometry.translate(0, 0, -0.4375);
    return geometry;
}
