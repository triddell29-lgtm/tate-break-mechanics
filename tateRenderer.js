// OUTPUT LAYER
// ------------
// Everything in this file is "how it looks," not "when it happens" or
// "what counts as a scroll." It takes the logic layer's two events
// (break started / break ended) and the tally readout, and turns them
// into: a walk-on, a lie-down, a breathing overlay with cycling cues, a
// walk-off, and a small always-visible counter. If tomorrow Tate was
// swapped for a different character or a plain "take a break" card, only
// this file would change.
//
// It also owns the ONE required "visible choice point" for this tool: the
// on-screen "N / target" tally (id="tate-tally") is never hidden, never
// randomized, and is the same exact number the logic layer is counting
// against - so at any moment the person can see exactly how close the next
// interruption is, instead of it happening to them with no warning.

const WALK_FRAME_COUNT = 6;
const LEAN_FRAME_COUNT = 9;
const WALK_FPS = 10;
const WALK_MS = 1600;
const LEAN_DOWN_MS = 650;
const LEAN_UP_MS = 500;
const REST_LEFT_VW = 60;
const MEDITATION_CUES = ['Breathe in...', 'and out...', "You're doing fine.", 'Breathe in...', 'and out...'];

// REST_LEFT_VW positions Tate's LEFT edge at 60% of the viewport width, and
// his height (min(560px, 58vh)) was never bounded by viewport WIDTH at
// all - only by a fixed pixel cap and viewport height. On a narrow (phone-
// width) viewport that combination pushes him hundreds of pixels past the
// right edge, off-screen, and the breathing invitation above him goes with
// him - the one required "visible choice point" plus the companion moment
// both effectively disappear (see the README break log, 2026-09-24).
// Below this breakpoint, rest further left and cap his size by viewport
// width too, so the whole thing stays on screen instead of just on desktop.
const NARROW_VIEWPORT_PX = 640;
const NARROW_REST_LEFT_VW = 6;

function isNarrowViewport() {
  return window.innerWidth < NARROW_VIEWPORT_PX;
}

function getRestLeftVw() {
  return isNarrowViewport() ? NARROW_REST_LEFT_VW : REST_LEFT_VW;
}

function getCharHeightCss() {
  return isNarrowViewport() ? 'min(320px, 46vh, 62vw)' : 'min(560px, 58vh)';
}

// Atmosphere pass: a short, deliberate beat between "Tate has arrived" and
// "the breathing UI appears," and a crossfade duration for each cue change.
// Both are here (not buried in playBreak) so the timing budget in
// playBreak's final sleep() is easy to keep honest.
const ARRIVAL_PAUSE_MS = 300;
const CUE_CROSSFADE_MS = 350;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mechanics used a flat linear tween for every walk. Atmosphere gives the
// walk-on a gentle ease-out (Tate arrives and settles, rather than
// stopping dead) and the walk-off a gentle ease-in (Tate drifts off rather
// than snapping into motion) - the same two curves a person's own
// footsteps have, just simplified into one line each.
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
function easeInCubic(t) {
  return t * t * t;
}

export function createTateRenderer({ assetUrl, mountPoint = document.documentElement } = {}) {
  const WALK_FRAMES = Array.from({ length: WALK_FRAME_COUNT }, (_, i) => assetUrl(`sprite/walk/frame_${i}.png`));
  const LEAN_FRAMES = Array.from({ length: LEAN_FRAME_COUNT }, (_, i) => assetUrl(`sprite/lean/frame_${i}.png`));
  const COVER_URL = assetUrl('breathe-cover.jpg');

  // ---- Tally readout (the visible choice point) --------------------------
  const tallyEl = document.createElement('div');
  tallyEl.id = 'tate-tally';
  Object.assign(tallyEl.style, {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: 2147483645,
    font: '600 13px -apple-system, system-ui, sans-serif',
    color: '#eafffb',
    background: 'rgba(10, 30, 28, 0.72)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '999px',
    padding: '6px 14px',
    letterSpacing: '0.02em',
    pointerEvents: 'none',
  });
  mountPoint.appendChild(tallyEl);

  function setTally(count, target) {
    tallyEl.textContent = `Tate in ${Math.max(0, target - count)} scroll${target - count === 1 ? '' : 's'}`;
  }

  // ---- Cover + character ---------------------------------------------------
  const coverEl = document.createElement('div');
  coverEl.id = 'tate-break-cover';
  Object.assign(coverEl.style, {
    position: 'fixed',
    inset: '0',
    zIndex: 2147483646,
    backgroundImage: `url(${COVER_URL})`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundColor: '#0b1a1f',
    opacity: '0',
    transition: 'opacity 0.6s ease',
    pointerEvents: 'none',
  });

  const charWrap = document.createElement('div');
  charWrap.id = 'tate-break-char';
  Object.assign(charWrap.style, {
    position: 'fixed',
    bottom: '0px',
    left: '105vw',
    zIndex: 2147483647,
    height: getCharHeightCss(),
    width: 'auto',
    pointerEvents: 'none',
  });

  const charImg = document.createElement('img');
  charImg.draggable = false;
  Object.assign(charImg.style, {
    display: 'block',
    height: '100%',
    width: 'auto',
    imageRendering: 'pixelated',
    transformOrigin: 'bottom center',
  });
  charWrap.appendChild(charImg);

  // Companion presence UI (the breathing moment). This is the one part of
  // the screen allowed to feel warm/domestic rather than instrumental -
  // it gets its own accent (amber, matching the hub's lamp-light) and its
  // own typeface (Poppins), kept off the tally pill on purpose so the
  // "visible choice point" never gets dressed up or softened.
  const breathUI = document.createElement('div');
  Object.assign(breathUI.style, {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    opacity: '0',
    transition: 'opacity 0.8s ease',
  });
  // A soft, wide glow sits behind the pulse - low-contrast enough that it
  // never competes with the pulse itself, just warms the space around it.
  const breathGlow = document.createElement('div');
  Object.assign(breathGlow.style, {
    position: 'absolute',
    width: '140px',
    height: '140px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, var(--tate-amber-glow, rgba(232,184,114,0.35)) 0%, rgba(232,184,114,0) 70%)',
    pointerEvents: 'none',
  });
  const breathPulse = document.createElement('div');
  Object.assign(breathPulse.style, {
    position: 'relative',
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'var(--tate-amber-soft, rgba(232,184,114,0.30))',
    border: '2px solid var(--tate-amber-line, rgba(232,184,114,0.75))',
    animation: 'tate-breathe 4s ease-in-out infinite',
  });
  const breathLabel = document.createElement('div');
  breathLabel.textContent = 'take a breath';
  Object.assign(breathLabel.style, {
    marginTop: '14px',
    font: "500 14px 'Poppins', -apple-system, system-ui, sans-serif",
    color: '#3a2c18',
    background: 'var(--tate-amber, #e8b872)',
    padding: '6px 14px',
    borderRadius: '12px',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
    opacity: '1',
    transition: `opacity ${CUE_CROSSFADE_MS}ms ease`,
  });
  breathUI.appendChild(breathGlow);
  breathUI.appendChild(breathPulse);
  breathUI.appendChild(breathLabel);
  charWrap.appendChild(breathUI);

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @keyframes tate-breathe {
      0%, 100% { transform: scale(0.7); opacity: 0.6; }
      50% { transform: scale(1.15); opacity: 1; }
    }
  `;
  document.documentElement.appendChild(styleTag);

  // Crossfades breathLabel's text instead of swapping it instantly: fade
  // out, swap the word underneath the fade, fade back in. Small, but it's
  // the difference between cues that arrive and cues that just appear.
  function setCueText(text) {
    breathLabel.style.opacity = '0';
    setTimeout(() => {
      breathLabel.textContent = text;
      breathLabel.style.opacity = '1';
    }, CUE_CROSSFADE_MS);
  }

  function setFacing(flipped) {
    // Source art faces left by default: no flip walking on (moving left),
    // flip walking off (moving right) - confirmed against the shipped
    // extension's tested-and-fixed direction logic.
    charImg.style.transform = flipped ? 'scaleX(-1)' : 'none';
  }

  function startFrameCycle(frames, fps) {
    let i = 0;
    charImg.src = frames[0];
    const id = setInterval(() => {
      i = (i + 1) % frames.length;
      charImg.src = frames[i];
    }, 1000 / fps);
    return () => clearInterval(id);
  }

  function tweenLeft(fromVw, toVw, durationMs, ease = null) {
    return new Promise((resolve) => {
      const start = performance.now();
      function step(now) {
        const raw = Math.min(1, (now - start) / durationMs);
        const t = ease ? ease(raw) : raw;
        charWrap.style.left = `${fromVw + (toVw - fromVw) * t}vw`;
        if (raw < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  function playFrameSequence(frames, durationMs) {
    return new Promise((resolve) => {
      const start = performance.now();
      const n = frames.length;
      function step(now) {
        const t = Math.min(1, (now - start) / durationMs);
        charImg.src = frames[Math.min(n - 1, Math.floor(t * n))];
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  // ---- The full on-screen sequence, driven by logic-layer events ---------
  async function playBreak(durationMs) {
    // Recomputed on every break, not just once at mount, so a window
    // resized between breaks (or opened narrow to begin with) still gets
    // sized and positioned to fit.
    charWrap.style.height = getCharHeightCss();
    const restLeftVw = getRestLeftVw();

    mountPoint.appendChild(coverEl);
    mountPoint.appendChild(charWrap);
    requestAnimationFrame(() => { coverEl.style.opacity = '1'; });

    const videosToResume = Array.from(document.querySelectorAll('video')).filter((v) => !v.paused);
    videosToResume.forEach((v) => { try { v.pause(); } catch (e) {} });

    setFacing(false);
    const stopWalkIn = startFrameCycle(WALK_FRAMES, WALK_FPS);
    await tweenLeft(105, restLeftVw, WALK_MS, easeOutCubic);
    stopWalkIn();

    await playFrameSequence(LEAN_FRAMES, LEAN_DOWN_MS);

    // A beat of stillness before the breathing UI appears - Tate settles
    // in before inviting you to join him, rather than the invitation
    // popping up the instant he lands.
    await sleep(ARRIVAL_PAUSE_MS);

    breathUI.style.opacity = '1';
    breathLabel.textContent = 'Take a breath';
    let cueIndex = 0;
    const cueTimer = setInterval(() => {
      setCueText(MEDITATION_CUES[cueIndex % MEDITATION_CUES.length]);
      cueIndex++;
    }, 2000);

    // Hold for whatever's left of the break duration once the walk-on,
    // lean-down, and the new arrival pause have taken their share of it.
    const spent = WALK_MS + LEAN_DOWN_MS + ARRIVAL_PAUSE_MS;
    await sleep(Math.max(0, durationMs - spent - LEAN_UP_MS - WALK_MS));
    clearInterval(cueTimer);
    breathUI.style.opacity = '0';

    await playFrameSequence([...LEAN_FRAMES].reverse(), LEAN_UP_MS);

    setFacing(true);
    const stopWalkOut = startFrameCycle(WALK_FRAMES, WALK_FPS);
    await tweenLeft(restLeftVw, 105, WALK_MS, easeInCubic);
    stopWalkOut();

    coverEl.style.opacity = '0';
    await sleep(500);
    charWrap.remove();
    coverEl.remove();
    videosToResume.forEach((v) => { try { v.play(); } catch (e) {} });
  }

  return { setTally, playBreak };
}
