// INPUT LAYER
// -----------
// The only job of this module is to notice raw user activity and turn it
// into ONE clean signal: "a scroll happened." It knows nothing about Tate,
// counting, timers, or breathing. If tomorrow the trigger changed from
// scrolling to, say, tab-switches, this is the only file that would change.
//
// It also does the minimum de-noising a real input layer has to do: a
// single mouse-wheel gesture on a trackpad or wheel can fire dozens of
// native "wheel" events in a few milliseconds. BURST_GAP_MS folds any
// events that land within that gap into a single logical scroll, so
// "the user scrolled once" and "the user scrolled ten times" both mean
// what a person would say they mean.

export function createScrollInput(target, { burstGapMs = 350, onScroll } = {}) {
  let lastEventAt = 0;

  function handleWheel(event) {
    const now = performance.now();
    if (now - lastEventAt > burstGapMs) {
      onScroll(event);
    }
    lastEventAt = now;
  }

  target.addEventListener('wheel', handleWheel, { passive: true });

  return {
    // Lets the logic layer temporarily ignore input (e.g. while Tate is
    // already on screen) without the input layer needing to know why.
    destroy() {
      target.removeEventListener('wheel', handleWheel);
    },
  };
}
