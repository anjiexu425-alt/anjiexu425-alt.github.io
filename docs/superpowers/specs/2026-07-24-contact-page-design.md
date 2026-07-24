# Contact Page Design

## Purpose

Add a `Contact` page (`contact.html`, already linked from the shared nav across every other page but not yet built) — an immersive, standalone landing page with a title, three contact links, and a klein-blue-toned 3D physics ball-pit background. Adapted from a standalone reference mockup file.

## Visual style

Unlike every other page on the site (About/Experience/Study Diary/Share Life/Toolkit), this page is a deliberately independent, minimalist full-screen experience:

- No shared `.site-nav` header/footer. Only a single "返回" (back) link, fixed top-left, linking to `index.html`.
- Centered title "GET IN TOUCH" in Playfair Display, uppercase, letter-spaced, above three pill-shaped contact links (Email / GitHub / Douyin), each with an icon and a small monospace label.
- Background: a Three.js 3D scene of ~120 physically-simulated glass spheres (gravity, floor/ceiling/wall bounce, soft sphere-sphere collision, mouse-hover bounce) in klein-blue-family colors, rendered on a fixed full-viewport `<canvas>` behind the content layer (same layering approach as the reference: canvas z-index 0, content z-index 1, `pointer-events: none` on non-interactive wrapper elements so the canvas still receives mouse-move events for the hover-bounce effect).
- Fonts/accent color reuse the site's existing values (klein blue `#002FA7`, Playfair Display for the title) even though the rest of the page's structure (bg color, spacing, no shared nav) is intentionally its own thing, not reusing `css/base.css`'s shared page chrome.

## Content

Three contact links:
- Email → `mailto:anjiexu0630@163.com` (matches the Share Life page's existing bio email)
- GitHub → placeholder `https://github.com` (owner will replace with their real profile URL after this ships)
- Douyin → placeholder `https://www.douyin.com` (owner will replace with their real profile URL after this ships)

## File plan

- **`contact.html`** (new) — page markup (back link, title, contact links, footer) plus an inline `<script>` block containing the Three.js ball-pit animation, ported near-verbatim from the reference file. Kept inline (not extracted to `js/contact.js`) because it's a one-shot visual effect with no state management, no Supabase interaction, and no data to unit test — consistent with there being nothing here for `node --test` to meaningfully cover.
- **`css/contact.css`** (new) — the reference file's `<style>` block extracted into its own stylesheet, following this project's convention of one CSS file per page (see `css/share-life.css`, `css/toolkit.css`).
- Three.js is loaded via the same CDN URL the reference file uses (`cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`), scoped to this page only — no other page gains this dependency.
- No changes to `css/base.css`, `css/nav.css`, or any other existing page. The nav links to `contact.html` already exist across the site (`index.html`, `about.html`, etc.) — nothing to update there.

## Out of scope

- No shared site navigation on this page (explicit design choice, confirmed with the site owner).
- No contact form, no backend, no Supabase — purely static links.
- No automated tests: this is a visual/static page with no business logic to unit test (matches the project's existing pattern of not unit-testing purely presentational pages).
