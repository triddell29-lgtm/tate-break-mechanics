// INPUT LAYER
// -----------
// The only job of this module is to notice raw user activity and turn it
// into ONE clean signal: "a scroll happened." It knows nothing about Tate,
// counting, timers, or breathing. If tomorrow the trigger changed from
// scrolling to, say, tab-switches, this is the only file that would change.
//
// It listens on the native "scroll" event, not "wheel". An earlier version
// listened for "wheel" only, which meant only mouse-wheel/trackpad input
// was ever counted - pressing Page Down, using arrow keys, or dragging the
// scrollbar thumb produced zero wheel events and silently never counted
// toward the trigger at all. "Scroll" fires for every one of those input
// methods, so the tool now notices a scroll no matter how it happened (see
// the README break log, 2026-09-24, for how this was found).
//
// It also does the minimum de-noising a real input layer has to do: a
// single scroll gesture - wheel, trackpad, or held-down key - can fire many
// native "scroll" events in quick succession. BURST_GAP_MS folds events
// that land within that gap into a single logical scroll, so "the user
// scrolled once" and "the user scrolled ten times" both mean what a person
// would say they mean.
//
// One continuous, unbroken gesture - a trackpad swipe held down, or a key
// held down - keeps firing "scroll" events less than burstGapMs apart for
// as long as it lasts. The first version of this de-noise only compared
// each event to the PREVIOUS event, so a long enough unbroken gesture
// never had a gap bigger than burstGapMs and was folded into a single
// logical scroll no matter how long it ran - a three-second continuous
// scroll and a quick flick both counted as exactly one (see the README
// break log, 2026-09-24). That let someone defeat the trigger entirely by
// never lifting their finger. Counting again every time burstGapMs of
// CONTINUOUS scrolling has elapsed (tracked separately from "time since
// the last event") fixes this without changing how a normal quick flick
// is counted.

export function createScrollInput(target, { burstGapMs = 350, onScroll } = {}) {
  let lastEventAt = 0;
  let lastCountedAt = 0;

  function handleScroll(event) {
    const now = performance.now();
    const isNewGesture = now - lastEventAt > burstGapMs;
    const heldLongEnoughToCountAgain = now - lastCountedAt > burstGapMs;
    if (isNewGesture || heldLongEnoughToCountAgain) {
      onScroll(event);
      lastCountedAt = now;
    }
    lastEventAt = now;
  }

  target.addEventListener('scroll', handleScroll, { passive: true });

  return {
    // Lets the logic layer temporarily ignore input (e.g. while Tate is
    // already on screen) without the input layer needing to know why.
    destroy() {
      target.removeEventListener('scroll', handleScroll);
    },
  };
}
