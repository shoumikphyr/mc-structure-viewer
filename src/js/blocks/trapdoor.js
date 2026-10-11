// Bloque/familia de modelos Minecraft. Las funciones se registran en el ámbito compartido del visor.

function createTrapdoorGeometry(half = 'bottom', isOpen = false) {
    // Estos son los cambios que hice, att. ChatGPT: cada trampilla usa su posición real; abierta queda vertical junto al borde de apoyo.
    if (isOpen) {
        // Estos son los cambios que hice, att. ChatGPT: abierta sigue siendo una placa 3D con grosor, no una lámina plana.
        const openGeometry = new THREE.BoxGeometry(0.98, 0.98, 0.18);
        openGeometry.translate(0, 0, -0.4);
        fixGeometryUVs(openGeometry);
        return openGeometry;
    }

    const closedGeometry = new THREE.BoxGeometry(0.98, 0.18, 0.98);
    closedGeometry.translate(0, half === 'top' ? 0.4 : -0.4, 0);
    fixGeometryUVs(closedGeometry);
    return closedGeometry;
}
