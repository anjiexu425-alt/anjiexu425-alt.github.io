import { createExperienceState, toggleFlip, computeScatterOffsets, computeArcTimelinePositions } from './experience-state.mjs';

const PLACEHOLDER_DETAIL = '[Text placeholder: describe this experience — responsibilities, outcomes, and what stood out.]';

const CARDS = [
  { line1: 'Lishui University', line2: 'Undergraduate · English', period: '2021', detail: PLACEHOLDER_DETAIL },
  { line1: 'President · Psychological Health Association', line2: '', period: '2023', detail: PLACEHOLDER_DETAIL },
  { line1: 'Project Lead · "New Sprout" Entrepreneurship Project', line2: '', period: '2023', detail: PLACEHOLDER_DETAIL },
  { line1: 'IELTS Teacher · AIU International Education', line2: '', period: '2025', detail: PLACEHOLDER_DETAIL },
  { line1: 'University of Edinburgh', line2: 'Master · TESOL', period: '2025', detail: PLACEHOLDER_DETAIL },
];

// One tick per distinct year, in first-seen order; clicking a year flips
// the first card that belongs to it.
const YEARS = [...new Set(CARDS.map((card) => card.period))];
const firstIndexForYear = (year) => CARDS.findIndex((card) => card.period === year);

let state = createExperienceState(CARDS.length);

function render() {
  const offsets = computeScatterOffsets(state.cardCount);

  document.querySelectorAll('.polaroid').forEach((card, i) => {
    const offset = offsets[i];
    const isFlipped = i === state.flippedIndex;
    const scale = isFlipped ? 1.06 : 1;
    card.style.transform = `translate(-50%, -50%) translate(${offset.translateX}px, ${offset.translateY}px) rotate(${offset.rotateDeg}deg) scale(${scale})`;
    card.style.zIndex = String(isFlipped ? 999 : offset.zIndex);
    card.classList.toggle('is-flipped', isFlipped);
  });

  const activeYear = state.flippedIndex === null ? null : CARDS[state.flippedIndex].period;
  document.querySelectorAll('.experience-timeline__tick').forEach((tick) => {
    tick.classList.toggle('is-active', tick.dataset.year === activeYear);
  });
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
    `;
    el.addEventListener('click', () => handleSelect(i));
    fan.appendChild(el);
  });

  const radius = Number(timeline.dataset.radius || 150);
  const positions = computeArcTimelinePositions(YEARS.length, radius);
  const labelBufferPx = 50;
  timeline.style.width = `${radius * 2}px`;
  timeline.style.height = `${radius + labelBufferPx}px`;

  const svgNs = 'http://www.w3.org/2000/svg';
  const arc = document.createElementNS(svgNs, 'svg');
  arc.setAttribute('class', 'experience-timeline__arc');
  arc.setAttribute('viewBox', `0 0 ${radius * 2} ${radius}`);
  arc.style.height = `${radius}px`;
  const arcLine = document.createElementNS(svgNs, 'path');
  arcLine.setAttribute('class', 'experience-timeline__arc-line');
  arcLine.setAttribute('d', `M 0 0 A ${radius} ${radius} 0 0 1 ${radius * 2} 0`);
  arc.appendChild(arcLine);
  timeline.appendChild(arc);

  YEARS.forEach((year, i) => {
    const tick = document.createElement('button');
    tick.type = 'button';
    tick.className = 'experience-timeline__tick';
    tick.textContent = year;
    tick.dataset.year = year;
    tick.setAttribute('aria-label', `Jump to ${year}`);
    tick.style.left = `${positions[i].x}px`;
    tick.style.top = `${positions[i].y}px`;
    tick.addEventListener('click', () => handleSelect(firstIndexForYear(year)));
    timeline.appendChild(tick);
  });

  render();
}

document.addEventListener('DOMContentLoaded', buildFan);
