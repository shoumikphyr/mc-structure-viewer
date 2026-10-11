// Bloque/familia de modelos Minecraft. Las funciones se registran en el ámbito compartido del visor.

function createCampfireLogGeometry(isLit = false) {
    const uv = (rect, rotation = 0) => ({ uv: rect, rotation });
    const makeBox = (from, to, faces, litFaces = []) => {
        const geometry = createVanillaModelBox(from, to, faces);
        geometry.groups.forEach(group => {
            const faceName = ['east', 'west', 'up', 'down', 'south', 'north'][group.materialIndex];
            group.materialIndex = isLit && litFaces.includes(faceName) ? 1 : 0;
        });
        return geometry;
    };
    const logs = [
        makeBox([1, 0, 0], [5, 4, 16], {
            north: [0, 4, 4, 8], east: [0, 1, 16, 5], south: [0, 4, 4, 8], west: [16, 0, 0, 4],
            up: uv([0, 0, 16, 4], 90), down: uv([0, 0, 16, 4], 90)
        }, ['east', 'west']),
        makeBox([0, 3, 11], [16, 7, 15], {
            north: [16, 0, 0, 4], east: [0, 4, 4, 8], south: [0, 0, 16, 4], west: [0, 4, 4, 8],
            up: uv([0, 0, 16, 4], 180), down: [0, 4, 16, 8]
        }, ['north', 'south', 'down']),
        makeBox([11, 0, 0], [15, 4, 16], {
            north: [0, 4, 4, 8], east: [0, 0, 16, 4], south: [0, 4, 4, 8], west: [16, 1, 0, 5],
            up: uv([0, 0, 16, 4], 90), down: uv([0, 0, 16, 4], 90)
        }, ['west']),
        makeBox([0, 3, 1], [16, 7, 5], {
            north: [0, 0, 16, 4], east: [0, 4, 4, 8], south: [16, 0, 0, 4], west: [0, 4, 4, 8],
            up: uv([0, 0, 16, 4], 180), down: [0, 4, 16, 8]
        }, ['north', 'south', 'down']),
        makeBox([5, 0, 0], [11, 1, 16], {
            north: [0, 15, 6, 16], south: [10, 15, 16, 16],
            up: uv([0, 8, 16, 14], 90), down: uv([0, 8, 16, 14], 90)
        }, ['up'])
    ];
    return mergeBoxGeometries(logs);
}

function createCampfireFlameGeometry() {
    // The Java cross template uses rescale=true on both 45-degree planes.
    const rescaledWidth = (14.4 / 16) / Math.cos(Math.PI / 4);
    const flameA = new THREE.PlaneGeometry(rescaledWidth, 1);
    const flameB = new THREE.PlaneGeometry(rescaledWidth, 1);
    flameA.rotateY(Math.PI / 4);
    flameB.rotateY(-Math.PI / 4);
    flameA.translate(0, 1 / 16, 0);
    flameB.translate(0, 1 / 16, 0);
    return mergeBoxGeometries([flameA, flameB]);
}
