import { contentOffsetForSlice } from './diary-state.mjs';

export const CURL_SLICE_COUNT = 16;

function elementFactory(stage, createElement) {
  if (createElement) return createElement;
  return (tagName) => stage.ownerDocument.createElement(tagName);
}

function pageElement(makeElement, physicalSide, html) {
  const page = makeElement('div');
  page.className = `diary-page diary-page--${physicalSide}`;
  page.innerHTML = html;
  return page;
}

export function renderSettledSpreadDOM(stage, spread, {
  createElement,
  hydrateMedia = () => {},
} = {}) {
  const makeElement = elementFactory(stage, createElement);
  const leftPage = pageElement(makeElement, 'left', spread.leftHTML);
  const rightPage = pageElement(makeElement, 'right', spread.rightHTML);

  stage.replaceChildren(leftPage, rightPage);
  hydrateMedia(stage);

  return { leftPage, rightPage };
}

export function buildCurlSpreadDOM(stage, transition, {
  createElement,
  sliceCount = CURL_SLICE_COUNT,
} = {}) {
  const makeElement = elementFactory(stage, createElement);
  stage.querySelectorAll('video').forEach((video) => video.pause());

  const leftPage = pageElement(
    makeElement,
    'left',
    transition.underlayLeftHTML,
  );
  const rightPage = pageElement(
    makeElement,
    'right',
    transition.underlayRightHTML,
  );
  const underlayIn = makeElement('div');
  underlayIn.className = 'diary-underlay-shadow diary-underlay-shadow--in';
  const underlayOut = makeElement('div');
  underlayOut.className = 'diary-underlay-shadow diary-underlay-shadow--out';
  leftPage.appendChild(underlayIn);
  rightPage.appendChild(underlayOut);

  const sheet = makeElement('div');
  sheet.className = 'diary-flip-sheet diary-flip-sheet--next';
  stage.replaceChildren(leftPage, rightPage, sheet);

  const sheetWidthPx = sheet.getBoundingClientRect().width;
  const sheetHeightPx = sheet.getBoundingClientRect().height;
  const segWidth = sheetWidthPx / sliceCount;
  const slices = [];

  for (let k = 0; k < sliceCount; k++) {
    const sliceEl = makeElement('div');
    sliceEl.className = 'diary-flip-slice';
    sliceEl.style.width = `${segWidth + 1.2}px`;
    sliceEl.style.height = `${sheetHeightPx}px`;

    const front = makeElement('div');
    front.className = 'diary-flip-slice__face diary-flip-slice__face--front';
    const back = makeElement('div');
    back.className = 'diary-flip-slice__face diary-flip-slice__face--back';
    const frontCanvas = makeElement('div');
    frontCanvas.className = 'diary-flip-slice__canvas';
    frontCanvas.style.width = `${sheetWidthPx}px`;
    frontCanvas.style.height = `${sheetHeightPx}px`;
    frontCanvas.innerHTML = `<div class="diary-page diary-page--right">${transition.frontHTML}</div>`;
    frontCanvas.style.transform = `translateX(${-contentOffsetForSlice(k, sliceCount, 'front') * segWidth}px)`;
    const backCanvas = makeElement('div');
    backCanvas.className = 'diary-flip-slice__canvas';
    backCanvas.style.width = `${sheetWidthPx}px`;
    backCanvas.style.height = `${sheetHeightPx}px`;
    backCanvas.innerHTML = `<div class="diary-page diary-page--left">${transition.backHTML}</div>`;
    backCanvas.style.transform = `translateX(${-contentOffsetForSlice(k, sliceCount, 'back') * segWidth}px)`;
    const frontShade = makeElement('div');
    frontShade.className = 'diary-flip-slice__shade';
    const backShade = makeElement('div');
    backShade.className = 'diary-flip-slice__shade';

    front.append(frontCanvas, frontShade);
    back.append(backCanvas, backShade);
    sliceEl.append(front, back);
    sheet.appendChild(sliceEl);
    slices.push({ el: sliceEl, frontShade, backShade });
  }

  const tipEl = makeElement('div');
  tipEl.className = 'diary-flip-tip';
  const castShadowEl = makeElement('div');
  castShadowEl.className = 'diary-flip-castshadow';
  sheet.append(tipEl, castShadowEl);

  return {
    leftPage,
    rightPage,
    sheet,
    slices,
    tipEl,
    castShadowEl,
    underlayIn,
    underlayOut,
    segWidth,
    sheetWidthPx,
    sliceCount,
  };
}
