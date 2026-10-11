// Registry of individual block definitions. Family modules provide shared rendering logic.
window.MC_BLOCK_DEFINITIONS = window.MC_BLOCK_DEFINITIONS || Object.create(null);
window.MC_BLOCK_DEFINITION_LOADS = window.MC_BLOCK_DEFINITION_LOADS || new Map();
window.MC_BLOCK_KNOWN_IDS = window.MC_BLOCK_KNOWN_IDS || new Set();

function normalizeBlockDefinitionId(value) {
    return String(value || '').replace(/^minecraft:/i, '').trim().toLowerCase().split('[')[0];
}

function inferBlockFamily(id) {
    if (['small_amethyst_bud', 'medium_amethyst_bud', 'large_amethyst_bud', 'amethyst_cluster'].includes(id)) return 'amethyst';
    if (id === 'enchanting_table') return 'enchanting-table';
    if (id === 'campfire' || id === 'soul_campfire') return 'campfire';
    if (['anvil', 'chipped_anvil', 'damaged_anvil'].includes(id)) return 'anvil';
    if (id === 'grindstone') return 'grindstone';
    if (id.includes('cauldron')) return 'cauldron';
    if (id.endsWith('_fence_gate')) return 'fence-gate';
    if (id.endsWith('_glass_pane') || id === 'glass_pane') return 'glass-pane';
    if (id.endsWith('_trapdoor')) return 'trapdoor';
    if (id.endsWith('_stairs')) return 'stairs';
    if (id.endsWith('_slab')) return 'slab';
    if (id === 'ladder' || id.endsWith('_ladder')) return 'ladder';
    if (id === 'chest' || id === 'trapped_chest' || id === 'ender_chest' || /^(waxed_)?(?:(exposed|weathered|oxidized)_)?copper_chest$/.test(id)) return 'chest';
    if (id === 'candle' || id.endsWith('_candle')) return 'candles';
    if (id.startsWith('potted_') || id === 'flower_pot') return 'potted';
    if (/(short_grass|tall_grass|fern|dead_bush|dandelion|poppy|orchid|allium|azure_bluet|tulip|daisy|cornflower|lily_of_the_valley|wither_rose|sunflower|lilac|rose_bush|peony|torchflower|eyeblossom|pitcher_plant|wheat|beetroots?|carrots?|potatoes|nether_wart|sweet_berry_bush)/.test(id)) return 'cross-plant';
    if (id.endsWith('_lantern') || id === 'lantern') return 'lantern';
    if (id.endsWith('_fence')) return 'fence';
    if (id.endsWith('_wall')) return 'wall';
    if (id === 'iron_bars') return 'iron-bars';
    if (id.endsWith('_door')) return 'door';
    if (id.includes('carpet') || id.endsWith('_pressure_plate')) return 'carpet';
    if (/(torch|flower_pot)$/.test(id)) return 'small-object';
    if (id.endsWith('_bed')) return 'bed';
    if (id.includes('chain')) return 'chain';
    return 'cube';
}

function registerBlockDefinition(definition) {
    if (!definition || !definition.id) throw new TypeError('Block definition requires an id.');
    const id = normalizeBlockDefinitionId(definition.id);
    window.MC_BLOCK_DEFINITIONS[id] = {
        ...definition,
        id,
        family: definition.family || inferBlockFamily(id),
        textures: definition.textures || Object.create(null)
    };
    return window.MC_BLOCK_DEFINITIONS[id];
}

function getBlockDefinition(blockName) {
    const id = normalizeBlockDefinitionId(blockName);
    return window.MC_BLOCK_DEFINITIONS[id] || { id, family: inferBlockFamily(id), textures: Object.create(null) };
}

function blockDefinitionFilename(id) {
    return normalizeBlockDefinitionId(id).replace(/[^a-z0-9_.-]/g, '_') + '.js';
}

function loadBlockDefinition(blockName) {
    const id = normalizeBlockDefinitionId(blockName);
    if (!id || window.MC_BLOCK_DEFINITIONS[id]) return Promise.resolve(getBlockDefinition(id));
    if (window.MC_BLOCK_DEFINITION_LOADS.has(id)) return window.MC_BLOCK_DEFINITION_LOADS.get(id);
    if (!window.MC_BLOCK_KNOWN_IDS.has(id)) {
        return Promise.resolve(registerBlockDefinition({ id, family: inferBlockFamily(id) }));
    }

    const promise = new Promise(resolve => {
        const script = document.createElement('script');
        script.src = 'src/js/blocks/definitions/' + blockDefinitionFilename(id);
        script.dataset.blockDefinition = id;
        script.onload = () => resolve(getBlockDefinition(id));
        script.onerror = () => resolve(registerBlockDefinition({ id, family: inferBlockFamily(id) }));
        document.head.appendChild(script);
    });
    window.MC_BLOCK_DEFINITION_LOADS.set(id, promise);
    return promise;
}

async function ensureBlockDefinitions(blockNames) {
    const ids = [...new Set((blockNames || []).map(normalizeBlockDefinitionId).filter(Boolean))];
    await Promise.all(ids.map(loadBlockDefinition));
}
