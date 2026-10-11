/* ==========================================================================
   MC STRUCTURE VIEWER - CÓDIGO COMPLETO OPTIMIZADO Y BLINDADO (JAVA QUADRAL)
   ========================================================================== */

// --- 1. REFERENCIAS AL DOM ---
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const resourcePackInput = document.getElementById('resourcePackInput');
const resourcePackButton = document.getElementById('resourcePackButton');
const resourcePackStatus = document.getElementById('resourcePackStatus');
const clearResourcePackButton = document.getElementById('clearResourcePackButton');
const shaderToggleButton = document.getElementById('shaderToggleButton');
const shaderStatus = document.getElementById('shaderStatus');

function syncShaderToggleButton() {
    if (!shaderToggleButton || !window.MCViewerShaderPipeline) return;
    const enabled = window.MCViewerShaderPipeline.isEnabled();
    shaderToggleButton.setAttribute('aria-pressed', String(enabled));
    shaderToggleButton.textContent = enabled ? 'Desactivar shader visual' : 'Aplicar shader visual';
    if (shaderStatus) {
        shaderStatus.textContent = enabled
            ? (renderer ? 'Shader visual activo · color y contraste mejorados' : 'Shader listo · carga una estructura para aplicarlo')
            : 'Shader visual desactivado';
    }
}

if (shaderToggleButton) {
    shaderToggleButton.addEventListener('click', () => {
        if (!window.MCViewerShaderPipeline) {
            if (shaderStatus) shaderStatus.textContent = 'No se pudo iniciar el módulo de shaders.';
            return;
        }
        window.MCViewerShaderPipeline.toggle();
        syncShaderToggleButton();
    });
}

if (window.location.protocol === 'file:' && resourcePackStatus) {
    resourcePackStatus.textContent = 'Para evitar texturas negras, inicia node server.js';
}
const layerSlider = document.getElementById('layerSlider');
const layerVal = document.getElementById('layerVal');
const toggleGrid = document.getElementById('toggleGrid');
const fileNameEl = document.getElementById('fileName');
const fileDimensionsEl = document.getElementById('fileDimensions');
const fileBlocksEl = document.getElementById('fileBlocks');

const fileVersionEl = document.getElementById('fileVersion');
let showFpsToggle = null;
let soloLeftToggle = null;
let soloRightToggle = null;
const fpsDisplay = document.getElementById('fpsDisplay');
const SETTINGS_STORAGE_KEYS = {
    showFps: 'mc_viewer_settings_show_fps',
    soloLeft: 'mc_viewer_settings_solo_left',
    soloRight: 'mc_viewer_settings_solo_right',
    grid: 'mc_viewer_settings_grid'
};
const REMEMBER_WORK_STORAGE_KEY = 'mc_viewer_remember_work';

function remembersViewerWork() {
    try { return localStorage.getItem(REMEMBER_WORK_STORAGE_KEY) !== 'false'; }
    catch (error) { return true; }
}

function loadBooleanSetting(key, defaultValue = false) {
    if (!remembersViewerWork()) return defaultValue;
    try {
        const value = localStorage.getItem(key);
        return value === null ? defaultValue : value === 'true';
    } catch (error) {
        return defaultValue;
    }
}

function saveBooleanSetting(key, value) {
    try {
        if (remembersViewerWork()) localStorage.setItem(key, String(Boolean(value)));
        else localStorage.removeItem(key);
    } catch (error) {
        // El visor sigue funcionando aunque el navegador bloquee el almacenamiento local.
    }
}

function setupSharedViewerSettings() {
    showFpsToggle = document.getElementById('showFpsToggle');
    soloLeftToggle = document.getElementById('soloLeftToggle');
    soloRightToggle = document.getElementById('soloRightToggle');
    if (showFpsToggle && !showFpsToggle.dataset.viewerBound) {
        showFpsToggle.checked = loadBooleanSetting(SETTINGS_STORAGE_KEYS.showFps);
        showFpsToggle.addEventListener('change', () => {
            if (fpsDisplay) fpsDisplay.hidden = !showFpsToggle.checked;
            saveBooleanSetting(SETTINGS_STORAGE_KEYS.showFps, showFpsToggle.checked);
        });
        showFpsToggle.dataset.viewerBound = 'true';
    }
    if (soloLeftToggle && !soloLeftToggle.dataset.viewerBound) {
        soloLeftToggle.checked = loadBooleanSetting(SETTINGS_STORAGE_KEYS.soloLeft);
        soloLeftToggle.addEventListener('change', () => {
            saveBooleanSetting(SETTINGS_STORAGE_KEYS.soloLeft, soloLeftToggle.checked);
            renderWithDoubleBlockFilters();
        });
        soloLeftToggle.dataset.viewerBound = 'true';
    }
    if (soloRightToggle && !soloRightToggle.dataset.viewerBound) {
        soloRightToggle.checked = loadBooleanSetting(SETTINGS_STORAGE_KEYS.soloRight);
        soloRightToggle.addEventListener('change', () => {
            saveBooleanSetting(SETTINGS_STORAGE_KEYS.soloRight, soloRightToggle.checked);
            renderWithDoubleBlockFilters();
        });
        soloRightToggle.dataset.viewerBound = 'true';
    }
    if (fpsDisplay) fpsDisplay.hidden = !showFpsToggle?.checked;
}

setupSharedViewerSettings();
window.MCViewerSettingsReady?.then(setupSharedViewerSettings);
document.addEventListener('mc-viewer-settings-ready', setupSharedViewerSettings);
if (toggleGrid) toggleGrid.checked = loadBooleanSetting(SETTINGS_STORAGE_KEYS.grid, true);

// Elimina el dato antiguo de bloques que antes se usaba para transferirlo a la página de materiales.
try {
    localStorage.removeItem('mc_structure_materials');
} catch (error) {
    // El traspaso temporal a la página de materiales ya no depende de localStorage.
}

const renderWithDoubleBlockFilters = () => {
    if (loadedBlocksData.length) renderBlocksInstanced();
};

let fpsFrameCount = 0;
let fpsLastUpdate = performance.now();

// Tabla de mapeo de DataVersion de Minecraft
const DATA_VERSION_MAP = {
    169: '1.9', 175: '1.9.1', 176: '1.9.2', 183: '1.9.3', 184: '1.9.4',
    510: '1.10', 511: '1.10.1', 512: '1.10.2', 819: '1.11', 921: '1.11.1', 922: '1.11.2',
    1139: '1.12', 1241: '1.12.1', 1343: '1.12.2', 1519: '1.13', 1628: '1.13.1', 1631: '1.13.2',
    1952: '1.14', 1957: '1.14.1', 1963: '1.14.2', 1968: '1.14.3', 1976: '1.14.4',
    2225: '1.15', 2227: '1.15.1', 2230: '1.15.2', 2566: '1.16', 2567: '1.16.1', 2578: '1.16.2', 2580: '1.16.3', 2584: '1.16.4', 2586: '1.16.5',
    2724: '1.17', 2730: '1.17.1', 2860: '1.18', 2865: '1.18.1', 2975: '1.18.2',
    3105: '1.19', 3117: '1.19.1', 3120: '1.19.2', 3218: '1.19.3', 3337: '1.19.4',
    3463: '1.20', 3465: '1.20.1', 3578: '1.20.2', 3698: '1.20.3', 3700: '1.20.4', 3837: '1.20.5', 3839: '1.20.6',
    3953: '1.21', 3955: '1.21.1', 4080: '1.21.2', 4082: '1.21.3', 4189: '1.21.4', 4325: '1.21.5', 4435: '1.21.6', 4438: '1.21.7', 4440: '1.21.8', 4554: '1.21.9', 4556: '1.21.10', 4671: '1.21.11',
    4786: '26.1', 4788: '26.1.1', 4790: '26.1.2', 4903: '26.2', 5023: '26.3'
};

function getMinecraftVersionFromDataVersion(dataVersion) {
    if (!dataVersion) return 'Desconocida';
    return DATA_VERSION_MAP[dataVersion] ? `MC ${DATA_VERSION_MAP[dataVersion]}` : `v${dataVersion}`;
}

const paletteListEl = document.getElementById('paletteList');
const canvasContainer = document.getElementById('canvas-container');
const exportPdfBtn = document.getElementById('exportPdfBtn');

// --- DICCIONARIO Y TRADUCTOR A ESPAÑOL DE MINECRAFT ---
const SPANISH_BLOCK_NAMES = {
    'air': 'Aire',
    'stone': 'Piedra',
    'granite': 'Granito',
    'polished_granite': 'Granito pulido',
    'diorite': 'Diorita',
    'polished_diorite': 'Diorita pulida',
    'andesite': 'Andesita',
    'polished_andesite': 'Andesita pulida',
    'grass_block': 'Bloque de hierba',
    'dirt': 'Tierra',
    'coarse_dirt': 'Tierra infértil',
    'podzol': 'Podsol',
    'dirt_path': 'Camino de tierra',
    'grass_path': 'Camino de hierba',
    'cobblestone': 'Adoquín',
    'mossy_cobblestone': 'Adoquín musgoso',
    'bedrock': 'Piedra base',
    'sand': 'Arena',
    'red_sand': 'Arena roja',
    'gravel': 'Grava',
    'oak_log': 'Tronco de roble',
    'spruce_log': 'Tronco de abeto',
    'birch_log': 'Tronco de abedul',
    'jungle_log': 'Tronco de jungla',
    'acacia_log': 'Tronco de acacia',
    'dark_oak_log': 'Tronco de roble oscuro',
    'mangrove_log': 'Tronco de mangle',
    'cherry_log': 'Tronco de cerezo',
    'oak_planks': 'Madera de roble',
    'spruce_planks': 'Madera de abeto',
    'birch_planks': 'Madera de abedul',
    'jungle_planks': 'Madera de jungla',
    'acacia_planks': 'Madera de acacia',
    'dark_oak_planks': 'Madera de roble oscuro',
    'mangrove_planks': 'Madera de mangle',
    'cherry_planks': 'Madera de cerezo',
    'bamboo_planks': 'Madera de bambú',
    'crimson_planks': 'Madera carmesí',
    'warped_planks': 'Madera distorsionada',
    'glass': 'Cristal',
    'glass_pane': 'Panel de cristal',
    'bookshelf': 'Librería',
    'chiseled_bookshelf': 'Librería cincelada',
    'crafting_table': 'Mesa de trabajo',
    'furnace': 'Horno',
    'chest': 'Cofre',
    'barrel': 'Barril',
    'lantern': 'Farol',
    'soul_lantern': 'Farol de almas',
    'torch': 'Antorcha',
    'soul_torch': 'Antorcha de almas',
    'cauldron': 'Caldero',
    'flower_pot': 'Maceta',
    'ladder': 'Escalera de mano',
    'scaffolding': 'Andamio',
    'chain': 'Cadena',
    'iron_bars': 'Barrotes de hierro'
};

const WOOD_TYPES_ES = {
    'oak': 'de roble',
    'spruce': 'de abeto',
    'birch': 'de abedul',
    'jungle': 'de jungla',
    'acacia': 'de acacia',
    'dark_oak': 'de roble oscuro',
    'mangrove': 'de mangle',
    'cherry': 'de cerezo',
    'bamboo': 'de bambú',
    'crimson': 'carmesí',
    'warped': 'distorsionada',
    'iron': 'de hierro'
};

const MATERIAL_TYPES_ES = {
    'stone': 'de piedra',
    'cobblestone': 'de adoquín',
    'mossy_cobblestone': 'de adoquín musgoso',
    'stone_brick': 'de ladrillos de piedra',
    'stone_bricks': 'de ladrillos de piedra',
    'mossy_stone_brick': 'de ladrillos de piedra musgosa',
    'granite': 'de granito',
    'diorite': 'de diorita',
    'andesite': 'de andesita',
    'brick': 'de ladrillo',
    'nether_brick': 'de ladrillos del Nether',
    'quartz': 'de cuarzo',
    'sandstone': 'de arenisca',
    'red_sandstone': 'de arenisca roja'
};

function getSpanishBlockName(rawBlockName) {
    let clean = rawBlockName.replace('minecraft:', '').toLowerCase().trim();
    if (clean.includes('[')) clean = clean.split('[')[0];

    if (SPANISH_BLOCK_NAMES[clean]) {
        return SPANISH_BLOCK_NAMES[clean];
    }

    if (clean.includes('_stairs')) {
        const mat = clean.replace('_stairs', '');
        if (WOOD_TYPES_ES[mat]) return `Escaleras ${WOOD_TYPES_ES[mat]}`;
        if (MATERIAL_TYPES_ES[mat]) return `Escaleras ${MATERIAL_TYPES_ES[mat]}`;
        return `Escaleras de ${mat.replace(/_/g, ' ')}`;
    }

    if (clean.includes('_slab')) {
        const mat = clean.replace('_slab', '');
        if (WOOD_TYPES_ES[mat]) return `Losa ${WOOD_TYPES_ES[mat]}`;
        if (MATERIAL_TYPES_ES[mat]) return `Losa ${MATERIAL_TYPES_ES[mat]}`;
        return `Losa de ${mat.replace(/_/g, ' ')}`;
    }

    if (clean.includes('_trapdoor')) {
        const mat = clean.replace('_trapdoor', '');
        if (WOOD_TYPES_ES[mat]) return `Trampilla ${WOOD_TYPES_ES[mat]}`;
        return `Trampilla de ${mat.replace(/_/g, ' ')}`;
    }

    if (clean.includes('_door')) {
        const mat = clean.replace('_door', '');
        if (WOOD_TYPES_ES[mat]) return `Puerta ${WOOD_TYPES_ES[mat]}`;
        return `Puerta de ${mat.replace(/_/g, ' ')}`;
    }

    if (clean.includes('_fence_gate')) {
        const mat = clean.replace('_fence_gate', '');
        if (WOOD_TYPES_ES[mat]) return `Cancela ${WOOD_TYPES_ES[mat]}`;
        return `Puerta de valla de ${mat.replace(/_/g, ' ')}`;
    }
    if (clean.includes('_fence')) {
        const mat = clean.replace('_fence', '');
        if (WOOD_TYPES_ES[mat]) return `Valla ${WOOD_TYPES_ES[mat]}`;
        return `Valla de ${mat.replace(/_/g, ' ')}`;
    }

    return clean
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

// --- LÓGICA DEL BOTÓN DESPLEGABLE HAMBURGUESA ---
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');

if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', () => {
        const sidebarEl = document.querySelector('aside') || document.querySelector('.sidebar');

        if (sidebarEl) {
            sidebarEl.classList.toggle('sidebar-collapsed');

            // Estos son los cambios que hice, att. ChatGPT: sincroniza el estado del menú para ampliar la portada cuando se oculta.
            const appContainer = document.querySelector('.app-container');
            if (appContainer) {
                appContainer.classList.toggle('sidebar-hidden', sidebarEl.classList.contains('sidebar-collapsed'));
            }

            let checks = 0;
            const resizeInterval = setInterval(() => {
                if (typeof onWindowResize === 'function') {
                    onWindowResize();
                }
                checks++;
                if (checks > 15) clearInterval(resizeInterval);
            }, 20);
        }
    });
}

function toggleAccordion(sectionId) {
    const contentEl = document.getElementById(sectionId);
    if (contentEl) {
        const sectionEl = contentEl.closest('.accordion-section');
        if (sectionEl) {
            sectionEl.classList.toggle('collapsed');
        }
    }
}

const resizer = document.getElementById('resizer');
const sidebar = dropZone ? dropZone.closest('aside') || dropZone.parentElement : null;

// --- CONTROL DE TAMAÑO DE BARRA LATERAL (RESIZER) ---
if (resizer && sidebar) {
    let isResizing = false;

    resizer.addEventListener('mousedown', () => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        resizer.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newWidth = Math.max(250, Math.min(600, e.clientX));
        sidebar.style.width = `${newWidth}px`;
        sidebar.style.flex = `0 0 ${newWidth}px`;

        if (typeof onWindowResize === 'function') {
            onWindowResize();
        }
    });

    window.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            resizer.classList.remove('is-dragging');
        }
    });
}

// --- 2. CONFIGURACIÓN DE TEXTURAS JAVA (RESOURCE PACK QUADRAL) ---
// Estos son los cambios que hice, att. ChatGPT: el visor usa como base los PNG vanilla oficiales de Minecraft Java 1.21.7.
const JAVA_ASSETS_BASE = './assets/minecraft-java-assets-26.3/assets/minecraft/';
const TEXTURE_BASE_URL = `${JAVA_ASSETS_BASE}textures/block/`;

const textureCache = {};
const materialCache = {};
let localResourcePackTextures = new Map();
let localResourcePackObjectUrls = [];

function getResourcePackTextureKey(texturePath) {
    const normalized = String(texturePath).replace(/\\/g, '/').toLowerCase();
    const marker = 'assets/minecraft/';
    const markerIndex = normalized.lastIndexOf(marker);
    if (markerIndex < 0) return '';
    return normalized.slice(markerIndex);
}

function findLocalResourcePackTexture(texturePath) {
    const key = getResourcePackTextureKey(texturePath);
    if (!key) return null;
    const direct = localResourcePackTextures.get(key);
    if (direct) return direct;

    // Acepta packs antiguos que guardaban los PNG de bloques en textures/blocks/.
    const legacyKey = key.replace('/textures/block/', '/textures/blocks/');
    return localResourcePackTextures.get(legacyKey) || null;
}

function clearTextureCaches() {
    Object.values(textureCache).forEach(texture => texture.dispose());
    Object.values(materialCache).forEach(material => material.dispose());
    // Estos son los cambios que hice, att. ChatGPT: vacía también el atlas de cofres cuando cambia el ZIP local.
    if (typeof chestFaceTextureCache !== 'undefined') {
        Object.values(chestFaceTextureCache).forEach(texture => texture.dispose());
        Object.keys(chestFaceTextureCache).forEach(key => delete chestFaceTextureCache[key]);
    }
    Object.keys(textureCache).forEach(key => delete textureCache[key]);
    Object.keys(materialCache).forEach(key => delete materialCache[key]);
}

async function loadLocalResourcePack(file) {
    if (!window.JSZip) throw new Error('No se pudo cargar el lector ZIP. Revisa tu conexión y vuelve a intentarlo.');
    if (file.size > 200 * 1024 * 1024) throw new Error('El ZIP supera el límite de 200 MB.');

    const zip = await JSZip.loadAsync(file, { checkCRC32: false });
    const nextTextures = new Map();
    const nextObjectUrls = [];
    let totalUncompressedSize = 0;
    const pngEntries = Object.values(zip.files).filter(entry => {
        const entryPath = entry.name.replace(/\\/g, '/').toLowerCase();
        return !entry.dir && entryPath.includes('assets/minecraft/textures/') && entryPath.endsWith('.png');
    });

    if (!pngEntries.length) {
        throw new Error('No encontré PNG dentro de assets/minecraft/textures/.');
    }

    try {
        for (const entry of pngEntries) {
            const imageBytes = await entry.async('uint8array');
            totalUncompressedSize += imageBytes.byteLength;
            if (totalUncompressedSize > 512 * 1024 * 1024) {
                throw new Error('Las texturas descomprimidas superan el límite de 512 MB.');
            }
            const blob = new Blob([imageBytes], { type: 'image/png' });
            const objectUrl = URL.createObjectURL(blob);
            nextObjectUrls.push(objectUrl);
            const textureKey = getResourcePackTextureKey(entry.name);
            if (textureKey) nextTextures.set(textureKey, objectUrl);
        }
    } catch (error) {
        nextObjectUrls.forEach(URL.revokeObjectURL);
        throw error;
    }

    localResourcePackObjectUrls.forEach(URL.revokeObjectURL);
    localResourcePackObjectUrls = nextObjectUrls;
    localResourcePackTextures = nextTextures;
    clearTextureCaches();

    if (resourcePackStatus) resourcePackStatus.textContent = `${file.name} · ${nextTextures.size} texturas`;
    if (clearResourcePackButton) clearResourcePackButton.hidden = false;
    if (loadedBlocksData.length) renderBlocksInstanced();
}

function removeLocalResourcePack() {
    localResourcePackObjectUrls.forEach(URL.revokeObjectURL);
    localResourcePackObjectUrls = [];
    localResourcePackTextures = new Map();
    clearTextureCaches();
    if (resourcePackStatus) resourcePackStatus.textContent = 'Texturas predeterminadas';
    if (clearResourcePackButton) clearResourcePackButton.hidden = true;
    if (loadedBlocksData.length) renderBlocksInstanced();
}

const canvasFallback = document.createElement('canvas');
canvasFallback.width = 16;
canvasFallback.height = 16;
const ctx = canvasFallback.getContext('2d');

ctx.fillStyle = '#ff00ff';
ctx.fillRect(0, 0, 16, 16);
ctx.fillStyle = '#000000';
ctx.fillRect(0, 0, 8, 8);
ctx.fillRect(8, 8, 8, 8);

const DEFAULT_TEXTURE = new THREE.CanvasTexture(canvasFallback);
DEFAULT_TEXTURE.encoding = THREE.sRGBEncoding;
DEFAULT_TEXTURE.magFilter = THREE.NearestFilter;
DEFAULT_TEXTURE.minFilter = THREE.NearestFilter;

function getCachedMaterial(tex, isLeaves, isGlass, isDoubleSided, isCutout = false) {
    const matKey = `${tex.uuid}_${isLeaves}_${isGlass}_${isDoubleSided}_${isCutout}`;
    if (materialCache[matKey]) return materialCache[matKey];

    const mat = new THREE.MeshLambertMaterial({
        map: tex,
        transparent: isLeaves || isGlass || isCutout,
        opacity: isGlass ? 0.7 : 1.0,
        alphaTest: (isLeaves || isCutout) ? 0.4 : 0.1,
        side: isDoubleSided ? THREE.DoubleSide : THREE.FrontSide
    });

    if (isLeaves) {
        mat.color.setHex(0x48b518);
    }

    materialCache[matKey] = mat;
    return mat;
}

// --- MAPEO DE TEXTURAS EXCLUSIVO PARA MINECRAFT JAVA EDITION ---
function resolveJavaTexturePath(blockName, face = "side") {
    let cleanId = blockName.replace('minecraft:', '').toLowerCase().trim();
    if (cleanId.includes('[')) cleanId = cleanId.split('[')[0];
    cleanId = cleanId.replace(/ /g, '_');

    const isTopOrDown = (face === 'up' || face === 'top' || face === 'down' || face === 'bottom');

    if (cleanId === 'glass_pane') {
        // Estos son los cambios que hice, att. ChatGPT: los paneles usan la textura fina del borde superior y la textura de cristal en los lados.
        return `${TEXTURE_BASE_URL}${isTopOrDown ? 'glass_pane_top' : 'glass'}.png`;
    }

    const stainedPane = cleanId.match(/^([a-z]+)_stained_glass_pane$/);
    if (stainedPane) {
        const color = stainedPane[1];
        return `${TEXTURE_BASE_URL}${isTopOrDown ? `${color}_stained_glass_pane_top` : `${color}_stained_glass`}.png`;
    }

    // 1. ENTIDADES Y COFRES
    if (cleanId === 'chest' || cleanId === 'trapped_chest') {
        return `${JAVA_ASSETS_BASE}textures/entity/chest/normal.png`;
    }
    if (cleanId === 'ender_chest') {
        return `${JAVA_ASSETS_BASE}textures/entity/chest/ender.png`;
    }
    if (cleanId.includes('head') || cleanId.includes('skull')) {
        return `${TEXTURE_BASE_URL}stone.png`;
    }
    if (cleanId === 'decorated_pot') {
        return `${TEXTURE_BASE_URL}terracotta.png`;
    }

    // 2. CADENA (Mapeo a barrotes de hierro)
    if (cleanId === 'chain') {
        return `${TEXTURE_BASE_URL}iron_bars.png`;
    }

    // Estos son los cambios que hice, att. ChatGPT: cada planta en maceta apunta al PNG de planta definido por Java.
    if (cleanId.startsWith('potted_')) {
        const pottedId = cleanId;
        const pottedTextureMap = {
            potted_cactus: 'cactus_side',
            potted_bamboo: 'bamboo_stalk',
            potted_mangrove_propagule: 'mangrove_propagule',
            potted_crimson_roots: 'crimson_roots_pot',
            potted_warped_roots: 'warped_roots_pot',
            potted_azalea_bush: 'potted_azalea_bush_plant',
            potted_flowering_azalea_bush: 'potted_flowering_azalea_bush_plant'
        };
        cleanId = pottedTextureMap[pottedId] || pottedId.replace(/^potted_/, '');
    }

    // 4. MESAS FUNCIONALES Y SUFIJOS DE CARA
    if (cleanId === 'cartography_table') {
        if (isTopOrDown) return `${TEXTURE_BASE_URL}cartography_table_top.png`;
        return `${TEXTURE_BASE_URL}cartography_table_side1.png`;
    }

    if (cleanId === 'fletching_table') {
        if (isTopOrDown) return `${TEXTURE_BASE_URL}fletching_table_top.png`;
        if (face === 'front') return `${TEXTURE_BASE_URL}fletching_table_front.png`;
        return `${TEXTURE_BASE_URL}fletching_table_side1.png`;
    }

    if (cleanId === 'smithing_table') {
        if (isTopOrDown) return `${TEXTURE_BASE_URL}smithing_table_top.png`;
        if (face === 'front') return `${TEXTURE_BASE_URL}smithing_table_front.png`;
        return `${TEXTURE_BASE_URL}smithing_table_side.png`;
    }

    if (cleanId === 'crafting_table') {
        if (isTopOrDown) return `${TEXTURE_BASE_URL}crafting_table_top.png`;
        if (face === 'front') return `${TEXTURE_BASE_URL}crafting_table_front.png`;
        return `${TEXTURE_BASE_URL}crafting_table_side.png`;
    }

    if (cleanId === 'furnace' || cleanId === 'blast_furnace' || cleanId === 'smoker') {
        if (isTopOrDown) return `${TEXTURE_BASE_URL}${cleanId}_top.png`;
        if (face === 'front') return `${TEXTURE_BASE_URL}${cleanId}_front.png`;
        return `${TEXTURE_BASE_URL}${cleanId}_side.png`;
    }

    if (cleanId === 'loom' || cleanId === 'jukebox') {
        if (isTopOrDown) return `${TEXTURE_BASE_URL}${cleanId}_top.png`;
        return `${TEXTURE_BASE_URL}${cleanId}_side.png`;
    }

    if (cleanId === 'cactus') {
        if (isTopOrDown) return `${TEXTURE_BASE_URL}cactus_${face === 'down' || face === 'bottom' ? 'bottom' : 'top'}.png`;
        return `${TEXTURE_BASE_URL}cactus_side.png`;
    }

    if (cleanId === 'azalea' || cleanId === 'flowering_azalea') {
        if (isTopOrDown) return `${TEXTURE_BASE_URL}${cleanId}_top.png`;
        return `${TEXTURE_BASE_URL}${cleanId}_side.png`;
    }

    if (cleanId === 'campfire' || cleanId === 'soul_campfire') {
        return `${TEXTURE_BASE_URL}campfire_log.png`;
    }

    if (cleanId === 'enchanting_table' || cleanId === 'stonecutter') {
        if (cleanId === 'enchanting_table' && (face === 'down' || face === 'bottom')) {
            return `${TEXTURE_BASE_URL}enchanting_table_bottom.png`;
        }
        if (isTopOrDown) return `${TEXTURE_BASE_URL}${cleanId}_top.png`;
        return `${TEXTURE_BASE_URL}${cleanId}_side.png`;
    }

    if (cleanId === 'anvil' || cleanId === 'chipped_anvil' || cleanId === 'damaged_anvil') {
        if (isTopOrDown && face !== 'down' && face !== 'bottom') return `${TEXTURE_BASE_URL}${cleanId}_top.png`;
        return `${TEXTURE_BASE_URL}anvil.png`;
    }

    if (cleanId === 'lectern') {
        if (isTopOrDown) return `${TEXTURE_BASE_URL}lectern_top.png`;
        if (face === 'front') return `${TEXTURE_BASE_URL}lectern_front.png`;
        return `${TEXTURE_BASE_URL}lectern_sides.png`;
    }

    if (cleanId === 'grindstone') {
        return `${TEXTURE_BASE_URL}${isTopOrDown ? 'grindstone_round' : 'grindstone_side'}.png`;
    }

    if (cleanId === 'hay_block') {
        if (isTopOrDown) return `${TEXTURE_BASE_URL}hay_block_top.png`;
        return `${TEXTURE_BASE_URL}hay_block_side.png`;
    }

    if (cleanId === 'scaffolding') {
        if (isTopOrDown) return `${TEXTURE_BASE_URL}scaffolding_top.png`;
        return `${TEXTURE_BASE_URL}scaffolding_side.png`;
    }

    if (cleanId.includes('cauldron')) {
        if (face === 'inside') return `${TEXTURE_BASE_URL}cauldron_inner.png`;
        if (face === 'bottom') return `${TEXTURE_BASE_URL}cauldron_bottom.png`;
        if (face === 'up' || face === 'top' || face === 'rim') return `${TEXTURE_BASE_URL}cauldron_top.png`;
        return `${TEXTURE_BASE_URL}cauldron_side.png`;
    }

    if (cleanId === 'barrel') {
        if (isTopOrDown) return `${TEXTURE_BASE_URL}barrel_${face === 'down' || face === 'bottom' ? 'bottom' : 'top'}.png`;
        return `${TEXTURE_BASE_URL}barrel_side.png`;
    }

    if (cleanId === 'chiseled_bookshelf') {
        if (isTopOrDown) return `${TEXTURE_BASE_URL}chiseled_bookshelf_top.png`;
        if (face === 'front') return `${TEXTURE_BASE_URL}chiseled_bookshelf_occupied.png`;
        return `${TEXTURE_BASE_URL}chiseled_bookshelf_side.png`;
    }

    // Estos son los cambios que hice, att. ChatGPT: las plantas de dos bloques usan textura distinta para cada mitad.
    const doublePlantIds = new Set(['sunflower', 'lilac', 'rose_bush', 'peony', 'tall_grass', 'large_fern']);
    if (doublePlantIds.has(cleanId) && (face === 'upper' || face === 'lower')) {
        return `${TEXTURE_BASE_URL}${cleanId}_${face === 'upper' ? 'top' : 'bottom'}.png`;
    }

    // 5. ALFOMBRAS, PLACAS, BOTONES Y CAMAS
    if (cleanId.endsWith('_carpet')) {
        const color = cleanId.replace('_carpet', '');
        return `${TEXTURE_BASE_URL}${color}_wool.png`;
    }

    if (cleanId.endsWith('_pressure_plate') || cleanId.endsWith('_button')) {
        let mat = cleanId.replace('_pressure_plate', '').replace('_button', '');
        if (WOOD_TYPES_ES[mat]) mat = `${mat}_planks`;
        return `${TEXTURE_BASE_URL}${mat}.png`;
    }

    if (cleanId.endsWith('_bed')) {
        const color = cleanId.replace('_bed', '');
        return `${TEXTURE_BASE_URL}${color && color !== 'bed' ? color : 'red'}_wool.png`;
    }

    // 6. CULTIVOS
    const CROPS_JAVA = {
        'carrots': 'carrots_stage3',
        'carrot': 'carrots_stage3',
        'potatoes': 'potatoes_stage3',
        'potato': 'potatoes_stage3',
        'wheat': 'wheat_stage7',
        'beetroots': 'beetroots_stage3',
        'beetroot': 'beetroots_stage3',
        'nether_wart': 'nether_wart_stage2',
        'sweet_berry_bush': 'sweet_berry_bush_stage3'
    };
    if (CROPS_JAVA[cleanId]) return `${TEXTURE_BASE_URL}${CROPS_JAVA[cleanId]}.png`;

    // 7. PUERTAS
    if (cleanId.includes('door') && !cleanId.includes('trapdoor') && !cleanId.includes('fence')) {
        let woodType = cleanId.replace('_door', '').replace('door_', '');
        if (!woodType || woodType === 'door') woodType = 'oak';
        const isUpper = (face === 'upper' || face === 'top');
        return `${TEXTURE_BASE_URL}${woodType}_door_${isUpper ? 'top' : 'bottom'}.png`;
    }

    // 8. BLOQUE DE HIERBA Y CAMINOS
    if (cleanId === 'grass_block') {
        if (isTopOrDown) return `${TEXTURE_BASE_URL}${face === 'down' || face === 'bottom' ? 'dirt' : 'grass_block_top'}.png`;
        return `${TEXTURE_BASE_URL}grass_block_side.png`;
    }

    if (cleanId === 'dirt_path' || cleanId === 'grass_path') {
        if (face === 'down' || face === 'bottom') return `${TEXTURE_BASE_URL}dirt.png`;
        if (isTopOrDown) return `${TEXTURE_BASE_URL}dirt_path_top.png`;
        return `${TEXTURE_BASE_URL}dirt_path_side.png`;
    }

    // 9. TRONCOS Y MADERAS
    if (cleanId.endsWith('_log') || cleanId.endsWith('_wood') || cleanId.startsWith('stripped_')) {
        let baseLog = cleanId.replace('_wood', '_log');
        if (isTopOrDown) return `${TEXTURE_BASE_URL}${baseLog}_top.png`;
        return `${TEXTURE_BASE_URL}${baseLog}.png`;
    }

    // 10. MAPEOS EXACTOS DE NOMBRES EN JAVA
    const EXACT_JAVA_MAP = {
        'mud_brick': 'mud_bricks',
        'mud_brick_wall': 'mud_bricks',
        'mud_brick_stairs': 'mud_bricks',
        'mud_brick_slab': 'mud_bricks',
        'dead_bush': 'dead_bush',
        'dead': 'dead_bush',
        'glass_pane': 'glass',
        'rose_bush': 'rose_bush_top',
        'peony': 'peony_top',
        'lilac': 'lilac_top',
        'sunflower': 'sunflower_top'
    };

    if (EXACT_JAVA_MAP[cleanId]) {
        return `${TEXTURE_BASE_URL}${EXACT_JAVA_MAP[cleanId]}.png`;
    }

    // 11. BLOQUES DERIVADOS (Escaleras, losas, muros, vallas)
    let baseMat = cleanId
        .replace('_stairs', '')
        .replace('_slab', '')
        .replace('_wall', '')
        .replace('_fence_gate', '')
        .replace('_fence', '');

    const WOOD_TYPES = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped'];
    if (WOOD_TYPES.includes(baseMat)) {
        baseMat = `${baseMat}_planks`;
    }

    const DIRECT_MAP = {
        'stone_brick': 'stone_bricks',
        'mossy_stone_brick': 'mossy_stone_bricks',
        'cracked_stone_brick': 'cracked_stone_bricks',
        'chiseled_stone_brick': 'chiseled_stone_bricks',
        'smooth_quartz': 'quartz_block_bottom',
        'smooth_quartz_slab': 'quartz_block_bottom',
        'smooth_quartz_stairs': 'quartz_block_bottom'
    };

    const finalName = DIRECT_MAP[cleanId] || DIRECT_MAP[baseMat] || baseMat;
    return `${TEXTURE_BASE_URL}${finalName}.png`;
}

// --- CARGA SECUENCIAL DE TEXTURAS ---
function resolveBlockDefinitionTexture(texturePath) {
    const value = String(texturePath || '').trim();
    if (!value) return '';
    if (/^(https?:|data:|blob:|\.\/|\/)/i.test(value)) return value;

    let relative = value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.png$/i, '');
    const textureMarker = 'assets/minecraft/textures/';
    const markerIndex = relative.lastIndexOf(textureMarker);
    if (markerIndex >= 0) relative = relative.slice(markerIndex + textureMarker.length);
    else if (relative.startsWith('textures/')) relative = relative.slice('textures/'.length);
    else if (!relative.includes('/')) relative = `block/${relative}`;
    return `${JAVA_ASSETS_BASE}textures/${relative}.png`;
}

function getBlockTexture(blockName, face = "side") {
    const definition = getBlockDefinition(blockName);
    const overridePath = definition.textures?.[face] || definition.textures?.default || '';
    const cacheKey = `${blockName}_${face}_${overridePath}`;

    if (!textureCache[cacheKey]) {
        const clean = blockName.replace('minecraft:', '').toLowerCase().trim();
        const primaryUrl = overridePath
            ? resolveBlockDefinitionTexture(overridePath)
            : resolveJavaTexturePath(blockName, face);

        let fallbacks = [primaryUrl];

        let baseMat = clean
            .replace('_stairs', '')
            .replace('_slab', '')
            .replace('_wall', '')
            .replace('_fence_gate', '')
            .replace('_fence', '');

        fallbacks.push(`${TEXTURE_BASE_URL}${clean}.png`);
        fallbacks.push(`${TEXTURE_BASE_URL}${baseMat}.png`);
        fallbacks.push(`${TEXTURE_BASE_URL}stone.png`);

        fallbacks = [...new Set(fallbacks.filter(Boolean))];

        const texture = new THREE.Texture(canvasFallback);
        texture.encoding = THREE.sRGBEncoding;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        textureCache[cacheKey] = texture;

        function tryLoadIndex(idx) {
            if (idx >= fallbacks.length) return;

            const img = new Image();
            img.onload = () => {
                texture.image = img;
                texture.needsUpdate = true;
            };
            img.onerror = () => {
                tryLoadIndex(idx + 1);
            };
            // Estos son los cambios que hice, att. ChatGPT: primero usa el PNG del ZIP local y conserva el paquete incluido como respaldo.
            img.src = findLocalResourcePackTexture(fallbacks[idx]) || fallbacks[idx];
        }

        tryLoadIndex(0);
    }

    return textureCache[cacheKey];
}

// --- 3. VARIABLES Y CONFIGURACIÓN DE THREE.JS ---
let scene, camera, renderer, controls, gridHelper, compassGroup;
let instancedMeshesGroup = new THREE.Group();
let loadedBlocksData = [];
let maxDimensions = { x: 0, y: 0, z: 0 };

function createCompassMarker(letter, direction, axis) {
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    const activeTheme = document.documentElement.dataset.theme;
    const colors = activeTheme === 'admin'
        ? { background: 'rgba(21, 16, 29, 0.96)', ring: '#c084fc', letter: '#f8fafc', label: '#f8fafc', axis: '#c0b3d0' }
        : activeTheme === 'dark'
            ? { background: 'rgba(18, 20, 18, 0.96)', ring: '#78d58b', letter: '#f1f3f0', label: '#f1f3f0', axis: '#b0b7b0' }
            : { background: 'rgba(255, 255, 255, 0.95)', ring: '#287b3c', letter: '#202720', label: '#202720', axis: '#566057' };
    ctx.fillStyle = colors.background;
    ctx.beginPath();
    ctx.roundRect(5, 5, 182, 86, 43);
    ctx.fill();

    ctx.fillStyle = colors.background;
    ctx.beginPath();
    ctx.arc(48, 48, 43, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colors.ring;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = colors.letter;
    ctx.font = 'bold 54px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 48, 51);

    ctx.textAlign = 'left';
    ctx.fillStyle = colors.label;
    ctx.font = 'bold 22px Arial';
    ctx.fillText(direction, 102, 39);
    ctx.fillStyle = colors.axis;
    ctx.font = 'bold 19px Arial';
    ctx.fillText(axis, 102, 67);

    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false
    }));
    marker.renderOrder = 1000;
    return marker;
}

function updateCompassMarkers(width, depth) {
    if (!scene || !compassGroup) return;

    while (compassGroup.children.length) {
        const marker = compassGroup.children[0];
        compassGroup.remove(marker);
        marker.material.map.dispose();
        marker.material.dispose();
    }

    const centerX = -0.5;
    const centerZ = -0.5;
    const margin = 2.5;
    const markerSize = Math.max(1.5, Math.min(3, Math.max(width, depth) * 0.025));
    const directions = [
        ['N', 'NORTE', 'Z−', centerX, -depth / 2 - margin],
        ['S', 'SUR', 'Z+', centerX, depth / 2 + margin],
        ['E', 'ESTE', 'X+', width / 2 + margin, centerZ],
        ['O', 'OESTE', 'X−', -width / 2 - margin, centerZ]
    ];

    directions.forEach(([letter, direction, axis, x, z]) => {
        const marker = createCompassMarker(letter, direction, axis);
        marker.position.set(x, -0.25, z);
        marker.scale.set(markerSize * 2, markerSize, 1);
        compassGroup.add(marker);
    });
}

function updateGridTheme() {
    if (!scene) return;

    if (gridHelper) {
        scene.remove(gridHelper);
        gridHelper.geometry.dispose();
        if (Array.isArray(gridHelper.material)) {
            gridHelper.material.forEach(material => material.dispose());
        } else {
            gridHelper.material.dispose();
        }
    }

    const activeTheme = document.documentElement.dataset.theme;
    const gridColors = activeTheme === 'admin'
        ? [0x9d6bd0, 0x49375d]
        : activeTheme === 'dark'
            ? [0x5b8763, 0x424842]
            : [0x7a9a7e, 0xcbd6cc];
    gridHelper = new THREE.GridHelper(100, 100, gridColors[0], gridColors[1]);    gridHelper.position.y = -0.5;
    gridHelper.visible = toggleGrid ? toggleGrid.checked : true;
    scene.add(gridHelper);
}

window.addEventListener('mc-viewer-theme-change', () => {
    if (scene) updateGridTheme();
    if (scene && compassGroup) updateCompassMarkers(maxDimensions.x, maxDimensions.z);
});

function updateStructureOrientation(width, depth) {
    instancedMeshesGroup.rotation.y = 0;
    instancedMeshesGroup.position.set(0, 0, 0);
}

function init3D() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(60, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.01, 5000);
    camera.position.set(40, 30, 40);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x000000, 0);

    const existingCanvas = canvasContainer.querySelector('canvas');
    if (existingCanvas) existingCanvas.remove();

    canvasContainer.appendChild(renderer.domElement);
    window.MCViewerShaderPipeline?.initialize(renderer, canvasContainer.clientWidth, canvasContainer.clientHeight);
    syncShaderToggleButton();

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    controls.screenSpacePanning = true;
    controls.panSpeed = 1.2;
    controls.rotateSpeed = 0.4;
    controls.zoomSpeed = 0.8;

    controls.minDistance = 0.01;
    controls.maxDistance = Infinity;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
    scene.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0xf5edff, 0x73627f, 0.75);
    scene.add(hemisphereLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    updateGridTheme();

    // Estos son los cambios que hice, att. ChatGPT: el plano cartesiano muestra N, S, E y O según los ejes del mundo.
    compassGroup = new THREE.Group();
    scene.add(compassGroup);

    scene.add(instancedMeshesGroup);

    window.addEventListener('resize', onWindowResize);
    animate();
}

function animate(timestamp = performance.now()) {
    requestAnimationFrame(animate);
    fpsFrameCount++;
    const fpsElapsed = timestamp - fpsLastUpdate;
    if (fpsElapsed >= 500) {
        if (showFpsToggle?.checked && fpsDisplay) {
            fpsDisplay.textContent = `${Math.round((fpsFrameCount * 1000) / fpsElapsed)} FPS`;
        }
        fpsFrameCount = 0;
        fpsLastUpdate = timestamp;
    }
    if (controls) controls.update();
    if (renderer && scene && camera) {
        window.MCViewerShaderPipeline?.render(renderer, scene, camera);
    }
}

function onWindowResize() {
    if (!camera || !renderer || !canvasContainer) return;
    camera.aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    window.MCViewerShaderPipeline?.resize(canvasContainer.clientWidth, canvasContainer.clientHeight, renderer.getPixelRatio());
}

// --- 4. GESTIÓN DE EVENTOS DE CARGA ---
const centerPlaceholder = document.getElementById('centerPlaceholder');

function bindUploadEvents(element) {
    if (!element) return;
    element.addEventListener('click', () => fileInput.click());
    element.addEventListener('dragover', (e) => { e.preventDefault(); element.classList.add('dragover'); });
    element.addEventListener('dragleave', () => element.classList.remove('dragover'));
    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
}

bindUploadEvents(dropZone);
bindUploadEvents(centerPlaceholder);

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });
}

if (resourcePackButton && resourcePackInput) {
    resourcePackButton.addEventListener('click', () => resourcePackInput.click());
    resourcePackInput.addEventListener('change', async event => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        resourcePackButton.disabled = true;
        if (resourcePackStatus) resourcePackStatus.textContent = 'Leyendo paquete de texturas…';
        try {
            await loadLocalResourcePack(file);
        } catch (error) {
            if (resourcePackStatus) resourcePackStatus.textContent = 'No se pudo cargar el ZIP';
            alert(`No pude cargar el paquete de texturas: ${error.message}`);
        } finally {
            resourcePackButton.disabled = false;
            resourcePackInput.value = '';
        }
    });
}

if (clearResourcePackButton) {
    clearResourcePackButton.addEventListener('click', removeLocalResourcePack);
}

if (canvasContainer) {
    canvasContainer.addEventListener('dragover', (e) => e.preventDefault());
    canvasContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
}

// --- 5. LECTURA Y DESCOMPRESIÓN SEGURA DE ARCHIVOS ---
function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'schem' && ext !== 'litematic') {
        alert('Por favor sube un archivo .schem o .litematic válido.');
        return;
    }

    if (fileNameEl) fileNameEl.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const rawArrayBuffer = event.target.result;
            const buffer = new Uint8Array(rawArrayBuffer);

            let decompressedBytes;
            if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
                decompressedBytes = pako.ungzip(buffer);
            } else {
                decompressedBytes = buffer;
            }

            const cleanArrayBuffer = decompressedBytes.buffer.slice(
                decompressedBytes.byteOffset,
                decompressedBytes.byteOffset + decompressedBytes.byteLength
            );

            if (!renderer) init3D();

            parseNbtBuffer(cleanArrayBuffer, ext);

        } catch (error) {
            console.error('Error detallado al abrir el archivo:', error);
            alert('Error al descomprimir/abrir el archivo. Revisa la consola (F12).');
        }
    };

    reader.readAsArrayBuffer(file);
}

// --- LECTOR NBT NATIVO ---
class NbtReader {
    constructor(arrayBuffer) {
        this.view = new DataView(arrayBuffer);
        this.offset = 0;
        this.decoder = new TextDecoder('utf-8');
    }

    readByte() {
        const val = this.view.getInt8(this.offset);
        this.offset += 1;
        return val;
    }

    readShort() {
        const val = this.view.getInt16(this.offset, false);
        this.offset += 2;
        return val;
    }

    readInt() {
        const val = this.view.getInt32(this.offset, false);
        this.offset += 4;
        return val;
    }

    readLong() {
        const val = this.view.getBigInt64(this.offset, false);
        this.offset += 8;
        return BigInt.asUintN(64, val);
    }

    readFloat() {
        const val = this.view.getFloat32(this.offset, false);
        this.offset += 4;
        return val;
    }

    readDouble() {
        const val = this.view.getFloat64(this.offset, false);
        this.offset += 8;
        return val;
    }

    readString() {
        const len = this.view.getUint16(this.offset, false);
        this.offset += 2;
        if (len === 0) return '';
        const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, len);
        this.offset += len;
        return this.decoder.decode(bytes);
    }

    readTagPayload(type) {
        switch (type) {
            case 1: return this.readByte();
            case 2: return this.readShort();
            case 3: return this.readInt();
            case 4: return this.readLong();
            case 5: return this.readFloat();
            case 6: return this.readDouble();
            case 7: {
                const len = this.readInt();
                const arr = new Int8Array(len);
                for (let i = 0; i < len; i++) arr[i] = this.readByte();
                return arr;
            }
            case 8: return this.readString();
            case 9: {
                const itemType = this.readByte();
                const len = this.readInt();
                const list = [];
                for (let i = 0; i < len; i++) list.push(this.readTagPayload(itemType));
                return list;
            }
            case 10: {
                const compound = {};
                while (true) {
                    const childType = this.readByte();
                    if (childType === 0) break;
                    const name = this.readString();
                    compound[name] = this.readTagPayload(childType);
                }
                return compound;
            }
            case 11: {
                const len = this.readInt();
                const arr = new Int32Array(len);
                for (let i = 0; i < len; i++) arr[i] = this.readInt();
                return arr;
            }
            case 12: {
                const len = this.readInt();
                const arr = [];
                for (let i = 0; i < len; i++) arr.push(this.readLong());
                return arr;
            }
            default:
                throw new Error(`Tipo de Tag NBT desconocido: ${type} en offset ${this.offset}`);
        }
    }

    parse() {
        const rootType = this.readByte();
        if (rootType !== 10) throw new Error(`Tag raíz inválido: se esperaba 10, se obtuvo ${rootType}`);
        const rootName = this.readString();
        return this.readTagPayload(10);
    }
}

// --- 6. PARSER NBT DIRECTO PARA .LITEMATIC Y .SCHEM ---
function parseNbtBuffer(arrayBuffer, ext) {
    try {
        const reader = new NbtReader(arrayBuffer);
        const parsedData = reader.parse();
        loadedBlocksData = [];

        if (ext === 'litematic') {
            parseLitematicData(parsedData);
        } else if (ext === 'schem') {
            parseSchematicData(parsedData);
        }
    } catch (error) {
        console.error("Error leyendo NBT:", error);
        alert("Error leyendo estructura NBT: " + error.message);
    }
}

// --- SISTEMA DE PROPIEDADES POR DEFECTO Y NORMALIZACIÓN DE BLOQUES ---
const BLOCK_DEFAULTS = {
    'chest': { type: 'single', facing: 'north', waterlogged: false },
    'trapped_chest': { type: 'single', facing: 'north', waterlogged: false },
    'ender_chest': { facing: 'north', waterlogged: false },
    'barrel': { facing: 'north', open: false },
    'stairs': { facing: 'north', half: 'bottom', shape: 'straight', waterlogged: false },
    'slab': { type: 'bottom', waterlogged: false },
    'door': { facing: 'north', half: 'lower', hinge: 'left', open: false, powered: false },
    'trapdoor': { facing: 'north', half: 'bottom', open: false, powered: false, waterlogged: false },
    'fence_gate': { facing: 'north', open: false, in_wall: false, powered: false },
    'lantern': { hanging: false, waterlogged: false },
    'candle': { candles: 1, lit: false, waterlogged: false }
};

function normalizeBlockProperties(block) {
    const cleanName = block.blockName.replace('minecraft:', '').toLowerCase().trim();

    // 1. Asignar valores generales en caso de no venir definidos en el NBT
    block._sourceTypeExplicit = block.type !== undefined && block.type !== null;
    if (block.facing === undefined) block.facing = 'north';
    if (block.half === undefined) block.half = 'bottom';
    if (block.shape === undefined) block.shape = 'straight';
    if (block.axis === undefined) block.axis = 'y';
    if (block.type === undefined) block.type = 'single';
    if (block.open === undefined) block.open = false;
    if (block.hanging === undefined) block.hanging = false;
    if (block.candles === undefined) block.candles = 1;
    if (block.lit === undefined) block.lit = false;
    if (block.waterlogged === undefined) block.waterlogged = false;
    if (block.level === undefined) block.level = 0;

    // 2. Buscar si el bloque coincide con reglas específicas por familia
    let defaults = BLOCK_DEFAULTS[cleanName];
    if (!defaults) {
        for (const [key, val] of Object.entries(BLOCK_DEFAULTS)) {
            if (cleanName.includes(key)) {
                defaults = val;
                break;
            }
        }
    }

    // 3. Inyectar propiedades por defecto si faltan en el objeto
    if (defaults) {
        for (const [prop, val] of Object.entries(defaults)) {
            if (block[prop] === undefined || block[prop] === null) {
                block[prop] = val;
            }
        }
    }

    return block;
}

// --- 7. DESCODIFICADOR LITEMATICA ---
function parseLitematicData(nbtData) {
    const regions = nbtData.Regions || nbtData.regions;
    if (!regions) {
        alert("El archivo .litematic no contiene regiones válidas.");
        return;
    }

    const paletteCounts = {};
    let totalBlocks = 0;
    let maxW = 0, maxH = 0, maxL = 0;

    Object.keys(regions).forEach(regionName => {
        const reg = regions[regionName];
        if (!reg) return;

        const sizeObj = reg.Size || reg.size || { x: 0, y: 0, z: 0 };
        const sizeX = Math.abs(sizeObj.x || 0);
        const sizeY = Math.abs(sizeObj.y || 0);
        const sizeZ = Math.abs(sizeObj.z || 0);

        maxW = Math.max(maxW, sizeX);
        maxH = Math.max(maxH, sizeY);
        maxL = Math.max(maxL, sizeZ);

        const palette = reg.BlockStatePalette || reg.block_state_palette || [];
        const blockStates = reg.BlockStates || reg.block_states || [];

        if (palette.length === 0) return;

        const volume = sizeX * sizeY * sizeZ;
        let indices = [];

        if (palette.length === 1) {
            indices = new Array(volume).fill(0);
        } else {
            indices = unpackLitematicaBlockStates(blockStates, palette.length, volume);
        }

        let idx = 0;
        for (let y = 0; y < sizeY; y++) {
            for (let z = 0; z < sizeZ; z++) {
                for (let x = 0; x < sizeX; x++) {
                    if (idx >= indices.length) break;
                    const blockIndex = indices[idx++];
                    const blockEntry = palette[blockIndex];

                    if (blockEntry) {
                        const fullName = blockEntry.Name || blockEntry.name || '';
                        if (fullName && fullName !== 'minecraft:air' && fullName !== 'air' && fullName !== 'minecraft:cave_air') {
                            // ✅ REEMPLAZAR POR ESTO:
const cleanName = fullName.replace('minecraft:', '');
const props = blockEntry.Properties || blockEntry.properties || {};

const posX = (sizeObj.x < 0) ? (sizeX - 1 - x) : x;
const posY = y;
const posZ = (sizeObj.z < 0) ? (sizeZ - 1 - z) : z;

const rawBlock = {
    x: posX,
    y: posY,
    z: posZ,
    blockName: cleanName,
    facing: props.facing,
    face: props.face,
    half: props.half,
    shape: props.shape,
    axis: props.axis,
    open: props.open !== undefined ? (props.open === 'true' || props.open === true) : undefined,
    type: props.type,
    hanging: props.hanging !== undefined ? (props.hanging === 'true' || props.hanging === true) : undefined,
    candles: props.candles !== undefined ? Number(props.candles) : undefined,
    lit: props.lit !== undefined ? (props.lit === 'true' || props.lit === true) : undefined,
    level: props.level !== undefined ? Number(props.level) : undefined,
    waterlogged: props.waterlogged !== undefined ? (props.waterlogged === 'true' || props.waterlogged === true) : undefined
};

loadedBlocksData.push(normalizeBlockProperties(rawBlock));
                            paletteCounts[cleanName] = (paletteCounts[cleanName] || 0) + 1;
                            totalBlocks++;
                        }
                    }
                }
            }
        }
    });

    const dataVersion = nbtData.MinecraftDataVersion || nbtData.DataVersion || 0;
    maxDimensions = { x: maxW, y: maxH, z: maxL };
    updateUIAndRender(maxW, maxH, maxL, totalBlocks, paletteCounts, dataVersion);
}

function unpackLitematicaBlockStates(blockStates, paletteLength, volume) {
    if (!blockStates || blockStates.length === 0) return new Array(volume).fill(0);

    const bitsPerBlock = Math.max(2, Math.ceil(Math.log2(paletteLength)));
    const mask = (1n << BigInt(bitsPerBlock)) - 1n;
    const longs = blockStates.map(v => typeof v === 'bigint' ? BigInt.asUintN(64, v) : BigInt.asUintN(64, BigInt(v)));
    const result = new Array(volume);

    for (let i = 0; i < volume; i++) {
        const startBit = BigInt(i * bitsPerBlock);
        const longIndex = Number(startBit / 64n);
        const bitOffset = startBit % 64n;

        if (longIndex >= longs.length) {
            result[i] = 0;
            continue;
        }

        const remainingBitsInLong = 64n - bitOffset;

        if (remainingBitsInLong >= BigInt(bitsPerBlock)) {
            const val = (longs[longIndex] >> bitOffset) & mask;
            result[i] = Number(val);
        } else {
            const firstPartBits = remainingBitsInLong;
            const secondPartBits = BigInt(bitsPerBlock) - firstPartBits;

            const firstPartMask = (1n << firstPartBits) - 1n;
            const firstPart = (longs[longIndex] >> bitOffset) & firstPartMask;

            let secondPart = 0n;
            if (longIndex + 1 < longs.length) {
                const secondPartMask = (1n << secondPartBits) - 1n;
                secondPart = longs[longIndex + 1] & secondPartMask;
            }

            const val = firstPart | (secondPart << firstPartBits);
            result[i] = Number(val);
        }
    }

    return result;
}

// --- 8. DESCODIFICADOR SCHEMATIC (WORLDEDIT) ---
function parseSchematicData(nbtData) {
    const schem = nbtData.Schematic || nbtData;
    const width = schem.Width || 0;
    const height = schem.Height || 0;
    const length = schem.Length || 0;
    const paletteMap = schem.Palette || {};
    const blockData = schem.BlockData || [];

    if (!width || !height || !length) {
        alert("El archivo .schem no contiene dimensiones válidas.");
        return;
    }

    const paletteArray = [];
    // ✅ REEMPLAZAR POR ESTO:
Object.entries(paletteMap).forEach(([fullName, id]) => {
    const cleanFull = fullName.replace('minecraft:', '');
    const nameOnly = cleanFull.split('[')[0];
    const props = {};

    if (cleanFull.includes('[')) {
        const rawProps = cleanFull.split('[')[1].replace(']', '');
        rawProps.split(',').forEach(p => {
            const [k, v] = p.split('=');
            if (k === 'facing') props.facing = v;
            if (k === 'face') props.face = v;
            if (k === 'half') props.half = v;
            if (k === 'shape') props.shape = v;
            if (k === 'axis') props.axis = v;
            if (k === 'open') props.open = (v === 'true');
            if (k === 'type') props.type = v;
            if (k === 'hanging') props.hanging = (v === 'true');
            if (k === 'candles') props.candles = Number(v);
            if (k === 'lit') props.lit = (v === 'true');
            if (k === 'level') props.level = Number(v);
            if (k === 'waterlogged') props.waterlogged = (v === 'true');
        });
    }
    paletteArray[id] = { name: nameOnly, ...props };
});

    const paletteCounts = {};
    let totalBlocks = 0;

    let idx = 0;
    for (let y = 0; y < height; y++) {
        for (let z = 0; z < length; z++) {
            for (let x = 0; x < width; x++) {
                if (idx >= blockData.length) break;
                const paletteId = blockData[idx++];
                const item = paletteArray[paletteId];

                // ✅ REEMPLAZAR POR ESTO:
if (item && item.name && item.name !== 'air' && item.name !== 'structure_void' && item.name !== 'cave_air') {
    const rawBlock = {
        x, y, z,
        blockName: item.name,
        facing: item.facing,
        face: item.face,
        half: item.half,
        shape: item.shape,
        axis: item.axis,
        open: item.open,
        type: item.type,
        hanging: item.hanging,
        candles: item.candles,
        lit: item.lit,
        level: item.level,
        waterlogged: item.waterlogged
    };
    loadedBlocksData.push(normalizeBlockProperties(rawBlock));
                    paletteCounts[item.name] = (paletteCounts[item.name] || 0) + 1;
                    totalBlocks++;
                }
            }
        }
    }

    const dataVersion = schem.DataVersion || nbtData.DataVersion || 0;
    maxDimensions = { x: width, y: height, z: length };
    updateUIAndRender(width, height, length, totalBlocks, paletteCounts, dataVersion);
}

// --- 9. RENDERIZADO Y ACTUALIZACIÓN DE UI ---
function updateUIAndRender(w, h, l, totalBlocks, paletteCounts, dataVersion = 0) {
    const ph = document.getElementById('centerPlaceholder') || document.querySelector('.placeholder-message');
    if (ph) ph.style.display = 'none';

    if (fileDimensionsEl) fileDimensionsEl.textContent = `${w} x ${h} x ${l}`;
    if (fileBlocksEl) fileBlocksEl.textContent = totalBlocks.toLocaleString();
    if (fileVersionEl) fileVersionEl.textContent = getMinecraftVersionFromDataVersion(dataVersion);

    updateCompassMarkers(w, l);
    updateStructureOrientation(w, l);

    if (layerSlider) {
        layerSlider.max = Math.max(0, h - 1);
        layerSlider.value = Math.max(0, h - 1);
        layerSlider.disabled = false;
    }
    if (layerVal) layerVal.textContent = `${h}/${h}`;

    renderBlocksInstanced();
    updatePaletteUI(paletteCounts);

    const collapseSection = (id) => {
        const el = document.getElementById(id);
        if (el) {
            const sec = el.closest('.accordion-section');
            if (sec) sec.classList.add('collapsed');
        }
    };

    const expandSection = (id) => {
        const el = document.getElementById(id);
        if (el) {
            const sec = el.closest('.accordion-section');
            if (sec) sec.classList.remove('collapsed');
        }
    };

    collapseSection('uploadSection');
    expandSection('visionSection');
    expandSection('infoSection');
    expandSection('paletteSection');

    if (camera && controls) {
        const maxDimension = Math.max(w, h, l);
        const distance = Math.max(35, maxDimension * 1.5);

        camera.position.set(distance, h + (distance * 0.4), distance);
        controls.target.set(0, h / 2, 0);
        controls.update();
    }

    setTimeout(() => {
        if (typeof onWindowResize === 'function') onWindowResize();
    }, 50);
}

function fixGeometryUVs(geo) {
    const pos = geo.attributes.position.array;
    const norm = geo.attributes.normal.array;
    const uvs = geo.attributes.uv.array;

    for (let i = 0; i < pos.length / 3; i++) {
        const nx = Math.abs(norm[i * 3]);
        const ny = Math.abs(norm[i * 3 + 1]);

        if (nx > 0.5) {
            uvs[i * 2] = pos[i * 3 + 2] + 0.5;
            uvs[i * 2 + 1] = pos[i * 3 + 1] + 0.5;
        } else if (ny > 0.5) {
            uvs[i * 2] = pos[i * 3] + 0.5;
            uvs[i * 2 + 1] = pos[i * 3 + 2] + 0.5;
        } else {
            uvs[i * 2] = pos[i * 3] + 0.5;
            uvs[i * 2 + 1] = pos[i * 3 + 1] + 0.5;
        }
    }
    geo.attributes.uv.needsUpdate = true;
    return geo;
}

function setBoxUVs(geo, sidesUV, topUV, bottomUV) {
    const uvs = geo.attributes.uv.array;
    const setFaceUV = (faceIdx, uMin, vMin, uMax, vMax) => {
        const offset = faceIdx * 8;
        uvs[offset + 0] = uMin; uvs[offset + 1] = vMax;
        uvs[offset + 2] = uMin; uvs[offset + 3] = vMin;
        uvs[offset + 4] = uMax; uvs[offset + 5] = vMax;
        uvs[offset + 6] = uMax; uvs[offset + 7] = vMin;
    };

    const bSide = sidesUV;
    const bTop = topUV || sidesUV;
    const bBot = bottomUV || sidesUV;

    setFaceUV(0, bSide[0], bSide[1], bSide[2], bSide[3]); // +X
    setFaceUV(1, bSide[0], bSide[1], bSide[2], bSide[3]); // -X
    setFaceUV(2, bTop[0], bTop[1], bTop[2], bTop[3]);    // +Y (Top)
    setFaceUV(3, bBot[0], bBot[1], bBot[2], bBot[3]);    // -Y (Bottom)
    setFaceUV(4, bSide[0], bSide[1], bSide[2], bSide[3]); // +Z
    setFaceUV(5, bSide[0], bSide[1], bSide[2], bSide[3]); // -Z

    geo.attributes.uv.needsUpdate = true;
}

// Estos son los cambios que hice, att. ChatGPT: aplica rectángulos UV por cara como en los JSON vanilla de Java.
function setModelFaceUVs(geometry, faceUVs) {
    const faceIndices = { east: 0, west: 1, up: 2, down: 3, south: 4, north: 5 };
    const uvs = geometry.attributes.uv.array;
    Object.entries(faceUVs).forEach(([face, faceSpec]) => {
        const faceIndex = faceIndices[face];
        if (faceIndex === undefined || !faceSpec) return;
        const spec = Array.isArray(faceSpec) ? { uv: faceSpec } : faceSpec;
        const [u1, v1, u2, v2] = spec.uv;
        const corners = [[u1, v1], [u2, v1], [u1, v2], [u2, v2]];
        let order = [0, 1, 2, 3];
        const quarterTurns = (((Number(spec.rotation) || 0) / 90) % 4 + 4) % 4;
        for (let turn = 0; turn < quarterTurns; turn++) order = [order[2], order[0], order[3], order[1]];
        const offset = faceIndex * 8;
        order.forEach((cornerIndex, vertexIndex) => {
            const [u, v] = corners[cornerIndex];
            uvs[offset + vertexIndex * 2] = u / 16;
            uvs[offset + vertexIndex * 2 + 1] = 1 - v / 16;
        });
    });
    geometry.attributes.uv.needsUpdate = true;
    return geometry;
}

function createVanillaModelBox(from, to, faceUVs = {}) {
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
    setModelFaceUVs(geometry, faceUVs);
    const faceNames = ['east', 'west', 'up', 'down', 'south', 'north'];
    geometry.groups.forEach(group => {
        if (!Object.prototype.hasOwnProperty.call(faceUVs, faceNames[group.materialIndex])) group.count = 0;
    });
    return geometry;
}



// GEOMETRÍAS BASE
const slabGeometry = new THREE.BoxGeometry(0.98, 0.49, 0.98);
slabGeometry.translate(0, -0.245, 0);
fixGeometryUVs(slabGeometry);



const bottomTrapdoorGeometry = createTrapdoorGeometry('bottom');
const topTrapdoorGeometry = createTrapdoorGeometry('top');
const openTrapdoorGeometry = createTrapdoorGeometry('bottom', true);

const lanternGeometry = createLanternGeometry(false);
const hangingLanternGeometry = createLanternGeometry(true);

const carpetGeometry = new THREE.BoxGeometry(0.98, 0.06, 0.98);
carpetGeometry.translate(0, -0.47, 0);
fixGeometryUVs(carpetGeometry);

const smallObjectGeometry = new THREE.BoxGeometry(0.35, 0.5, 0.35);
smallObjectGeometry.translate(0, -0.25, 0);
fixGeometryUVs(smallObjectGeometry);

const bedGeometry = new THREE.BoxGeometry(0.98, 0.5, 0.98);
bedGeometry.translate(0, -0.25, 0);
fixGeometryUVs(bedGeometry);

// Postes delgados para vallas (0.25)
const fencePostGeometry = new THREE.BoxGeometry(0.25, 0.98, 0.25);
fixGeometryUVs(fencePostGeometry);

// Postes normales para muros, cadenas y barrotes (0.50)
const postGeometry = new THREE.BoxGeometry(0.5, 0.98, 0.5);
fixGeometryUVs(postGeometry);

const doorGeometry = new THREE.BoxGeometry(0.98, 0.98, 0.1875);
doorGeometry.translate(0, 0, -0.39375);
fixGeometryUVs(doorGeometry);

function mergeBoxGeometries(boxes) {
    const positions = [], normals = [], uvs = [], indices = [];
    const groups = [];
    let vertexOffset = 0;
    let indexOffset = 0;

    boxes.forEach(g => {
        const pos = g.attributes.position.array;
        const norm = g.attributes.normal.array;
        const uv = g.attributes.uv.array;
        const idx = g.index.array;

        positions.push(...pos);
        normals.push(...norm);
        uvs.push(...uv);

        for (let i = 0; i < idx.length; i++) {
            indices.push(idx[i] + vertexOffset);
        }

        if (g.groups && g.groups.length > 0) {
            g.groups.forEach(grp => {
                groups.push({
                    start: grp.start + indexOffset,
                    count: grp.count,
                    materialIndex: grp.materialIndex
                });
            });
        }

        vertexOffset += pos.length / 3;
        indexOffset += idx.length;
    });

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    merged.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

    if (groups.length > 0) {
        groups.forEach(grp => merged.addGroup(grp.start, grp.count, grp.materialIndex));
    } else {
        merged.addGroup(0, indices.length, 0);
    }

    return merged;
}











// Estos son los cambios que hice, att. ChatGPT: construye la maceta hueca con la geometria y los UV vanilla de Java.


// Estos son los cambios que hice, att. ChatGPT: limita cada flor en maceta a su altura Java y conserva la transparencia PNG.


// Estos son los cambios que hice, att. ChatGPT: el cactus en maceta usa el cubo estrecho del modelo vanilla de Java.


// Estos son los cambios que hice, att. ChatGPT: el bambú en maceta tiene tallo vertical y hojas pequeñas en la punta.




// Estos son los cambios que hice, att. ChatGPT: conserva el tamaño de cada fase y usa dos planos cruzados en X.


// Estos son los cambios que hice, att. ChatGPT: velas de uno a cuatro respetan posiciones y dimensiones de Java.




// Estos son los cambios que hice, att. ChatGPT: mesa de encantamiento baja, con base completa y altura vanilla de 12/16.


// Estos son los cambios que hice, att. ChatGPT: reconstruye la fogata con las cinco piezas del modelo Java, sin leños diagonales.




// Estos son los cambios que hice, att. ChatGPT: ajusta las cuatro partes del yunque a las dimensiones del modelo vanilla.


// Estos son los cambios que hice, att. ChatGPT: replica la rueda cuadrada y los apoyos asimétricos del modelo vanilla de la afiladora.

























const cauldronGeometry = createCauldronGeometry();
const fenceGateGeometry = createFenceGateGeometry();
const stairGeometry = createStairGeometry();
const ladderGeometry = createLadderGeometry();
const crossPlantGeometry = createCrossPlantGeometry();
const pottedPotGeometry = createPottedPotGeometry();
const pottedPlantGeometry = createPottedPlantGeometry();
const pottedCactusGeometry = createPottedCactusGeometry();
const pottedBambooStalkGeometry = createPottedBambooStalkGeometry();
const pottedBambooLeavesGeometry = createPottedBambooLeavesGeometry();
const pottedDirtGeometry = createPottedDirtGeometry();
const enchantingTableGeometry = createEnchantingTableGeometry();
const campfireLogGeometry = createCampfireLogGeometry(false);
const campfireLogLitGeometry = createCampfireLogGeometry(true);
const campfireFlameGeometry = createCampfireFlameGeometry();
const anvilGeometry = createAnvilGeometry();
const grindstoneWheelGeometry = createGrindstoneWheelGeometry();
const grindstoneLegGeometry = createGrindstoneLegGeometry();
const grindstonePivotGeometry = createGrindstonePivotGeometry();
const outerStairGeometry = createOuterStairGeometry();
const innerStairGeometry = createInnerStairGeometry();
const outerLeftStairGeometry = createOuterStairGeometry(true);
const innerLeftStairGeometry = createInnerStairGeometry(true);

// Estos son los cambios que hice, att. ChatGPT: los cubos llenos ocupan el bloque completo y no dejan ranuras entre vecinos.
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const culledBoxGeometryCache = new Map();

function createGrassSideOverlayGeometry() {
    const source = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const overlayGroups = [];
    const sideMaterialIndices = new Set([0, 1, 4, 5]);

    source.groups.forEach(group => {
        if (!sideMaterialIndices.has(group.materialIndex)) return;
        const groupStart = indices.length;

        for (let i = group.start; i < group.start + group.count; i++) {
            const vertexIndex = source.index ? source.index.getX(i) : i;
            positions.push(
                source.attributes.position.getX(vertexIndex),
                source.attributes.position.getY(vertexIndex),
                source.attributes.position.getZ(vertexIndex)
            );
            normals.push(
                source.attributes.normal.getX(vertexIndex),
                source.attributes.normal.getY(vertexIndex),
                source.attributes.normal.getZ(vertexIndex)
            );
            uvs.push(
                source.attributes.uv.getX(vertexIndex),
                source.attributes.uv.getY(vertexIndex)
            );
            indices.push(indices.length);
        }

        overlayGroups.push({ start: groupStart, count: group.count });
    });

    const overlayGeometry = new THREE.BufferGeometry();
    overlayGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    overlayGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    overlayGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    overlayGeometry.setIndex(indices);
    overlayGroups.forEach(group => overlayGeometry.addGroup(group.start, group.count, 0));
    overlayGeometry.computeBoundingSphere();
    source.dispose();
    return overlayGeometry;
}

const grassSideOverlayGeometry = createGrassSideOverlayGeometry();
const GRASS_BLOCK_PLAINS_TINT = 0x91bd59;
let grassSideOverlayMaterial = null;







function isFullGlassCube(blockName) {
    const id = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
    return id === 'glass' || id === 'tinted_glass' || id.endsWith('_stained_glass');
}

function isFaceCullableFullBlock(blockName, type = 'single') {
    const id = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
    if (type === 'top' || type === 'bottom') return false;
    if (isCrossPlantBlock(id)) return false;
    if (getConnectedBlockKind(id)) return false;
    // Glass stays transparent in its material; this only marks its cube for matching-face culling.
    if (isFullGlassCube(id)) return true;
    if (/(stairs|slab|trapdoor|ladder|fence|wall|door|bed|carpet|rail|torch|button|pressure_plate|sign|banner|flower_pot|lantern|cauldron|chest|barrel|anvil|chain|head|skull|shulker|boat|lever|vine|plant|grass|fern|flower|mushroom|crop|sapling)/.test(id)) return false;
    if (/(glass|leaves|water|lava|ice|slime|honey|web|portal)/.test(id)) return false;
    return true;
}

function getHiddenCubeFaces(block, blocksByPosition, currentMaxY) {
    // Estos son los cambios que hice, att. ChatGPT: convierto vecinos del mundo a la orientación local antes de ocultar una cara.
    if (block.axis && block.axis !== 'y') return 0;
    if (block.facing === 'up' || block.facing === 'down') return 0;

    let yaw = 0;
    if (block.facing === 'west') yaw = -Math.PI / 2;
    else if (block.facing === 'north') yaw = Math.PI;
    else if (block.facing === 'east') yaw = Math.PI / 2;
    const cos = Math.round(Math.cos(yaw));
    const sin = Math.round(Math.sin(yaw));
    const directions = [
        [1, 0, 0], [-1, 0, 0],
        [0, 0, 1], [0, 0, -1],
        [0, 1, 0], [0, -1, 0]
    ];
    let hiddenFaces = 0;
    const currentBlockId = block.blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
    directions.forEach(([dx, dy, dz]) => {
        const neighbor = blocksByPosition.get(`${block.x + dx},${block.y + dy},${block.z + dz}`);
        const neighborBlockId = neighbor?.blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
        const localX = Math.round(dx * cos - dz * sin);
        const localZ = Math.round(dx * sin + dz * cos);
        const localFace = dy > 0 ? 2 : dy < 0 ? 3 : localX > 0 ? 0 : localX < 0 ? 1 : localZ > 0 ? 4 : 5;
        // Estos son los cambios que hice, att. ChatGPT: oculta caras internas entre bloques iguales, también en vidrio transparente, según su cara local.
        if (neighbor && neighbor.y <= currentMaxY && neighborBlockId === currentBlockId &&
            isFaceCullableFullBlock(neighbor.blockName, neighbor.type)) {
            hiddenFaces |= (1 << localFace);
        }
    });
    return hiddenFaces;
}

function getGlassSeamMask(block, blocksByPosition, currentMaxY) {
    if (!isFullGlassCube(block.blockName)) return 0;
    const currentBlockId = block.blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
    const neighbors = [
        [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
    ];
    return neighbors.reduce((mask, [dx, dy, dz], index) => {
        const neighbor = blocksByPosition.get(`${block.x + dx},${block.y + dy},${block.z + dz}`);
        if (!neighbor || neighbor.y > currentMaxY) return mask;
        const neighborId = neighbor.blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
        return neighborId === currentBlockId ? mask | (1 << index) : mask;
    }, 0);
}

function getCulledBoxGeometry(hiddenFaces) {
    if (!hiddenFaces) return boxGeometry;
    if (culledBoxGeometryCache.has(hiddenFaces)) return culledBoxGeometryCache.get(hiddenFaces);

    const geometry = new THREE.BufferGeometry();
    ['position', 'normal', 'uv'].forEach(attribute => {
        geometry.setAttribute(attribute, boxGeometry.getAttribute(attribute));
    });
    const sourceIndices = boxGeometry.index.array;
    const visibleIndices = [];
    boxGeometry.groups.forEach(group => {
        if (hiddenFaces & (1 << group.materialIndex)) return;
        const start = visibleIndices.length;
        for (let i = group.start; i < group.start + group.count; i++) visibleIndices.push(sourceIndices[i]);
        geometry.addGroup(start, group.count, group.materialIndex);
    });
    geometry.setIndex(visibleIndices);
    geometry.computeBoundingSphere();
    culledBoxGeometryCache.set(hiddenFaces, geometry);
    return geometry;
}

const glassBlockGeometryCache = new Map();
function getConnectedGlassBlockGeometry(hiddenFaces, seamMask) {
    if (!seamMask) return getCulledBoxGeometry(hiddenFaces);
    const cacheKey = `${hiddenFaces}:${seamMask}`;
    if (glassBlockGeometryCache.has(cacheKey)) return glassBlockGeometryCache.get(cacheKey);

    const geometry = getCulledBoxGeometry(hiddenFaces).clone();
    const uv = geometry.attributes.uv.array;
    // One logical texture pixel plus a tiny bias avoids sampling the border texel with nearest filtering.
    const pixelInset = (1 / 16) + 0.001;
    const faceEdges = [
        { uMin: 5, uMax: 4, vMin: 3, vMax: 2 }, // east: north/south and down/up
        { uMin: 5, uMax: 4, vMin: 3, vMax: 2 }, // west
        { uMin: 1, uMax: 0, vMin: 5, vMax: 4 }, // up: west/east and north/south
        { uMin: 1, uMax: 0, vMin: 5, vMax: 4 }, // down
        { uMin: 1, uMax: 0, vMin: 3, vMax: 2 }, // south: west/east and down/up
        { uMin: 1, uMax: 0, vMin: 3, vMax: 2 }  // north
    ];

    faceEdges.forEach((edges, faceIndex) => {
        const offset = faceIndex * 8;
        for (let corner = 0; corner < 4; corner++) {
            const uIndex = offset + corner * 2;
            const vIndex = uIndex + 1;
            const u = uv[uIndex];
            const v = uv[vIndex];
            if ((seamMask & (1 << edges.uMin)) && u < 0.001) uv[uIndex] = pixelInset;
            if ((seamMask & (1 << edges.uMax)) && u > 0.999) uv[uIndex] = 1 - pixelInset;
            if ((seamMask & (1 << edges.vMin)) && v < 0.001) uv[vIndex] = pixelInset;
            if ((seamMask & (1 << edges.vMax)) && v > 0.999) uv[vIndex] = 1 - pixelInset;
        }
    });
    geometry.attributes.uv.needsUpdate = true;
    glassBlockGeometryCache.set(cacheKey, geometry);
    return geometry;
}

function getStairShape(block, blocksByPosition) {
    if (getBlockDefinition(block.blockName).family !== 'stairs') return block.shape || 'straight';
    const vectors = {
        north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0]
    };
    const leftOf = { north: 'west', west: 'south', south: 'east', east: 'north' };
    const facing = block.facing || 'north';
    const forward = vectors[facing];
    if (!forward) return block.shape || 'straight';

    const sameStairHalf = neighbor => neighbor && getBlockDefinition(neighbor.blockName).family === 'stairs' && neighbor.half === block.half;
    const neighborAt = (dx, dz) => blocksByPosition.get(`${block.x + dx},${block.y},${block.z + dz}`);
    const hasSideBlockWithCurrentFacing = direction => {
        const [dx, dz] = vectors[direction];
        const sideBlock = neighborAt(dx, dz);
        return sameStairHalf(sideBlock) && sideBlock.facing === facing;
    };

    const front = neighborAt(forward[0], forward[1]);
    if (sameStairHalf(front) && vectors[front.facing] && vectors[front.facing][0] * forward[0] + vectors[front.facing][1] * forward[1] === 0) {
        const guardDirection = ({ north: 'south', east: 'west', south: 'north', west: 'east' })[front.facing];
        if (!hasSideBlockWithCurrentFacing(guardDirection)) {
            return front.facing === leftOf[facing] ? 'outer_left' : 'outer_right';
        }
    }

    const back = neighborAt(-forward[0], -forward[1]);
    if (sameStairHalf(back) && vectors[back.facing] && vectors[back.facing][0] * forward[0] + vectors[back.facing][1] * forward[1] === 0) {
        if (!hasSideBlockWithCurrentFacing(back.facing)) {
            return back.facing === leftOf[facing] ? 'inner_left' : 'inner_right';
        }
    }

    return block.shape || 'straight';
}

let blockRenderRevision = 0;
async function renderBlocksInstanced() {
    const renderRevision = ++blockRenderRevision;
    await ensureBlockDefinitions(loadedBlocksData.map(block => block.blockName));
    if (renderRevision !== blockRenderRevision) return;

    while (instancedMeshesGroup.children.length > 0) {
        instancedMeshesGroup.children.pop();
    }

    if (typeof autoDetectDoubleChests === 'function') {
        autoDetectDoubleChests(loadedBlocksData);
    }

    const currentMaxY = layerSlider ? parseInt(layerSlider.value, 10) : 999;
    const blocksByType = {};
    const blocksByPosition = new Map(loadedBlocksData.map(block => [`${block.x},${block.y},${block.z}`, block]));
    const offsetX = -maxDimensions.x / 2;
    const offsetZ = -maxDimensions.z / 2;

    for (let i = 0; i < loadedBlocksData.length; i++) {
        const block = loadedBlocksData[i];
        if (block.y <= currentMaxY) {
            const type = block.type || 'single';
            const showOnlyLeft = Boolean(soloLeftToggle?.checked && !soloRightToggle?.checked);
            const showOnlyRight = Boolean(soloRightToggle?.checked && !soloLeftToggle?.checked);
            if ((showOnlyLeft && type === 'right') || (showOnlyRight && type === 'left')) continue;

            const shape = getStairShape(block, blocksByPosition);
            const half = block.half || 'bottom';
            const hanging = block.hanging ? 'hanging' : 'standing';
            const connectionDirections = getConnectedDirections(block, blocksByPosition);
            const openState = block.open ? 'open' : 'closed';
            const face = block.face || '';
            const candleCount = block.candles || 1;
            const litState = block.lit ? 'lit' : 'unlit';
            const cauldronLevel = block.level || 0;
            const hiddenFaces = isFaceCullableFullBlock(block.blockName, type)
                ? getHiddenCubeFaces(block, blocksByPosition, currentMaxY)
                : 0;
            const glassSeamMask = getGlassSeamMask(block, blocksByPosition, currentMaxY);
            const groupKey = `${block.blockName}__${shape}__${type}__${half}__${hanging}__${connectionDirections}__${openState}__${hiddenFaces}__${face}__${candleCount}__${litState}__${cauldronLevel}__${glassSeamMask}`;

            if (!blocksByType[groupKey]) blocksByType[groupKey] = [];
            blocksByType[groupKey].push(block);
        }
    }

    let customNormalChestModel = null;
    let customNormalDoubleLeftModel = null;
    let customNormalDoubleRightModel = null;
    let customEnderChestModel = null;
    let customTrappedChestModel = null;
    let customCopperChestModel = null;
    let customWheatModel = null;
    let customCarrotModel = null;
    let customPotatoModel = null;
    let customBeetrootModel = null;
    const copperChestTextureFiles = new Map([
        ['copper_chest', 'copper'],
        ['exposed_copper_chest', 'copper_exposed'],
        ['weathered_copper_chest', 'copper_weathered'],
        ['oxidized_copper_chest', 'copper_oxidized'],
        ['waxed_copper_chest', 'copper'],
        ['waxed_exposed_copper_chest', 'copper_exposed'],
        ['waxed_weathered_copper_chest', 'copper_weathered'],
        ['waxed_oxidized_copper_chest', 'copper_oxidized']
    ]);
    const customDoubleChestVariantModels = new Map();
    const hasNormalSingleChest = Object.keys(blocksByType).some(groupKey => {
        const [blockName, , type] = groupKey.split('__');
        const normalizedBlockId = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
        return normalizedBlockId === 'chest' && type === 'single';
    });

    if (hasNormalSingleChest && typeof loadCustomModel === 'function') {
        try {
            customNormalChestModel = await loadCustomModel('./custom-Models/Minecraft/Models/chests/chest.json');
        } catch (error) {
            console.warn('No se pudo cargar el modelo personalizado del cofre normal; se usará el modelo de respaldo.', error);
        }

        if (renderRevision !== blockRenderRevision) return;
    }

    const hasNormalDoubleLeftChest = Object.keys(blocksByType).some(groupKey => {
        const [blockName, , type] = groupKey.split('__');
        const normalizedBlockId = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
        return normalizedBlockId === 'chest' && type === 'left';
    });
    const hasNormalDoubleRightChest = Object.keys(blocksByType).some(groupKey => {
        const [blockName, , type] = groupKey.split('__');
        const normalizedBlockId = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
        return normalizedBlockId === 'chest' && type === 'right';
    });

    if ((hasNormalDoubleLeftChest || hasNormalDoubleRightChest) && typeof loadCustomModel === 'function') {
        if (hasNormalDoubleLeftChest) {
            try {
                customNormalDoubleRightModel = await loadCustomModel('./custom-Models/Minecraft/Models/chests/normal_right.json');
            } catch (error) {
                console.warn('No se pudo cargar el modelo de la mitad izquierda del cofre doble; se usará el modelo de respaldo.', error);
            }
            if (renderRevision !== blockRenderRevision) return;
        }

        if (hasNormalDoubleRightChest) {
            try {
                customNormalDoubleLeftModel = await loadCustomModel('./custom-Models/Minecraft/Models/chests/normal_left.json');
            } catch (error) {
                console.warn('No se pudo cargar el modelo de la mitad derecha del cofre doble; se usará el modelo de respaldo.', error);
            }
            if (renderRevision !== blockRenderRevision) return;
        }
    }

    const doubleChestVariantBases = new Set();
    Object.keys(blocksByType).forEach(groupKey => {
        const [blockName, , type] = groupKey.split('__');
        if (type !== 'left' && type !== 'right') return;
        const normalizedBlockId = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
        if (normalizedBlockId === 'trapped_chest') doubleChestVariantBases.add('trapped');
        else if (copperChestTextureFiles.has(normalizedBlockId)) {
            doubleChestVariantBases.add(copperChestTextureFiles.get(normalizedBlockId));
        }
    });

    if (doubleChestVariantBases.size && typeof loadCustomModel === 'function') {
        for (const modelBase of doubleChestVariantBases) {
            const models = { left: null, right: null };
            for (const side of ['left', 'right']) {
                try {
                    models[side] = await loadCustomModel(`./custom-Models/Minecraft/Models/chests/${modelBase}_${side}.json`);
                } catch (error) {
                    console.warn(`No se pudo cargar el modelo doble ${modelBase}_${side}; se usará el modelo de respaldo.`, error);
                }
                if (renderRevision !== blockRenderRevision) return;
            }
            customDoubleChestVariantModels.set(modelBase, models);
        }
    }

    const hasEnderSingleChest = Object.keys(blocksByType).some(groupKey => {
        const [blockName, , type] = groupKey.split('__');
        const normalizedBlockId = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
        return normalizedBlockId === 'ender_chest' && type === 'single';
    });

    if (hasEnderSingleChest && typeof loadCustomModel === 'function') {
        try {
            customEnderChestModel = await loadCustomModel('./custom-Models/Minecraft/Models/chests/ender_chest.json');
        } catch (error) {
            console.warn('No se pudo cargar el modelo personalizado del Ender Chest; se usará el modelo de respaldo.', error);
        }

        if (renderRevision !== blockRenderRevision) return;
    }

    const hasTrappedSingleChest = Object.keys(blocksByType).some(groupKey => {
        const [blockName, , type] = groupKey.split('__');
        const normalizedBlockId = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
        return normalizedBlockId === 'trapped_chest' && type === 'single';
    });

    if (hasTrappedSingleChest && typeof loadCustomModel === 'function') {
        try {
            customTrappedChestModel = await loadCustomModel('./custom-Models/Minecraft/Models/chests/trapped_chest.json');
        } catch (error) {
            console.warn('No se pudo cargar el modelo personalizado del cofre trampa; se usará el modelo de respaldo.', error);
        }

        if (renderRevision !== blockRenderRevision) return;
    }

    const hasCopperSingleChest = Object.keys(blocksByType).some(groupKey => {
        const [blockName, , type] = groupKey.split('__');
        const normalizedBlockId = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
        return copperChestTextureFiles.has(normalizedBlockId) && type === 'single';
    });

    if (hasCopperSingleChest && typeof loadCustomModel === 'function') {
        try {
            customCopperChestModel = await loadCustomModel('./custom-Models/Minecraft/Models/chests/copper_chest.json');
        } catch (error) {
            console.warn('No se pudo cargar el modelo personalizado del cofre de cobre; se usará el modelo de respaldo.', error);
        }

        if (renderRevision !== blockRenderRevision) return;
    }

    const hasWheatCrop = Object.keys(blocksByType).some(groupKey => {
        const [blockName] = groupKey.split('__');
        const normalizedBlockId = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
        return normalizedBlockId === 'wheat';
    });

    if (hasWheatCrop && typeof loadCustomModel === 'function') {
        try {
            customWheatModel = await loadCustomModel('./custom-Models/Minecraft/Models/crops/wheat_stage7.json');
        } catch (error) {
            console.warn('No se pudo cargar el modelo personalizado del trigo; se usará la geometría de respaldo.', error);
        }

        if (renderRevision !== blockRenderRevision) return;
    }

    const hasCustomCrop = cropIds => Object.keys(blocksByType).some(groupKey => {
        const [blockName] = groupKey.split('__');
        const normalizedBlockId = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
        return cropIds.includes(normalizedBlockId);
    });

    if (hasCustomCrop(['carrot', 'carrots']) && typeof loadCustomModel === 'function') {
        try {
            customCarrotModel = await loadCustomModel('./custom-Models/Minecraft/Models/crops/carrot.json');
        } catch (error) {
            console.warn('No se pudo cargar el modelo personalizado de la zanahoria; se usará la geometría de respaldo.', error);
        }
        if (renderRevision !== blockRenderRevision) return;
    }

    if (hasCustomCrop(['potato', 'potatoes']) && typeof loadCustomModel === 'function') {
        try {
            customPotatoModel = await loadCustomModel('./custom-Models/Minecraft/Models/crops/potato.json');
        } catch (error) {
            console.warn('No se pudo cargar el modelo personalizado de la papa; se usará la geometría de respaldo.', error);
        }
        if (renderRevision !== blockRenderRevision) return;
    }

    if (hasCustomCrop(['beetroot', 'beetroots']) && typeof loadCustomModel === 'function') {
        try {
            customBeetrootModel = await loadCustomModel('./custom-Models/Minecraft/Models/crops/beetroot.json');
        } catch (error) {
            console.warn('No se pudo cargar el modelo personalizado de la remolacha; se usará la geometría de respaldo.', error);
        }
        if (renderRevision !== blockRenderRevision) return;
    }

    const dummy = new THREE.Object3D();
    const addSpecialInstancedMesh = (blockName, blocksList, geometry, material, transformBlock) => {
        const mesh = new THREE.InstancedMesh(geometry, material, blocksList.length);
        mesh.userData = { blockName, blocksList };
        for (let i = 0; i < blocksList.length; i++) {
            const block = blocksList[i];
            dummy.position.set(block.x + offsetX, block.y, block.z + offsetZ);
            dummy.rotation.set(0, 0, 0);
            dummy.rotation.order = 'XYZ';
            dummy.scale.set(1, 1, 1);
            if (transformBlock) transformBlock(dummy, block);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.geometry.computeBoundingSphere();
        instancedMeshesGroup.add(mesh);
        return mesh;
    };

    Object.entries(blocksByType).forEach(([groupKey, blocksList]) => {
        const [blockName, shape, type, half, hanging, connectionDirections = '', openState = 'closed', hiddenFaces = '0', face = '', candleCount = '1', litState = 'unlit', cauldronLevel = '0', glassSeamMask = '0'] = groupKey.split('__');

        const normalizedBlockId = blockName.replace('minecraft:', '').toLowerCase().trim().split('[')[0];
        const blockFamily = getBlockDefinition(normalizedBlockId).family;
        if (blockFamily === 'enchanting-table') {
            // Estos son los cambios que hice, att. ChatGPT: mesa usa la geometría y las tres texturas vanilla sin el libro flotante.
            const tableMaterial = [
                getCachedMaterial(getBlockTexture(blockName, 'side'), false, false, false),
                getCachedMaterial(getBlockTexture(blockName, 'side'), false, false, false),
                getCachedMaterial(getBlockTexture(blockName, 'up'), false, false, false),
                getCachedMaterial(getBlockTexture(blockName, 'down'), false, false, false),
                getCachedMaterial(getBlockTexture(blockName, 'side'), false, false, false),
                getCachedMaterial(getBlockTexture(blockName, 'side'), false, false, false)
            ];
            addSpecialInstancedMesh(blockName, blocksList, enchantingTableGeometry, tableMaterial);
            return;
        }

        if (blockFamily === 'campfire') {
            const isLit = litState === 'lit';
            const campfireYaw = { south: 0, west: -Math.PI / 2, north: Math.PI, east: Math.PI / 2 };
            const rotateCampfire = (object, block) => { object.rotation.y = campfireYaw[block.facing] ?? 0; };
            const logMaterial = getCachedMaterial(getBlockTexture('campfire_log', 'side'), false, false, false);
            const logGeometry = isLit ? campfireLogLitGeometry : campfireLogGeometry;
            const logMaterials = isLit
                ? [logMaterial, getCachedMaterial(getBlockTexture('campfire_log_lit', 'side'), false, false, false)]
                : logMaterial;
            addSpecialInstancedMesh(blockName, blocksList, logGeometry, logMaterials, rotateCampfire);

            if (isLit) {
                const flameTextureName = normalizedBlockId === 'soul_campfire' ? 'soul_campfire_fire' : 'campfire_fire';
                const flameTexture = getBlockTexture(flameTextureName, 'side');
                flameTexture.repeat.set(1, 1 / 4);
                flameTexture.offset.set(0, 0);
                flameTexture.needsUpdate = true;
                addSpecialInstancedMesh(
                    blockName,
                    blocksList,
                    campfireFlameGeometry,
                    getCachedMaterial(flameTexture, false, false, true, true),
                    rotateCampfire
                );
            }
            return;
        }

        if (blockFamily === 'anvil') {
            // Estos son los cambios que hice, att. ChatGPT: el yunque conserva su acabado superior normal, picado o dañado.
            const anvilMaterial = [
                getCachedMaterial(getBlockTexture(blockName, 'side'), false, false, false),
                getCachedMaterial(getBlockTexture(blockName, 'up'), false, false, false)
            ];
            const anvilYaw = { south: 0, west: -Math.PI / 2, north: Math.PI, east: Math.PI / 2 };
            addSpecialInstancedMesh(blockName, blocksList, anvilGeometry, anvilMaterial, (object, block) => {
                object.rotation.y = anvilYaw[block.facing] ?? 0;
            });
            return;
        }

        if (blockFamily === 'grindstone') {
            // Estos son los cambios que hice, att. ChatGPT: orienta rueda y soportes según cara y dirección de la afiladora.
            const legMaterial = getCachedMaterial(getBlockTexture('dark_oak_log', 'side'), false, false, false);
            const pivotMaterial = getCachedMaterial(getBlockTexture('grindstone_pivot', 'side'), false, false, false);
            const wheelSideMaterial = getCachedMaterial(getBlockTexture(blockName, 'side'), false, false, false);
            const wheelMaterial = [
                wheelSideMaterial,
                wheelSideMaterial,
                getCachedMaterial(getBlockTexture(blockName, 'up'), false, false, false),
                getCachedMaterial(getBlockTexture(blockName, 'up'), false, false, false),
                getCachedMaterial(getBlockTexture(blockName, 'up'), false, false, false),
                getCachedMaterial(getBlockTexture(blockName, 'up'), false, false, false)
            ];
            const rotateGrindstone = (object, block) => {
                const yawByFacing = { north: 0, east: Math.PI / 2, south: Math.PI, west: -Math.PI / 2 };
                const faceTilt = face === 'wall' ? Math.PI / 2 : (face === 'ceiling' ? Math.PI : 0);
                object.rotation.set(faceTilt, yawByFacing[block.facing] ?? 0, 0, 'YXZ');
            };
            addSpecialInstancedMesh(blockName, blocksList, grindstoneLegGeometry, legMaterial, rotateGrindstone);
            addSpecialInstancedMesh(blockName, blocksList, grindstonePivotGeometry, pivotMaterial, rotateGrindstone);
            addSpecialInstancedMesh(blockName, blocksList, grindstoneWheelGeometry, wheelMaterial, rotateGrindstone);
            return;
        }

        if (blockFamily === 'amethyst') {
            // Estos son los cambios que hice, att. ChatGPT: el tamaño depende de la fase y la orientación de la cara de apoyo.
            const crystalMaterial = getCachedMaterial(getBlockTexture(normalizedBlockId, 'side'), false, false, true, true).clone();
            crystalMaterial.emissive = new THREE.Color(0x24113f);
            crystalMaterial.emissiveIntensity = 0.28;
            const crystalMesh = new THREE.InstancedMesh(createAmethystGeometry(normalizedBlockId), crystalMaterial, blocksList.length);
            crystalMesh.userData = { blockName, blocksList };
            const facingVectors = {
                up: [0, 1, 0], down: [0, -1, 0], north: [0, 0, -1],
                south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0]
            };
            for (let i = 0; i < blocksList.length; i++) {
                const block = blocksList[i];
                const direction = facingVectors[block.facing] || facingVectors.up;
                dummy.position.set(block.x + offsetX, block.y, block.z + offsetZ);
                dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...direction));
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                crystalMesh.setMatrixAt(i, dummy.matrix);
            }
            crystalMesh.instanceMatrix.needsUpdate = true;
            crystalMesh.geometry.computeBoundingSphere();
            instancedMeshesGroup.add(crystalMesh);
            return;
        }

        if (blockFamily === 'candles') {
            // Estos son los cambios que hice, att. ChatGPT: vela encendida y cantidad de velas vienen de sus propiedades vanilla.
            const candleTextureName = litState === 'lit'
                ? `${normalizedBlockId}_lit`
                : normalizedBlockId;
            const candleMaterial = getCachedMaterial(getBlockTexture(candleTextureName, 'side'), false, false, true, true);
            const candleMesh = new THREE.InstancedMesh(createCandleGeometry(candleCount), candleMaterial, blocksList.length);
            candleMesh.userData = { blockName, blocksList };
            for (let i = 0; i < blocksList.length; i++) {
                const block = blocksList[i];
                dummy.position.set(block.x + offsetX, block.y, block.z + offsetZ);
                dummy.rotation.set(0, 0, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                candleMesh.setMatrixAt(i, dummy.matrix);
            }
            candleMesh.instanceMatrix.needsUpdate = true;
            candleMesh.geometry.computeBoundingSphere();
            instancedMeshesGroup.add(candleMesh);
            return;
        }

        if (blockFamily === 'potted') {
            // Estos son los cambios que hice, att. ChatGPT: cada maceta se dibuja por capas vanilla, no como cubo sólido.
            const potMaterial = getCachedMaterial(getBlockTexture('flower_pot', 'side'), false, false, true, true);
            const dirtMaterial = getCachedMaterial(getBlockTexture('dirt', 'side'), false, false, true, true);
            const pottedLayers = [
                { geometry: pottedPotGeometry, material: potMaterial },
                { geometry: pottedDirtGeometry, material: dirtMaterial }
            ];

            if (isPottedPlantBlock(blockName)) {
                const plantTextureName = getPottedPlantTextureName(blockName);
                const plantTexture = getBlockTexture(plantTextureName, 'side');
                const plantMaterial = getCachedMaterial(plantTexture, /grass|fern|roots/.test(plantTextureName), false, true, true);
                if (normalizedBlockId === 'potted_bamboo') {
                    pottedLayers.push({ geometry: pottedBambooStalkGeometry, material: plantMaterial });
                    pottedLayers.push({
                        geometry: pottedBambooLeavesGeometry,
                        material: getCachedMaterial(getBlockTexture('bamboo_small_leaves', 'side'), false, false, true, true)
                    });
                } else {
                    pottedLayers.push({
                        geometry: normalizedBlockId === 'potted_cactus' ? pottedCactusGeometry : pottedPlantGeometry,
                        material: plantMaterial
                    });
                }
            }

            for (const layer of pottedLayers) {
                const pottedMesh = new THREE.InstancedMesh(layer.geometry, layer.material, blocksList.length);
                pottedMesh.userData = { blockName, blocksList };
                for (let i = 0; i < blocksList.length; i++) {
                    const block = blocksList[i];
                    dummy.position.set(block.x + offsetX, block.y, block.z + offsetZ);
                    dummy.rotation.set(0, 0, 0);
                    dummy.scale.set(1, 1, 1);
                    dummy.updateMatrix();
                    pottedMesh.setMatrixAt(i, dummy.matrix);
                }
                pottedMesh.instanceMatrix.needsUpdate = true;
                pottedMesh.geometry.computeBoundingSphere();
                instancedMeshesGroup.add(pottedMesh);
            }
            return;
        }
        
        let activeGeometry = boxGeometry;
        if (blockFamily === 'cross-plant') {
            const customCropModel = normalizedBlockId === 'wheat' ? customWheatModel
                : (normalizedBlockId === 'carrot' || normalizedBlockId === 'carrots') ? customCarrotModel
                : (normalizedBlockId === 'potato' || normalizedBlockId === 'potatoes') ? customPotatoModel
                : (normalizedBlockId === 'beetroot' || normalizedBlockId === 'beetroots') ? customBeetrootModel
                : null;
            activeGeometry = customCropModel?.geometry || crossPlantGeometry;
        } else if (isFaceCullableFullBlock(blockName, type)) {
            const faceMask = parseInt(hiddenFaces, 10) || 0;
            activeGeometry = isFullGlassCube(blockName)
                ? getConnectedGlassBlockGeometry(faceMask, parseInt(glassSeamMask, 10) || 0)
                : getCulledBoxGeometry(faceMask);
        } else if (blockFamily === 'ladder') {
            activeGeometry = ladderGeometry;
        } else if (blockFamily === 'stairs') {
            // Estos son los cambios que hice, att. ChatGPT: las variantes left/right se invierten para compensar el giro local y cerrar la esquina real.
            if (shape.includes('inner')) activeGeometry = shape.includes('left') ? innerStairGeometry : innerLeftStairGeometry;
            else if (shape.includes('outer')) activeGeometry = shape.includes('left') ? outerStairGeometry : outerLeftStairGeometry;
            else activeGeometry = stairGeometry;
        } else if (blockFamily === 'slab') {
            activeGeometry = (type === 'double') ? boxGeometry : slabGeometry;
        } else if (blockFamily === 'trapdoor') {
            activeGeometry = openState === 'open'
                ? openTrapdoorGeometry
                : (half === 'top' ? topTrapdoorGeometry : bottomTrapdoorGeometry);
        } else if (blockFamily === 'cauldron') {
            activeGeometry = cauldronGeometry;
        } else if (blockFamily === 'fence-gate') {
            activeGeometry = fenceGateGeometry;
        } else if (blockFamily === 'glass-pane') {
            activeGeometry = getGlassPaneGeometry(connectionDirections);
        } else if (['fence', 'wall', 'iron-bars'].includes(blockFamily)) {
            activeGeometry = getConnectedGeometry(getConnectedBlockKind(blockName), connectionDirections);
        } else if (blockFamily === 'chest') {
            const customTexture = customNormalChestModel?.textures?.['0'] || customNormalChestModel?.texture;
            const isCustomNormalSingleChest = normalizedBlockId === 'chest' && type === 'single' && customNormalChestModel?.geometry && customTexture;
            // Con facing=north, el giro existente de 180° invierte X; usar la mitad JSON opuesta mantiene la unión en el centro.
            const customNormalDoubleModel = type === 'left' ? customNormalDoubleRightModel : type === 'right' ? customNormalDoubleLeftModel : null;
            const customNormalDoubleTexture = customNormalDoubleModel?.textures?.['0'] || customNormalDoubleModel?.texture;
            const isCustomNormalDoubleChest = normalizedBlockId === 'chest' && (type === 'left' || type === 'right') && customNormalDoubleModel?.geometry && customNormalDoubleTexture;
            const doubleChestVariantBase = normalizedBlockId === 'trapped_chest' ? 'trapped' : copperChestTextureFiles.get(normalizedBlockId);
            const doubleChestVariantPair = doubleChestVariantBase ? customDoubleChestVariantModels.get(doubleChestVariantBase) : null;
            const customDoubleVariantModel = type === 'left' ? doubleChestVariantPair?.right : type === 'right' ? doubleChestVariantPair?.left : null;
            const isCustomDoubleVariantChest = (normalizedBlockId === 'trapped_chest' || copperChestTextureFiles.has(normalizedBlockId))
                && (type === 'left' || type === 'right') && customDoubleVariantModel?.geometry;
            const isCustomEnderSingleChest = normalizedBlockId === 'ender_chest' && type === 'single' && customEnderChestModel?.geometry;
            const isCustomTrappedSingleChest = normalizedBlockId === 'trapped_chest' && type === 'single' && customTrappedChestModel?.geometry;
            const isCustomCopperSingleChest = copperChestTextureFiles.has(normalizedBlockId) && type === 'single' && customCopperChestModel?.geometry;
            if (isCustomNormalDoubleChest) {
                activeGeometry = customNormalDoubleModel.geometry;
            } else if (isCustomDoubleVariantChest) {
                activeGeometry = customDoubleVariantModel.geometry;
            } else if (isCustomNormalSingleChest) {
                activeGeometry = customNormalChestModel.geometry;
            } else if (isCustomEnderSingleChest) {
                activeGeometry = customEnderChestModel.geometry;
            } else if (isCustomTrappedSingleChest) {
                activeGeometry = customTrappedChestModel.geometry;
            } else if (isCustomCopperSingleChest) {
                activeGeometry = customCopperChestModel.geometry;
            } else {
                const chestData = resolveChestData(blockName, type, getBlockTexture, getCachedMaterial);
                activeGeometry = chestData.geometry;
            }
        } else if (blockFamily === 'carpet') {
            activeGeometry = carpetGeometry;
        } else if (blockFamily === 'lantern') {
            activeGeometry = (hanging === 'hanging') ? hangingLanternGeometry : lanternGeometry;
        } else if (blockFamily === 'small-object') {
            activeGeometry = smallObjectGeometry;
        } else if (blockFamily === 'bed') {
            activeGeometry = bedGeometry;
        } else if (blockFamily === 'fence') {
            activeGeometry = fencePostGeometry; // Vallas delgadas
        } else if (blockFamily === 'wall' || blockFamily === 'chain' || blockFamily === 'iron-bars') {
            activeGeometry = postGeometry;      // Muros / Cadenas / Barrotes
        } else if (blockFamily === 'door') {
            activeGeometry = doorGeometry;
        }

        const texSide = getBlockTexture(blockName, 'side');
        const texTop = getBlockTexture(blockName, 'up');
        const texBottom = getBlockTexture(blockName, 'down');
        const texFront = getBlockTexture(blockName, 'front');

        const isLeaves = blockName.includes('leaves') || blockName.includes('vine') || (blockName.includes('grass') && normalizedBlockId !== 'grass_block') || blockName.includes('plant');
        const isGlass = (blockName.includes('glass') || blockName.includes('water')) && !blockName.includes('cauldron');
        const isCauldron = blockFamily === 'cauldron';
        const isStairs = blockFamily === 'stairs';
        const isLadder = blockFamily === 'ladder';
        const isFenceGate = blockFamily === 'fence-gate';
        const isDoor = blockFamily === 'door';
        const isLantern = blockFamily === 'lantern';
        const isDoubleSided = isCauldron || isStairs || isLadder || isFenceGate || isDoor || isLantern || blockFamily === 'slab' || blockFamily === 'trapdoor';

        let material;
        if (blockFamily === 'cross-plant') {
            // Estos son los cambios que hice, att. ChatGPT: flores conservan sus colores y usan textura recortada de doble cara.
            const tintFoliage = /grass|fern/.test(blockName);
            const plantTexture = getBlockTexture(blockName,
                ['sunflower', 'lilac', 'rose_bush', 'peony', 'tall_grass', 'large_fern'].includes(blockName)
                    ? (half === 'upper' || half === 'top' ? 'upper' : 'lower')
                    : 'side'
            );
            material = getCachedMaterial(plantTexture, tintFoliage, false, true, true);
        } else if (isDoor) {
            const isUpper = (half === 'upper' || half === 'top');
            const texDoor = getBlockTexture(blockName, isUpper ? 'upper' : 'lower');
            material = getCachedMaterial(texDoor, false, false, true, true);
        } else if (isLantern) {
            material = getCachedMaterial(texSide, false, false, true, true);
        } else if (isLadder) {
            // Estos son los cambios que hice, att. ChatGPT: activo transparencia y doble cara para respetar el PNG plano de la escalera.
            material = getCachedMaterial(texSide, false, false, true, true);
        } else if (blockFamily === 'trapdoor') {
            // Estos son los cambios que hice, att. ChatGPT: el canal alfa conserva los huecos del diseño de la trampilla.
            material = getCachedMaterial(texSide, false, false, true, true);
        } else if (isCauldron) {
            material = [
                getCachedMaterial(getBlockTexture(blockName, 'side'), false, false, false),
                getCachedMaterial(getBlockTexture(blockName, 'inside'), false, false, false),
                getCachedMaterial(getBlockTexture(blockName, 'rim'), false, false, false),
                getCachedMaterial(getBlockTexture(blockName, 'bottom'), false, false, false)
            ];
        } else if (blockFamily === 'glass-pane') {
            material = [
                getCachedMaterial(texSide, false, true, true),
                getCachedMaterial(texTop, false, true, true)
            ];
        } else if (isStairs || isFenceGate) {
            material = getCachedMaterial(texSide, isLeaves, isGlass, isDoubleSided);
        // ✅ REEMPLAZAR POR ESTO:
        } else if (blockFamily === 'chest') {
            const customTexture = customNormalChestModel?.textures?.['0'] || customNormalChestModel?.texture;
            const isCustomNormalSingleChest = normalizedBlockId === 'chest' && type === 'single' && customNormalChestModel?.geometry && customTexture;
            const customNormalDoubleModel = type === 'left' ? customNormalDoubleRightModel : type === 'right' ? customNormalDoubleLeftModel : null;
            const customNormalDoubleTexture = customNormalDoubleModel?.textures?.['0'] || customNormalDoubleModel?.texture;
            const isCustomNormalDoubleChest = normalizedBlockId === 'chest' && (type === 'left' || type === 'right') && customNormalDoubleModel?.geometry && customNormalDoubleTexture;
            const doubleChestVariantBase = normalizedBlockId === 'trapped_chest' ? 'trapped' : copperChestTextureFiles.get(normalizedBlockId);
            const doubleChestVariantPair = doubleChestVariantBase ? customDoubleChestVariantModels.get(doubleChestVariantBase) : null;
            const customDoubleVariantModel = type === 'left' ? doubleChestVariantPair?.right : type === 'right' ? doubleChestVariantPair?.left : null;
            const customDoubleVariantTexture = customDoubleVariantModel?.textures?.['0'] || customDoubleVariantModel?.texture;
            const isCustomDoubleVariantChest = (normalizedBlockId === 'trapped_chest' || copperChestTextureFiles.has(normalizedBlockId))
                && (type === 'left' || type === 'right') && customDoubleVariantModel?.geometry && customDoubleVariantTexture;
            const customEnderTexture = customEnderChestModel?.textures?.['0'] || customEnderChestModel?.texture;
            const isCustomEnderSingleChest = normalizedBlockId === 'ender_chest' && type === 'single' && customEnderChestModel?.geometry && customEnderTexture;
            const trappedTexture = customTrappedChestModel?.textures?.['0'] || customTrappedChestModel?.texture;
            const isCustomTrappedSingleChest = normalizedBlockId === 'trapped_chest' && type === 'single' && customTrappedChestModel?.geometry && trappedTexture;
            const copperTexture = copperChestTextureFiles.get(normalizedBlockId);
            const isCustomCopperSingleChest = copperChestTextureFiles.has(normalizedBlockId) && type === 'single' && customCopperChestModel?.geometry && copperTexture;
            if (isCustomNormalDoubleChest) {
                const texturePath = `${JAVA_ASSETS_BASE}textures/${customNormalDoubleTexture.replace(/^minecraft:/, '')}.png`;
                material = getCachedMaterial(getChestAtlasTexture(texturePath), false, false, false);
            } else if (isCustomDoubleVariantChest) {
                const texturePath = `${JAVA_ASSETS_BASE}textures/${customDoubleVariantTexture.replace(/^minecraft:/, '')}.png`;
                material = getCachedMaterial(getChestAtlasTexture(texturePath), false, false, false);
            } else if (isCustomNormalSingleChest) {
                const texturePath = `${JAVA_ASSETS_BASE}textures/${customTexture.replace(/^minecraft:/, '')}.png`;
                material = getCachedMaterial(getChestAtlasTexture(texturePath), false, false, false);
            } else if (isCustomEnderSingleChest) {
                const texturePath = `${JAVA_ASSETS_BASE}textures/${customEnderTexture.replace(/^minecraft:/, '')}.png`;
                material = getCachedMaterial(getChestAtlasTexture(texturePath), false, false, false);
            } else if (isCustomTrappedSingleChest) {
                const texturePath = `${JAVA_ASSETS_BASE}textures/${trappedTexture.replace(/^minecraft:/, '')}.png`;
                material = getCachedMaterial(getChestAtlasTexture(texturePath), false, false, false);
            } else if (isCustomCopperSingleChest) {
                const texturePath = `${JAVA_ASSETS_BASE}textures/entity/chest/${copperTexture}.png`;
                material = getCachedMaterial(getChestAtlasTexture(texturePath), false, false, false);
            } else {
                const chestData = resolveChestData(blockName, type, getBlockTexture, getCachedMaterial);
                material = chestData.material;
            }
        } else if (normalizedBlockId === 'grass_block') {
            const grassSideMaterial = getCachedMaterial(texSide, false, false, false);
            const grassTopMaterial = getCachedMaterial(texTop, false, false, false).clone();
            grassTopMaterial.color.setHex(GRASS_BLOCK_PLAINS_TINT);
            material = [
                grassSideMaterial,
                grassSideMaterial,
                grassTopMaterial,
                getCachedMaterial(texBottom, false, false, false),
                grassSideMaterial,
                grassSideMaterial
            ];

            if (!grassSideOverlayMaterial) {
                grassSideOverlayMaterial = getCachedMaterial(
                    getBlockTexture('grass_block_side_overlay', 'side'),
                    false,
                    false,
                    false,
                    true
                ).clone();
                grassSideOverlayMaterial.color.setHex(GRASS_BLOCK_PLAINS_TINT);
            }
        } else {
            material = [
                getCachedMaterial(texSide, isLeaves, isGlass, isDoubleSided),
                getCachedMaterial(texSide, isLeaves, isGlass, isDoubleSided),
                getCachedMaterial(texTop, isLeaves, isGlass, isDoubleSided),
                getCachedMaterial(texBottom, isLeaves, isGlass, isDoubleSided),
                getCachedMaterial(blockName.includes('chest') || blockName.includes('chiseled_bookshelf') ? texFront : texSide, isLeaves, isGlass, isDoubleSided),
                getCachedMaterial(texSide, isLeaves, isGlass, isDoubleSided)
            ];
        }
        
        const instancedMesh = new THREE.InstancedMesh(activeGeometry, material, blocksList.length);
        instancedMesh.userData = { blockName, blocksList };

        for (let i = 0; i < blocksList.length; i++) {
            const b = blocksList[i];
            dummy.position.set(b.x + offsetX, b.y, b.z + offsetZ);
            dummy.rotation.set(0, 0, 0);
            dummy.rotation.order = 'XYZ';
            dummy.scale.set(1, 1, 1);

            const blockFamily = getBlockDefinition(b.blockName).family;
            const isTrapdoor = blockFamily === 'trapdoor';
            const isStairs = blockFamily === 'stairs';
            const isSlab = blockFamily === 'slab';

            if (b.axis) {
                if (b.axis === 'x') dummy.rotation.z = -Math.PI / 2;
                else if (b.axis === 'z') dummy.rotation.x = Math.PI / 2;
            }

            // Estos son los cambios que hice, att. ChatGPT: restauro el giro previo; la unión de esquina se resuelve con shape y sus vecinos.
            if (b.facing && !getConnectedBlockKind(b.blockName)) {
                if (b.facing === 'up') {
                    dummy.rotation.x = -Math.PI / 2;
                } else if (b.facing === 'down') {
                    dummy.rotation.x = Math.PI / 2;
                } else {
                    let rotY = 0;
                    if (b.facing === 'south') rotY = 0;
                    else if (b.facing === 'west') rotY = -Math.PI / 2;
                    else if (b.facing === 'north') rotY = Math.PI;
                    else if (b.facing === 'east') rotY = Math.PI / 2;

                    dummy.rotation.y = rotY;
                }
            }

            const isTopSlab = isSlab && (b.type === 'top' || b.half === 'top');
            const isTopStairs = isStairs && b.half === 'top';
            if (isTopSlab || isTopStairs) {
                dummy.scale.y = -1;
            }

            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }

        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.geometry.computeBoundingSphere();
        instancedMeshesGroup.add(instancedMesh);
        if (normalizedBlockId === 'grass_block' && grassSideOverlayMaterial) {
            const overlayMesh = new THREE.InstancedMesh(grassSideOverlayGeometry, grassSideOverlayMaterial, blocksList.length);
            const instanceMatrix = new THREE.Matrix4();
            for (let i = 0; i < blocksList.length; i++) {
                instancedMesh.getMatrixAt(i, instanceMatrix);
                overlayMesh.setMatrixAt(i, instanceMatrix);
            }
            overlayMesh.instanceMatrix.needsUpdate = true;
            overlayMesh.geometry.computeBoundingSphere();
            instancedMeshesGroup.add(overlayMesh);
        }
        if (isCauldron && (normalizedBlockId === 'lava_cauldron' || normalizedBlockId === 'water_cauldron' || normalizedBlockId === 'powder_snow_cauldron')) {
            // Estos son los cambios que hice, att. ChatGPT: muestra el contenido hasta el nivel indicado dentro del hueco del caldero.
            const fillLevel = normalizedBlockId === 'lava_cauldron'
                ? 3
                : Math.max(1, Math.min(3, Number(cauldronLevel) || 1));
            const liquidGeometry = new THREE.PlaneGeometry(12 / 16, 12 / 16);
            const liquidUvs = liquidGeometry.attributes.uv.array;
            [2 / 16, 14 / 16, 14 / 16, 14 / 16, 2 / 16, 2 / 16, 14 / 16, 2 / 16]
                .forEach((value, index) => { liquidUvs[index] = value; });
            liquidGeometry.attributes.uv.needsUpdate = true;
            liquidGeometry.rotateX(-Math.PI / 2);
            const liquidTextureName = normalizedBlockId === 'lava_cauldron'
                ? 'lava_still'
                : normalizedBlockId === 'water_cauldron' ? 'water_still' : 'powder_snow';
            const liquidTexture = getBlockTexture(liquidTextureName, 'side');
            if (liquidTextureName === 'lava_still' || liquidTextureName === 'water_still') {
                // Estos son los cambios que hice, att. ChatGPT: muestra solo el primer cuadro de las tiras animadas de agua y lava para evitar franjas repetidas.
                const frameCount = liquidTextureName === 'lava_still' ? 20 : 32;
                liquidTexture.repeat.set(1, 1 / frameCount);
                liquidTexture.offset.set(0, 0);
                liquidTexture.needsUpdate = true;
            }
            const liquidMaterial = getCachedMaterial(
                liquidTexture,
                false,
                normalizedBlockId === 'water_cauldron',
                true
            );
            const liquidMesh = new THREE.InstancedMesh(liquidGeometry, liquidMaterial, blocksList.length);
            liquidMesh.userData = { blockName, blocksList };
            const liquidY = -0.5 + (4 + (fillLevel / 3) * 8) / 16;
            for (let i = 0; i < blocksList.length; i++) {
                const block = blocksList[i];
                dummy.position.set(block.x + offsetX, block.y + liquidY, block.z + offsetZ);
                dummy.rotation.set(0, 0, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                liquidMesh.setMatrixAt(i, dummy.matrix);
            }
            liquidMesh.instanceMatrix.needsUpdate = true;
            liquidMesh.geometry.computeBoundingSphere();
            instancedMeshesGroup.add(liquidMesh);
        }
    });
}

// --- LÓGICA DE CONTROL DE CAPA Y ---
const btnLayerMinus = document.getElementById('btnLayerMinus');
const btnLayerPlus = document.getElementById('btnLayerPlus');

let layerFramePending = false;

function updateLayerUI() {
    if (!layerSlider) return;
    const val = layerSlider.value;
    if (layerVal) layerVal.textContent = `${parseInt(val) + 1}/${maxDimensions.y}`;

    if (!layerFramePending) {
        layerFramePending = true;
        requestAnimationFrame(() => {
            renderBlocksInstanced();
            layerFramePending = false;
        });
    }
}

if (layerSlider) {
    layerSlider.addEventListener('input', updateLayerUI);
}

if (btnLayerMinus && layerSlider) {
    btnLayerMinus.addEventListener('click', () => {
        if (layerSlider.disabled) return;
        let current = parseInt(layerSlider.value, 10);
        const min = parseInt(layerSlider.min, 10) || 0;
        if (current > min) {
            layerSlider.value = current - 1;
            updateLayerUI();
        }
    });
}

if (btnLayerPlus && layerSlider) {
    btnLayerPlus.addEventListener('click', () => {
        if (layerSlider.disabled) return;
        let current = parseInt(layerSlider.value, 10);
        const max = parseInt(layerSlider.max, 10) || 0;
        if (current < max) {
            layerSlider.value = current + 1;
            updateLayerUI();
        }
    });
}

if (toggleGrid) {
    toggleGrid.addEventListener('change', (e) => {
        if (gridHelper) gridHelper.visible = e.target.checked;
        saveBooleanSetting(SETTINGS_STORAGE_KEYS.grid, e.target.checked);
    });
}

function syncViewerSettingsFromStorage() {
    if (showFpsToggle) showFpsToggle.checked = loadBooleanSetting(SETTINGS_STORAGE_KEYS.showFps);
    if (fpsDisplay) fpsDisplay.hidden = !showFpsToggle?.checked;
    if (soloLeftToggle) soloLeftToggle.checked = loadBooleanSetting(SETTINGS_STORAGE_KEYS.soloLeft);
    if (soloRightToggle) soloRightToggle.checked = loadBooleanSetting(SETTINGS_STORAGE_KEYS.soloRight);
    if (toggleGrid) toggleGrid.checked = loadBooleanSetting(SETTINGS_STORAGE_KEYS.grid, true);
    if (gridHelper && toggleGrid) gridHelper.visible = toggleGrid.checked;
    renderWithDoubleBlockFilters();
}

window.addEventListener('mc-viewer-preferences-reset', syncViewerSettingsFromStorage);
window.addEventListener('mc-viewer-remember-work-change', event => {
    if (!event.detail?.enabled) {
        syncViewerSettingsFromStorage();
        return;
    }
    saveBooleanSetting(SETTINGS_STORAGE_KEYS.showFps, Boolean(showFpsToggle?.checked));
    saveBooleanSetting(SETTINGS_STORAGE_KEYS.soloLeft, Boolean(soloLeftToggle?.checked));
    saveBooleanSetting(SETTINGS_STORAGE_KEYS.soloRight, Boolean(soloRightToggle?.checked));
    saveBooleanSetting(SETTINGS_STORAGE_KEYS.grid, Boolean(toggleGrid?.checked));
});
window.addEventListener('storage', event => {
    if (Object.values(SETTINGS_STORAGE_KEYS).includes(event.key) || event.key === REMEMBER_WORK_STORAGE_KEY) syncViewerSettingsFromStorage();
});

function updatePaletteUI(palette) {
    if (!paletteListEl) return;
    paletteListEl.innerHTML = '';
    Object.entries(palette).forEach(([block, count]) => {
        const item = document.createElement('div');
        item.className = 'palette-item';
        item.innerHTML = `
            <span>${getSpanishBlockName(block)}</span>
            <strong>x${count}</strong>
        `;
        paletteListEl.appendChild(item);
    });
}

// --- INSPECTOR DE BLOQUES AL HACER CLIC ---
const raycaster = new THREE.Raycaster();
const mouseVector = new THREE.Vector2();

if (canvasContainer) {
    canvasContainer.addEventListener('click', (event) => {
        if (!camera || !instancedMeshesGroup) return;

        const rect = canvasContainer.getBoundingClientRect();
        mouseVector.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseVector.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouseVector, camera);
        const intersects = raycaster.intersectObjects(instancedMeshesGroup.children);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const mesh = hit.object;
            const instanceId = hit.instanceId;

            if (mesh.userData && mesh.userData.blocksList && instanceId !== undefined) {
                const block = mesh.userData.blocksList[instanceId];
                if (block && block.blockName) {
                    showBlockInfoCard(block.blockName);
                }
            }
        }
    });
}

function showBlockInfoCard(blockName) {
    const card = document.getElementById('blockInfoCard');
    const titleEl = document.getElementById('blockInfoTitle');
    const idEl = document.getElementById('blockInfoId');
    const imgEl = document.getElementById('blockInfoImg');

    if (!card) return;

    titleEl.textContent = getSpanishBlockName(blockName);

    const cleanId = blockName.replace('minecraft:', '');
    idEl.textContent = `minecraft:${cleanId}`;

    imgEl.onerror = () => {
        if (typeof canvasFallback !== 'undefined') {
            imgEl.src = canvasFallback.toDataURL();
        }
    };

    const texUrl = resolveJavaTexturePath(blockName, 'side');
    const resolvedTexUrl = texUrl || `${TEXTURE_BASE_URL}${blockName}.png`;
    imgEl.src = findLocalResourcePackTexture(resolvedTexUrl) || resolvedTexUrl;

    card.classList.remove('hidden');
}

const closeBlockBtn = document.getElementById('closeBlockInfo');
if (closeBlockBtn) {
    closeBlockBtn.addEventListener('click', () => {
        const card = document.getElementById('blockInfoCard');
        if (card) card.classList.add('hidden');
    });
}

// --- NAVEGACIÓN A LA PÁGINA INDEPENDIENTE DE MATERIALES ---
const openMaterialsPageBtn = document.getElementById('openMaterialsPageBtn');

if (openMaterialsPageBtn) {
    openMaterialsPageBtn.addEventListener('click', () => {
        if (!loadedBlocksData || loadedBlocksData.length === 0) {
            alert("Primero debes cargar una estructura .schem o .litematic.");
            return;
        }

        const counts = {};
        loadedBlocksData.forEach(b => {
            counts[b.blockName] = (counts[b.blockName] || 0) + 1;
        });

        const dataToExport = {
            fileName: fileNameEl ? fileNameEl.textContent : 'Estructura',
            dimensions: fileDimensionsEl ? fileDimensionsEl.textContent : '0x0x0',
            totalBlocks: fileBlocksEl ? fileBlocksEl.textContent : '0',
            palette: counts,
            blocks: loadedBlocksData
        };

        const transferId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const targetOrigin = window.location.origin === 'null' ? '*' : window.location.origin;
        let materialsWindow = null;
        const handleMaterialsWindowMessage = (event) => {
            if (event.source !== materialsWindow || event.data?.type !== 'mc-materials-ready' || event.data.transferId !== transferId) return;
            if (targetOrigin !== '*' && event.origin !== targetOrigin) return;

            materialsWindow.postMessage({
                type: 'mc-structure-materials-data',
                transferId,
                data: dataToExport
            }, targetOrigin);
            window.removeEventListener('message', handleMaterialsWindowMessage);
        };

        window.addEventListener('message', handleMaterialsWindowMessage);
        materialsWindow = window.open(`materials.html#transfer=${encodeURIComponent(transferId)}`, '_blank');
        if (!materialsWindow) {
            window.removeEventListener('message', handleMaterialsWindowMessage);
            alert('Permite las ventanas emergentes para abrir la lista de materiales.');
        }
    });
}




// Abre directamente desde la biblioteca privada cuando se llega con ?structure=<id>.
(async function loadSavedStructureFromAccount() {
    const structureId = new URLSearchParams(window.location.search).get('structure');
    if (!structureId) return;

    try {
        const response = await fetch('/api/structures/' + encodeURIComponent(structureId) + '/download', { credentials: 'same-origin' });
        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            alert(result.error || 'No se pudo abrir esta estructura.');
            if (response.status === 401) window.location.href = 'index.html#cuenta';
            return;
        }
        const encodedName = response.headers.get('X-File-Name') || 'estructura.schem';
        const fileName = decodeURIComponent(encodedName);
        const structureBlob = await response.blob();
        handleFile(new File([structureBlob], fileName, { type: 'application/octet-stream' }));
    } catch (error) {
        console.error('No se pudo cargar la estructura guardada:', error);
        alert('No se pudo conectar con la biblioteca. Comprueba que el servidor esté activo.');
    }
})();



