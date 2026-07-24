# Contact Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `contact.html` — a standalone, immersive landing page with a klein-blue-toned Three.js 3D physics ball-pit background and three contact links (Email/GitHub/Douyin), deliberately independent of the site's shared navigation chrome.

**Architecture:** A single static page (`contact.html`) with its own stylesheet (`css/contact.css`) and an inline `<script>` block containing the Three.js ball-pit animation — no separate JS module, no Supabase, no shared `.site-nav`. This is a near-verbatim port of an approved reference mockup.

**Tech Stack:** Plain HTML/CSS, Three.js r128 loaded via the `cdnjs.cloudflare.com` CDN (scoped to this page only), Google Fonts (Playfair Display, Noto Sans SC, Inter — this page's own font stack, distinct from the rest of the site's Playfair Display + Noto Serif SC).

## Global Constraints

- No shared `.site-nav`/`.site-footer` on this page — a single fixed "返回" (back) link to `index.html` replaces them (explicit design choice).
- Contact links: Email → `mailto:anjiexu0630@163.com` (exact address, matches Share Life's bio); GitHub → placeholder `https://github.com`; Douyin → placeholder `https://www.douyin.com` (owner replaces both placeholders after this ships — do not invent real URLs).
- Do not modify `css/base.css`, `css/nav.css`, or any other existing page — nav links to `contact.html` already exist site-wide.
- No automated tests for this page (purely presentational, no business logic — matches the design spec's explicit "Out of scope" section).

---

### Task 1: `contact.html` + `css/contact.css` — full page port

**Files:**
- Create: `contact.html`
- Create: `css/contact.css`

**Interfaces:** None — this is a self-contained, standalone page with no dependency on or from any other file in the codebase (other than the pre-existing nav links in other pages that already point to `contact.html`, which need no changes).

- [ ] **Step 1: Create `css/contact.css`**

```css
:root {
  --contact-bg-primary: #f5f3ef;
  --contact-bg-secondary: #ffffff;
  --contact-text-primary: #1a1a1a;
  --contact-text-secondary: #666666;
  --contact-text-muted: #999999;
  --contact-accent: #002FA7;
  --contact-border: #e5e5e5;
  --contact-shadow-hover: 0 12px 40px rgba(0,0,0,0.1);
  --contact-transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

body {
  font-family: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--contact-bg-primary);
  color: var(--contact-text-primary);
}

#ballpitCanvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.content {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 15vh;
  pointer-events: none;
}

.title-decoration {
  position: relative;
  width: 90px;
  height: 90px;
  margin-bottom: 24px;
}

.title-circle {
  position: absolute;
  border-radius: 50%;
  border: none;
}

.title-circle:nth-child(1) {
  width: 56px;
  height: 56px;
  left: 0;
  top: 0;
  background: radial-gradient(circle at 30% 30%, rgba(0,47,167,0.45) 0%, rgba(0,47,167,0.15) 50%, rgba(0,47,167,0.05) 100%);
  box-shadow: 0 4px 20px rgba(0,47,167,0.15);
  animation: contact-orbit1 8s ease-in-out infinite;
}

.title-circle:nth-child(2) {
  width: 52px;
  height: 52px;
  left: 28px;
  top: 14px;
  background: radial-gradient(circle at 30% 30%, rgba(0,47,167,0.5) 0%, rgba(0,47,167,0.18) 50%, rgba(0,47,167,0.06) 100%);
  box-shadow: 0 4px 20px rgba(0,47,167,0.15);
  animation: contact-orbit2 10s ease-in-out infinite;
}

.title-circle:nth-child(3) {
  width: 48px;
  height: 48px;
  left: 16px;
  top: 36px;
  background: radial-gradient(circle at 30% 30%, rgba(0,47,167,0.55) 0%, rgba(0,47,167,0.2) 50%, rgba(0,47,167,0.08) 100%);
  box-shadow: 0 4px 20px rgba(0,47,167,0.15);
  animation: contact-orbit3 12s ease-in-out infinite;
}

@keyframes contact-orbit1 {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(6px, 4px) rotate(5deg); }
  50% { transform: translate(2px, 8px) rotate(-3deg); }
  75% { transform: translate(-4px, 2px) rotate(3deg); }
}

@keyframes contact-orbit2 {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(-4px, 6px) rotate(-4deg); }
  50% { transform: translate(6px, 2px) rotate(5deg); }
  75% { transform: translate(2px, -4px) rotate(-2deg); }
}

@keyframes contact-orbit3 {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(4px, -4px) rotate(3deg); }
  50% { transform: translate(-2px, 6px) rotate(-5deg); }
  75% { transform: translate(-6px, -2px) rotate(4deg); }
}

.main-title {
  font-family: 'Playfair Display', serif;
  font-size: 56px;
  font-weight: 500;
  color: var(--contact-text-primary);
  letter-spacing: 4px;
  text-transform: uppercase;
  margin-bottom: 60px;
  pointer-events: auto;
}

.contact-links {
  display: flex;
  flex-direction: column;
  gap: 32px;
  align-items: center;
  pointer-events: auto;
}

.contact-link {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 40px;
  border-radius: 100px;
  background: var(--contact-bg-secondary);
  border: 1px solid var(--contact-border);
  text-decoration: none;
  color: var(--contact-text-primary);
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  transition: var(--contact-transition);
  min-width: 280px;
  justify-content: center;
}

.contact-link:hover {
  transform: translateY(-4px);
  box-shadow: var(--contact-shadow-hover);
  border-color: var(--contact-accent);
}

.contact-link svg {
  width: 20px;
  height: 20px;
  stroke: var(--contact-accent);
  stroke-width: 2;
  fill: none;
}

.contact-link .icon-solid {
  fill: var(--contact-accent);
  stroke: none;
}

.link-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--contact-text-muted);
  letter-spacing: 2px;
  text-transform: uppercase;
}

.footer {
  position: fixed;
  bottom: 40px;
  left: 0;
  right: 0;
  text-align: center;
  z-index: 1;
  pointer-events: none;
}

.footer-text {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  color: var(--contact-text-muted);
  letter-spacing: 2px;
  text-transform: uppercase;
}

.back-link {
  position: fixed;
  top: 40px;
  left: 48px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 100px;
  background: var(--contact-bg-secondary);
  border: 1px solid var(--contact-border);
  text-decoration: none;
  color: var(--contact-text-secondary);
  font-size: 14px;
  font-weight: 500;
  transition: var(--contact-transition);
}

.back-link:hover {
  border-color: var(--contact-accent);
  color: var(--contact-accent);
}

.back-link svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}

@media (max-width: 768px) {
  .main-title {
    font-size: 36px;
    letter-spacing: 2px;
  }

  .contact-link {
    min-width: 260px;
    padding: 18px 32px;
  }

  .back-link {
    left: 20px;
    top: 20px;
  }

  .title-decoration {
    width: 60px;
    height: 60px;
  }

  .title-circle:nth-child(1) {
    width: 36px;
    height: 36px;
  }

  .title-circle:nth-child(2) {
    width: 32px;
    height: 32px;
    left: 18px;
    top: 8px;
  }

  .title-circle:nth-child(3) {
    width: 28px;
    height: 28px;
    left: 10px;
    top: 22px;
  }
}
```

Note: the reference mockup's `@keyframes orbit1/orbit2/orbit3` are renamed here to `contact-orbit1/2/3` as a defensive precaution — CSS keyframe names and custom properties are global, so a generic name risks silently colliding with something added to a shared stylesheet later, even though no such collision exists in the codebase today (verified: no other stylesheet currently defines `@keyframes orbit1/2/3`). Custom properties are similarly prefixed (`--contact-*`) rather than reusing `--bg-primary`/`--accent`/etc., since this page intentionally does not draw from `css/base.css`'s shared `:root` tokens (per the design spec) and generic names like `--accent` could otherwise be mistaken for the shared ones.

- [ ] **Step 2: Create `contact.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Anjie — Contact</title>
  <link rel="icon" href="assets/icons/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Noto+Sans+SC:wght@300;400;500;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/contact.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
  <canvas id="ballpitCanvas"></canvas>

  <a href="index.html" class="back-link">
    <svg viewBox="0 0 24 24"><path d="M19 12H5M5 12l7-7M5 12l7 7"/></svg>
    返回
  </a>

  <div class="content">
    <div class="title-decoration">
      <span class="title-circle"></span>
      <span class="title-circle"></span>
      <span class="title-circle"></span>
    </div>

    <h1 class="main-title">GET IN TOUCH</h1>

    <div class="contact-links">
      <a href="mailto:anjiexu0630@163.com" class="contact-link">
        <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        <span class="link-label">Email</span>
      </a>

      <a href="https://github.com" target="_blank" rel="noopener" class="contact-link">
        <svg viewBox="0 0 24 24" class="icon-solid"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
        <span class="link-label">GitHub</span>
      </a>

      <a href="https://www.douyin.com" target="_blank" rel="noopener" class="contact-link">
        <svg viewBox="0 0 24 24" class="icon-solid"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.08 1.04-1.25 1.77-.21.82-.16 1.72.17 2.51.46 1.05 1.5 1.8 2.65 1.85 1.26.1 2.53-.49 3.24-1.54.35-.53.5-1.18.5-1.81V.02z"/></svg>
        <span class="link-label">Douyin</span>
      </a>
    </div>
  </div>

  <footer class="footer">
    <p class="footer-text">Contact</p>
  </footer>

  <script>
    // Ballpit 3D Effect - Scattered Glass Spheres with Mouse Bounce
    (function() {
      const canvas = document.getElementById('ballpitCanvas');
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });

      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 1);
      dirLight.position.set(10, 20, 10);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      scene.add(dirLight);

      const pointLight = new THREE.PointLight(0x002FA7, 1.5, 50);
      pointLight.position.set(0, 10, 5);
      scene.add(pointLight);

      const sphereCount = 120;
      const spheres = [];
      const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);

      const GRAVITY = -0.012;
      const WALL_BOUNCE = 0.92;
      const FRICTION = 0.998;
      const FLOOR_Y = -12;
      const CEILING_Y = 18;
      const WALL_X = 20;
      const WALL_Z = 8;

      const glassColors = [
        0x002FA7, 0x1a4fc7, 0x3366cc, 0x4d7fd9,
        0x6688dd, 0x8099e6, 0x99aaee, 0xb3bbf5,
        0xccccff, 0xe6e6ff, 0xf0f0ff, 0xffffff,
        0x1a237e, 0x283593, 0x3949ab, 0x5c6bc0
      ];

      for (let i = 0; i < sphereCount; i++) {
        const color = glassColors[Math.floor(Math.random() * glassColors.length)];

        const material = new THREE.MeshPhysicalMaterial({
          color: color,
          metalness: 0,
          roughness: 0.15,
          transmission: 0.5,
          thickness: 1.5,
          transparent: true,
          opacity: 0.9,
          clearcoat: 0.6,
          clearcoatRoughness: 0.1,
          ior: 1.5
        });

        const mesh = new THREE.Mesh(sphereGeometry, material);

        const x = (Math.random() - 0.5) * WALL_X * 1.6;
        const y = Math.random() * (CEILING_Y - FLOOR_Y) * 0.8 + FLOOR_Y + 2;
        const z = (Math.random() - 0.5) * WALL_Z * 1.2;

        mesh.position.set(x, y, z);

        const scale = Math.random() * 0.6 + 0.3;
        mesh.scale.set(scale, scale, scale);

        mesh.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 0.12,
          (Math.random() - 0.5) * 0.08,
          (Math.random() - 0.5) * 0.06
        );

        mesh.radius = scale;
        mesh.hovered = false;
        mesh.hoverTime = 0;
        spheres.push(mesh);
        scene.add(mesh);
      }

      const mouse = new THREE.Vector2();
      const raycaster = new THREE.Raycaster();
      let hoveredSphere = null;

      document.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(spheres);

        if (hoveredSphere && (!intersects.length || intersects[0].object !== hoveredSphere)) {
          hoveredSphere.hovered = false;
          hoveredSphere = null;
        }

        if (intersects.length > 0) {
          const sphere = intersects[0].object;
          if (!sphere.hovered) {
            sphere.hovered = true;
            hoveredSphere = sphere;

            sphere.velocity.y = 0.3 + Math.random() * 0.2;
            sphere.velocity.x += (Math.random() - 0.5) * 0.2;
            sphere.velocity.z += (Math.random() - 0.5) * 0.15;

            const baseScale = sphere.radius;
            sphere.scale.setScalar(baseScale * 1.1);
            setTimeout(() => {
              if (sphere) sphere.scale.setScalar(baseScale);
            }, 200);
          }
        }
      });

      camera.position.set(0, 2, 28);
      camera.lookAt(0, 0, 0);

      const clock = new THREE.Clock();

      function animate() {
        requestAnimationFrame(animate);
        const delta = Math.min(clock.getDelta(), 0.05);

        spheres.forEach((sphere, i) => {
          sphere.velocity.y += GRAVITY;
          sphere.velocity.multiplyScalar(FRICTION);
          sphere.position.add(sphere.velocity);

          if (sphere.position.y - sphere.radius < FLOOR_Y) {
            sphere.position.y = FLOOR_Y + sphere.radius;
            sphere.velocity.y = -sphere.velocity.y * WALL_BOUNCE;
            sphere.velocity.x *= 0.95;
            sphere.velocity.z *= 0.95;
          }

          if (sphere.position.y + sphere.radius > CEILING_Y) {
            sphere.position.y = CEILING_Y - sphere.radius;
            sphere.velocity.y = -sphere.velocity.y * WALL_BOUNCE;
          }

          if (sphere.position.x + sphere.radius > WALL_X) {
            sphere.position.x = WALL_X - sphere.radius;
            sphere.velocity.x = -sphere.velocity.x * WALL_BOUNCE;
          }
          if (sphere.position.x - sphere.radius < -WALL_X) {
            sphere.position.x = -WALL_X + sphere.radius;
            sphere.velocity.x = -sphere.velocity.x * WALL_BOUNCE;
          }

          if (sphere.position.z + sphere.radius > WALL_Z) {
            sphere.position.z = WALL_Z - sphere.radius;
            sphere.velocity.z = -sphere.velocity.z * WALL_BOUNCE;
          }
          if (sphere.position.z - sphere.radius < -WALL_Z) {
            sphere.position.z = -WALL_Z + sphere.radius;
            sphere.velocity.z = -sphere.velocity.z * WALL_BOUNCE;
          }

          for (let j = i + 1; j < spheres.length; j++) {
            const other = spheres[j];
            const dx = other.position.x - sphere.position.x;
            const dy = other.position.y - sphere.position.y;
            const dz = other.position.z - sphere.position.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const minDist = sphere.radius + other.radius;

            if (dist < minDist && dist > 0.001) {
              const overlap = (minDist - dist) * 0.25;
              const nx = dx / dist;
              const ny = dy / dist;
              const nz = dz / dist;

              sphere.position.x -= nx * overlap;
              sphere.position.y -= ny * overlap;
              sphere.position.z -= nz * overlap;
              other.position.x += nx * overlap;
              other.position.y += ny * overlap;
              other.position.z += nz * overlap;

              const v1n = sphere.velocity.x * nx + sphere.velocity.y * ny + sphere.velocity.z * nz;
              const v2n = other.velocity.x * nx + other.velocity.y * ny + other.velocity.z * nz;

              const exchange = (v2n - v1n) * 0.25;
              sphere.velocity.x += exchange * nx;
              sphere.velocity.y += exchange * ny;
              sphere.velocity.z += exchange * nz;
              other.velocity.x -= exchange * nx;
              other.velocity.y -= exchange * ny;
              other.velocity.z -= exchange * nz;
            }
          }

          sphere.rotation.x += sphere.velocity.z * 0.03;
          sphere.rotation.z -= sphere.velocity.x * 0.03;
        });

        const time = clock.getElapsedTime();
        camera.position.x = Math.sin(time * 0.02) * 2;
        camera.position.y = 2 + Math.cos(time * 0.015) * 1;
        camera.lookAt(0, 1, 0);

        renderer.render(scene, camera);
      }

      animate();

      window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          clock.stop();
        } else {
          clock.start();
        }
      });
    })();
  </script>
</body>
</html>
```

- [ ] **Step 3: Verify the inline script is syntactically valid JavaScript**

Extract the contents between `<script>` and `</script>` (the ballpit IIFE) to a scratch file and check it:

```bash
sed -n '/<script>/,/<\/script>/p' contact.html | sed '1d;$d' > /tmp/contact-ballpit-check.js
node --check /tmp/contact-ballpit-check.js
rm /tmp/contact-ballpit-check.js
```

Expected: no output from `node --check` (valid syntax). Note this only validates JS syntax — it cannot execute the script, since it references `THREE`, `document`, and `window`, none of which exist in a plain Node process. Real rendering verification happens in Step 4.

- [ ] **Step 4: Verify the page serves and loads its assets**

Start a local static server on a scratch port and confirm both new files are reachable:

```bash
python3 -m http.server 8123 &
sleep 1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8123/contact.html
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8123/css/contact.css
kill %1
```

Expected: both curl calls print `200`.

- [ ] **Step 5: Commit**

```bash
git add contact.html css/contact.css
git commit -m "feat: add Contact page with 3D glass-ball background"
```

## Follow-up (not part of this task)

The site owner will replace the two placeholder URLs (`https://github.com` and `https://www.douyin.com` in `contact.html`) with their real profile links once they have them — this is expected, not a defect to fix during implementation.
