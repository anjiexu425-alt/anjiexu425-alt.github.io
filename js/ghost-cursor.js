import { lerp, computeFadeOpacity } from './ghost-cursor-math.mjs';

const THREE_BASE = 'https://cdn.jsdelivr.net/npm/three@0.160.0';

const COLOR = '#3261d7';
const BRIGHTNESS = 2;
const TRAIL_LENGTH = 50;
const INERTIA = 0.5;
const GRAIN_INTENSITY = 0.05;
const BLOOM_STRENGTH = 0.1;
const BLOOM_RADIUS = 1;
const BLOOM_THRESHOLD = 0.025;
const FADE_DELAY_MS = 1000;
const FADE_DURATION_MS = 1500;

const GRAIN_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    grainIntensity: { value: GRAIN_INTENSITY },
    time: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float grainIntensity;
    uniform float time;
    varying vec2 vUv;
    float random(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233)) + time) * 43758.5453);
    }
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float grain = (random(vUv) - 0.5) * grainIntensity;
      gl_FragColor = vec4(color.rgb + grain, color.a);
    }
  `,
};

function createDotTexture(THREE) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

async function loadThree() {
  const [THREE, composerMod, renderMod, bloomMod, shaderMod] = await Promise.all([
    import(`${THREE_BASE}/build/three.module.js`),
    import(`${THREE_BASE}/examples/jsm/postprocessing/EffectComposer.js`),
    import(`${THREE_BASE}/examples/jsm/postprocessing/RenderPass.js`),
    import(`${THREE_BASE}/examples/jsm/postprocessing/UnrealBloomPass.js`),
    import(`${THREE_BASE}/examples/jsm/postprocessing/ShaderPass.js`),
  ]);
  return {
    THREE,
    EffectComposer: composerMod.EffectComposer,
    RenderPass: renderMod.RenderPass,
    UnrealBloomPass: bloomMod.UnrealBloomPass,
    ShaderPass: shaderMod.ShaderPass,
  };
}

async function initGhostCursor() {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let modules;
  try {
    modules = await loadThree();
  } catch (error) {
    console.error('Ghost cursor: failed to load Three.js from CDN, effect disabled.', error);
    return;
  }
  const { THREE, EffectComposer, RenderPass, UnrealBloomPass, ShaderPass } = modules;
  console.info('Ghost cursor: Three.js modules loaded, setting up scene.');

  try {
    const canvas = document.createElement('canvas');
    canvas.className = 'ghost-cursor-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    // top=0/bottom=height (inverted) so world coordinates match DOM client
    // coordinates directly: y=0 at the visual top, y=height at the bottom.
    const camera = new THREE.OrthographicCamera(0, window.innerWidth, 0, window.innerHeight, -10, 10);
    camera.position.z = 5;

    const dotTexture = createDotTexture(THREE);
    const trailPoints = [];
    const sprites = [];

    for (let i = 0; i < TRAIL_LENGTH; i += 1) {
      trailPoints.push({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const material = new THREE.SpriteMaterial({
        map: dotTexture,
        color: new THREE.Color(COLOR),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(material);
      scene.add(sprite);
      sprites.push(sprite);
    }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    );
    composer.addPass(bloomPass);
    const grainPass = new ShaderPass(GRAIN_SHADER);
    composer.addPass(grainPass);

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height);
      composer.setSize(width, height);
      camera.right = width;
      camera.bottom = height;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let lastMoveMs = performance.now();

    window.addEventListener('mousemove', (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
      lastMoveMs = performance.now();
    });

    const followFactor = 1 - INERTIA;
    let loggedFirstFrame = false;

    function animate(timestampMs) {
      trailPoints[0].x = lerp(trailPoints[0].x, targetX, followFactor);
      trailPoints[0].y = lerp(trailPoints[0].y, targetY, followFactor);
      for (let i = 1; i < trailPoints.length; i += 1) {
        trailPoints[i].x = lerp(trailPoints[i].x, trailPoints[i - 1].x, followFactor);
        trailPoints[i].y = lerp(trailPoints[i].y, trailPoints[i - 1].y, followFactor);
      }

      const fade = computeFadeOpacity(timestampMs - lastMoveMs, FADE_DELAY_MS, FADE_DURATION_MS);

      sprites.forEach((sprite, i) => {
        const point = trailPoints[i];
        const t = 1 - i / trailPoints.length;
        sprite.position.set(point.x, point.y, 0);
        const scale = 6 + t * 18;
        sprite.scale.set(scale, scale, 1);
        sprite.material.opacity = t * fade * BRIGHTNESS * 0.35;
      });

      grainPass.uniforms.time.value = timestampMs * 0.001;

      composer.render();

      if (!loggedFirstFrame) {
        loggedFirstFrame = true;
        console.info('Ghost cursor: first frame rendered.', {
          canvasSize: [canvas.width, canvas.height],
          headSpriteOpacity: sprites[0].material.opacity,
          headSpritePosition: sprites[0].position.toArray(),
        });
      }

      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  } catch (error) {
    console.error('Ghost cursor: setup failed after Three.js loaded.', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initGhostCursor();
});
