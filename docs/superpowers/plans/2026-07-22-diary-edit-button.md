# Abroad Diary Edit Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `Edit` button next to `Write Diary` in the Abroad Diary header that lets the user edit the text, images, and video of the currently displayed diary page in place.

**Architecture:** Reuse the existing "write diary" modal (`write-diary-modal` / `write-diary-form` in `ai-studio-diary-book/App.tsx`) in a new "edit mode", toggled by a new `editingSpreadId` state value. Clicking `Edit` prefills the same form fields from the active spread; submitting in edit mode replaces that spread in place instead of appending a new one.

**Tech Stack:** React 19 + TypeScript (function components, hooks), Tailwind CSS v4 (via `@tailwindcss/vite`), `lucide-react` icons, `motion/react` (the `motion` package) for animation, bundled with Vite.

## Global Constraints

- Single file of consequence: `ai-studio-diary-book/App.tsx`. Supporting types/constants live in `ai-studio-diary-book/types.ts` and `ai-studio-diary-book/data.ts`.
- **A local dev environment now exists and is verified working** (Task 1 below — already applied to the working tree as of commit `e7cad3a`). To test any change in a real browser: `cd ai-studio-diary-book && npm install && npm run dev`, then open the printed local URL (Vite default `http://localhost:5173/`, or whatever port it prints if that one is busy). Every verification step in this plan from Task 2 onward is a real click-through in that browser session — no more "trace by inspection."
- Known, out-of-scope limitation of the dev scaffold: the "AI Polish & Motto" button (`ai-enrich-trigger-btn`) calls `fetch('/api/enrich-diary')`, which has no backend in this scaffold and will show a connection error. This is unrelated to the Edit feature — do not click it while testing, and do not report its failure as a regression.
- Preserve all existing behavior of the "new entry" (`Write Diary`) flow — this plan only adds an edit path alongside it, per the approved spec at `docs/superpowers/specs/2026-07-22-diary-edit-button-design.md`.
- Match existing code style exactly: 2-space indentation, single quotes for string literals except template literals, Tailwind utility classes inline, `id` attributes on interactive elements (existing convention throughout the file — e.g. `id="write-diary-btn"`).
- The design doc's default reflection quote (`“Finding beauty in the slow hours of my ... journey.”`) uses Unicode curly quotes (U+201C / U+201D), not straight quotes — preserve exactly as in the source file.

---

### Task 1: Scaffold a local Vite dev environment — DONE

**Status:** Already completed and committed (`e7cad3a`, "Add local Vite dev scaffold for ai-studio-diary-book"). Documented here for reproducibility and so later tasks can reference exactly what exists.

**Files:**
- Create: `ai-studio-diary-book/package.json`
- Create: `ai-studio-diary-book/vite.config.ts`
- Create: `ai-studio-diary-book/index.html`
- Create: `ai-studio-diary-book/main.tsx`
- Create: `ai-studio-diary-book/tsconfig.json`
- Create: `ai-studio-diary-book/.gitignore`

**Interfaces:**
- Produces: a working `npm run dev` command in `ai-studio-diary-book/` that serves `App.tsx` at a local URL. All later tasks' verification steps depend on this.

- [x] **Step 1: `package.json`**

```json
{
  "name": "ai-studio-diary-book",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^1.25.0",
    "motion": "^12.42.2",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.4",
    "tailwindcss": "^4.3.3",
    "typescript": "^7.0.2",
    "vite": "^8.1.5"
  }
}
```

- [x] **Step 2: `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

`@tailwindcss/vite` is required because `index.css` uses Tailwind v4's `@import "tailwindcss";` + `@theme { ... }` syntax (custom `--color-brand-blue`, `--font-serif`, etc.) — the v3 PostCSS setup would not understand this.

- [x] **Step 3: `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Abroad Diary</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

- [x] **Step 4: `main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [x] **Step 5: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["*.ts", "*.tsx"]
}
```

- [x] **Step 6: `.gitignore`** (scoped to this package, so `node_modules`/`dist` never get committed)

```
node_modules/
dist/
```

- [x] **Step 7: Verify it actually runs**

Already verified in this session:
```bash
cd ai-studio-diary-book && npm install   # → "added 45 packages... found 0 vulnerabilities"
npm run dev -- --port 5183 --strictPort  # → "VITE v8.1.5 ready in 888 ms"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5183/          # → 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:5183/main.tsx  # → 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:5183/App.tsx   # → 200 (confirms App.tsx transforms with no syntax errors)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5183/data.ts   # → 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:5183/index.css # → 200
```
No 500s from any of these — the app boots cleanly. (No headless-browser tool was available in this session to also capture a pixel screenshot; a human opening the URL is the remaining check, which every later task's verification step asks for.)

- [x] **Step 8: Commit** — already done as commit `e7cad3a`.

---

### Task 2: Extract `CATEGORY_OPTIONS` into `data.ts`

**Files:**
- Modify: `ai-studio-diary-book/data.ts`
- Modify: `ai-studio-diary-book/App.tsx:26` (import), `App.tsx:1330-1345` (category `<select>` JSX)

**Interfaces:**
- Produces: `CategoryOption` interface (`{ value: string; label: string }`) and `CATEGORY_OPTIONS: CategoryOption[]` exported from `data.ts`. Task 4 depends on `CATEGORY_OPTIONS.map(o => o.value)` for category matching.

This is prep work: today the 7 category choices are hardcoded as `<option>` tags inside the JSX and nowhere else. Task 4's edit-prefill logic needs the same list of valid values to match against, so we extract it once to avoid two out-of-sync copies.

- [ ] **Step 1: Add `CATEGORY_OPTIONS` to `data.ts`**

Open `ai-studio-diary-book/data.ts`. Find the end of the file (the `AMBIENT_TRACKS` export):

```ts
export const AMBIENT_TRACKS = [
  {
    id: 'lofi-1',
    name: 'Calm Healing Lofi',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' // public fallback
  },
  {
    id: 'lofi-2',
    name: 'Rain & Piano Atmosphere',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
  }
];
```

Append immediately after it:

```ts

export interface CategoryOption {
  value: string;
  label: string;
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'Abroad', label: '✈️ Abroad / Travel' },
  { value: 'Chill Beach', label: '🏖️ Chill Beach' },
  { value: 'Cozy', label: '☕ Cozy Coffee Shop' },
  { value: 'Nature', label: '🌳 Quiet Nature' },
  { value: 'City', label: '🌆 City Sunset' },
  { value: 'Rain', label: '🌧️ Rainy Reflection' },
  { value: 'Night', label: '🌙 Midnight Wanderer' }
];
```

- [ ] **Step 2: Import `CATEGORY_OPTIONS` in `App.tsx`**

In `ai-studio-diary-book/App.tsx`, find line 26:

```ts
import { INITIAL_SPREADS, PRESET_MEDIA_LIST, AMBIENT_TRACKS, curDate, BLANK_SPREAD } from './data';
```

Replace with:

```ts
import { INITIAL_SPREADS, PRESET_MEDIA_LIST, AMBIENT_TRACKS, curDate, BLANK_SPREAD, CATEGORY_OPTIONS } from './data';
```

- [ ] **Step 3: Replace the hardcoded `<option>` list with a map over `CATEGORY_OPTIONS`**

In `ai-studio-diary-book/App.tsx`, find:

```tsx
                      <select
                        id="form-input-category"
                        value={writingCategory}
                        onChange={(e) => setWritingCategory(e.target.value)}
                        className="px-3 py-2 text-xs bg-neutral-50 border border-neutral-300/60 rounded-xl focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none"
                      >
                        <option value="Abroad">✈️ Abroad / Travel</option>
                        <option value="Chill Beach">🏖️ Chill Beach</option>
                        <option value="Cozy">☕ Cozy Coffee Shop</option>
                        <option value="Nature">🌳 Quiet Nature</option>
                        <option value="City">🌆 City Sunset</option>
                        <option value="Rain">🌧️ Rainy Reflection</option>
                        <option value="Night">🌙 Midnight Wanderer</option>
                      </select>
```

Replace with:

```tsx
                      <select
                        id="form-input-category"
                        value={writingCategory}
                        onChange={(e) => setWritingCategory(e.target.value)}
                        className="px-3 py-2 text-xs bg-neutral-50 border border-neutral-300/60 rounded-xl focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none"
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
```

- [ ] **Step 4: Verify in the browser**

```bash
cd ai-studio-diary-book && npm run dev
```

Open the printed URL. Click the closed book cover to open it, then click `Write Diary`. Click the `Category` dropdown and confirm all 7 options appear, in the same order, with the same emoji + label text as before (✈️ Abroad / Travel, 🏖️ Chill Beach, ☕ Cozy Coffee Shop, 🌳 Quiet Nature, 🌆 City Sunset, 🌧️ Rainy Reflection, 🌙 Midnight Wanderer). Close the modal. This step should be visually indistinguishable from before the change — it's a pure refactor.

- [ ] **Step 5: Commit**

```bash
git add ai-studio-diary-book/data.ts ai-studio-diary-book/App.tsx
git commit -m "Extract diary category options into a shared CATEGORY_OPTIONS constant"
```

---

### Task 3: Add `editingSpreadId` state and `resetWriterForm` helper

**Files:**
- Modify: `ai-studio-diary-book/App.tsx:367-368` (state), `App.tsx:381-382` (new helper insertion point), `App.tsx:552-563` (save-success reset), `App.tsx:1312-1318` (close button), `App.tsx:1729-1736` (cancel button)

**Interfaces:**
- Consumes: nothing new from Task 2.
- Produces: `editingSpreadId: string | null` state + `setEditingSpreadId`, and `resetWriterForm(): void` (a stable `useCallback` with `[]` deps). Task 4 sets `editingSpreadId`/writer fields via `handleOpenEditor`. Task 6 reads `editingSpreadId` to branch `handleSaveEntry` and calls `resetWriterForm()` on its edit-save path.

This task introduces the state and the reset helper, and wires the helper into the *existing* new-entry save/cancel/close paths, with no new user-facing behavior yet beyond: cancel/close now fully resets the draft (previously they left stale text in the form until the next successful save). This is required so that a cancelled edit (added in Task 4) can never leak into a later "Write Diary" draft — see the approved design doc.

- [ ] **Step 1: Add `editingSpreadId` state**

In `ai-studio-diary-book/App.tsx`, find:

```tsx
  // Diary Writing Modal
  const [isWriting, setIsWriting] = useState<boolean>(false);
  const handleOpenWriter = useCallback(() => setIsWriting(true), []);
```

Replace with:

```tsx
  // Diary Writing Modal
  const [isWriting, setIsWriting] = useState<boolean>(false);
  const [editingSpreadId, setEditingSpreadId] = useState<string | null>(null);
  const handleOpenWriter = useCallback(() => setIsWriting(true), []);
```

- [ ] **Step 2: Add the `resetWriterForm` helper**

In `ai-studio-diary-book/App.tsx`, find:

```tsx
  const [useCustomMedia, setUseCustomMedia] = useState<boolean>(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState<boolean>(false);

  // AI Enrichment state
```

Replace with:

```tsx
  const [useCustomMedia, setUseCustomMedia] = useState<boolean>(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState<boolean>(false);

  // Resets every writer-modal field back to its "new entry" defaults and
  // clears edit mode. Used after a successful save and on cancel/close so
  // an in-progress edit never leaks into the next "Write Diary" draft.
  const resetWriterForm = useCallback(() => {
    setEditingSpreadId(null);
    setWritingTitle('');
    setWritingBody('');
    setWritingCategory('Abroad');
    setWritingDate(curDate());
    setCustomQuote('');
    setSelectedMedia(PRESET_MEDIA_LIST[0]);
    setCustomMediaUrl('');
    setCustomImageUrls(['', '', '', '']);
    setCustomMediaType('video');
    setMediaCaption('');
    setUseCustomMedia(false);
  }, []);

  // AI Enrichment state
```

- [ ] **Step 3: Use `resetWriterForm()` in the new-entry save path**

In `ai-studio-diary-book/App.tsx`, find:

```tsx
    const updated = [...spreads, newSpread];
    setSpreads(updated);
    
    // Clear and close modal
    setWritingTitle('');
    setWritingBody('');
    setCustomQuote('');
    setMediaCaption('');
    setCustomMediaUrl('');
    setCustomImageUrls(['', '', '', '']);
    setIsWriting(false);
    
    // Switch filter to 'All' so they can see it and jump to it
```

Replace with:

```tsx
    const updated = [...spreads, newSpread];
    setSpreads(updated);

    resetWriterForm();
    setIsWriting(false);

    // Switch filter to 'All' so they can see it and jump to it
```

- [ ] **Step 4: Reset on close (X) button**

In `ai-studio-diary-book/App.tsx`, find:

```tsx
                <button
                  id="close-writer-btn"
                  onClick={() => setIsWriting(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
```

Replace with:

```tsx
                <button
                  id="close-writer-btn"
                  onClick={() => { resetWriterForm(); setIsWriting(false); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
```

- [ ] **Step 5: Reset on Cancel button**

In `ai-studio-diary-book/App.tsx`, find:

```tsx
                <button
                  id="writer-cancel-btn"
                  type="button"
                  onClick={() => setIsWriting(false)}
                  className="px-4 py-2 bg-neutral-200 text-neutral-700 hover:bg-neutral-300 rounded-full font-medium text-xs transition-colors cursor-pointer"
                >
```

Replace with:

```tsx
                <button
                  id="writer-cancel-btn"
                  type="button"
                  onClick={() => { resetWriterForm(); setIsWriting(false); }}
                  className="px-4 py-2 bg-neutral-200 text-neutral-700 hover:bg-neutral-300 rounded-full font-medium text-xs transition-colors cursor-pointer"
                >
```

- [ ] **Step 6: Verify in the browser**

```bash
cd ai-studio-diary-book && npm run dev
```

Open the printed URL, open the book, click `Write Diary`:
1. Type something into the `Title` field (e.g. "temp draft"), then click the `X` close button. Reopen `Write Diary` — confirm `Title` is empty again (this proves the close-button reset works; before this task it would have still shown "temp draft").
2. Repeat, but this time type into `Title` and click `Cancel` instead of `X` — confirm the same reset behavior.
3. Fill out a full new entry (title + body required) and click `Insert to Abroad Diary` — confirm it still saves correctly (a new page appears and the book jumps to it), exactly as before this task.

- [ ] **Step 7: Commit**

```bash
git add ai-studio-diary-book/App.tsx
git commit -m "Add editingSpreadId state and resetWriterForm helper for the diary writer modal"
```

---

### Task 4: Add the `Edit` button and `handleOpenEditor` prefill logic

**Files:**
- Modify: `ai-studio-diary-book/App.tsx:5` (icon import), `App.tsx:643-644` (new handler, inserted after `activeSpread`), `App.tsx:748-750` (header button)

**Interfaces:**
- Consumes: `editingSpreadId`/`setEditingSpreadId` and `resetWriterForm` are not used here (this task only *sets into* edit mode, `resetWriterForm` is for leaving it). Consumes `CATEGORY_OPTIONS` from Task 2 and `activeSpread`, `isOpen`, `isDiaryEmpty` (all already defined earlier in `App()`).
- Produces: `handleOpenEditor(): void` and the `edit-diary-btn` button in the header. Task 5/6 don't depend on this task's internals, but this is the only way `editingSpreadId` ever becomes non-null, so it must land before the feature is end-to-end testable.

- [ ] **Step 1: Import the `Pencil` icon**

In `ai-studio-diary-book/App.tsx`, find:

```tsx
import { 
  BookOpen, 
  Book, 
  PenTool, 
  Plus, 
```

Replace with:

```tsx
import { 
  BookOpen, 
  Book, 
  PenTool, 
  Pencil, 
  Plus, 
```

- [ ] **Step 2: Add `handleOpenEditor`, right after `activeSpread` is computed**

In `ai-studio-diary-book/App.tsx`, find:

```tsx
  // Current active spread
  const activeSpread = displaySpreads[currentIndex];

  return (
```

Replace with:

```tsx
  // Current active spread
  const activeSpread = displaySpreads[currentIndex];

  // Open the writer modal pre-filled with the currently displayed spread's
  // content, so saving replaces this page instead of adding a new one.
  const handleOpenEditor = () => {
    if (!activeSpread || activeSpread.id === 'blank-spread') return;

    setEditingSpreadId(activeSpread.id);
    setWritingTitle(activeSpread.leftPage.title);
    setWritingBody(activeSpread.leftPage.bodyText);
    setWritingDate(activeSpread.leftPage.date || curDate());
    setCustomQuote(activeSpread.leftPage.quote || '');
    setMediaCaption(activeSpread.rightPage.caption || '');

    const rawCategory = activeSpread.leftPage.category?.includes('/')
      ? activeSpread.leftPage.category.split('/')[1].trim()
      : activeSpread.leftPage.category || '';
    const matchedCategory = CATEGORY_OPTIONS.find(
      (opt) => opt.value.toLowerCase() === rawCategory.toLowerCase()
    );
    setWritingCategory(matchedCategory ? matchedCategory.value : 'Abroad');

    if (activeSpread.rightPage.urls && activeSpread.rightPage.urls.length > 0) {
      setUseCustomMedia(true);
      setCustomMediaType('image');
      setCustomMediaUrl(activeSpread.rightPage.urls[0] || '');
      setCustomImageUrls([
        activeSpread.rightPage.urls[1] || '',
        activeSpread.rightPage.urls[2] || '',
        activeSpread.rightPage.urls[3] || ''
      ]);
    } else {
      const matchedPreset = PRESET_MEDIA_LIST.find((m) => m.url === activeSpread.rightPage.url);
      if (matchedPreset) {
        setUseCustomMedia(false);
        setSelectedMedia(matchedPreset);
      } else {
        setUseCustomMedia(true);
        setCustomMediaType(activeSpread.rightPage.type);
        setCustomMediaUrl(activeSpread.rightPage.url);
        setCustomImageUrls(['', '', '']);
      }
    }

    setIsWriting(true);
  };

  return (
```

- [ ] **Step 3: Add the `Edit` button to the header, left of `Write Diary`**

In `ai-studio-diary-book/App.tsx`, find:

```tsx
          {/* Write Button */}
          <button
            id="write-diary-btn"
            onClick={() => setIsWriting(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-blue text-white rounded-full font-medium text-xs shadow-md shadow-brand-blue/20 hover:bg-brand-blue-hover hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <PenTool size={13} />
            <span>Write Diary</span>
          </button>
```

Replace with:

```tsx
          {/* Edit Button */}
          <button
            id="edit-diary-btn"
            onClick={handleOpenEditor}
            disabled={!isOpen || isDiaryEmpty || activeSpread.id === 'blank-spread'}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-brand-blue border border-brand-blue/40 rounded-full font-medium text-xs shadow-sm hover:bg-brand-blue/5 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-white"
            title="Edit the current diary page"
          >
            <Pencil size={13} />
            <span>Edit</span>
          </button>

          {/* Write Button */}
          <button
            id="write-diary-btn"
            onClick={() => setIsWriting(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-blue text-white rounded-full font-medium text-xs shadow-md shadow-brand-blue/20 hover:bg-brand-blue-hover hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <PenTool size={13} />
            <span>Write Diary</span>
          </button>
```

- [ ] **Step 4: Verify in the browser**

```bash
cd ai-studio-diary-book && npm run dev
```

Open the printed URL:
1. **Closed cover:** before clicking the book open, confirm the `Edit` button is visible in the header next to `Write Diary` but greyed out (40% opacity) and not clickable (`cursor-not-allowed`).
2. **Open with a real page:** click the cover to open the book (it shows the seeded "A Sunset Dream at Chill Beach" page). Confirm `Edit` is now solid/clickable.
3. Click `Edit`. Confirm the modal opens with: Category = `Chill Beach`, Date = `2026.07.20`, Title = `A Sunset Dream at Chill Beach`, Quote = the seeded quote, Body = the seeded paragraph, media panel switched to the `CUSTOM URL` tab with 4 image link fields filled in (matching the 4 beach photos shown on the right page). Close the modal without saving (click `X`).
4. **Empty diary:** click `Clear All Diaries` at the bottom, confirm the diary shows the blank-spread placeholder page and the `Edit` button is greyed out/disabled again.
5. Click `Restore Demo Diary` to bring the seeded entry back for the next task's testing.

- [ ] **Step 5: Commit**

```bash
git add ai-studio-diary-book/App.tsx
git commit -m "Add Edit button and handleOpenEditor prefill logic to Abroad Diary header"
```

---

### Task 5: Swap modal title/subtitle/submit button text and icon for edit mode

**Files:**
- Modify: `ai-studio-diary-book/App.tsx:1308-1309` (modal title/subtitle), `App.tsx:1738-1745` (submit button)

**Interfaces:**
- Consumes: `editingSpreadId` (Task 3).
- Produces: no new interface — purely presentational, read by nothing downstream.

- [ ] **Step 1: Swap the modal header title and subtitle**

In `ai-studio-diary-book/App.tsx`, find:

```tsx
                  <div>
                    <h3 className="font-serif font-bold text-lg text-neutral-900 leading-tight">Write Abroad Reflection</h3>
                    <p className="text-[11px] text-neutral-400 font-mono tracking-wide mt-0.5 uppercase">Draft new page spread</p>
                  </div>
```

Replace with:

```tsx
                  <div>
                    <h3 className="font-serif font-bold text-lg text-neutral-900 leading-tight">
                      {editingSpreadId ? 'Edit Reflection' : 'Write Abroad Reflection'}
                    </h3>
                    <p className="text-[11px] text-neutral-400 font-mono tracking-wide mt-0.5 uppercase">
                      {editingSpreadId ? 'Update this page spread' : 'Draft new page spread'}
                    </p>
                  </div>
```

- [ ] **Step 2: Swap the submit button icon and label**

In `ai-studio-diary-book/App.tsx`, find:

```tsx
                <button
                  id="writer-submit-btn"
                  type="submit"
                  form="write-diary-form"
                  className="px-5 py-2 bg-brand-blue text-white rounded-full font-medium text-xs shadow-md shadow-brand-blue/25 hover:bg-brand-blue-hover hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                >
                  <PenTool size={13} />
                  <span>Insert to Abroad Diary</span>
                </button>
```

Replace with:

```tsx
                <button
                  id="writer-submit-btn"
                  type="submit"
                  form="write-diary-form"
                  className="px-5 py-2 bg-brand-blue text-white rounded-full font-medium text-xs shadow-md shadow-brand-blue/25 hover:bg-brand-blue-hover hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                >
                  {editingSpreadId ? <Check size={13} /> : <PenTool size={13} />}
                  <span>{editingSpreadId ? 'Save Changes' : 'Insert to Abroad Diary'}</span>
                </button>
```

Note: `Check` is already imported from `lucide-react` (line 18 in the original import block) — no import change needed here.

- [ ] **Step 3: Verify in the browser**

```bash
cd ai-studio-diary-book && npm run dev
```

Open the printed URL, open the book:
1. Click `Write Diary` (fresh, not edit). Confirm the modal title reads "Write Abroad Reflection", subtitle "Draft new page spread", and the submit button shows a pen icon and reads "Insert to Abroad Diary". Close it.
2. Click `Edit` on the current page. Confirm the modal title now reads "Edit Reflection", subtitle "Update this page spread", and the submit button shows a checkmark icon and reads "Save Changes". Close it without saving.

- [ ] **Step 4: Commit**

```bash
git add ai-studio-diary-book/App.tsx
git commit -m "Swap diary writer modal copy and submit icon between write and edit modes"
```

---

### Task 6: Branch `handleSaveEntry` to update an existing spread in edit mode

**Files:**
- Modify: `ai-studio-diary-book/App.tsx:520-572` (the version left by Task 3, Step 3)

**Interfaces:**
- Consumes: `editingSpreadId` (Task 3), `resetWriterForm` (Task 3), `CATEGORY_OPTIONS`-matched `writingCategory` (works the same regardless of how it was set).
- Produces: no new interface — this is the terminal behavior the whole feature exists for.

This is the only task that changes what gets written to `spreads`/`localStorage`. After Task 3, `handleSaveEntry` looks like this (confirm your file matches before editing — if it doesn't, Task 3 wasn't applied correctly and must be fixed first):

```tsx
  // Create a new spread
  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!writingTitle.trim() || !writingBody.trim()) return;

    const newSpreadId = `spread-${Date.now()}`;
    const mediaUrl = useCustomMedia ? customMediaUrl : selectedMedia.url;
    const mediaType = useCustomMedia ? customMediaType : selectedMedia.type;

    // Filter valid custom image urls
    const activeUrls = useCustomMedia && customMediaType === 'image'
      ? [customMediaUrl, ...customImageUrls].map(u => u.trim()).filter(Boolean)
      : [];

    const newSpread: DiarySpread = {
      id: newSpreadId,
      leftPage: {
        id: `left-${Date.now()}`,
        category: `${String(spreads.length).padStart(2, '0')} / ${writingCategory.toUpperCase()}`,
        date: writingDate || curDate(),
        title: writingTitle,
        quote: customQuote || `“Finding beauty in the slow hours of my ${writingCategory.toLowerCase()} journey.”`,
        bodyText: writingBody
      },
      rightPage: {
        type: mediaType,
        url: mediaUrl || PRESET_MEDIA_LIST[0].url,
        ...(activeUrls.length > 1 ? { urls: activeUrls } : {}),
        caption: mediaCaption || `Capturing the perfect aesthetic moment during my ${writingCategory.toLowerCase()} journey.`
      }
    };

    const updated = [...spreads, newSpread];
    setSpreads(updated);

    resetWriterForm();
    setIsWriting(false);

    // Switch filter to 'All' so they can see it and jump to it
    setSelectedCategory('All');
    setIsOpen(true);
    
    // Jump to the newly added page
    setTimeout(() => {
      setCurrentIndex(updated.length - 1);
    }, 100);
  };
```

- [ ] **Step 1: Insert the edit-mode branch and hoist the shared `mediaUrl`/`mediaType`/`activeUrls` computation**

Replace the entire function body shown above with:

```tsx
  // Create a new spread, or apply edits to an existing one
  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!writingTitle.trim() || !writingBody.trim()) return;

    const mediaUrl = useCustomMedia ? customMediaUrl : selectedMedia.url;
    const mediaType = useCustomMedia ? customMediaType : selectedMedia.type;

    // Filter valid custom image urls
    const activeUrls = useCustomMedia && customMediaType === 'image'
      ? [customMediaUrl, ...customImageUrls].map(u => u.trim()).filter(Boolean)
      : [];

    if (editingSpreadId) {
      // Edit mode: replace the matching spread's content in place, keeping
      // its id and its original category number prefix (the "01" in
      // "01 / CHILL BEACH") so re-saving never renumbers pages.
      setSpreads(prevSpreads => prevSpreads.map(s => {
        if (s.id !== editingSpreadId) return s;

        const prefix = s.leftPage.category?.includes('/')
          ? s.leftPage.category.split('/')[0].trim()
          : '00';

        return {
          ...s,
          leftPage: {
            ...s.leftPage,
            category: `${prefix} / ${writingCategory.toUpperCase()}`,
            date: writingDate || curDate(),
            title: writingTitle,
            quote: customQuote || s.leftPage.quote,
            bodyText: writingBody
          },
          rightPage: {
            type: mediaType,
            url: mediaUrl || PRESET_MEDIA_LIST[0].url,
            ...(activeUrls.length > 1 ? { urls: activeUrls } : {}),
            caption: mediaCaption || s.rightPage.caption
          }
        };
      }));

      resetWriterForm();
      setIsWriting(false);
      return;
    }

    const newSpreadId = `spread-${Date.now()}`;
    const newSpread: DiarySpread = {
      id: newSpreadId,
      leftPage: {
        id: `left-${Date.now()}`,
        category: `${String(spreads.length).padStart(2, '0')} / ${writingCategory.toUpperCase()}`,
        date: writingDate || curDate(),
        title: writingTitle,
        quote: customQuote || `“Finding beauty in the slow hours of my ${writingCategory.toLowerCase()} journey.”`,
        bodyText: writingBody
      },
      rightPage: {
        type: mediaType,
        url: mediaUrl || PRESET_MEDIA_LIST[0].url,
        ...(activeUrls.length > 1 ? { urls: activeUrls } : {}),
        caption: mediaCaption || `Capturing the perfect aesthetic moment during my ${writingCategory.toLowerCase()} journey.`
      }
    };

    const updated = [...spreads, newSpread];
    setSpreads(updated);

    resetWriterForm();
    setIsWriting(false);

    // Switch filter to 'All' so they can see it and jump to it
    setSelectedCategory('All');
    setIsOpen(true);

    // Jump to the newly added page
    setTimeout(() => {
      setCurrentIndex(updated.length - 1);
    }, 100);
  };
```

- [ ] **Step 2: Verify in the browser**

```bash
cd ai-studio-diary-book && npm run dev
```

Open the printed URL, open the book (seeded Chill Beach page showing):
1. Click `Edit`. Change `Title` to `Edited Sunset Title`. Change `Category` to `Nature`. Click `Save Changes`.
2. Confirm: the modal closes, the currently displayed left page now shows "Edited Sunset Title" as its title, with **no page-turn animation** (it should just update in place — contrast with clicking `Write Diary` and saving, which does animate to a new page). Confirm the top-left category tag on the page now reads `01 / NATURE` (prefix `01` preserved, not renumbered).
3. Confirm the bottom pagination dot count is unchanged (still however many pages existed before — editing must not add a page).
4. Open browser DevTools → Application → Local Storage → `http://localhost:5173` (or whatever port was printed) → key `abroad_diary_spreads`. Confirm the JSON contains `"title":"Edited Sunset Title"` and `"category":"01 / NATURE"`.
5. Refresh the browser page entirely. Confirm the edited title/category persist after reload (proves the save went through the same `localStorage`-backed `spreads` state as new entries, via the existing `useEffect` on `[spreads]`).
6. Click `Restore Demo Diary` to reset back to the seeded data for the next task.

- [ ] **Step 3: Commit**

```bash
git add ai-studio-diary-book/App.tsx
git commit -m "Update handleSaveEntry to edit an existing spread in place when editingSpreadId is set"
```

---

### Task 7: End-to-end regression pass in the browser

**Files:** none modified — this task is a full manual click-through of the finished feature plus the pre-existing flows it touches.

**Interfaces:** none.

- [ ] **Step 1: Full checklist walk-through**

```bash
cd ai-studio-diary-book && npm run dev
```

Open the printed URL and work through every item; click `Restore Demo Diary` first to start from a known state:

1. **New entry still works exactly as before:** click `Write Diary`, fill in Title/Body (leave the rest default), submit. Confirm a new page is added and the book jumps to it, with the pagination dot count incremented by one.
2. **Edit prefill, three media shapes:**
   - Edit the seeded Chill Beach page (multi-image `urls`) — confirm all 4 image URL fields are filled on the `CUSTOM URL` tab.
   - Edit the page you just created in step 1 if it used a preset — confirm the matching preset card is highlighted/selected rather than the Custom tab being active.
   - Create one more entry using the `CUSTOM URL` → video option with a direct `.mp4` link, then Edit it — confirm the Custom tab shows `Video MP4` selected with the URL filled in.
3. **Cancel leaves data untouched:** Edit any page, change the Title, click `Cancel`. Re-open `Edit` on the same page — confirm the Title shows the *original* value, not the cancelled edit.
4. **Save replaces in place:** Edit a page, change Title/Body/media, click `Save Changes` — confirm the change appears on that same page with no page-jump, and the total page count is unchanged.
5. **No leakage into new entries:** immediately after saving an edit (step 4), click `Write Diary` — confirm every field is back to the blank/default new-entry state (empty Title/Body/Quote/Caption, Category back to `Abroad`, Date back to today, media back to the first preset).
6. **Disabled states:** close the book cover (via `Close Diary Cover`) — confirm `Edit` is disabled. Reopen, then `Clear All Diaries` — confirm the blank placeholder page shows and `Edit` is disabled. Click `Restore Demo Diary` — confirm `Edit` becomes enabled again once a real page is showing.
7. **Known non-issue:** do not click `AI Polish & Motto` — it will show a connection error because this dev scaffold has no `/api/enrich-diary` backend. This is expected and out of scope for this feature.

- [ ] **Step 2: Fix anything the walk-through surfaces**

If any item above fails, identify which task's change is responsible (Task 2–6), fix it there, and re-run the full checklist from Step 1.

- [ ] **Step 3: Final commit (only if Step 2 required fixes)**

```bash
git add ai-studio-diary-book/App.tsx ai-studio-diary-book/data.ts
git commit -m "Fix issues found in end-to-end review of the diary edit feature"
```

If nothing needed fixing, skip this commit — Task 6's commit is the last one for this feature.
