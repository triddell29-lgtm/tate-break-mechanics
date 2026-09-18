// Wiring only. This file has no behavior of its own - it just hands the
// input layer's raw signal to the logic layer, and the logic layer's
// abstract events to the output layer. Reading this file top to bottom is
// meant to be a complete description of the mechanic without needing to
// open any of the three layer files.

import { createScrollInput } from './src/input/scrollInput.js';
import { createBreakEngine } from './src/logic/breakEngine.js';
import { createTateRenderer } from './src/output/tateRenderer.js';

const feedEl = document.getElementById('feed');

function assetUrl(path) {
  return `assets/${path}`;
}

const renderer = createTateRenderer({ assetUrl, mountPoint: document.documentElement });

const BREAK_DURATION_MS = 15000;

const engine = createBreakEngine({
  scrollTarget: 10,
  openDelayMs: 1500,
  breakDurationMs: BREAK_DURATION_MS,
  onTallyChange: (count, target) => renderer.setTally(count, target),
  onBreakStart: () => { renderer.playBreak(BREAK_DURATION_MS); },
  onBreakEnd: () => {},
});

// Listen on window rather than the feed element: wheel events bubble, so
// listening on both would double-count every real scroll (the feed's
// listener and window's listener both firing for one gesture). Window
// alone also matches how a real page is actually scrolled.
createScrollInput(window, {
  burstGapMs: 350,
  onScroll: () => engine.registerScroll(),
});

engine.start();

// ---- Simulated feed content ----------------------------------------------
// Standing in for a real social feed so the mechanic can be demoed without
// depending on any live site. Purely cosmetic - none of this feeds the
// input or logic layers, which only care that scrolling happened.
const POSTS = [
  ['A friend of a friend', 'Normal day. Coffee, then more coffee.'],
  ['Study group', 'Meeting moved to the library, 3rd floor.'],
  ['Class page', 'Reminder: reading response due Thursday.'],
  ['A friend of a friend', 'This song has been stuck in my head all week.'],
  ['Club account', 'Sign-ups close Friday, link in bio.'],
  ['A friend of a friend', 'Rewatched that one movie again, still good.'],
  ['Study group', 'Anyone have notes from Tuesday’s lecture?'],
  ['Class page', 'Office hours moved to Wednesday this week.'],
];

function buildFeed() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 40; i++) {
    const [name, text] = POSTS[i % POSTS.length];
    const card = document.createElement('article');
    card.className = 'post';
    card.innerHTML = `
      <div class="post-avatar" aria-hidden="true"></div>
      <div class="post-body">
        <div class="post-name">${name}</div>
        <div class="post-text">${text}</div>
      </div>
    `;
    frag.appendChild(card);
  }
  feedEl.appendChild(frag);
}

buildFeed();
