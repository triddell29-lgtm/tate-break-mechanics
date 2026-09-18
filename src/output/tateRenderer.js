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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    backgroundSize: 'contain',
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
    height: 'min(560px, 58vh)',
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

  const breathUI = document.createElement('div');
  Object.assign(breathUI.style, {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '18px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    opacity: '0',
    transition: 'opacity 0.6s ease',
  });
  const breathPulse = document.createElement('div');
  Object.assign(breathPulse.style, {
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.35)',
    border: '2px solid rgba(255,255,255,0.8)',
    animation: 'tate-breathe 4s ease-in-out infinite',
  });
  const breathLabel = document.createElement('div');
  breathLabel.textContent = 'take a breath';
  Object.assign(breathLabel.style, {
    marginTop: '10px',
    font: '13px -apple-system, system-ui, sans-serif',
    color: '#fff',
    background: 'rgba(0,0,0,0.5)',
    padding: '4px 10px',
    borderRadius: '10px',
    whiteSpace: 'nowrap',
  });
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

  function tweenLeft(fromVw, toVw, durationMs) {
    return new Promise((resolve) => {
      const start = performance.now();
      function step(now) {
        const t = Math.min(1, (now - start) / durationMs);
        charWrap.style.left = `${fromVw + (toVw - fromVw) * t}vw`;
        if (t < 1) requestAnimationFrame(step);
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
    mountPoint.appendChild(coverEl);
    mountPoint.appendChild(charWrap);
    requestAnimationFrame(() => { coverEl.style.opacity = '1'; });

    const videosToResume = Array.from(document.querySelectorAll('video')).filter((v) => !v.paused);
    videosToResume.forEach((v) => { try { v.pause(); } catch (e) {} });

    setFacing(false);
    const stopWalkIn = startFrameCycle(WALK_FRAMES, WALK_FPS);
    await tweenLeft(105, REST_LEFT_VW, WALK_MS);
    stopWalkIn();

    await playFrameSequence(LEAN_FRAMES, LEAN_DOWN_MS);

    breathUI.style.opacity = '1';
    breathLabel.textContent = 'Take a breath';
    let cueIndex = 0;
    const cueTimer = setInterval(() => {
      breathLabel.textContent = MEDITATION_CUES[cueIndex % MEDITATION_CUES.length];
      cueIndex++;
    }, 2000);

    // Hold for whatever's left of the break duration once the walk-on and
    // lean-down animations have taken their share of it.
    const spent = WALK_MS + LEAN_DOWN_MS;
    await sleep(Math.max(0, durationMs - spent - LEAN_UP_MS - WALK_MS));
    clearInterval(cueTimer);
    breathUI.style.opacity = '0';

    await playFrameSequence([...LEAN_FRAMES].reverse(), LEAN_UP_MS);

    setFacing(true);
    const stopWalkOut = startFrameCycle(WALK_FRAMES, WALK_FPS);
    await tweenLeft(REST_LEFT_VW, 105, WALK_MS);
    stopWalkOut();

    coverEl.style.opacity = '0';
    await sleep(500);
    charWrap.remove();
    coverEl.remove();
    videosToResume.forEach((v) => { try { v.play(); } catch (e) {} });
  }

  return { setTally, playBreak };
}
