(() => {
    let enabled = false;
    let renderTarget = null;
    let postScene = null;
    let postCamera = null;
    let postMaterial = null;
    let activeRenderer = null;
    let pixelWidth = 0;
    let pixelHeight = 0;

    const vertexShader = [
        'varying vec2 vUv;',
        'void main() {',
        '    vUv = uv;',
        '    gl_Position = vec4(position.xy, 0.0, 1.0);',
        '}'
    ].join('\n');

    const fragmentShader = [
        'precision highp float;',
        'uniform sampler2D tDiffuse;',
        'uniform vec2 uResolution;',
        'uniform float uTime;',
        'varying vec2 vUv;',
        'void main() {',
        '    vec4 source = texture2D(tDiffuse, vUv);',
        '    float luma = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));',
        '    vec3 vivid = mix(vec3(luma), source.rgb, 1.12);',
        '    vec3 color = (vivid - vec3(0.34)) * 1.08 + vec3(0.34);',
        '    color += vec3(0.012, 0.006, 0.018);',
        '    float distanceFromCenter = distance(vUv, vec2(0.5));',
        '    float vignette = 1.0 - smoothstep(0.34, 0.78, distanceFromCenter) * 0.13;',
        '    color *= vignette;',
        '    color = clamp(color, 0.0, 1.0);',
        '    vec3 finalColor = mix(source.rgb, color, source.a);',
        '    finalColor = pow(max(finalColor, vec3(0.0)), vec3(1.0 / 2.2));',
        '    gl_FragColor = vec4(finalColor, source.a);',
        '}'
    ].join('\n');

    function disposeTarget() {
        if (renderTarget) renderTarget.dispose();
        renderTarget = null;
        pixelWidth = 0;
        pixelHeight = 0;
    }

    function resize(width, height, pixelRatio = 1) {
        if (!activeRenderer || !postMaterial || width <= 0 || height <= 0) return;
        const nextWidth = Math.max(1, Math.floor(width * pixelRatio));
        const nextHeight = Math.max(1, Math.floor(height * pixelRatio));
        if (nextWidth === pixelWidth && nextHeight === pixelHeight && renderTarget) return;

        disposeTarget();
        renderTarget = new THREE.WebGLRenderTarget(nextWidth, nextHeight, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            depthBuffer: true,
            stencilBuffer: false
        });
        renderTarget.texture.generateMipmaps = false;
        postMaterial.uniforms.tDiffuse.value = renderTarget.texture;
        postMaterial.uniforms.uResolution.value.set(nextWidth, nextHeight);
        pixelWidth = nextWidth;
        pixelHeight = nextHeight;
    }

    function initialize(renderer, width, height) {
        if (activeRenderer && activeRenderer !== renderer) disposeTarget();
        activeRenderer = renderer;
        if (!postScene) {
            postScene = new THREE.Scene();
            postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
            postCamera.position.z = 1;
            postMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    tDiffuse: { value: null },
                    uResolution: { value: new THREE.Vector2(1, 1) },
                    uTime: { value: 0 }
                },
                vertexShader,
                fragmentShader,
                depthTest: false,
                depthWrite: false,
                toneMapped: false
            });
            const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial);
            quad.frustumCulled = false;
            postScene.add(quad);
        }
        resize(width, height, renderer.getPixelRatio());
    }

    function setEnabled(nextValue) {
        enabled = Boolean(nextValue);
        return enabled;
    }

    function toggle() {
        return setEnabled(!enabled);
    }

    function isEnabled() {
        return enabled;
    }

    function render(renderer, scene, camera) {
        if (!enabled || !renderTarget || !postScene) {
            renderer.render(scene, camera);
            return;
        }
        postMaterial.uniforms.uTime.value = performance.now() / 1000;
        renderer.setRenderTarget(renderTarget);
        renderer.clear();
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(postScene, postCamera);
    }

    window.MCViewerShaderPipeline = { initialize, resize, render, toggle, setEnabled, isEnabled };
})();
