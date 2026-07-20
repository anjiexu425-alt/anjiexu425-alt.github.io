import { createExperienceState, selectCard, computeCoverflowOffsets, computeCompassTickAngles, computeCompassRotation } from './experience-state.mjs';

const PLACEHOLDER_DETAIL = '[Text placeholder: describe this experience — responsibilities, outcomes, and what stood out.]';

const CARDS = [
  { line1: 'Lishui University', line2: 'Bachelor - English', period: '2021', photo: 'assets/images/experience-1-lishui.jpg', detail: PLACEHOLDER_DETAIL },
  { line1: 'President · Psychological Health Association', line2: '', period: '2023', photo: 'assets/images/experience-2-psych-association.jpg', detail: PLACEHOLDER_DETAIL },
  { line1: 'Project Lead · "New Sprout" Entrepreneurship Project', line2: '', period: '2023', photo: 'assets/images/experience-3-new-sprout.jpg', detail: PLACEHOLDER_DETAIL },
  { line1: 'IELTS Teacher · Aiyoumi International Education', line2: '', period: '2025', photo: 'assets/images/experience-4-ielts.jpg', detail: PLACEHOLDER_DETAIL },
  { line1: 'University of Edinburgh', line2: 'Master · TESOL', period: '2025', photo: 'assets/images/experience-5-edinburgh.jpg', detail: PLACEHOLDER_DETAIL },
];

// Compass geometry ported from the reference TimelineArc.tsx: a very large
// radius circle whose center sits far below the visible box, so only its
// near-flat top sliver shows — an elegant, gently-curved dome rather than a
// tight arc. Values kept identical to the reference so the proportions
// (dome flatness, tick spacing, pointer size) match exactly.
const VIEW_W = 800;
const VIEW_H = 320;
const CX = 400;
const CY = 650;
const R = 500;
const VISUAL_BUFFER_DEG = 80; // extra arc length so rotation never reveals a gap at the ends

const tickAngles = computeCompassTickAngles(CARDS.length);

let state = createExperienceState(CARDS.length, 0);

function getXY(radius, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function render() {
  const offsets = computeCoverflowOffsets(state.cardCount, state.activeIndex);

  document.querySelectorAll('.polaroid').forEach((card, i) => {
    const offset = offsets[i];
    card.style.transform = `translate(-50%, -50%) translate(${offset.translateX}px, ${offset.translateY}px) rotate(${offset.rotateDeg}deg) scale(${offset.scale})`;
    card.style.zIndex = String(offset.zIndex);
    card.classList.toggle('is-active', offset.isActive);
    card.classList.toggle('is-flipped', offset.isActive && state.flipped);
  });

  const dialRotation = computeCompassRotation(tickAngles, state.activeIndex);
  const dial = document.querySelector('.experience-compass__dial');
  if (dial) {
    // .style.transform (not setAttribute('transform', ...)): the SVG
    // presentation attribute doesn't reliably pick up a CSS
    // `transition: transform` in Safari, so it just snaps with no visible
    // animation instead of failing loudly. Writing the CSS property
    // directly — same technique already used for the card fan above — is
    // unambiguous and matches what the transition rule actually watches.
    dial.style.transform = `rotate(${dialRotation}deg)`;
  }

  document.querySelectorAll('[data-timeline-index]').forEach((el) => {
    el.classList.toggle('is-active', Number(el.dataset.timelineIndex) === state.activeIndex);
  });

  const activeSegment = document.querySelector('.experience-compass__active-segment');
  if (activeSegment) {
    if (state.activeIndex > 0) {
      const startPt = getXY(R, tickAngles[0].angleDeg);
      const activePt = getXY(R, tickAngles[state.activeIndex].angleDeg);
      activeSegment.setAttribute('d', `M ${startPt.x} ${startPt.y} A ${R} ${R} 0 0 1 ${activePt.x} ${activePt.y}`);
      activeSegment.style.opacity = '1';
    } else {
      activeSegment.style.opacity = '0';
    }
  }

  const activePeriodText = document.querySelector('.experience-compass__active-period');
  if (activePeriodText) {
    activePeriodText.innerHTML = `Active Period: <strong>${CARDS[state.activeIndex].period}</strong>`;
  }
}

function handleSelect(index) {
  state = selectCard(state, index);
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
    el.setAttribute('aria-label', `${label}, ${card.period}. Click to select; click again to flip and read more.`);
    el.innerHTML = `
      <span class="polaroid__flip">
        <span class="polaroid__face polaroid__face--front">
          <img class="polaroid__photo" src="${card.photo}" alt="${card.line1}" />
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
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('class', 'experience-compass__svg');
  svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);

  const firstAngle = tickAngles[0].angleDeg;
  const lastAngle = tickAngles[tickAngles.length - 1].angleDeg;

  const dial = document.createElementNS(svgNs, 'g');
  dial.setAttribute('class', 'experience-compass__dial');
  dial.style.transformOrigin = `${CX}px ${CY}px`;

  const trackRadius = R - 35;
  const trackStart = getXY(trackRadius, firstAngle - VISUAL_BUFFER_DEG);
  const trackEnd = getXY(trackRadius, lastAngle + VISUAL_BUFFER_DEG);
  const track = document.createElementNS(svgNs, 'path');
  track.setAttribute('class', 'experience-compass__track');
  track.setAttribute('d', `M ${trackStart.x} ${trackStart.y} A ${trackRadius} ${trackRadius} 0 1 1 ${trackEnd.x} ${trackEnd.y}`);
  dial.appendChild(track);

  const visualStart = getXY(R, firstAngle - VISUAL_BUFFER_DEG);
  const visualEnd = getXY(R, lastAngle + VISUAL_BUFFER_DEG);
  const arcLine = document.createElementNS(svgNs, 'path');
  arcLine.setAttribute('class', 'experience-compass__arc-line');
  arcLine.setAttribute('d', `M ${visualStart.x} ${visualStart.y} A ${R} ${R} 0 1 1 ${visualEnd.x} ${visualEnd.y}`);
  dial.appendChild(arcLine);

  const activeSegment = document.createElementNS(svgNs, 'path');
  activeSegment.setAttribute('class', 'experience-compass__active-segment');
  dial.appendChild(activeSegment);

  tickAngles.forEach(({ index, angleDeg }) => {
    const lineStart = getXY(R + 2, angleDeg);
    const lineEnd = getXY(R + 9, angleDeg);
    const textPos = getXY(R + 22, angleDeg);

    const connector = document.createElementNS(svgNs, 'line');
    connector.setAttribute('class', 'experience-compass__connector');
    connector.setAttribute('x1', lineStart.x);
    connector.setAttribute('y1', lineStart.y);
    connector.setAttribute('x2', lineEnd.x);
    connector.setAttribute('y2', lineEnd.y);
    connector.dataset.timelineIndex = index;
    dial.appendChild(connector);

    const text = document.createElementNS(svgNs, 'text');
    text.setAttribute('class', 'experience-compass__label');
    text.setAttribute('x', textPos.x);
    text.setAttribute('y', textPos.y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('tabindex', '0');
    text.setAttribute('role', 'button');
    text.setAttribute('aria-label', `Jump to ${CARDS[index].line1}, ${CARDS[index].period}`);
    text.textContent = CARDS[index].period;
    text.dataset.timelineIndex = index;
    dial.appendChild(text);

    const selectThisTick = () => handleSelect(index);
    connector.addEventListener('click', selectThisTick);
    text.addEventListener('click', selectThisTick);
    text.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectThisTick();
      }
    });
  });

  svg.appendChild(dial);

  const pivot = document.createElementNS(svgNs, 'g');
  pivot.setAttribute('class', 'experience-compass__pivot');
  pivot.setAttribute('transform', `translate(${CX}, ${CY})`);
  pivot.innerHTML = `
    <circle r="14" class="experience-compass__pivot-outer" />
    <circle r="8" class="experience-compass__pivot-mid" />
    <circle r="4" class="experience-compass__pivot-center" />
  `;
  svg.appendChild(pivot);

  const pointer = document.createElementNS(svgNs, 'g');
  pointer.setAttribute('class', 'experience-compass__pointer');
  pointer.innerHTML = `
    <polygon points="400,158 392,177 408,177" class="experience-compass__pointer-shadow" transform="translate(0,2)" />
    <polygon points="400,158 393,176 407,176" class="experience-compass__pointer-arrow" />
    <line x1="400" y1="160" x2="400" y2="175" class="experience-compass__pointer-detail" />
  `;
  svg.appendChild(pointer);

  compass.appendChild(svg);

  const activePeriod = document.createElement('p');
  activePeriod.className = 'experience-compass__active-period';
  compass.insertAdjacentElement('afterend', activePeriod);
}

document.addEventListener('DOMContentLoaded', buildFan);
