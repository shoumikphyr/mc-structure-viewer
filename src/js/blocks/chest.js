/* Java 1.21 chest meshes and atlas UVs. */
const CHEST_RESOURCE_BASE = './assets/minecraft-java-assets-26.3/assets/minecraft/textures/';
const chestFaceTextureCache = {};

function createChestFallbackCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#6f472b';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#4b2d1a';
    ctx.fillRect(1, 1, 62, 62);
    ctx.fillStyle = '#9a7046';
    ctx.fillRect(8, 8, 48, 48);
    return canvas;
}

function getChestAtlasTexture(texturePath) {
    if (chestFaceTextureCache[texturePath]) return chestFaceTextureCache[texturePath];

    const texture = new THREE.Texture(createChestFallbackCanvas());
    texture.encoding = THREE.sRGBEncoding;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    chestFaceTextureCache[texturePath] = texture;

    const image = new Image();
    image.onload = () => {
        texture.image = image;
        texture.needsUpdate = true;
    };
    image.src = (typeof findLocalResourcePackTexture === 'function' && findLocalResourcePackTexture(texturePath)) || texturePath;
    return texture;
}

function chestUvRect(x0, y0, x1, y1) {
    return { x0, y0, x1, y1 };
}

function getChestBoxUvRects(width, height, depth, u = 0, v = 0) {
    return {
        left: chestUvRect(u, v + depth, u + depth, v + depth + height),
        front: chestUvRect(u + depth, v + depth, u + depth + width, v + depth + height),
        right: chestUvRect(u + depth + width, v + depth, u + 2 * depth + width, v + depth + height),
        back: chestUvRect(u + 2 * depth + width, v + depth, u + 2 * depth + 2 * width, v + depth + height),
        top: chestUvRect(u + depth, v, u + depth + width, v + depth),
        bottom: chestUvRect(u + depth + width, v, u + depth + 2 * width, v + depth)
    };
}

function chestUv(pixelX, pixelY) {
    return [pixelX / 64, 1 - pixelY / 64];
}

function createChestGeometry(isDouble = false, isLeft = false, isEnder = false) {
    const positions = [];
    const uvs = [];
    const indices = [];
    const sideStart = isDouble ? (isLeft ? 1 : 0) : 1;
    const sideEnd = sideStart + (isDouble ? 15 : 14);

    function addFace(points, rect, uvCorners) {
        const start = positions.length / 3;
        for (let i = 0; i < 4; i++) {
            positions.push(points[i][0], points[i][1], points[i][2]);
            const pixelUv = [
                [rect.x0, rect.y0],
                [rect.x1, rect.y0],
                [rect.x1, rect.y1],
                [rect.x0, rect.y1]
            ][uvCorners[i]];
            uvs.push(...chestUv(pixelUv[0], pixelUv[1]));
        }
        indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }

    function addBox(x0, x1, y0, y1, z0, z1, textureU, textureV, swapFrontBack = false) {
        const width = x1 - x0;
        const height = y1 - y0;
        const depth = z1 - z0;
        const rect = getChestBoxUvRects(width, height, depth, textureU, textureV);
        const px = value => (value - 8) / 16;
        const py = value => (value - 8) / 16;
        const pz = value => (8 - value) / 16;
        const left = px(x0), right = px(x1);
        const bottom = py(y0), top = py(y1);
        const front = pz(z0), back = pz(z1);
        // Front is the chest face at model z=0; atlas rows stay top-to-bottom.

        const frontRect = swapFrontBack ? rect.back : rect.front;
        const backRect = swapFrontBack ? rect.front : rect.back;

        const topRect = swapFrontBack ? rect.bottom : rect.top;
        const bottomRect = swapFrontBack ? rect.top : rect.bottom;

        addFace([[left, bottom, front], [right, bottom, front], [right, top, front], [left, top, front]], frontRect, [3, 2, 1, 0]);
        addFace([[right, bottom, back], [left, bottom, back], [left, top, back], [right, top, back]], backRect, [3, 2, 1, 0]);
        addFace([[right, bottom, front], [right, bottom, back], [right, top, back], [right, top, front]], rect.right, [3, 2, 1, 0]);
        addFace([[left, bottom, back], [left, bottom, front], [left, top, front], [left, top, back]], rect.left, [3, 2, 1, 0]);
        addFace([[left, top, front], [right, top, front], [right, top, back], [left, top, back]], topRect, [3, 0, 1, 2]);
        addFace([[left, bottom, back], [right, bottom, back], [right, bottom, front], [left, bottom, front]], bottomRect, [0, 1, 2, 3]);
    }

    // Vanilla chest: 14x10x14 body, 14x5x14 lid and the small front latch.
    addBox(sideStart, sideEnd, 0, 10, 1, 15, 0, 19, isEnder);
    addBox(sideStart, sideEnd, 9, 14, 1, 15, 0, 0, isEnder);

    if (!isDouble) {
        addBox(7, 9, 7, 11, 0, 1, 0, 0);
    } else if (isLeft) {
        // The left half's latch pixel sits on the inner edge next to its right half.
        addBox(sideStart, sideStart + 1, 7, 11, 0, 1, 0, 0);
    } else {
        // The right half completes that latch on its own inner edge.
        addBox(sideEnd - 1, sideEnd, 7, 11, 0, 1, 0, 0);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
}

const singleChestGeo = createChestGeometry(false, false);
const singleEnderChestGeo = createChestGeometry(false, false, true);
const doubleChestLeftGeo = createChestGeometry(true, true);
const doubleChestRightGeo = createChestGeometry(true, false);

function autoDetectDoubleChests(blocksList) {
    if (!blocksList || !blocksList.length) return;
    const eligible = new Set([
        'chest',
        'trapped_chest',
        'copper_chest',
        'exposed_copper_chest',
        'weathered_copper_chest',
        'oxidized_copper_chest',
        'waxed_copper_chest',
        'waxed_exposed_copper_chest',
        'waxed_weathered_copper_chest',
        'waxed_oxidized_copper_chest'
    ]);
    const blockMap = new Map();
    const paired = new Set();
    const chestBlocks = blocksList.filter(block => {
        const id = block.blockName.replace('minecraft:', '').toLowerCase().trim();
        if (!eligible.has(id)) return false;
        blockMap.set([block.x, block.y, block.z].join(','), block);
        return true;
    });
    const leftOffsets = {
        north: [1, 0, 0], south: [-1, 0, 0], east: [0, 0, 1], west: [0, 0, -1]
    };

    chestBlocks.forEach(block => {
        const key = [block.x, block.y, block.z].join(',');
        if (paired.has(key)) return;
        const facing = block.facing || 'north';
        const leftOffset = leftOffsets[facing] || leftOffsets.north;
        const rightOffset = leftOffset.map(value => -value);
        const neighbors = [
            { offset: leftOffset, type: 'right' },
            { offset: rightOffset, type: 'left' }
        ];
        const id = block.blockName.replace('minecraft:', '').toLowerCase().trim();
        const match = neighbors.map(({ offset, type }) => {
            const [dx, dy, dz] = offset;
            const otherKey = [block.x + dx, block.y + dy, block.z + dz].join(',');
            return { other: blockMap.get(otherKey), otherKey, type };
        }).find(({ other, otherKey }) => {
            return other && !paired.has(otherKey) &&
                other.blockName.replace('minecraft:', '').toLowerCase().trim() === id &&
                !(block._sourceTypeExplicit && block.type === 'single') &&
                !(other._sourceTypeExplicit && other.type === 'single') &&
                (other.facing || 'north') === facing;
        });

        if (!match) {
            block.type = 'single';
            return;
        }

        const explicitType = block.type === 'left' || block.type === 'right' ? block.type : null;
        const side = explicitType || match.type;
        block.type = side;
        match.other.type = side === 'left' ? 'right' : 'left';
        paired.add(key);
        paired.add(match.otherKey);
    });
}

function resolveChestData(blockName, type, getBlockTextureFunc, getCachedMaterialFunc) {
    const cleanName = blockName.replace('minecraft:', '').toLowerCase().trim();
    const isDouble = !cleanName.includes('ender') && (type === 'left' || type === 'right');
    const isLeft = type === 'left';
    let textureFileName;
    if (cleanName.includes('ender')) {
        textureFileName = 'ender.png';
    } else if (cleanName.includes('trapped')) {
        textureFileName = isDouble ? (isLeft ? 'trapped_left.png' : 'trapped_right.png') : 'trapped.png';
    } else {
        const copperTextureBaseById = {
            copper_chest: 'copper',
            exposed_copper_chest: 'copper_exposed',
            weathered_copper_chest: 'copper_weathered',
            oxidized_copper_chest: 'copper_oxidized',
            waxed_copper_chest: 'copper',
            waxed_exposed_copper_chest: 'copper_exposed',
            waxed_weathered_copper_chest: 'copper_weathered',
            waxed_oxidized_copper_chest: 'copper_oxidized'
        };
        const copperTextureBase = copperTextureBaseById[cleanName];
        textureFileName = copperTextureBase
            ? `${copperTextureBase}${isDouble ? (isLeft ? '_left' : '_right') : ''}.png`
            : (isDouble ? (isLeft ? 'normal_left.png' : 'normal_right.png') : 'normal.png');
    }

    const texturePath = CHEST_RESOURCE_BASE + 'entity/chest/' + textureFileName;
    const geometry = isDouble
        ? (isLeft ? doubleChestLeftGeo : doubleChestRightGeo)
        : (cleanName.includes('ender') ? singleEnderChestGeo : singleChestGeo);
    const atlas = getChestAtlasTexture(texturePath);
    return { geometry, material: getCachedMaterialFunc(atlas, false, false, false) };
}


