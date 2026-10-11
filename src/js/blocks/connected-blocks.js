// Bloque/familia de modelos Minecraft. Las funciones se registran en el ámbito compartido del visor.

const GLASS_PANE_NON_SOLID_BLOCKS = new Set([
    'air', 'cave_air', 'void_air', 'water', 'lava',
    'grass', 'short_grass', 'tall_grass', 'fern', 'large_fern', 'dead_bush',
    'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip',
    'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley',
    'sunflower', 'lilac', 'rose_bush', 'peony', 'torchflower', 'pink_petals',
    'vine', 'glow_lichen', 'hanging_roots', 'spore_blossom', 'sugar_cane', 'bamboo',
    'sweet_berry_bush', 'cobweb', 'torch', 'soul_torch', 'wall_torch', 'redstone_torch',
    'soul_wall_torch', 'redstone_wall_torch', 'lantern', 'soul_lantern', 'carpet', 'flower_pot',
    'lily_pad', 'seagrass', 'tall_seagrass', 'kelp', 'ladder', 'scaffolding',
    'tripwire', 'redstone_wire', 'rail', 'powered_rail', 'detector_rail', 'activator_rail'
]);

const glassPaneGeometryCache = {};

function getConnectedBlockKind(blockName) {
    const id = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
    // Estos son los cambios que hice, att. ChatGPT: también reconozco el nombre exacto glass_pane para darle geometría de panel.
    if (id === 'glass_pane' || id.endsWith('_glass_pane') || id === 'iron_bars') return 'pane';
    if (id.endsWith('_fence') || id.endsWith('_fence_gate')) return 'fence';
    if (id.endsWith('_wall')) return 'wall';
    return '';
}

function isGlassPaneBlock(blockName) {
    const id = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
    return id === 'glass_pane' || id.endsWith('_glass_pane');
}

function canConnectToFamily(blockKind, neighborName) {
    const id = neighborName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
    if (blockKind === 'fence' && (id === 'glass_pane' || id.endsWith('_glass_pane') || id === 'iron_bars')) {
        return false;
    }
    return canGlassPaneConnectTo(id);
}

function getConnectedDirections(block, blocksByPosition) {
    const blockKind = getConnectedBlockKind(block.blockName);
    if (!blockKind) return '';

    // Estos son los cambios que hice, att. ChatGPT: solo se dibujan conexiones reales con bloques vecinos compatibles.
    const neighbors = [
        ['north', 0, -1],
        ['south', 0, 1],
        ['east', 1, 0],
        ['west', -1, 0]
    ];

    return neighbors
        .filter(([, dx, dz]) => {
            const neighbor = blocksByPosition.get(`${block.x + dx},${block.y},${block.z + dz}`);
            return neighbor && canConnectToFamily(blockKind, neighbor.blockName);
        })
        .map(([direction]) => direction)
        .join(',');
}

function getConnectedGeometry(blockKind, connections) {
    const cacheKey = `${blockKind}:${connections}`;
    if (glassPaneGeometryCache[cacheKey]) return glassPaneGeometryCache[cacheKey];

    const parts = [];
    const isFence = blockKind === 'fence';
    const isWall = blockKind === 'wall';
    const postWidth = isFence ? 0.25 : (isWall ? 0.375 : 0.125);
    parts.push(new THREE.BoxGeometry(postWidth, 0.98, postWidth));

    const armLength = (1 - postWidth) / 2;
    const armCenter = postWidth / 2 + armLength / 2;
    const directions = connections ? connections.split(',') : [];

    directions.forEach(direction => {
        const isNorthSouth = direction === 'north' || direction === 'south';
        const sign = direction === 'north' || direction === 'west' ? -1 : 1;

        if (isFence) {
            [-0.15, 0.18].forEach(y => {
                const rail = isNorthSouth
                    ? new THREE.BoxGeometry(0.125, 0.125, armLength)
                    : new THREE.BoxGeometry(armLength, 0.125, 0.125);
                rail.translate(
                    isNorthSouth ? 0 : sign * armCenter,
                    y,
                    isNorthSouth ? sign * armCenter : 0
                );
                parts.push(rail);
            });
        } else {
            const thickness = isWall ? 0.25 : 0.125;
            const height = isWall ? 0.75 : 0.98;
            const arm = isNorthSouth
                ? new THREE.BoxGeometry(thickness, height, armLength)
                : new THREE.BoxGeometry(armLength, height, thickness);
            arm.translate(
                isNorthSouth ? 0 : sign * armCenter,
                0,
                isNorthSouth ? sign * armCenter : 0
            );
            parts.push(arm);
        }
    });

    glassPaneGeometryCache[cacheKey] = mergeBoxGeometries(parts);
    return glassPaneGeometryCache[cacheKey];
}

function getGlassPaneGeometry(connections) {
    const cacheKey = `java-glass-pane:${connections}`;
    if (glassPaneGeometryCache[cacheKey]) return glassPaneGeometryCache[cacheKey];

    // El poste central y los brazos usan las medidas del modelo vanilla (2 px de grosor).
    // Las tapas exteriores de los brazos conectados se omiten: Java las oculta con cullface.
    const post = createVanillaModelBox([7, 0, 7], [9, 16, 9], {
        east: [7, 0, 9, 16], west: [7, 0, 9, 16],
        south: [7, 0, 9, 16], north: [7, 0, 9, 16],
        up: [7, 7, 9, 9], down: [7, 7, 9, 9]
    });

    // El brazo norte es el template que Java rota para las otras tres direcciones.
    const northArm = createVanillaModelBox([7, 0, 0], [9, 16, 7], {
        up: [7, 0, 9, 7], down: [7, 0, 9, 7],
        west: [16, 0, 9, 16], east: [9, 0, 16, 16]
        // No se incluye north: es la cara cullface del extremo conectado.
        // Tampoco south: queda cubierta por el poste central.
    });

    // Los grupos 2 y 3 son las caras superior e inferior: llevan glass_pane_top.
    [post, northArm].forEach(geometry => {
        geometry.groups.forEach(group => {
            if (group.materialIndex === 2 || group.materialIndex === 3) group.materialIndex = 1;
        });
    });

    const parts = [post];
    const rotations = {
        north: 0,
        east: -Math.PI / 2,
        south: Math.PI,
        west: Math.PI / 2
    };
    (connections ? connections.split(',') : []).forEach(direction => {
        if (!(direction in rotations)) return;
        const arm = northArm.clone();
        if (rotations[direction]) arm.rotateY(rotations[direction]);
        parts.push(arm);
    });

    glassPaneGeometryCache[cacheKey] = mergeBoxGeometries(parts);
    return glassPaneGeometryCache[cacheKey];
}

function canGlassPaneConnectTo(blockName) {
    const id = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];

    if (id === 'glass_pane' || id.endsWith('_glass_pane') || id === 'iron_bars' || id.endsWith('_fence') || id.endsWith('_wall')) {
        return true;
    }

    // Estos son los cambios que hice, att. ChatGPT: excluyo familias completas de flores y plantas, aunque sus nombres varíen.
    const plantOrDecoration = /(flower|petal|tulip|orchid|poppy|daisy|bluet|lily|rose|peony|lilac|eyeblossom|pitcher|bush|sapling|leaves|fern|mushroom|fungus|crop|roots?|vine|kelp|seagrass|coral|lichen|carpet|torch|lantern|candle|rail|button|pressure_plate|sign|banner|ladder|scaffolding|tripwire|redstone_wire)/;
    if (id !== 'grass_block' && (plantOrDecoration.test(id) || id === 'grass' || id.startsWith('potted_') ||
        GLASS_PANE_NON_SOLID_BLOCKS.has(id) || id.endsWith('_leaves') || id.endsWith('_carpet') ||
        id.endsWith('_button') || id.endsWith('_pressure_plate') || id.endsWith('_sign') ||
        id.endsWith('_wall_sign') || id.endsWith('_hanging_sign') || id.endsWith('_banner') ||
        id.endsWith('_wall_banner') || id.endsWith('_rail'))) {
        return false;
    }

    return true;
}
