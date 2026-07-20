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
