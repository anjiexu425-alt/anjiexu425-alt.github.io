import { createExperienceState, toggleFlip, computeFanOffsets, computeArcTimelinePositions } from './experience-state.mjs';

const PLACEHOLDER_DETAIL = '[Text placeholder: describe this experience — responsibilities, outcomes, and what stood out.]';

const CARDS = [
  { line1: 'Lishui University', line2: 'Undergraduate · English', period: '2021', detail: PLACEHOLDER_DETAIL },
  { line1: 'President · Psychological Health Association', line2: '', period: '2023', detail: PLACEHOLDER_DETAIL },
  { line1: 'Project Lead · "New Sprout" Entrepreneurship Project', line2: '', period: '2023', detail: PLACEHOLDER_DETAIL },
  { line1: 'IELTS Teacher · AIU International Education', line2: '', period: '2025', detail: PLACEHOLDER_DETAIL },
  { line1: 'University of Edinburgh', line2: 'Master · TESOL', period: '2025', detail: PLACEHOLDER_DETAIL },
];

// One tick per card (years can repeat) — no dedup. Default pointer/highlight
// rests on the middle card when nothing is flipped.
const DEFAULT_ACTIVE_INDEX = Math.floor((CARDS.length - 1) / 2);
const LABEL_ROW_PX = 32;

let state = createExperienceState(CARDS.length);
let timelineRadius = 150;
let timelinePositions = computeArcTimelinePositions(CARDS.length, timelineRadius);

function render() {
  const offsets = computeFanOffsets();

  document.querySelectorAll('.polaroid').forEach((card, i) => {
    const offset = offsets[i];
    const isFlipped = i === state.flippedIndex;
    const scale = isFlipped ? 1.06 : 1;
    card.style.transform = `translate(-50%, -50%) translate(${offset.translateX}px, ${offset.translateY}px) rotate(${offset.rotateDeg}deg) scale(${scale})`;
    card.style.zIndex = isFlipped ? '999' : String(offset.index + 1);
    card.classList.toggle('is-flipped', isFlipped);
  });

  const activeIndex = state.flippedIndex === null ? DEFAULT_ACTIVE_INDEX : state.flippedIndex;

  document.querySelectorAll('[data-timeline-index]').forEach((el) => {
    el.classList.toggle('is-active', Number(el.dataset.timelineIndex) === activeIndex);
  });

  const pointerNeedle = document.querySelector('.experience-timeline__pointer-needle');
  if (pointerNeedle) {
    const angleDeg = timelinePositions[activeIndex].angleDeg;
    pointerNeedle.setAttribute('transform', `rotate(${angleDeg - 90} ${timelineRadius} 0)`);
  }
}

function handleSelect(index) {
  state = toggleFlip(state, index);
  render();
}

function buildFan() {
  const fan = document.querySelector('.experience-fan');
  const timeline = document.querySelector('.experience-timeline');
  if (!fan || !timeline) return;

  CARDS.forEach((card, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'polaroid';
    const label = card.line2 ? `${card.line1}, ${card.line2}` : card.line1;
    el.setAttribute('aria-label', `${label}, ${card.period}. Click to flip and read more.`);
    el.innerHTML = `
      <span class="polaroid__flip">
        <span class="polaroid__face polaroid__face--front">
          <span class="placeholder-img" style="min-height:220px;">[Photo placeholder: ${card.line1}]</span>
          <span class="polaroid__caption">
            <strong>${card.line1}</strong>
            ${card.line2 ? `<span>${card.line2}</span>` : ''}
          </span>
        </span>
        <span class="polaroid__face polaroid__face--back">
          <strong>${card.line1}</strong><br />
          ${card.line2 ? `${card.line2}<br />` : ''}
          ${card.period}<br /><br />
          ${card.detail}
        </span>
      </span>
    `;
    el.addEventListener('click', () => handleSelect(i));
    fan.appendChild(el);
  });

  timelineRadius = Number(timeline.dataset.radius || 150);
  timelinePositions = computeArcTimelinePositions(CARDS.length, timelineRadius);
  timeline.style.width = `${timelineRadius * 2}px`;
  timeline.style.height = `${timelineRadius + LABEL_ROW_PX}px`;

  const svgNs = 'http://www.w3.org/2000/svg';
  const arc = document.createElementNS(svgNs, 'svg');
  arc.setAttribute('class', 'experience-timeline__arc');
  arc.setAttribute('viewBox', `0 0 ${timelineRadius * 2} ${timelineRadius}`);
  arc.style.top = `${LABEL_ROW_PX}px`;
  arc.style.height = `${timelineRadius}px`;

  const arcLine = document.createElementNS(svgNs, 'path');
  arcLine.setAttribute('class', 'experience-timeline__arc-line');
  arcLine.setAttribute('d', `M 0 0 A ${timelineRadius} ${timelineRadius} 0 0 1 ${timelineRadius * 2} 0`);
  arc.appendChild(arcLine);

  timelinePositions.forEach((pos, i) => {
    const connector = document.createElementNS(svgNs, 'line');
    connector.setAttribute('class', 'experience-timeline__connector');
    connector.setAttribute('x1', pos.x);
    connector.setAttribute('y1', 0);
    connector.setAttribute('x2', pos.x);
    connector.setAttribute('y2', pos.y);
    connector.dataset.timelineIndex = i;
    arc.appendChild(connector);

    const dot = document.createElementNS(svgNs, 'circle');
    dot.setAttribute('class', 'experience-timeline__dot');
    dot.setAttribute('cx', pos.x);
    dot.setAttribute('cy', pos.y);
    dot.setAttribute('r', 4);
    dot.dataset.timelineIndex = i;
    arc.appendChild(dot);
  });

  const pointerLength = timelineRadius * 0.5;
  const pointerHub = document.createElementNS(svgNs, 'circle');
  pointerHub.setAttribute('class', 'experience-timeline__pointer-hub');
  pointerHub.setAttribute('cx', timelineRadius);
  pointerHub.setAttribute('cy', 0);
  pointerHub.setAttribute('r', 4);
  arc.appendChild(pointerHub);

  const pointerNeedle = document.createElementNS(svgNs, 'line');
  pointerNeedle.setAttribute('class', 'experience-timeline__pointer-needle');
  pointerNeedle.setAttribute('x1', timelineRadius);
  pointerNeedle.setAttribute('y1', 0);
  pointerNeedle.setAttribute('x2', timelineRadius);
  pointerNeedle.setAttribute('y2', pointerLength);
  arc.appendChild(pointerNeedle);

  timeline.appendChild(arc);

  CARDS.forEach((card, i) => {
    const tick = document.createElement('button');
    tick.type = 'button';
    tick.className = 'experience-timeline__tick';
    tick.textContent = card.period;
    tick.dataset.timelineIndex = i;
    tick.setAttribute('aria-label', `Jump to ${card.line1}, ${card.period}`);
    tick.style.left = `${timelinePositions[i].x}px`;
    tick.style.top = `${LABEL_ROW_PX / 2}px`;
    tick.addEventListener('click', () => handleSelect(i));
    timeline.appendChild(tick);
  });

  render();
}

document.addEventListener('DOMContentLoaded', buildFan);
