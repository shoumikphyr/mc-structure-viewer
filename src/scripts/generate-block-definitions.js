// Generates one editable definition file for every block id in the localized Java catalog.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const catalogPath = path.join(root, 'src/data/block-names.js');
const outputDir = path.join(root, 'src/js/blocks/definitions');
const source = fs.readFileSync(catalogPath, 'utf8');
const payload = source.slice(source.indexOf('=') + 1).trim().replace(/;\s*$/, '');
const catalog = JSON.parse(payload);

function familyFor(id) {
    if (['small_amethyst_bud', 'medium_amethyst_bud', 'large_amethyst_bud', 'amethyst_cluster'].includes(id)) return 'amethyst';
    if (id === 'enchanting_table') return 'enchanting-table';
    if (id === 'campfire' || id === 'soul_campfire') return 'campfire';
    if (['anvil', 'chipped_anvil', 'damaged_anvil'].includes(id)) return 'anvil';
    if (id === 'grindstone') return 'grindstone';
    if (id.includes('cauldron')) return 'cauldron';
    if (id.endsWith('_fence_gate')) return 'fence-gate';
    if (id === 'glass_pane' || id.endsWith('_glass_pane')) return 'glass-pane';
    if (id.endsWith('_trapdoor')) return 'trapdoor';
    if (id.endsWith('_stairs')) return 'stairs';
    if (id.endsWith('_slab')) return 'slab';
    if (id === 'ladder' || id.endsWith('_ladder')) return 'ladder';
    if (['chest', 'trapped_chest', 'ender_chest'].includes(id)) return 'chest';
    if (id === 'candle' || id.endsWith('_candle')) return 'candles';
    if (id.startsWith('potted_') || id === 'flower_pot') return 'potted';
    if (/(short_grass|tall_grass|fern|dead_bush|dandelion|poppy|orchid|allium|azure_bluet|tulip|daisy|cornflower|lily_of_the_valley|wither_rose|sunflower|lilac|rose_bush|peony|torchflower|eyeblossom|pitcher_plant|wheat|beetroots?|carrots?|potatoes|nether_wart|sweet_berry_bush)/.test(id)) return 'cross-plant';
    if (id === 'lantern' || id.endsWith('_lantern')) return 'lantern';
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
function fileName(id) { return id.replace(/[^a-z0-9_.-]/g, '_') + '.js'; }
fs.mkdirSync(outputDir, { recursive: true });
const entries = Object.keys(catalog.en || {}).sort();
const seen = new Set();
let created = 0;
for (const id of entries) {
    const name = fileName(id);
    if (seen.has(name)) throw new Error('Duplicate sanitized definition filename: ' + name);
    seen.add(name);
    const contents = '// Per-block settings. Override family or face textures here when needed.\n' +
        'registerBlockDefinition({ id: ' + JSON.stringify(id) + ', family: ' + JSON.stringify(familyFor(id)) + ' });\n';
    const definitionPath = path.join(outputDir, name);
    if (!fs.existsSync(definitionPath)) {
        fs.writeFileSync(definitionPath, contents, 'utf8');
        created++;
    }
}
const manifest = '// Known block ids; per-block settings load on demand.\n' +
    'window.MC_BLOCK_KNOWN_IDS = new Set(' + JSON.stringify(entries) + ');\n';
fs.writeFileSync(path.join(root, 'src/js/blocks/manifest.js'), manifest, 'utf8');
console.log('Catalog: ' + entries.length + ' ids; created ' + created + ' new definitions; preserved existing custom files.');
