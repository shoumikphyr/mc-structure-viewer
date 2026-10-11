// Bloque/familia de modelos Minecraft. Las funciones se registran en el ámbito compartido del visor.

function isCrossPlantBlock(blockName) {
    const id = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
    if (id.startsWith('potted_') || id === 'flower_pot' || id === 'pink_petals') return false;
    return /(short_grass|tall_grass|fern|dead_bush|dandelion|poppy|orchid|allium|azure_bluet|tulip|daisy|cornflower|lily_of_the_valley|wither_rose|sunflower|lilac|rose_bush|peony|torchflower|eyeblossom|pitcher_plant|wheat|beetroots?|carrots?|potatoes|nether_wart|sweet_berry_bush)/.test(id);
}

function getPottedPlantTextureName(blockName) {
    const id = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
    const modelTextureOverrides = {
        potted_azalea_bush: 'potted_azalea_bush_plant',
        potted_flowering_azalea_bush: 'potted_flowering_azalea_bush_plant',
        potted_crimson_roots: 'crimson_roots_pot',
        potted_warped_roots: 'warped_roots_pot',
        potted_cactus: 'cactus',
        potted_bamboo: 'bamboo_stalk',
        potted_mangrove_propagule: 'mangrove_propagule'
    };
    return modelTextureOverrides[id] || id.replace(/^potted_/, '');
}

function isPottedPlantBlock(blockName) {
    return blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0].startsWith('potted_');
}

function createCrossPlantGeometry() {
    const width = (14.4 / 16) / Math.cos(Math.PI / 4);
    const diagonalA = new THREE.PlaneGeometry(width, 1);
    const diagonalB = new THREE.PlaneGeometry(width, 1);
    diagonalA.rotateY(Math.PI / 4);
    diagonalB.rotateY(-Math.PI / 4);
    return mergeBoxGeometries([diagonalA, diagonalB]);
}

function createPottedPotGeometry() {
    const faceOrder = ['east', 'west', 'up', 'down', 'south', 'north'];
    const createModelBox = (from, to, faceUvs) => {
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

        const uv = geometry.attributes.uv.array;
        faceOrder.forEach((face, faceIndex) => {
            const rect = faceUvs[face];
            if (!rect) return;
            const [u1, v1, u2, v2] = rect;
            const uMin = u1 / 16;
            const uMax = u2 / 16;
            const vMin = 1 - v2 / 16;
            const vMax = 1 - v1 / 16;
            const offset = faceIndex * 8;
            uv[offset] = uMin; uv[offset + 1] = vMax;
            uv[offset + 2] = uMin; uv[offset + 3] = vMin;
            uv[offset + 4] = uMax; uv[offset + 5] = vMax;
            uv[offset + 6] = uMax; uv[offset + 7] = vMin;
        });
        geometry.attributes.uv.needsUpdate = true;
        return geometry;
    };

    const fullSides = [5, 10, 11, 16];
    const narrowLeft = [5, 10, 6, 16];
    const narrowRight = [10, 10, 11, 16];
    const pieces = [
        createModelBox([5, 0, 5], [6, 6, 11], {
            down: [5, 5, 6, 11], up: [5, 5, 6, 11], north: narrowRight,
            south: narrowLeft, west: fullSides, east: fullSides
        }),
        createModelBox([10, 0, 5], [11, 6, 11], {
            down: [10, 5, 11, 11], up: [10, 5, 11, 11], north: narrowLeft,
            south: narrowRight, west: fullSides, east: fullSides
        }),
        createModelBox([6, 0, 5], [10, 6, 6], {
            down: [6, 10, 10, 11], up: [6, 5, 10, 6],
            north: [6, 10, 10, 16], south: [6, 10, 10, 16]
        }),
        createModelBox([6, 0, 10], [10, 6, 11], {
            down: [6, 5, 10, 6], up: [6, 10, 10, 11],
            north: [6, 10, 10, 16], south: [6, 10, 10, 16]
        })
    ];
    return mergeBoxGeometries(pieces);
}

function createPottedPlantGeometry() {
    const width = 10.8 / 16;
    const height = 12 / 16;
    const diagonalA = new THREE.PlaneGeometry(width, height);
    const diagonalB = new THREE.PlaneGeometry(width, height);
    diagonalA.rotateY(Math.PI / 4);
    diagonalB.rotateY(-Math.PI / 4);
    diagonalA.translate(0, 0.125, 0);
    diagonalB.translate(0, 0.125, 0);
    return mergeBoxGeometries([diagonalA, diagonalB]);
}

function createPottedCactusGeometry() {
    const geometry = new THREE.BoxGeometry(4 / 16, 11 / 16, 4 / 16);
    geometry.translate(0, 10.5 / 16 - 0.5, 0);
    return geometry;
}

function createPottedBambooStalkGeometry() {
    const geometry = new THREE.BoxGeometry(3 / 16, 12 / 16, 3 / 16);
    geometry.translate(0, 0.125, 0);
    return geometry;
}

function createPottedBambooLeavesGeometry() {
    const leafA = new THREE.PlaneGeometry(7 / 16, 4 / 16);
    const leafB = new THREE.PlaneGeometry(7 / 16, 4 / 16);
    leafA.rotateY(Math.PI / 4);
    leafB.rotateY(-Math.PI / 4);
    leafA.translate(0, 0.25, 0);
    leafB.translate(0, 0.25, 0);
    return mergeBoxGeometries([leafA, leafB]);
}

function createPottedDirtGeometry() {
    const geometry = new THREE.PlaneGeometry(4 / 16, 4 / 16);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -0.25, 0);
    return geometry;
}
