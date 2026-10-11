// ============================================================
// CARGADOR DE MODELOS JSON PERSONALIZADOS DE BLOCKBENCH
// ============================================================

function createCustomModelGeometry(modelData) {
    if (!modelData || !Array.isArray(modelData.elements)) {
        console.warn('Modelo personalizado inválido: no contiene elements.');
        return null;
    }

    const positions = [];
    const uvs = [];
    const indices = [];
    let transformElementVertex = corner => corner;

    const addFace = (corners, uvRect, uvRotation = 0, uvOrder = [0, 1, 2, 3]) => {
        const start = positions.length / 3;

        for (const corner of corners) {
            const transformedCorner = transformElementVertex(corner);
            positions.push(transformedCorner[0], transformedCorner[1], transformedCorner[2]);
        }

        // Si el JSON no tiene UV, usamos una UV básica.
        const uv = uvRect || [0, 0, 16, 16];

        const u0 = uv[0] / 16;
        const v0 = 1 - (uv[1] / 16);
        const u1 = uv[2] / 16;
        const v1 = 1 - (uv[3] / 16);

        // Blockbench almacena la rotación de UV por cara en saltos de 90°.
        // Reordenamos las cuatro esquinas de la región UV sin cambiar sus límites.
        const uvCorners = [
            [u0, v1],
            [u1, v1],
            [u1, v0],
            [u0, v0]
        ];
        const turns = Math.round(((((Number(uvRotation) || 0) % 360) + 360) % 360) / 90);

        for (let i = 0; i < 4; i++) {
            const [u, v] = uvCorners[uvOrder[(i - turns + 4) % 4]];
            uvs.push(u, v);
        }

        indices.push(
            start,
            start + 1,
            start + 2,

            start,
            start + 2,
            start + 3
        );
    };

    for (const element of modelData.elements) {
        if (!element.from || !element.to || !element.faces) {
            continue;
        }

        const from = element.from;
        const to = element.to;

        // Minecraft usa un espacio de 16x16x16 por bloque.
        // Centramos el modelo para que:
        // X: -0.5 → 0.5
        // Y:  0   → 1
        // Z: -0.5 → 0.5
        const x0 = (from[0] - 8) / 16;
        const x1 = (to[0] - 8) / 16;

        const y0 = (from[1] - 8) / 16;
        const y1 = (to[1] - 8) / 16;

        const z0 = (from[2] - 8) / 16;
        const z1 = (to[2] - 8) / 16;

        const rotation = element.rotation;
        const rotationOrigin = rotation?.origin;
        let yRotation = 0;

        if (rotation?.axis?.toLowerCase() === 'y') {
            yRotation = Number(rotation.angle) || 0;
        } else if (rotation && !rotation.axis
            && (Number(rotation.x) || 0) === 0
            && (Number(rotation.z) || 0) === 0) {
            yRotation = Number(rotation.y) || 0;
        }

        if (yRotation && Array.isArray(rotationOrigin) && rotationOrigin.length === 3) {
            const pivotX = (rotationOrigin[0] - 8) / 16;
            const pivotY = (rotationOrigin[1] - 8) / 16;
            const pivotZ = (rotationOrigin[2] - 8) / 16;
            const angle = yRotation * Math.PI / 180;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            transformElementVertex = ([x, y, z]) => {
                const dx = x - pivotX;
                const dz = z - pivotZ;
                return [
                    pivotX + dx * cos + dz * sin,
                    pivotY + (y - pivotY),
                    pivotZ - dx * sin + dz * cos
                ];
            };
        } else {
            transformElementVertex = corner => corner;
        }

        const faces = element.faces;

        // NORTH
        if (faces.north && faces.north.texture !== '#missing') {
            addFace(
                [
                    [x1, y0, z0],
                    [x0, y0, z0],
                    [x0, y1, z0],
                    [x1, y1, z0]
                ],
                faces.north.uv,
                faces.north.rotation,
                [2, 3, 0, 1]
            );
        }

        // SOUTH
        if (faces.south && faces.south.texture !== '#missing') {
            addFace(
                [
                    [x0, y0, z1],
                    [x1, y0, z1],
                    [x1, y1, z1],
                    [x0, y1, z1]
                ],
                faces.south.uv,
                faces.south.rotation,
                [2, 3, 0, 1]
            );
        }

        // EAST
        if (faces.east && faces.east.texture !== '#missing') {
            addFace(
                [
                    [x1, y0, z1],
                    [x1, y0, z0],
                    [x1, y1, z0],
                    [x1, y1, z1]
                ],
                faces.east.uv,
                faces.east.rotation,
                [2, 3, 0, 1]
            );
        }

        // WEST
        if (faces.west && faces.west.texture !== '#missing') {
            addFace(
                [
                    [x0, y0, z0],
                    [x0, y0, z1],
                    [x0, y1, z1],
                    [x0, y1, z0]
                ],
                faces.west.uv,
                faces.west.rotation,
                [2, 3, 0, 1]
            );
        }

        // UP
        if (faces.up && faces.up.texture !== '#missing') {
            addFace(
                [
                    [x0, y1, z0],
                    [x0, y1, z1],
                    [x1, y1, z1],
                    [x1, y1, z0]
                ],
                faces.up.uv,
                faces.up.rotation,
                [0, 3, 2, 1]
            );
        }

        // DOWN
        if (faces.down && faces.down.texture !== '#missing') {
            addFace(
                [
                    [x0, y0, z1],
                    [x0, y0, z0],
                    [x1, y0, z0],
                    [x1, y0, z1]
                ],
                faces.down.uv,
                faces.down.rotation,
                [0, 3, 2, 1]
            );
        }
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
    );

    geometry.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(uvs, 2)
    );

    geometry.setIndex(indices);

    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    return geometry;
}

async function loadCustomModel(modelUrl) {
    const response = await fetch(modelUrl);

    if (!response.ok) {
        throw new Error(`No se pudo cargar el modelo personalizado: ${modelUrl}`);
    }

    const modelData = await response.json();
    const geometry = createCustomModelGeometry(modelData);

    if (!geometry) {
        return null;
    }

    return {
        geometry,
        textures: modelData.textures || {},
        texture: modelData.textures?.['0'] || modelData.textures?.particle || null
    };
}
