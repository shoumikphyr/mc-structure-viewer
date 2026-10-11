// Estos son los cambios que hice, att. ChatGPT: limita el idioma al espanol o al ingles preferido del dispositivo.
const preferredLanguages = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
    navigator.userLanguage
].filter(Boolean).map(language => language.toLowerCase());
const selectedLanguage = preferredLanguages.find(language => language.startsWith('es') || language.startsWith('en')) || 'en';
const currentLang = selectedLanguage.startsWith('es') ? 'es' : 'en';

const i18n = {
    es: {
        pageTitle: 'Lista de Materiales - MC Viewer', headerTitle: 'Lista de Materiales',
        dimensions: 'Dimensiones', totalBlocks: 'Total de Bloques',
        plansButton: 'Planos / Visor 3D', printPlansButton: 'Descargar Planos (Capas)',
        exportButton: 'Descargar Lista', searchPlaceholder: 'Buscar bloque o ID (ej. Oak, Stone, Glass)...',
        noData: 'No hay informaci\u00f3n de estructura cargada. Regresa a la p\u00e1gina principal y abre una estructura primero.',
        noResults: 'No se encontraron bloques con ese nombre.',
        exportProgress: 'Generando PDF...', plansProgress: 'GENERANDO PLANOS EN ALTA RESOLUCI\u00d3N...',
        pdfDimensions: 'Dimensiones', pdfTotal: 'Total de Bloques', pdfFile: 'Archivo', pdfBlocks: 'Bloques',
        pdfPlan: 'Plano de Construcci\u00f3n - Capa Y =', plansSuffix: 'planos_capas_2D', materialsSuffix: 'materiales',
        noLayerData: "No se encontraron datos por capas. Vuelve a cargar la estructura en el visor 3D y presiona 'Abrir Lista Completa'.",
        pdfUnavailable: 'La librer\u00eda jsPDF no est\u00e1 disponible.',
        renderError: 'Ocurri\u00f3 un error renderizando los planos 2D.'
    },
    en: {
        pageTitle: 'Materials List - MC Viewer', headerTitle: 'Materials List',
        dimensions: 'Dimensions', totalBlocks: 'Total Blocks',
        plansButton: 'Plans / 3D Viewer', printPlansButton: 'Download Plans (Layers)',
        exportButton: 'Download List', searchPlaceholder: 'Search block or ID (e.g., Oak, Stone, Glass)...',
        noData: 'No structure data loaded. Return to the main page and load a structure first.',
        noResults: 'No blocks found with that name.',
        exportProgress: 'Generating PDF...', plansProgress: 'GENERATING HIGH-RESOLUTION PLANS...',
        pdfDimensions: 'Dimensions', pdfTotal: 'Total Blocks', pdfFile: 'File', pdfBlocks: 'Blocks',
        pdfPlan: 'Construction Plan - Layer Y =', plansSuffix: 'plans_layers_2D', materialsSuffix: 'materials',
        noLayerData: "No layer data found. Reload the structure in the 3D viewer and choose 'Open Full List'.",
        pdfUnavailable: 'The jsPDF library is unavailable.',
        renderError: 'An error occurred while rendering the 2D plans.'
    }
};
const t = i18n[currentLang];

// Estos son los cambios que hice, att. ChatGPT: usa texturas vanilla locales del cliente oficial Minecraft Java 1.21.7.
const JAVA_TEXTURE_BASE = './assets/minecraft-java-1.21.7/assets/minecraft/textures/';

function createMissingTextureCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillRect(8, 8, 8, 8);
    return canvas;
}

const MISSING_TEXTURE_DATA_URL = createMissingTextureCanvas().toDataURL('image/png');
const JAVA_TEXTURE_ALIASES = {
    grass_block: ['block/grass_block_top.png'],
    dirt_path: ['block/dirt_path_top.png', 'block/dirt_path_side.png'],
    grass_path: ['block/dirt_path_top.png', 'block/dirt_path_side.png'],
    farmland: ['block/farmland.png'],
    stone_brick: ['block/stone_bricks.png'],
    mossy_stone_brick: ['block/mossy_stone_bricks.png'],
    cracked_stone_brick: ['block/cracked_stone_bricks.png'],
    chiseled_stone_brick: ['block/chiseled_stone_bricks.png'],
    smooth_quartz: ['block/quartz_block_bottom.png'],
    quartz: ['block/quartz_block_top.png'],
    chest: ['entity/chest/normal.png'],
    trapped_chest: ['entity/chest/trapped.png'],
    ender_chest: ['entity/chest/ender.png']
};
const BLOCK_VARIANT_SUFFIXES = [
    '_fence_gate', '_pressure_plate', '_hanging_sign', '_trapdoor', '_stairs',
    '_slab', '_wall', '_fence', '_button', '_door', '_sign', '_pane'
];

function cleanMaterialId(blockName) {
    return String(blockName).replace(/^minecraft:/, '').split('[')[0].toLowerCase().trim();
}

function getDisplayName(blockName) {
    const id = cleanMaterialId(blockName);
    return window.MC_BLOCK_NAMES?.[currentLang]?.[id] || id.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function getTextureCandidates(blockName) {
    const id = cleanMaterialId(blockName);
    const candidates = [];
    const add = path => candidates.push(`${JAVA_TEXTURE_BASE}${path}`);

    // Prioriza el sprite Java del inventario y usa la textura del bloque como respaldo vanilla.
    add(`item/${id}.png`);
    (JAVA_TEXTURE_ALIASES[id] || []).forEach(add);
    add(`block/${id}.png`);

    const suffix = BLOCK_VARIANT_SUFFIXES.find(value => id.endsWith(value));
    if (suffix) {
        const base = id.slice(0, -suffix.length);
        (JAVA_TEXTURE_ALIASES[base] || []).forEach(add);
        add(`block/${base}.png`);
        if (/^(oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|bamboo|crimson|warped)$/.test(base)) {
            add(`block/${base}_planks.png`);
        }
        if (base.endsWith('_brick')) add(`block/${base}s.png`);
    }

    return [...new Set(candidates)];
}

function loadBlockImage(blockName) {
    return new Promise(resolve => {
        const candidates = getTextureCandidates(blockName);
        const tryLoad = index => {
            if (index >= candidates.length) {
                const fallbackImg = new Image();
                fallbackImg.onload = () => resolve({ img: fallbackImg, ok: false });
                fallbackImg.src = MISSING_TEXTURE_DATA_URL;
                return;
            }
            const img = new Image();
            img.onload = () => resolve({ img, ok: true });
            img.onerror = () => tryLoad(index + 1);
            img.src = candidates[index];
        };
        tryLoad(0);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Estos son los cambios que hice, att. ChatGPT: traduce toda la interfaz y conserva el idioma elegido del dispositivo.
    document.documentElement.lang = currentLang;
    document.title = t.pageTitle;

    const plansButton = document.getElementById('btnPlanos');
    const printPlansButton = document.getElementById('btnPrintPlanos');
    const exportButton = document.getElementById('btnExportar');
    if (plansButton) plansButton.textContent = t.plansButton;
    if (printPlansButton) printPlansButton.textContent = t.printPlansButton;
    if (exportButton) exportButton.textContent = t.exportButton;
    
    const searchInput = document.getElementById('searchInput');
    const labelDimEl = document.getElementById('labelDimensions');
    const labelTotalEl = document.getElementById('labelTotalBlocks');

    if (searchInput) searchInput.placeholder = t.searchPlaceholder;
    if (labelDimEl) labelDimEl.textContent = t.dimensions;
    if (labelTotalEl) labelTotalEl.textContent = t.totalBlocks;

    const gridEl = document.getElementById('materialsGrid');

    function initializeMaterialsPage(data) {
    if (!data) {
        if (gridEl) gridEl.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">${t.noData}</p>`;
        return;
    }

    const fileNameHeader = document.getElementById('matFileName');
    const dimValEl = document.getElementById('matDimensions');
    const totalValEl = document.getElementById('matTotalBlocks');

    if (fileNameHeader) fileNameHeader.textContent = `${t.headerTitle}: ${data.fileName}`;
    if (dimValEl) dimValEl.textContent = data.dimensions;
    if (totalValEl) totalValEl.textContent = Number(data.totalBlocks).toLocaleString(currentLang === 'es' ? 'es-ES' : 'en-US');

    const entries = Object.entries(data.palette).sort((a, b) => b[1] - a[1]);

    function renderList(filterText = '') {
        gridEl.innerHTML = '';

        const normalizedFilter = filterText.toLowerCase();
        const filtered = entries.filter(([blockName]) => {
            const localizedName = getDisplayName(blockName).toLowerCase();
            return blockName.toLowerCase().includes(normalizedFilter) ||
                blockName.replace(/_/g, ' ').toLowerCase().includes(normalizedFilter) ||
                localizedName.includes(normalizedFilter);
        });

        if (filtered.length === 0) {
            gridEl.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">${t.noResults}</p>`;
            return;
        }

        filtered.forEach(([blockName, count]) => {
            const formattedTitle = getDisplayName(blockName);

            const card = document.createElement('div');
            card.className = 'material-card';

            card.innerHTML = `
                <div class="material-img-box">
                    <img alt="${formattedTitle}">
                </div>
                <div class="material-meta">
                    <h3>${formattedTitle}</h3>
                    <span>minecraft:${blockName}</span>
                </div>
                <div class="material-count">x${count.toLocaleString()}</div>
            `;

            const icon = card.querySelector('img');
            const textureCandidates = getTextureCandidates(blockName);
            let candidateIndex = 0;
            icon.onerror = () => {
                candidateIndex++;
                if (candidateIndex < textureCandidates.length) {
                    icon.src = textureCandidates[candidateIndex];
                } else {
                    icon.onerror = null;
                    icon.src = MISSING_TEXTURE_DATA_URL;
                }
            };
            icon.src = textureCandidates[0];

            gridEl.appendChild(card);
        });
    }

    renderList();

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderList(e.target.value);
        });
    }

    // --- 3. BOTÓN DESCARGAR LISTA EN PDF ---
    const btnExportar = document.getElementById('btnExportar');
    if (btnExportar) {
        btnExportar.onclick = async (e) => {
            e.preventDefault();

            if (typeof window.jspdf === 'undefined') {
                alert(t.pdfUnavailable);
                return;
            }

            const origText = btnExportar.textContent;
            btnExportar.textContent = t.exportProgress;
            btnExportar.disabled = true;

            try {
                const imageMap = {};
                for (const [blockName] of entries) {
                    const res = await loadBlockImage(blockName);
                    imageMap[blockName] = res.img;
                }

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();

                const headerTitle = fileNameHeader ? fileNameHeader.textContent : t.headerTitle;
                const dimensionsStr = dimValEl ? dimValEl.textContent : '0x0x0';
                const totalBlocksStr = totalValEl ? totalValEl.textContent : '0';

                doc.setFont("helvetica", "bold");
                doc.setFontSize(16);
                doc.text(headerTitle, 14, 20);

                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.text(`${t.pdfDimensions}: ${dimensionsStr} | ${t.pdfTotal}: ${Number(totalBlocksStr).toLocaleString(currentLang === 'es' ? 'es-ES' : 'en-US')}`, 14, 28);
                doc.setDrawColor(200, 200, 200);
                doc.line(14, 32, 196, 32);

                let yPos = 42;
                const pageHeight = 275;

                entries.forEach(([blockName, count]) => {
                    if (yPos > pageHeight) {
                        doc.addPage();
                        yPos = 20;
                    }

                    const cleanTitle = blockName.replace(/_/g, ' ').toUpperCase();
                    const imgObj = imageMap[blockName];

                    if (imgObj) {
                        try {
                            const tmpCanvas = document.createElement('canvas');
                            tmpCanvas.width = 16;
                            tmpCanvas.height = 16;
                            const ctx = tmpCanvas.getContext('2d');
                            ctx.drawImage(imgObj, 0, 0, 16, 16);
                            doc.addImage(tmpCanvas.toDataURL('image/png'), 'PNG', 14, yPos - 5, 7, 7);
                        } catch (err) {}
                    }

                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(10);
                    doc.text(cleanTitle, 24, yPos);

                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(8);
                    doc.text(`minecraft:${blockName}`, 24, yPos + 4);

                    doc.setFontSize(10);
                    doc.text(`x${count.toLocaleString()}`, 160, yPos + 2);

                    doc.setDrawColor(230, 230, 230);
                    doc.line(14, yPos + 7, 196, yPos + 7);

                    yPos += 14;
                });

                const cleanFileName = (data.fileName || 'materiales').split('.')[0];
                doc.save(`${cleanFileName}_${t.materialsSuffix}.pdf`);
            } catch (err) {
                console.error(err);
            } finally {
                btnExportar.textContent = origText;
                btnExportar.disabled = false;
            }
        };
    }

    // --- 4. BOTÓN DESCARGAR PLANOS (ALTA RESOLUCIÓN Y PESO BALANCEADO <= 50MB) ---
    const btnPrintPlanos = document.getElementById('btnPrintPlanos');
    if (btnPrintPlanos) {
        btnPrintPlanos.onclick = async (e) => {
            e.preventDefault();

            if (!data.blocks || data.blocks.length === 0) {
                alert(t.noLayerData);
                return;
            }

            if (typeof window.jspdf === 'undefined') {
                alert(t.pdfUnavailable);
                return;
            }

            const origText = btnPrintPlanos.textContent;
            btnPrintPlanos.textContent = t.plansProgress;
            btnPrintPlanos.disabled = true;

            setTimeout(async () => {
                try {
                    let maxX = 0, maxZ = 0;
                    const layers = {};

                    data.blocks.forEach(b => {
                        if (b.x > maxX) maxX = b.x;
                        if (b.z > maxZ) maxZ = b.z;

                        const y = b.y;
                        if (!layers[y]) layers[y] = [];
                        layers[y].push(b);
                    });

                    maxX += 1;
                    maxZ += 1;

                    // Pre-cargar imágenes/texturas necesarias
                    const uniqueBlocks = [...new Set(data.blocks.map(b => b.blockName))];
                    const imageMap = {};
                    for (const bName of uniqueBlocks) {
                        const res = await loadBlockImage(bName);
                        imageMap[bName] = res.img;
                    }

                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF('p', 'mm', 'a4');
                    const sortedY = Object.keys(layers).map(Number).sort((a, b) => a - b);
                    const cleanFileName = (data.fileName || 'estructura').split('.')[0];

                    // RESOLUCIÓN AUMENTADA: Celdas entre 16px y 32px por bloque para máxima nitidez
                    const maxDim = Math.max(maxX, maxZ);
                    const tileSize = Math.min(32, Math.max(16, Math.floor(1600 / maxDim)));

                    for (let i = 0; i < sortedY.length; i++) {
                        const y = sortedY[i];
                        const layerBlocks = layers[y];

                        if (i > 0) doc.addPage();

                        // Encabezado del PDF
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(13);
                        doc.text(`${t.pdfPlan} ${y + 1}`, 14, 15);

                        doc.setFontSize(8);
                        doc.setFont("helvetica", "normal");
                        doc.text(`${t.pdfFile}: ${data.fileName} | ${t.pdfDimensions}: ${maxX}x${maxZ} | ${t.pdfBlocks}: ${layerBlocks.length}`, 14, 20);
                        doc.setDrawColor(200, 200, 200);
                        doc.line(14, 23, 196, 23);

                        // Crear Canvas 2D en alta resolución
                        const canvas = document.createElement('canvas');
                        canvas.width = maxX * tileSize;
                        canvas.height = maxZ * tileSize;
                        const ctx = canvas.getContext('2d', { alpha: false });
                        ctx.imageSmoothingEnabled = false; // Mantiene el pixel art nítido

                        // Fondo plano
                        const activeTheme = document.documentElement.dataset.theme;
                        ctx.fillStyle = activeTheme === 'light' ? '#f1f4f1' : activeTheme === 'admin' ? '#100e14' : '#171a18';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // Rejilla / Grid
                        ctx.strokeStyle = activeTheme === 'light' ? 'rgba(32, 39, 32, 0.2)' : 'rgba(255, 255, 255, 0.2)';
                        ctx.lineWidth = 1;
                        for (let x = 0; x <= maxX; x++) {
                            ctx.beginPath();
                            ctx.moveTo(x * tileSize, 0);
                            ctx.lineTo(x * tileSize, maxZ * tileSize);
                            ctx.stroke();
                        }
                        for (let z = 0; z <= maxZ; z++) {
                            ctx.beginPath();
                            ctx.moveTo(0, z * tileSize);
                            ctx.lineTo(maxX * tileSize, z * tileSize);
                            ctx.stroke();
                        }

                        // Dibujar bloques en la cuadrícula
                        layerBlocks.forEach(b => {
                            const img = imageMap[b.blockName];
                            const posX = b.x * tileSize;
                            const posZ = b.z * tileSize;

                            if (img) {
                                ctx.drawImage(img, posX, posZ, tileSize, tileSize);
                            }
                        });

                        // ALTA CALIDAD DE IMAGEN: Calidad 0.92 (92%)
                        const imgData = canvas.toDataURL('image/jpeg', 0.92);

                        const maxPdfWidth = 180;
                        const maxPdfHeight = 240;
                        const aspect = canvas.width / canvas.height;
                        let pdfW = maxPdfWidth;
                        let pdfH = maxPdfWidth / aspect;

                        if (pdfH > maxPdfHeight) {
                            pdfH = maxPdfHeight;
                            pdfW = maxPdfHeight * aspect;
                        }

                        const posX = (210 - pdfW) / 2;

                        doc.addImage(imgData, 'JPEG', posX, 26, pdfW, pdfH, undefined, 'SLOW');
                    } // Fin del ciclo for de capas

                    doc.save(`${cleanFileName}_${t.plansSuffix}.pdf`);
                } catch (err) {
                    console.error("Error al renderizar planos:", err);
                    alert(t.renderError);
                } finally {
                    btnPrintPlanos.textContent = origText;
                    btnPrintPlanos.disabled = false;
                }
            }, 50);
        };
    }
    }

    const transferId = new URLSearchParams(window.location.hash.slice(1)).get('transfer');
    if (transferId && window.opener) {
        const expectedOrigin = window.location.origin === 'null' ? 'null' : window.location.origin;
        window.addEventListener('message', (event) => {
            if (event.source !== window.opener || event.data?.type !== 'mc-structure-materials-data' || event.data.transferId !== transferId) return;
            if (expectedOrigin !== 'null' && event.origin !== expectedOrigin) return;
            initializeMaterialsPage(event.data.data);
        }, { once: true });

        window.opener.postMessage({ type: 'mc-materials-ready', transferId }, expectedOrigin === 'null' ? '*' : expectedOrigin);
    } else {
        initializeMaterialsPage(null);
    }
});
