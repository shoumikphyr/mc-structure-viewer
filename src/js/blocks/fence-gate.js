// Bloque/familia de modelos Minecraft. Las funciones se registran en el ámbito compartido del visor.

function createFenceGateGeometry() {
    const postL = new THREE.BoxGeometry(0.125, 0.8125, 0.125); postL.translate(-0.4375, 0, 0);
    const postR = new THREE.BoxGeometry(0.125, 0.8125, 0.125); postR.translate(0.4375, 0, 0);
    const barTop = new THREE.BoxGeometry(0.75, 0.1875, 0.125); barTop.translate(0, 0.22, 0);
    const barBot = new THREE.BoxGeometry(0.75, 0.1875, 0.125); barBot.translate(0, -0.16, 0);
    const center = new THREE.BoxGeometry(0.1875, 0.5625, 0.125); center.translate(0, 0.03, 0);
    return mergeBoxGeometries([postL, postR, barTop, barBot, center]);
}
