// LOGIC LAYER
// -----------
// This is the actual state machine, and it is the file that IS Tate Break
// as a behavior, independent of any DOM, any sprite, or any feed. It takes
// abstract "a scroll happened" and "time passed" signals in, and produces
// abstract "start a break" / "break ended" signals out. Nothing in this
// file touches document, window, or any pixel value - swap the renderer
// for a console.log and this file would not need to change at all.
//
// State machine, three states:
//   IDLE        -> counting scrolls, waiting for the threshold
//   BREAK_ACTIVE -> a break is running; input is ignored, not queued
//   (BREAK_ACTIVE always returns to IDLE when the break finishes)
//
// This mirrors, one for one, the state machine already proven in the real
// Tate Break Chrome extension's content.js (same fixed-count design, same
// "ignore input while active" rule) - this file is that logic, lifted out
// of the extension and out of the DOM so it can be tested and read on its
// own.

export function createBreakEngine({
  scrollTarget = 10,
  openDelayMs = 1500,
  breakDurationMs = 15000,
  onBreakStart,
  onBreakEnd,
  onTallyChange,
} = {}) {
  let scrollCount = 0;
  let state = 'IDLE'; // 'IDLE' | 'BREAK_ACTIVE'
  let openTimer = null;
  let breakTimer = null;

  function tally() {
    onTallyChange?.(scrollCount, scrollTarget);
  }

  function startBreak() {
    if (state === 'BREAK_ACTIVE') return; // already running - ignore, don't queue
    state = 'BREAK_ACTIVE';
    onBreakStart?.();
    breakTimer = setTimeout(endBreak, breakDurationMs);
  }

  function endBreak() {
    state = 'IDLE';
    scrollCount = 0;
    tally();
    onBreakEnd?.();
  }

  function registerScroll() {
    if (state === 'BREAK_ACTIVE') return; // input is ignored while active, not buffered
    scrollCount += 1;
    tally();
    if (scrollCount >= scrollTarget) {
      startBreak();
    }
  }

  function start() {
    tally();
    // Fires once on open, in addition to the fixed scroll-count trigger -
    // the same "greet you the moment you open the site" behavior as the
    // shipped extension.
    openTimer = setTimeout(() => {
      if (state === 'IDLE') startBreak();
    }, openDelayMs);
  }

  function destroy() {
    clearTimeout(openTimer);
    clearTimeout(breakTimer);
  }

  // Exposed for the "visible choice point" requirement and for testing:
  // lets the output layer (or a test harness) ask "where do things stand"
  // without reaching into private state.
  function getState() {
    return { state, scrollCount, scrollTarget };
  }

  return { start, registerScroll, destroy, getState };
}
