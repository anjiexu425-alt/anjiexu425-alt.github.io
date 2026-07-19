# Personal Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 7-page static personal website (Home, About, Experience, Study Diary, Share Life and Insights, Toolkit, Contact) in Klein-blue/light-gray editorial style, with placeholder content the user will replace later.

**Architecture:** Pure static HTML/CSS/JS, no build tools or frameworks. Each page is a standalone `.html` file with its own copy of the shared top nav and footer markup (no runtime partial-loading). Shared visual language lives in `css/base.css`; page-specific styles live in `css/pages.css`. Interaction logic with real decision-making (circular nav placement math, Experience card selection/flip, Study Diary pagination) is extracted into pure ES modules (`.mjs`) that are unit-tested with Node's built-in test runner and imported into thin DOM-wiring scripts.

**Tech Stack:** HTML5, CSS3 (custom properties, Grid/Flexbox, CSS animations), vanilla JS (ES modules), Node.js built-in `node:test` for logic unit tests. Google Fonts CDN for Playfair Display + Noto Serif SC. No package.json, no bundler, no server required for local preview (page-shell files open directly via `file://`; only the two files with `.mjs` imports need `type="module"`, which works from `file://` in current browsers used for manual verification, but if a task's manual check reports a module-loading error under `file://`, verify instead via a static file server, e.g. `python3 -m http.server`, from the project root).

## Global Constraints

- No build tools, bundlers, or frontend frameworks — plain HTML/CSS/JS only.
- Multi-page site: each `.html` file contains its own full `<head>`, nav, and footer markup (duplicated, not templated).
- Color palette: Klein blue `#002FA7` (primary/accent), light warm gray `#F5F5F3` (background), white `#FFFFFF` (surfaces), `#2B2B2E` (body text), `#6B6B70` (muted text), `#E8ECF9` (soft blue accent bg), `rgba(0,47,167,0.35)` (dashed tag borders).
- Typography: headings/emphasis use `'Playfair Display', 'Noto Serif SC', Georgia, serif`; body text uses `Georgia, 'Noto Serif SC', serif`. Entire site is serif, no sans-serif.
- All transitions use `ease-in-out`, duration 0.4s–0.8s; breathing/floating loop animations use 4–7s `ease-in-out infinite alternate`. Never `linear` or bounce/elastic easing.
- Responsive breakpoints: 768px (mobile/tablet split), 1024px (desktop split).
- Placeholder content convention: text placeholders are wrapped in `[Text placeholder: ...]` / `[Photo placeholder: ...]` describing what real content should go there, so the user can find-and-replace later.
- Every interactive element (nav toggle, circular nav items, flip cards, diary controls) has an `aria-label` or accessible text.

---

## Task 1: Project scaffolding — base styles, directories, favicon

**Files:**
- Create: `css/base.css`
- Create: `assets/icons/favicon.svg`
- Create: `assets/images/.gitkeep`
- Create: `assets/icons/.gitkeep`

**Interfaces:**
- Produces: CSS custom properties consumed by every later CSS file — `--color-klein-blue`, `--color-klein-blue-soft`, `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border-dashed`, `--font-display`, `--font-body`, `--space-1`..`--space-6`, `--radius-md`, `--radius-lg`, `--transition-fast`, `--transition-slow`. The 768px/1024px breakpoints from the Global Constraints are hardcoded directly inside each `@media` rule in later tasks (CSS custom properties cannot be used inside `@media` conditions), not exposed as custom properties. Also produces reusable classes `.container`, `.placeholder-img`, `.emphasis`, `.visually-hidden`, `.button`, `.button--primary`, `.tag-cloud`, `.tag`.

- [ ] **Step 1: Create the directory layout**

```bash
mkdir -p /Users/estrella/Desktop/my-project/css
mkdir -p /Users/estrella/Desktop/my-project/js
mkdir -p /Users/estrella/Desktop/my-project/assets/images
mkdir -p /Users/estrella/Desktop/my-project/assets/icons
touch /Users/estrella/Desktop/my-project/assets/images/.gitkeep
touch /Users/estrella/Desktop/my-project/assets/icons/.gitkeep
```

- [ ] **Step 2: Write `css/base.css`**

```css
:root {
  --color-klein-blue: #002FA7;
  --color-klein-blue-soft: #E8ECF9;
  --color-bg: #F5F5F3;
  --color-surface: #FFFFFF;
  --color-text: #2B2B2E;
  --color-text-muted: #6B6B70;
  --color-border-dashed: rgba(0, 47, 167, 0.35);

  --font-display: 'Playfair Display', 'Noto Serif SC', Georgia, serif;
  --font-body: Georgia, 'Noto Serif SC', serif;

  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.5rem;
  --space-4: 2.5rem;
  --space-5: 4rem;
  --space-6: 6rem;

  --radius-md: 12px;
  --radius-lg: 20px;

  --transition-fast: 0.4s ease-in-out;
  --transition-slow: 0.8s ease-in-out;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 {
  font-family: var(--font-display);
  font-weight: 600;
  margin: 0 0 var(--space-2);
}

p {
  margin: 0 0 var(--space-2);
}

a {
  color: var(--color-klein-blue);
  text-decoration: none;
}

img {
  max-width: 100%;
  display: block;
}

.emphasis {
  color: var(--color-klein-blue);
  font-weight: 700;
}

.placeholder-img {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-2);
  background: linear-gradient(135deg, #d7deF5, #eef1fb);
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: 0.85rem;
  border-radius: var(--radius-md);
  min-height: 240px;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 var(--space-3);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.button {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--color-klein-blue);
  border-radius: 999px;
  color: var(--color-klein-blue);
  margin: var(--space-3) 0;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.button--primary:hover {
  background: var(--color-klein-blue);
  color: #fff;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin: var(--space-2) 0 var(--space-4);
}

.tag {
  border: 1px dashed var(--color-border-dashed);
  color: var(--color-klein-blue);
  border-radius: 999px;
  padding: 4px 14px;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

@keyframes breathe {
  from { transform: translate(-50%, -50%) scale(0.95); opacity: 0.85; }
  to { transform: translate(-50%, -50%) scale(1.05); opacity: 1; }
}
```

- [ ] **Step 3: Write `assets/icons/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="14" fill="#002FA7" />
</svg>
```

- [ ] **Step 4: Verify in browser**

Open `assets/icons/favicon.svg` directly in a browser tab. Expected: a solid Klein-blue circle renders with no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/estrella/Desktop/my-project
git add css/base.css assets/icons/favicon.svg assets/images/.gitkeep assets/icons/.gitkeep
git commit -m "Add base styles, design tokens, and favicon"
```

---

## Task 2: Shared top navigation bar (CSS + JS)

**Files:**
- Create: `css/nav.css`
- Create: `js/nav.js`

**Interfaces:**
- Consumes: CSS custom properties from `css/base.css` (Task 1).
- Produces: `.site-nav`, `.site-nav__brand`, `.site-nav__toggle`, `.site-nav__links` CSS classes and the hamburger-toggle/scroll-shadow behavior in `js/nav.js`, consumed by every page task (3–11). Each page embeds the exact nav HTML block documented in Step 1 below, with `aria-current="page"` moved onto that page's own link.

- [ ] **Step 1: Document the canonical nav/footer HTML block**

This exact block (adjusting only which `<li>` carries `aria-current="page"` and the `<title>`/active class per page) is copied into every page in Tasks 3–11:

```html
<header class="site-nav">
  <a class="site-nav__brand" href="index.html">Anjie</a>
  <button type="button" class="site-nav__toggle" aria-label="Toggle navigation menu" aria-expanded="false">☰</button>
  <nav aria-label="Primary">
    <ul class="site-nav__links">
      <li><a href="about.html">About</a></li>
      <li><a href="experience.html">Experience</a></li>
      <li><a href="study-diary.html">Study Diary</a></li>
      <li><a href="share-life.html">Share Life</a></li>
      <li><a href="toolkit.html">Toolkit</a></li>
      <li><a href="contact.html">Contact</a></li>
    </ul>
  </nav>
</header>
```

```html
<footer class="site-footer">
  <p>&copy; 2026 Anjie</p>
</footer>
```

- [ ] **Step 2: Write `css/nav.css`**

```css
.site-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  transition: background var(--transition-fast), box-shadow var(--transition-fast);
}

.site-nav.is-scrolled {
  background: rgba(245, 245, 243, 0.9);
  backdrop-filter: blur(6px);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
}

.site-nav__brand {
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--color-text);
}

.site-nav__links {
  display: flex;
  gap: var(--space-3);
  list-style: none;
  margin: 0;
  padding: 0;
}

.site-nav__links a {
  color: var(--color-text);
  font-size: 0.95rem;
  letter-spacing: 0.02em;
  padding-bottom: 2px;
  border-bottom: 2px solid transparent;
  transition: border-color var(--transition-fast), color var(--transition-fast);
}

.site-nav__links a:hover,
.site-nav__links a[aria-current="page"] {
  color: var(--color-klein-blue);
  border-bottom-color: var(--color-klein-blue);
}

.site-nav__toggle {
  display: none;
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
}

.site-footer {
  text-align: center;
  padding: var(--space-4) var(--space-3);
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

@media (max-width: 768px) {
  .site-nav__links {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    background: var(--color-surface);
    padding: var(--space-2) var(--space-3);
    gap: var(--space-2);
    display: none;
  }

  .site-nav__links.is-open {
    display: flex;
  }

  .site-nav__toggle {
    display: block;
  }
}
```

- [ ] **Step 3: Write `js/nav.js`**

```js
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.site-nav');
  const toggle = document.querySelector('.site-nav__toggle');
  const links = document.querySelector('.site-nav__links');

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const isOpen = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
});
```

- [ ] **Step 4: Commit**

```bash
cd /Users/estrella/Desktop/my-project
git add css/nav.css js/nav.js
git commit -m "Add shared top navigation bar styles and behavior"
```

(No standalone browser check here — verified visually once embedded in the Home page in Task 3.)

---

## Task 3: Home page — circular breathing nav + hero text

**Files:**
- Create: `js/circle-nav-math.mjs`
- Create: `js/circle-nav-math.test.mjs`
- Create: `js/home.js`
- Create: `index.html`
- Modify: `css/pages.css` (created here, extended by later tasks)

**Interfaces:**
- Consumes: `computeRingPositions` is new in this task. CSS tokens from Task 1. Nav/footer block and `nav.js` from Task 2.
- Produces: `computeRingPositions(labels, radius) -> Array<{label, angleDeg, x, y, rotateDeg}>` in `js/circle-nav-math.mjs`, used only by `js/home.js` (no other task depends on it, but its test pattern is the template Tasks 5 and 7 follow).

- [ ] **Step 1: Write the failing test for the ring-position math**

```js
// js/circle-nav-math.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRingPositions } from './circle-nav-math.mjs';

test('distributes items evenly around the circle starting at the top', () => {
  const positions = computeRingPositions(['A', 'B', 'C', 'D'], 100);
  assert.equal(positions.length, 4);
  assert.equal(positions[0].angleDeg, -90);
  assert.equal(positions[1].angleDeg, 0);
  assert.equal(positions[2].angleDeg, 90);
  assert.equal(positions[3].angleDeg, 180);
});

test('first item sits at the top of the circle (x near 0, y negative)', () => {
  const positions = computeRingPositions(['A', 'B'], 100);
  assert.ok(Math.abs(positions[0].x) < 1e-9);
  assert.ok(positions[0].y < 0);
});

test('rotateDeg keeps the label tangent to the circle', () => {
  const positions = computeRingPositions(['A'], 50);
  assert.equal(positions[0].rotateDeg, 0);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd /Users/estrella/Desktop/my-project
node --test js/circle-nav-math.test.mjs
```

Expected: FAIL — `Cannot find module './circle-nav-math.mjs'`.

- [ ] **Step 3: Implement `js/circle-nav-math.mjs`**

```js
export function computeRingPositions(labels, radius) {
  const count = labels.length;
  return labels.map((label, i) => {
    const angleDeg = (360 / count) * i - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = radius * Math.cos(angleRad);
    const y = radius * Math.sin(angleRad);
    const rotateDeg = angleDeg + 90;
    return { label, angleDeg, x, y, rotateDeg };
  });
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
node --test js/circle-nav-math.test.mjs
```

Expected: PASS — 3 tests, 0 failures.

- [ ] **Step 5: Write `js/home.js`**

```js
import { computeRingPositions } from './circle-nav-math.mjs';

const RING_ITEMS = [
  { label: 'About', href: 'about.html' },
  { label: 'Experience', href: 'experience.html' },
  { label: 'Study Diary', href: 'study-diary.html' },
  { label: 'Share Life', href: 'share-life.html' },
  { label: 'Toolkit', href: 'toolkit.html' },
  { label: 'Contact', href: 'contact.html' },
];

function renderRing() {
  const ring = document.querySelector('.circle-nav__ring');
  if (!ring) return;

  const radius = Number(ring.dataset.radius || 160);
  const positions = computeRingPositions(RING_ITEMS.map((item) => item.label), radius);

  positions.forEach((pos, i) => {
    const item = RING_ITEMS[i];
    const link = document.createElement('a');
    link.href = item.href;
    link.className = 'circle-nav__item';
    link.textContent = item.label;
    link.setAttribute('aria-label', `Go to ${item.label}`);
    link.style.transform =
      `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${pos.rotateDeg}deg)`;
    ring.appendChild(link);
  });
}

document.addEventListener('DOMContentLoaded', renderRing);
```

- [ ] **Step 6: Write `css/pages.css` with the hero + circular nav styles**

```css
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  min-height: calc(100vh - 80px);
  flex-wrap: wrap;
}

.hero__intro {
  max-width: 480px;
}

.hero__line {
  opacity: 0;
  transform: translateY(12px);
  animation: fade-up 0.8s ease-in-out forwards;
}

.hero__line--1 {
  font-family: var(--font-display);
  font-size: 3rem;
  color: var(--color-klein-blue);
  animation-delay: 0.1s;
}

.hero__line--2 {
  font-size: 1.25rem;
  animation-delay: 0.5s;
}

.hero__line--3 {
  font-size: 1.1rem;
  color: var(--color-text-muted);
  animation-delay: 0.9s;
}

@keyframes fade-up {
  to { opacity: 1; transform: translateY(0); }
}

.circle-nav {
  position: relative;
  width: 360px;
  height: 360px;
  flex-shrink: 0;
  animation: float 7s ease-in-out infinite alternate;
}

.circle-nav__orbit {
  position: absolute;
  inset: 20px;
  border: 1px dashed rgba(0, 47, 167, 0.2);
  border-radius: 50%;
}

.circle-nav__orb {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 140px;
  height: 140px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 47, 167, 0.9), rgba(0, 47, 167, 0.15) 70%, transparent 100%);
  filter: blur(2px);
  animation: breathe 4.5s ease-in-out infinite alternate;
}

.circle-nav__ring {
  position: absolute;
  inset: 0;
}

.circle-nav__item {
  position: absolute;
  top: 50%;
  left: 50%;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  white-space: nowrap;
  transition: color var(--transition-fast);
}

.circle-nav__item:hover {
  color: var(--color-klein-blue);
}

.circle-nav__mobile-list {
  display: none;
}

@keyframes float {
  from { transform: translateY(-8px); }
  to { transform: translateY(8px); }
}

@media (max-width: 768px) {
  .circle-nav {
    width: auto;
    height: auto;
    animation: none;
  }

  .circle-nav__orbit,
  .circle-nav__ring {
    display: none;
  }

  .circle-nav__orb {
    position: relative;
    top: auto;
    left: auto;
    transform: none;
    width: 80px;
    height: 80px;
    margin: 0 auto var(--space-3);
  }

  .circle-nav__mobile-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    list-style: none;
    padding: 0;
    text-align: center;
  }
}
```

- [ ] **Step 7: Write `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Anjie — Home</title>
  <link rel="icon" href="assets/icons/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Noto+Serif+SC:wght@500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/nav.css" />
  <link rel="stylesheet" href="css/pages.css" />
</head>
<body>
  <header class="site-nav">
    <a class="site-nav__brand" href="index.html">Anjie</a>
    <button type="button" class="site-nav__toggle" aria-label="Toggle navigation menu" aria-expanded="false">☰</button>
    <nav aria-label="Primary">
      <ul class="site-nav__links">
        <li><a href="about.html">About</a></li>
        <li><a href="experience.html">Experience</a></li>
        <li><a href="study-diary.html">Study Diary</a></li>
        <li><a href="share-life.html">Share Life</a></li>
        <li><a href="toolkit.html">Toolkit</a></li>
        <li><a href="contact.html">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <section class="hero container">
      <div class="hero__intro">
        <p class="hero__line hero__line--1">Hello,</p>
        <p class="hero__line hero__line--2">I'm Anjie, endlessly curious about bringing ideas to life with AI.</p>
        <p class="hero__line hero__line--3">Nothing starts perfectly. Everything starts somewhere.</p>
      </div>
      <div class="circle-nav" aria-label="Section navigation">
        <div class="circle-nav__orbit"></div>
        <div class="circle-nav__orb"></div>
        <div class="circle-nav__ring" data-radius="160"></div>
        <ul class="circle-nav__mobile-list">
          <li><a href="about.html">About</a></li>
          <li><a href="experience.html">Experience</a></li>
          <li><a href="study-diary.html">Study Diary</a></li>
          <li><a href="share-life.html">Share Life</a></li>
          <li><a href="toolkit.html">Toolkit</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <p>&copy; 2026 Anjie</p>
  </footer>

  <script src="js/nav.js" defer></script>
  <script type="module" src="js/home.js"></script>
</body>
</html>
```

- [ ] **Step 8: Verify in browser**

Serve the project root (`python3 -m http.server 8000` from `/Users/estrella/Desktop/my-project`) and open `http://localhost:8000/index.html`. Expected:
- "Hello," fades in first, then the two intro lines, in sequence.
- A blue glowing circle slowly breathes (scales) and the whole circle-nav drifts up/down.
- 6 words (About, Experience, Study Diary, Share Life, Toolkit, Contact) are arranged around the circle, each rotated to sit tangent to the ring; hovering one turns it Klein blue.
- Clicking a ring word navigates to the matching page (will 404 until later tasks create those files — confirm the `href` is correct, that's sufficient for now).
- Resize the window under 768px: the ring disappears and a centered vertical list of the same 6 links appears instead.

- [ ] **Step 9: Commit**

```bash
cd /Users/estrella/Desktop/my-project
git add js/circle-nav-math.mjs js/circle-nav-math.test.mjs js/home.js index.html css/pages.css
git commit -m "Add home page with breathing circular nav"
```

---

## Task 4: About page

**Files:**
- Create: `about.html`
- Modify: `css/pages.css` (append About section styles)

**Interfaces:**
- Consumes: `.container`, `.emphasis`, `.tag-cloud`, `.tag`, `.placeholder-img` from `css/base.css`; nav/footer block from Task 2.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Append About styles to `css/pages.css`**

```css
.about {
  display: flex;
  gap: var(--space-5);
  align-items: flex-start;
  flex-wrap: wrap;
  padding: var(--space-5) 0;
}

.about__photo {
  flex: 1 1 320px;
  aspect-ratio: 3 / 4;
  min-height: 380px;
}

.about__content {
  flex: 1 1 380px;
}

.about__content h1 {
  font-size: 1.8rem;
  line-height: 1.5;
  margin-bottom: var(--space-3);
}
```

- [ ] **Step 2: Write `about.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Anjie — About</title>
  <link rel="icon" href="assets/icons/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Noto+Serif+SC:wght@500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/nav.css" />
  <link rel="stylesheet" href="css/pages.css" />
</head>
<body>
  <header class="site-nav">
    <a class="site-nav__brand" href="index.html">Anjie</a>
    <button type="button" class="site-nav__toggle" aria-label="Toggle navigation menu" aria-expanded="false">☰</button>
    <nav aria-label="Primary">
      <ul class="site-nav__links">
        <li><a href="about.html" aria-current="page">About</a></li>
        <li><a href="experience.html">Experience</a></li>
        <li><a href="study-diary.html">Study Diary</a></li>
        <li><a href="share-life.html">Share Life</a></li>
        <li><a href="toolkit.html">Toolkit</a></li>
        <li><a href="contact.html">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <section class="about container">
      <div class="about__photo placeholder-img" data-label="portrait">[Photo placeholder: portrait of Anjie]</div>
      <div class="about__content">
        <h1>I ask <span class="emphasis">what if</span> a lot, <span class="emphasis">explore</span> things before I understand them, build from the <span class="emphasis">mess</span> — that's kind of the point.</h1>
        <div class="tag-cloud">
          <span class="tag">Curious-Minded</span>
          <span class="tag">AI-Driven</span>
          <span class="tag">Strategy-Minded</span>
        </div>
        <p>[Text placeholder: introduce your academic background, e.g. "Currently pursuing my degree at [school] in [field], I bring a foundation in [prior field] from [prior school]."]</p>
        <p>[Text placeholder: describe what draws your curiosity to AI and building things, and what you're working on now.]</p>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <p>&copy; 2026 Anjie</p>
  </footer>

  <script src="js/nav.js" defer></script>
</body>
</html>
```

- [ ] **Step 3: Verify in browser**

With the local server still running, open `http://localhost:8000/about.html`. Expected:
- Top nav shows "About" underlined in Klein blue (active state).
- Left column shows the gradient placeholder box with its label text; right column shows the headline with 3 blue-bold phrases, 3 dashed pill tags, and 2 placeholder paragraphs.
- Resize under 768px: columns stack vertically (photo above text).

- [ ] **Step 4: Commit**

```bash
cd /Users/estrella/Desktop/my-project
git add about.html css/pages.css
git commit -m "Add About page"
```

---

## Task 5: Experience state logic (fan positioning + select/flip rules)

**Files:**
- Create: `js/experience-state.mjs`
- Create: `js/experience-state.test.mjs`

**Interfaces:**
- Produces: `createExperienceState(cardCount, activeIndex = 0) -> {cardCount, activeIndex, flipped}`, `selectCard(state, index) -> state`, `computeFanOffsets(cardCount, activeIndex) -> Array<{index, isActive, rotateDeg, translateX, zIndex}>`. Consumed by `js/experience.js` in Task 6.

- [ ] **Step 1: Write the failing tests**

```js
// js/experience-state.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExperienceState, selectCard, computeFanOffsets } from './experience-state.mjs';

test('selecting a non-active card makes it active and unflipped', () => {
  const state = createExperienceState(4, 0);
  const next = selectCard(state, 2);
  assert.equal(next.activeIndex, 2);
  assert.equal(next.flipped, false);
});

test('selecting the already-active card toggles flip instead of changing selection', () => {
  const state = createExperienceState(4, 1);
  const flipped = selectCard(state, 1);
  assert.equal(flipped.activeIndex, 1);
  assert.equal(flipped.flipped, true);

  const flippedBack = selectCard(flipped, 1);
  assert.equal(flippedBack.activeIndex, 1);
  assert.equal(flippedBack.flipped, false);
});

test('active card sits centered with no rotation and the highest z-index', () => {
  const offsets = computeFanOffsets(5, 2);
  const active = offsets[2];
  assert.equal(active.isActive, true);
  assert.equal(active.rotateDeg, 0);
  assert.equal(active.translateX, 0);
  assert.equal(active.zIndex, 5);
});

test('cards further from the active index fan out further and sit lower in the stack', () => {
  const offsets = computeFanOffsets(5, 2);
  assert.equal(offsets[0].rotateDeg, -12);
  assert.equal(offsets[4].rotateDeg, 12);
  assert.ok(offsets[0].zIndex < offsets[2].zIndex);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
cd /Users/estrella/Desktop/my-project
node --test js/experience-state.test.mjs
```

Expected: FAIL — `Cannot find module './experience-state.mjs'`.

- [ ] **Step 3: Implement `js/experience-state.mjs`**

```js
export function createExperienceState(cardCount, activeIndex = 0) {
  return { cardCount, activeIndex, flipped: false };
}

export function selectCard(state, index) {
  if (index === state.activeIndex) {
    return { ...state, flipped: !state.flipped };
  }
  return { ...state, activeIndex: index, flipped: false };
}

export function computeFanOffsets(cardCount, activeIndex) {
  const offsets = [];
  for (let i = 0; i < cardCount; i += 1) {
    const distance = i - activeIndex;
    offsets.push({
      index: i,
      isActive: i === activeIndex,
      rotateDeg: distance * 6,
      translateX: distance * 18,
      zIndex: cardCount - Math.abs(distance),
    });
  }
  return offsets;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
node --test js/experience-state.test.mjs
```

Expected: PASS — 4 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
cd /Users/estrella/Desktop/my-project
git add js/experience-state.mjs js/experience-state.test.mjs
git commit -m "Add Experience card selection and fan-layout logic"
```

---

## Task 6: Experience page — polaroid fan, timeline, flip cards

**Files:**
- Create: `js/experience.js`
- Create: `experience.html`
- Modify: `css/pages.css` (append Experience section styles)

**Interfaces:**
- Consumes: `createExperienceState`, `selectCard`, `computeFanOffsets` from `js/experience-state.mjs` (Task 5).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Append Experience styles to `css/pages.css`**

```css
.experience-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: var(--space-5) 0;
}

.experience-header__number {
  font-family: var(--font-display);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.experience-header__glow {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 47, 167, 0.9), transparent 70%);
  animation: breathe 4s ease-in-out infinite alternate;
}

.experience-fan {
  position: relative;
  display: flex;
  justify-content: center;
  height: 380px;
  margin-bottom: var(--space-4);
}

.polaroid {
  position: absolute;
  width: 220px;
  padding: var(--space-1) var(--space-1) var(--space-2);
  background: var(--color-surface);
  border-radius: 4px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  border: none;
  transition: transform var(--transition-slow);
  perspective: 1000px;
  text-align: left;
}

.polaroid__face {
  display: block;
  backface-visibility: hidden;
  transition: transform var(--transition-slow);
}

.polaroid__face--back {
  position: absolute;
  inset: 0;
  padding: var(--space-2);
  transform: rotateY(180deg);
  font-size: 0.85rem;
  color: var(--color-text-muted);
  background: var(--color-surface);
}

.polaroid.is-flipped .polaroid__face--front {
  transform: rotateY(180deg);
}

.polaroid.is-flipped .polaroid__face--back {
  transform: rotateY(0deg);
}

.polaroid__caption {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: var(--space-1);
  font-size: 0.8rem;
}

.experience-timeline__track {
  display: flex;
  justify-content: space-between;
  border-top: 2px solid var(--color-klein-blue-soft);
  padding-top: var(--space-2);
}

.experience-timeline__tick {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  padding: var(--space-1);
  border-bottom: 2px solid transparent;
}

.experience-timeline__tick.is-active {
  color: var(--color-klein-blue);
  border-bottom-color: var(--color-klein-blue);
  font-weight: 700;
}

@media (max-width: 768px) {
  .experience-fan {
    overflow-x: auto;
    justify-content: flex-start;
    gap: var(--space-2);
  }

  .polaroid {
    position: relative;
    transform: none !important;
  }
}
```

- [ ] **Step 2: Write `js/experience.js`**

```js
import { createExperienceState, selectCard, computeFanOffsets } from './experience-state.mjs';

const CARDS = [
  {
    org: 'Lanzhou University',
    role: 'Bachelor · Public Administration',
    period: '2018',
    detail: '[Text placeholder: describe coursework, honors, and a standout project from this degree.]',
  },
  {
    org: 'Tongji University',
    role: "Master's · International Relations",
    period: '2022',
    detail: '[Text placeholder: describe your thesis focus and the coursework that shaped it.]',
  },
  {
    org: 'AI Product Team',
    role: 'Product Intern',
    period: '2024',
    detail: '[Text placeholder: describe your responsibilities and one concrete outcome.]',
  },
  {
    org: 'Content Strategy Team',
    role: 'Content Strategy Intern',
    period: '2023',
    detail: '[Text placeholder: describe the campaigns or content you shaped.]',
  },
];

let state = createExperienceState(CARDS.length, 0);

function render() {
  const offsets = computeFanOffsets(state.cardCount, state.activeIndex);

  document.querySelectorAll('.polaroid').forEach((card, i) => {
    const offset = offsets[i];
    const scale = offset.isActive ? 1.08 : 0.94;
    card.style.transform = `translateX(${offset.translateX}px) rotate(${offset.rotateDeg}deg) scale(${scale})`;
    card.style.zIndex = String(offset.zIndex);
    card.classList.toggle('is-active', offset.isActive);
    card.classList.toggle('is-flipped', offset.isActive && state.flipped);
  });

  document.querySelectorAll('.experience-timeline__tick').forEach((tick, i) => {
    tick.classList.toggle('is-active', i === state.activeIndex);
  });
}

function handleSelect(index) {
  state = selectCard(state, index);
  render();
}

function buildFan() {
  const fan = document.querySelector('.experience-fan');
  const track = document.querySelector('.experience-timeline__track');
  if (!fan || !track) return;

  CARDS.forEach((card, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'polaroid';
    el.setAttribute('aria-label', `${card.org}, ${card.role}, ${card.period}. Click to select, click again to flip.`);
    el.innerHTML = `
      <span class="polaroid__face polaroid__face--front">
        <span class="placeholder-img" style="min-height:160px;">[Photo placeholder: ${card.org}]</span>
        <span class="polaroid__caption">
          <strong>${card.org}</strong>
          <span>${card.role}</span>
          <span>${card.period}</span>
        </span>
      </span>
      <span class="polaroid__face polaroid__face--back">${card.detail}</span>
    `;
    el.addEventListener('click', () => handleSelect(i));
    fan.appendChild(el);

    const tick = document.createElement('button');
    tick.type = 'button';
    tick.className = 'experience-timeline__tick';
    tick.textContent = card.period;
    tick.setAttribute('aria-label', `Select ${card.org}, ${card.period}`);
    tick.addEventListener('click', () => handleSelect(i));
    track.appendChild(tick);
  });

  render();
}

document.addEventListener('DOMContentLoaded', buildFan);
```

- [ ] **Step 3: Write `experience.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Anjie — Experience</title>
  <link rel="icon" href="assets/icons/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Noto+Serif+SC:wght@500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/nav.css" />
  <link rel="stylesheet" href="css/pages.css" />
</head>
<body>
  <header class="site-nav">
    <a class="site-nav__brand" href="index.html">Anjie</a>
    <button type="button" class="site-nav__toggle" aria-label="Toggle navigation menu" aria-expanded="false">☰</button>
    <nav aria-label="Primary">
      <ul class="site-nav__links">
        <li><a href="about.html">About</a></li>
        <li><a href="experience.html" aria-current="page">Experience</a></li>
        <li><a href="study-diary.html">Study Diary</a></li>
        <li><a href="share-life.html">Share Life</a></li>
        <li><a href="toolkit.html">Toolkit</a></li>
        <li><a href="contact.html">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main class="container">
    <div class="experience-header">
      <span class="experience-header__number">02 — Experience</span>
      <span class="experience-header__glow" aria-hidden="true"></span>
    </div>

    <div class="experience-fan"></div>

    <div class="experience-timeline__track"></div>
  </main>

  <footer class="site-footer">
    <p>&copy; 2026 Anjie</p>
  </footer>

  <script src="js/nav.js" defer></script>
  <script type="module" src="js/experience.js"></script>
</body>
</html>
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:8000/experience.html`. Expected:
- 4 polaroid-style cards appear fanned/overlapping, one centered and enlarged (the active one).
- A row of year buttons (2018/2022/2024/2023) sits below; the one matching the active card is underlined in Klein blue.
- Clicking a non-active card, or a different year, brings that card to the front (centered, un-rotated) without flipping it.
- Clicking the already-active (front) card flips it 3D to reveal the placeholder detail text on the back; clicking it again flips it back.
- Resize under 768px: cards become a horizontally scrollable row with no rotation.

- [ ] **Step 5: Commit**

```bash
cd /Users/estrella/Desktop/my-project
git add js/experience.js experience.html css/pages.css
git commit -m "Add Experience page with fanned flip cards and timeline"
```

---

## Task 7: Study Diary state logic (pagination)

**Files:**
- Create: `js/diary-state.mjs`
- Create: `js/diary-state.test.mjs`

**Interfaces:**
- Produces: `createDiaryState(totalPages) -> {current, totalPages, isOpen}`, `openBook(state) -> state`, `goToNext(state) -> state`, `goToPrevious(state) -> state`, `canGoNext(state) -> boolean`, `canGoPrevious(state) -> boolean`. Consumed by `js/diary.js` in Task 8.

- [ ] **Step 1: Write the failing tests**

```js
// js/diary-state.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
} from './diary-state.mjs';

test('starts closed on the first page', () => {
  const state = createDiaryState(3);
  assert.equal(state.isOpen, false);
  assert.equal(state.current, 0);
});

test('opening the book does not change the current page', () => {
  const state = openBook(createDiaryState(3));
  assert.equal(state.isOpen, true);
  assert.equal(state.current, 0);
});

test('previous is clamped at the first page', () => {
  const state = createDiaryState(3);
  assert.equal(canGoPrevious(state), false);
  const stillFirst = goToPrevious(state);
  assert.equal(stillFirst.current, 0);
});

test('next moves forward and is clamped at the last page', () => {
  let state = createDiaryState(3);
  state = goToNext(state);
  state = goToNext(state);
  assert.equal(state.current, 2);
  assert.equal(canGoNext(state), false);

  const stillLast = goToNext(state);
  assert.equal(stillLast.current, 2);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
cd /Users/estrella/Desktop/my-project
node --test js/diary-state.test.mjs
```

Expected: FAIL — `Cannot find module './diary-state.mjs'`.

- [ ] **Step 3: Implement `js/diary-state.mjs`**

```js
export function createDiaryState(totalPages) {
  return { current: 0, totalPages, isOpen: false };
}

export function openBook(state) {
  return { ...state, isOpen: true };
}

export function goToNext(state) {
  if (state.current >= state.totalPages - 1) return state;
  return { ...state, current: state.current + 1 };
}

export function goToPrevious(state) {
  if (state.current <= 0) return state;
  return { ...state, current: state.current - 1 };
}

export function canGoNext(state) {
  return state.current < state.totalPages - 1;
}

export function canGoPrevious(state) {
  return state.current > 0;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
node --test js/diary-state.test.mjs
```

Expected: PASS — 4 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
cd /Users/estrella/Desktop/my-project
git add js/diary-state.mjs js/diary-state.test.mjs
git commit -m "Add Study Diary pagination logic"
```

---

## Task 8: Study Diary page — cover, page-turn, pagination dots

**Files:**
- Create: `js/diary.js`
- Create: `study-diary.html`
- Modify: `css/pages.css` (append Study Diary section styles)

**Interfaces:**
- Consumes: `createDiaryState`, `openBook`, `goToNext`, `goToPrevious`, `canGoNext`, `canGoPrevious` from `js/diary-state.mjs` (Task 7).
- Produces: nothing consumed by later tasks. Diary entries are placeholder data (3 entries) the user replaces later — the number of entries is intentionally not fixed by the design, so `ENTRIES.length` is the only thing that needs to change to add more.

- [ ] **Step 1: Append Study Diary styles to `css/pages.css`**

```css
.diary {
  position: relative;
  min-height: 70vh;
}

.diary-cover {
  position: relative;
  width: 320px;
  min-height: 460px;
  margin: var(--space-5) auto;
  padding: var(--space-4);
  background: var(--color-klein-blue);
  color: #fff;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.diary-cover__label {
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  opacity: 0.75;
}

.diary-cover__title {
  font-size: 2rem;
  line-height: 1.2;
}

.diary-cover__open {
  position: absolute;
  top: 50%;
  right: -22px;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: #fff;
  color: var(--color-klein-blue);
  font-size: 1.2rem;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
}

.diary-cover__open.is-clicked {
  background: var(--color-klein-blue);
  color: #fff;
  box-shadow: 0 0 20px rgba(0, 47, 167, 0.6);
}

.diary-book {
  display: none;
}

.diary.is-open .diary-cover {
  display: none;
}

.diary.is-open .diary-book {
  display: grid;
  grid-template-columns: auto 1fr 1fr auto;
  align-items: stretch;
  gap: var(--space-2);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
  padding: var(--space-4);
  position: relative;
}

.diary-page--left {
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  padding-right: var(--space-3);
}

.diary-page--right {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.diary-page__number {
  color: var(--color-klein-blue);
  font-size: 0.8rem;
  letter-spacing: 0.1em;
}

.diary-page__category {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.diary-nav {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 50%;
  width: 44px;
  height: 44px;
  cursor: pointer;
  color: var(--color-text);
  align-self: center;
  transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
}

.diary-nav.is-clicked {
  background: var(--color-klein-blue);
  color: #fff;
  box-shadow: 0 0 16px rgba(0, 47, 167, 0.5);
}

.diary-nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.diary-pagination {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-3);
}

.diary-pagination__dots {
  display: flex;
  gap: 6px;
}

.diary-pagination__dot {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: rgba(0, 47, 167, 0.25);
  transition: all var(--transition-fast);
}

.diary-pagination__dot.is-active {
  width: 18px;
  background: var(--color-klein-blue);
}

.diary-pagination__count {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

@media (max-width: 768px) {
  .diary.is-open .diary-book {
    grid-template-columns: auto 1fr auto;
  }

  .diary-page--right {
    grid-column: 1 / -1;
  }
}
```

- [ ] **Step 2: Write `js/diary.js`**

```js
import {
  createDiaryState,
  openBook,
  goToNext,
  goToPrevious,
  canGoNext,
  canGoPrevious,
} from './diary-state.mjs';

const ENTRIES = [
  {
    number: '01',
    category: 'On Arrival',
    title: 'First Week',
    body: '[Text placeholder: describe your first impressions of the city and program.]',
    images: ['[Photo placeholder: arrival photo]'],
  },
  {
    number: '02',
    category: 'On Everyday Life',
    title: 'Between Classes',
    body: '[Text placeholder: describe a typical day, a favorite spot, or a small ritual.]',
    images: ['[Photo placeholder: campus photo]', '[Photo placeholder: street photo]'],
  },
  {
    number: '03',
    category: 'On Reflection',
    title: 'What Changed',
    body: '[Text placeholder: describe how the experience shifted your perspective.]',
    images: ['[Photo placeholder: reflection photo]'],
  },
];

let state = createDiaryState(ENTRIES.length);

function renderPage() {
  const entry = ENTRIES[state.current];

  document.querySelector('.diary-page__number').textContent = entry.number;
  document.querySelector('.diary-page__category').textContent = entry.category;
  document.querySelector('.diary-page__title').textContent = entry.title;
  document.querySelector('.diary-page__body').textContent = entry.body;

  const imagesEl = document.querySelector('.diary-page__images');
  imagesEl.innerHTML = '';
  entry.images.forEach((label) => {
    const div = document.createElement('div');
    div.className = 'placeholder-img';
    div.textContent = label;
    imagesEl.appendChild(div);
  });

  document.querySelector('.diary-pagination__count').textContent =
    `${state.current + 1} / ${state.totalPages}`;

  document.querySelectorAll('.diary-pagination__dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === state.current);
  });

  document.querySelector('.diary-nav--prev').disabled = !canGoPrevious(state);
  document.querySelector('.diary-nav--next').disabled = !canGoNext(state);
}

function buildDots() {
  const dotsEl = document.querySelector('.diary-pagination__dots');
  dotsEl.innerHTML = '';
  ENTRIES.forEach(() => {
    const dot = document.createElement('span');
    dot.className = 'diary-pagination__dot';
    dotsEl.appendChild(dot);
  });
}

function flashClicked(button) {
  button.classList.add('is-clicked');
  setTimeout(() => button.classList.remove('is-clicked'), 500);
}

function openCover(button) {
  flashClicked(button);
  state = openBook(state);
  document.querySelector('.diary').classList.add('is-open');
  renderPage();
}

document.addEventListener('DOMContentLoaded', () => {
  buildDots();

  document.querySelector('.diary-cover__open').addEventListener('click', (event) => {
    openCover(event.currentTarget);
  });

  document.querySelector('.diary-nav--next').addEventListener('click', (event) => {
    state = goToNext(state);
    flashClicked(event.currentTarget);
    renderPage();
  });

  document.querySelector('.diary-nav--prev').addEventListener('click', (event) => {
    state = goToPrevious(state);
    flashClicked(event.currentTarget);
    renderPage();
  });

  document.addEventListener('keydown', (event) => {
    if (!state.isOpen) return;
    if (event.key === 'ArrowRight') {
      state = goToNext(state);
      renderPage();
    }
    if (event.key === 'ArrowLeft') {
      state = goToPrevious(state);
      renderPage();
    }
  });
});
```

- [ ] **Step 3: Write `study-diary.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Anjie — Study Diary</title>
  <link rel="icon" href="assets/icons/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Noto+Serif+SC:wght@500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/nav.css" />
  <link rel="stylesheet" href="css/pages.css" />
</head>
<body>
  <header class="site-nav">
    <a class="site-nav__brand" href="index.html">Anjie</a>
    <button type="button" class="site-nav__toggle" aria-label="Toggle navigation menu" aria-expanded="false">☰</button>
    <nav aria-label="Primary">
      <ul class="site-nav__links">
        <li><a href="about.html">About</a></li>
        <li><a href="experience.html">Experience</a></li>
        <li><a href="study-diary.html" aria-current="page">Study Diary</a></li>
        <li><a href="share-life.html">Share Life</a></li>
        <li><a href="toolkit.html">Toolkit</a></li>
        <li><a href="contact.html">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <section class="diary container">
      <div class="diary-cover">
        <p class="diary-cover__label">STUDY DIARY / 2026</p>
        <h1 class="diary-cover__title">Study<br />Diary.</h1>
        <button type="button" class="diary-cover__open" aria-label="Open diary">›</button>
      </div>

      <div class="diary-book">
        <button type="button" class="diary-nav diary-nav--prev" aria-label="Previous page">‹</button>
        <div class="diary-page diary-page--left">
          <p class="diary-page__number"></p>
          <p class="diary-page__category"></p>
          <h2 class="diary-page__title"></h2>
          <p class="diary-page__body"></p>
        </div>
        <div class="diary-page diary-page--right diary-page__images"></div>
        <button type="button" class="diary-nav diary-nav--next" aria-label="Next page">›</button>
      </div>

      <div class="diary-pagination">
        <div class="diary-pagination__dots"></div>
        <p class="diary-pagination__count"></p>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <p>&copy; 2026 Anjie</p>
  </footer>

  <script src="js/nav.js" defer></script>
  <script type="module" src="js/diary.js"></script>
</body>
</html>
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:8000/study-diary.html`. Expected:
- A closed Klein-blue book cover shows with a white circular "open" button on its right edge.
- Clicking the button briefly turns it blue, then the cover disappears and page 1 of 3 shows: left side has a category label + title + body text, right side has one placeholder image.
- Page count reads "1 / 3"; the "previous" (‹) button is disabled/grayed.
- Clicking "next" (›) advances to page 2 (two stacked placeholder images on the right, different text on the left), turns blue briefly, and the active pagination dot moves and elongates.
- On page 3, "next" becomes disabled. Left/Right arrow keys also navigate.

- [ ] **Step 5: Commit**

```bash
cd /Users/estrella/Desktop/my-project
git add js/diary.js study-diary.html css/pages.css
git commit -m "Add Study Diary page with cover and page-turn navigation"
```

---

## Task 9: Share Life and Insights page

**Files:**
- Create: `share-life.html`
- Modify: `css/pages.css` (append Share Life section styles)

**Interfaces:**
- Consumes: `.button`, `.button--primary`, `.placeholder-img` from `css/base.css`; nav/footer from Task 2.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Append Share Life styles to `css/pages.css`**

```css
.share-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin: var(--space-5) 0 var(--space-2);
}

.share-header__number {
  font-size: 0.8rem;
  letter-spacing: 0.15em;
  color: var(--color-text-muted);
}

.share-header__meta {
  text-align: right;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.share-header__stats {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  margin-top: var(--space-1);
}

.share-header__stats strong {
  display: block;
  color: var(--color-klein-blue);
  font-size: 1.2rem;
}

.share-header__stats span {
  font-size: 0.7rem;
  letter-spacing: 0.1em;
}

.share-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-3);
  margin: var(--space-3) 0 var(--space-4);
}

.share-card {
  display: block;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.share-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.1);
}

.share-card__caption {
  padding: var(--space-2);
  font-size: 0.9rem;
  color: var(--color-text);
}

.share-footer-hint {
  text-align: center;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding-top: var(--space-2);
  margin-top: var(--space-4);
  color: var(--color-text-muted);
  font-size: 0.8rem;
  letter-spacing: 0.08em;
}
```

- [ ] **Step 2: Write `share-life.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Anjie — Share Life and Insights</title>
  <link rel="icon" href="assets/icons/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Noto+Serif+SC:wght@500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/nav.css" />
  <link rel="stylesheet" href="css/pages.css" />
</head>
<body>
  <header class="site-nav">
    <a class="site-nav__brand" href="index.html">Anjie</a>
    <button type="button" class="site-nav__toggle" aria-label="Toggle navigation menu" aria-expanded="false">☰</button>
    <nav aria-label="Primary">
      <ul class="site-nav__links">
        <li><a href="about.html">About</a></li>
        <li><a href="experience.html">Experience</a></li>
        <li><a href="study-diary.html">Study Diary</a></li>
        <li><a href="share-life.html" aria-current="page">Share Life</a></li>
        <li><a href="toolkit.html">Toolkit</a></li>
        <li><a href="contact.html">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main class="container">
    <header class="share-header">
      <div>
        <p class="share-header__number">04 — Share Life</p>
        <h1>Share<br /><span class="emphasis">Life &amp; Insights</span></h1>
      </div>
      <div class="share-header__meta">
        <p>记录成长中的每一步。<br />Record growth in my 20s.</p>
        <div class="share-header__stats">
          <div><strong>[placeholder]</strong><span>Followers</span></div>
          <div><strong>[placeholder]</strong><span>Likes</span></div>
        </div>
      </div>
    </header>

    <a class="button button--primary" href="#" target="_blank" rel="noopener">关注我的抖音</a>

    <div class="share-grid">
      <a class="share-card" href="#" target="_blank" rel="noopener">
        <div class="placeholder-img">[Douyin screenshot placeholder 1]</div>
        <p class="share-card__caption">[Text placeholder: caption for post 1]</p>
      </a>
      <a class="share-card" href="#" target="_blank" rel="noopener">
        <div class="placeholder-img">[Douyin screenshot placeholder 2]</div>
        <p class="share-card__caption">[Text placeholder: caption for post 2]</p>
      </a>
      <a class="share-card" href="#" target="_blank" rel="noopener">
        <div class="placeholder-img">[Douyin screenshot placeholder 3]</div>
        <p class="share-card__caption">[Text placeholder: caption for post 3]</p>
      </a>
      <a class="share-card" href="#" target="_blank" rel="noopener">
        <div class="placeholder-img">[Douyin screenshot placeholder 4]</div>
        <p class="share-card__caption">[Text placeholder: caption for post 4]</p>
      </a>
      <a class="share-card" href="#" target="_blank" rel="noopener">
        <div class="placeholder-img">[Douyin screenshot placeholder 5]</div>
        <p class="share-card__caption">[Text placeholder: caption for post 5]</p>
      </a>
    </div>

    <p class="share-footer-hint">点击查看更多</p>
  </main>

  <footer class="site-footer">
    <p>&copy; 2026 Anjie</p>
  </footer>

  <script src="js/nav.js" defer></script>
</body>
</html>
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:8000/share-life.html`. Expected:
- Header shows "04 — Share Life" label, two-line title (second line blue), and right-aligned bilingual tagline + placeholder follower/like stats.
- A pill "关注我的抖音" button below the header.
- A responsive grid of 5 placeholder cards, each with a caption; hover lifts the card slightly.
- Resize under ~500px width: grid collapses to a single column.

- [ ] **Step 4: Commit**

```bash
cd /Users/estrella/Desktop/my-project
git add share-life.html css/pages.css
git commit -m "Add Share Life and Insights page"
```

---

## Task 10: Toolkit page

**Files:**
- Create: `toolkit.html`
- Modify: `css/pages.css` (append Toolkit section styles)

**Interfaces:**
- Consumes: `.tag-cloud`, `.tag` from `css/base.css`; nav/footer from Task 2.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Append Toolkit styles to `css/pages.css`**

```css
.toolkit {
  padding: var(--space-5) 0;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-3);
}

.project-card {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
}

.project-card .tag-cloud {
  margin: var(--space-1) 0;
}
```

- [ ] **Step 2: Write `toolkit.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Anjie — Toolkit</title>
  <link rel="icon" href="assets/icons/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Noto+Serif+SC:wght@500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/nav.css" />
  <link rel="stylesheet" href="css/pages.css" />
</head>
<body>
  <header class="site-nav">
    <a class="site-nav__brand" href="index.html">Anjie</a>
    <button type="button" class="site-nav__toggle" aria-label="Toggle navigation menu" aria-expanded="false">☰</button>
    <nav aria-label="Primary">
      <ul class="site-nav__links">
        <li><a href="about.html">About</a></li>
        <li><a href="experience.html">Experience</a></li>
        <li><a href="study-diary.html">Study Diary</a></li>
        <li><a href="share-life.html">Share Life</a></li>
        <li><a href="toolkit.html" aria-current="page">Toolkit</a></li>
        <li><a href="contact.html">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main class="container toolkit">
    <h1>Toolkit</h1>

    <h2>Skills</h2>
    <div class="tag-cloud">
      <span class="tag">Python</span>
      <span class="tag">Figma</span>
      <span class="tag">Prompt Engineering</span>
      <span class="tag">React</span>
      <span class="tag">Product Strategy</span>
      <span class="tag">Data Storytelling</span>
    </div>

    <h2>Projects</h2>
    <div class="project-grid">
      <article class="project-card">
        <h3>[Project name placeholder 1]</h3>
        <p>[Text placeholder: one-sentence description of this vibe-coding project.]</p>
        <div class="tag-cloud">
          <span class="tag">JavaScript</span>
        </div>
        <a href="#" target="_blank" rel="noopener">GitHub ↗</a>
      </article>
      <article class="project-card">
        <h3>[Project name placeholder 2]</h3>
        <p>[Text placeholder: one-sentence description of this vibe-coding project.]</p>
        <div class="tag-cloud">
          <span class="tag">Python</span>
        </div>
        <a href="#" target="_blank" rel="noopener">GitHub ↗</a>
      </article>
      <article class="project-card">
        <h3>[Project name placeholder 3]</h3>
        <p>[Text placeholder: one-sentence description of this vibe-coding project.]</p>
        <div class="tag-cloud">
          <span class="tag">AI</span>
        </div>
        <a href="#" target="_blank" rel="noopener">GitHub ↗</a>
      </article>
      <article class="project-card">
        <h3>[Project name placeholder 4]</h3>
        <p>[Text placeholder: one-sentence description of this vibe-coding project.]</p>
        <div class="tag-cloud">
          <span class="tag">Design</span>
        </div>
        <a href="#" target="_blank" rel="noopener">GitHub ↗</a>
      </article>
    </div>
  </main>

  <footer class="site-footer">
    <p>&copy; 2026 Anjie</p>
  </footer>

  <script src="js/nav.js" defer></script>
</body>
</html>
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:8000/toolkit.html`. Expected:
- "Skills" section shows 6 dashed-border pill tags in a wrapping row.
- "Projects" section shows a responsive grid of 4 cards, each with a title, description, one tag, and a "GitHub ↗" link.
- Resize narrow: project grid collapses to one column.

- [ ] **Step 4: Commit**

```bash
cd /Users/estrella/Desktop/my-project
git add toolkit.html css/pages.css
git commit -m "Add Toolkit page"
```

---

## Task 11: Contact page

**Files:**
- Create: `contact.html`
- Modify: `css/pages.css` (append Contact section styles)

**Interfaces:**
- Consumes: `@keyframes breathe` from `css/base.css`; nav/footer from Task 2.
- Produces: nothing consumed by later tasks. This is the final page task.

- [ ] **Step 1: Append Contact styles to `css/pages.css`**

```css
.contact {
  position: relative;
  text-align: center;
  padding: var(--space-6) var(--space-3);
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.contact__glow {
  position: absolute;
  top: 20%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 160px;
  height: 160px;
  background: radial-gradient(circle, rgba(0, 47, 167, 0.15), transparent 70%);
  animation: breathe 6s ease-in-out infinite alternate;
  pointer-events: none;
}

.contact__heading {
  font-family: var(--font-display);
  font-size: 2.5rem;
  color: var(--color-klein-blue);
}

.contact-links {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-4);
  flex-wrap: wrap;
  justify-content: center;
}

.contact-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  border: 1px solid var(--color-klein-blue);
  border-radius: 999px;
  padding: var(--space-1) var(--space-3);
  color: var(--color-klein-blue);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.contact-link:hover {
  background: var(--color-klein-blue);
  color: #fff;
}
```

- [ ] **Step 2: Write `contact.html`**

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
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Noto+Serif+SC:wght@500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/base.css" />
  <link rel="stylesheet" href="css/nav.css" />
  <link rel="stylesheet" href="css/pages.css" />
</head>
<body>
  <header class="site-nav">
    <a class="site-nav__brand" href="index.html">Anjie</a>
    <button type="button" class="site-nav__toggle" aria-label="Toggle navigation menu" aria-expanded="false">☰</button>
    <nav aria-label="Primary">
      <ul class="site-nav__links">
        <li><a href="about.html">About</a></li>
        <li><a href="experience.html">Experience</a></li>
        <li><a href="study-diary.html">Study Diary</a></li>
        <li><a href="share-life.html">Share Life</a></li>
        <li><a href="toolkit.html">Toolkit</a></li>
        <li><a href="contact.html" aria-current="page">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main class="contact container">
    <div class="contact__glow" aria-hidden="true"></div>
    <h1 class="contact__heading">Hello again,</h1>
    <p>thanks for reading this far. Let's build something.</p>
    <div class="contact-links">
      <a class="contact-link" href="mailto:anjiexu425@gmail.com">
        <span aria-hidden="true">✉</span> Email
      </a>
      <a class="contact-link" href="#" target="_blank" rel="noopener">
        <span aria-hidden="true">⌥</span> GitHub
      </a>
      <a class="contact-link" href="#" target="_blank" rel="noopener">
        <span aria-hidden="true">♪</span> TikTok
      </a>
    </div>
  </main>

  <footer class="site-footer">
    <p>&copy; 2026 Anjie</p>
  </footer>

  <script src="js/nav.js" defer></script>
</body>
</html>
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:8000/contact.html`. Expected:
- A faint blue glow slowly breathes behind the centered heading.
- "Hello again," in large blue serif, one line of body text below.
- 3 pill-shaped contact buttons (Email/GitHub/TikTok); Email opens the default mail client addressed to `anjiexu425@gmail.com`; hover fills each button with Klein blue.

- [ ] **Step 4: Commit**

```bash
cd /Users/estrella/Desktop/my-project
git add contact.html css/pages.css
git commit -m "Add Contact page"
```

---

## Task 12: Cross-page verification pass

**Files:**
- Modify (only if issues are found): any of `css/base.css`, `css/nav.css`, `css/pages.css`, `js/nav.js`, or any `.html` file.

**Interfaces:**
- Consumes: everything produced by Tasks 1–11.
- Produces: nothing further — this is the final task.

- [ ] **Step 1: Run every logic test suite together**

```bash
cd /Users/estrella/Desktop/my-project
node --test js/*.test.mjs
```

Expected: PASS — all 11 tests across `circle-nav-math.test.mjs`, `experience-state.test.mjs`, and `diary-state.test.mjs`, 0 failures.

- [ ] **Step 2: Walk every page's navigation**

With the local server running (`python3 -m http.server 8000` from the project root), starting at `http://localhost:8000/index.html`, click through: Home → About → Experience → Study Diary → Share Life → Toolkit → Contact → Home (via the brand link). Confirm:
- Every page loads with no console errors (open browser dev tools console on each page).
- The top nav's active-page underline matches the current page on every page.
- The hamburger menu (resize under 768px) opens and closes on every page.

- [ ] **Step 3: Responsive sweep**

At each of 375px, 768px, 1024px, and 1440px viewport widths, open every page and confirm no horizontal scrollbar appears and no text/element overlaps another. Pay particular attention to: the Home circular nav vs. mobile list swap at 768px, the Experience fan vs. horizontal-scroll swap at 768px, and the Study Diary book grid reflow at 768px.

- [ ] **Step 4: Fix any issues found**

If Steps 2 or 3 surface a problem, fix it in the relevant file(s) listed above, re-run the affected verification step, and confirm it now passes before moving on.

- [ ] **Step 5: Final commit**

```bash
cd /Users/estrella/Desktop/my-project
git add -A
git status
```

If Step 4 produced changes, commit them:

```bash
git commit -m "Fix cross-page issues found during verification pass"
```

If Step 4 produced no changes, skip the commit — there is nothing new to record.
