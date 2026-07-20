import { createExperienceState, toggleFlip, computeFanOffsets, computeCompassTickAngles, computeCompassRotation } from './experience-state.mjs';

const PLACEHOLDER_DETAIL = '[Text placeholder: describe this experience — responsibilities, outcomes, and what stood out.]';

const CARDS = [
  { line1: 'Lishui University', line2: 'Undergraduate · English', period: '2021', detail: PLACEHOLDER_DETAIL },
  { line1: 'President · Psychological Health Association', line2: '', period: '2023', detail: PLACEHOLDER_DETAIL },
  { line1: 'Project Lead · "New Sprout" Entrepreneurship Project', line2: '', period: '2023', detail: PLACEHOLDER_DETAIL },
  { line1: 'IELTS Teacher · AIU International Education', line2: '', period: '2025', detail: PLACEHOLDER_DETAIL },
  { line1: 'University of Edinburgh', line2: 'Master · TESOL', period: '2025', detail: PLACEHOLDER_DETAIL },
];

// Default pointer/highlight rests on the middle card when nothing is flipped.
const DEFAULT_ACTIVE_INDEX = Math.floor((CARDS.length - 1) / 2);
const COMPASS_RADIUS = 90;
const COMPASS_LABEL_RADIUS = COMPASS_RADIUS + 34;

const tickAngles = computeCompassTickAngles(CARDS.length);

let state = createExperienceState(CARDS.length);

function pointOnCircle(radius, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
}

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
  const dialRotation = computeCompassRotation(tickAngles, activeIndex);

  const dial = document.querySelector('.experience-compass__dial');
  if (dial) {
    dial.setAttribute('transform', `rotate(${dialRotation} ${COMPASS_RADIUS} ${COMPASS_RADIUS})`);
  }

  document.querySelectorAll('.experience-compass__label').forEach((label) => {
    const i = Number(label.dataset.timelineIndex);
    const angleDeg = tickAngles[i].angleDeg + dialRotation;
    const point = pointOnCircle(COMPASS_LABEL_RADIUS, angleDeg);
    label.style.left = `${COMPASS_LABEL_RADIUS + point.x}px`;
    label.style.top = `${COMPASS_LABEL_RADIUS + point.y}px`;
    label.classList.toggle('is-active', i === activeIndex);
  });

  document.querySelectorAll('.experience-compass__dot').forEach((dot) => {
    dot.classList.toggle('is-active', Number(dot.dataset.timelineIndex) === activeIndex);
  });

  const activePeriodText = document.querySelector('.experience-compass__active-period');
  if (activePeriodText) {
    activePeriodText.innerHTML = `Active Period: <strong>${CARDS[activeIndex].period}</strong>`;
  }
}

function handleSelect(index) {
  state = toggleFlip(state, index);
  render();
}

function buildFan() {
  const fan = document.querySelector('.experience-fan');
  const compass = document.querySelector('.experience-compass');
  if (!fan || !compass) return;

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

  buildCompass(compass);
  render();
}

function buildCompass(compass) {
  const dialDiameter = COMPASS_RADIUS * 2;
  const svgNs = 'http://www.w3.org/2000/svg';

  const ring = document.createElementNS(svgNs, 'svg');
  ring.setAttribute('class', 'experience-compass__ring');
  ring.setAttribute('viewBox', `0 0 ${dialDiameter} ${dialDiameter}`);
  ring.style.width = `${dialDiameter}px`;
  ring.style.height = `${dialDiameter}px`;

  const dial = document.createElementNS(svgNs, 'g');
  dial.setAttribute('class', 'experience-compass__dial');

  const circle = document.createElementNS(svgNs, 'circle');
  circle.setAttribute('class', 'experience-compass__ring-line');
  circle.setAttribute('cx', COMPASS_RADIUS);
  circle.setAttribute('cy', COMPASS_RADIUS);
  circle.setAttribute('r', COMPASS_RADIUS - 1);
  dial.appendChild(circle);

  tickAngles.forEach(({ index, angleDeg }) => {
    const point = pointOnCircle(COMPASS_RADIUS, angleDeg);
    const dot = document.createElementNS(svgNs, 'circle');
    dot.setAttribute('class', 'experience-compass__dot');
    dot.setAttribute('cx', COMPASS_RADIUS + point.x);
    dot.setAttribute('cy', COMPASS_RADIUS + point.y);
    dot.setAttribute('r', 5);
    dot.dataset.timelineIndex = index;
    dial.appendChild(dot);
  });

  const dialBoxSize = COMPASS_LABEL_RADIUS * 2;
  compass.style.width = `${dialBoxSize}px`;
  compass.style.height = `${dialBoxSize}px`;
  ring.style.left = `${COMPASS_LABEL_RADIUS - COMPASS_RADIUS}px`;
  ring.style.top = `${COMPASS_LABEL_RADIUS - COMPASS_RADIUS}px`;

  ring.appendChild(dial);
  compass.appendChild(ring);

  const pointer = document.createElement('div');
  pointer.className = 'experience-compass__pointer';
  pointer.setAttribute('aria-hidden', 'true');
  compass.appendChild(pointer);

  CARDS.forEach((card, i) => {
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'experience-compass__label';
    label.textContent = card.period;
    label.dataset.timelineIndex = i;
    label.setAttribute('aria-label', `Jump to ${card.line1}, ${card.period}`);
    label.addEventListener('click', () => handleSelect(i));
    compass.appendChild(label);
  });

  const activePeriod = document.createElement('p');
  activePeriod.className = 'experience-compass__active-period';
  compass.insertAdjacentElement('afterend', activePeriod);
}

document.addEventListener('DOMContentLoaded', buildFan);
