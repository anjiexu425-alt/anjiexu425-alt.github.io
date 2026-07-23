# Study Diary Reversible Curl Design

## Problem

The current 16-slice page curl treats `next` and `prev` as separate geometric
directions. `next` walks outward from the centre spine with negative rotations.
`prev` changes the angle sign, mirrors slice positions, and reverses content
offsets. Those transformations do not preserve one shared physical coordinate
system: during a previous-page turn, the hinge, free edge, content strips, and
stacking order stop describing the same sheet. The left page therefore appears
to fold or unwrap incorrectly when it turns toward the right.

The supplied `realistic_physical_book_fixed.html` avoids that split. It defines
one canonical sheet curve from progress 0 to 1. A forward turn plays 0 → 1; a
backward turn prepares the adjacent spread at progress 1 and plays the same
curve 1 → 0.

## Chosen Approach

Use one reversible physical sheet model.

- Canonical progress 0 means the turning sheet is flat on the right.
- Canonical progress 1 means the same sheet is flat on the left.
- Moving to the next spread animates progress 0 → 1.
- Moving to the previous spread animates progress 1 → 0.
- Dragging the right page maps leftward motion to increasing progress.
- Dragging the left page maps rightward motion to decreasing progress.

`direction` remains useful for choosing the old/new entries and settling the
state, but it no longer changes curl angles, slice positions, or texture-strip
orientation.

## Geometry

Replace the direction-dependent `computeSliceThetas` and
`computeSliceLayout` contracts with a canonical curve:

- Every slice walks from the centre spine toward the physical free edge.
- Base rotation is `-π × progress`.
- Curl intensity peaks at the midpoint.
- The curl profile is asymmetric, with slightly more deformation near the free
  edge, following the supplied reference.
- A small counter-curl term keeps the silhouette from looking like a smooth
  cylinder.
- Slice positions are accumulated from the centre spine without a separate
  `prev` mirror.

At the two endpoints, all slices form a flat page. At intermediate progress,
the free edge moves continuously through the centre and toward the opposite
side.

## DOM and Content Mapping

The existing DOM-based pages remain intact; the implementation will not migrate
the diary to Canvas.

Each transition builds the same canonical physical sheet:

- Front surface: the current spread's right page.
- Back surface: the next spread's left page.
- Front strips map left-to-right.
- Back strips use the mirrored texture coordinate required by the reverse side
  of paper.

For a previous-page action, the transition is prepared between
`current - 1` and `current` at progress 1. Playing back to 0 naturally reveals
the earlier spread without constructing a second mirrored sheet.

The DOM order of slices changes at the midpoint so overlapping strips paint in
physical depth order:

- Before progress 0.5, slices nearer the free edge paint above earlier strips.
- After progress 0.5, the order reverses.

The highlight and cast shadow continue to follow the canonical free edge.

## Interaction Flow

### Buttons and keyboard

- Next: prepare `(current, current + 1, 0)`, animate to 1, settle on
  `current + 1`.
- Previous: prepare `(current - 1, current, 1)`, animate to 0, settle on
  `current - 1`.

### Dragging

- Right-page drag starts at progress 0 and increases as the pointer moves left.
- Left-page drag starts at progress 1 and decreases as the pointer moves right.
- The existing 50% completion threshold remains:
  - next completes when progress is at least 0.5;
  - previous completes when progress is below 0.5.
- Release animation reuses the same requestAnimationFrame driver.

### Reduced motion and mobile

The existing instant-swap behavior at widths up to 768px and for
`prefers-reduced-motion` remains unchanged.

## Error Handling and State Safety

- Navigation remains locked while a transition is active.
- A transition owns immutable `fromIndex`, `toIndex`, and current progress.
- State changes only after the animation reaches the chosen endpoint.
- A cancelled or incomplete drag returns to its starting endpoint.
- Existing exclusions for discard, mood, and photo interactions remain
  unchanged.

## Testing

Pure-function tests will verify:

- canonical angles are flat at progress 0 and -180° at progress 1;
- the canonical layout is continuous and has the expected endpoints;
- texture-strip mapping is independent of navigation direction;
- next and previous transition descriptors use 0 → 1 and 1 → 0 respectively;
- completion decisions use the correct endpoint for each navigation direction.

Browser verification will cover:

- left arrow: left page turns right with correct hinge, content orientation,
  highlight, shadow, and stacking;
- right arrow remains visually correct;
- arrow keys match the buttons;
- slow dragging follows the pointer in both directions;
- releases on each side of the midpoint complete or return correctly;
- no console errors occur;
- narrow-screen and reduced-motion behavior remains instant.

## Scope

This change does not alter diary data, authentication, editing, uploads,
lightbox behavior, responsive layout, or page styling. It does not migrate
page rendering to Canvas or add velocity-based flick completion.
