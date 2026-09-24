# Tate Break — Mechanics Prototype

A standalone, dependency-free web build of Tate Break's actual interruption
mechanic, built for the *Tool Build (mechanics)* assignment. This is the
same trigger-and-companion loop already shipped as a real Chrome extension
(see the separate `tate-break` extension project and its own
`Interface Ritual Sketch` submission) — rebuilt here as a self-contained
prototype with the input, logic, and output responsibilities pulled apart
into their own files, per this assignment's architecture requirement.

- **Live deployed link:** the published Artifact version of this exact
  prototype (see the link given alongside this submission).
- **Try it locally:** open `index.html` in a browser, or serve the folder
  (`python3 -m http.server`, then visit it) if the browser blocks ES module
  imports over `file://`.
- **Core loop:** scroll a simulated feed. Tate appears once shortly after
  the page loads, and again every fixed 10 scrolls. He walks on, lies down,
  covers the feed, leads a 15-second breathing pause with cycling cues,
  then gets up and leaves — the feed resumes exactly where it was.

## Architecture

The assignment asks for a clear separation between what captures input,
what decides what happens, and what the person actually sees. This
prototype keeps those as three separate files that only talk to each other
through plain function calls and callbacks — none of them reach into the
others' internals.

```
src/input/scrollInput.js   INPUT LAYER
src/logic/breakEngine.js   LOGIC LAYER
src/output/tateRenderer.js OUTPUT LAYER
main.js                    wiring only — no behavior of its own
```

**Input layer** (`scrollInput.js`) — Listens for native `scroll` events on
a target (so wheel, trackpad, keyboard, and scrollbar-drag input all
count — see the break log below for why it isn't just `wheel`) and turns
a noisy burst of native events (a single real-world scroll gesture can
fire dozens of events in a few milliseconds) into one clean "a scroll
happened" signal, using a 350ms gap to tell one gesture from the next,
while still counting again if that gesture is held long enough to
deserve more than one (also in the break log). It knows nothing about
Tate, counting, or timers.

**Logic layer** (`breakEngine.js`) — The actual state machine: a scroll
counter, a fixed target (10), an open-delay timer, and a break-duration
timer. Two states only — `IDLE` (counting) and `BREAK_ACTIVE` (a break is
running, and new scroll signals are *ignored*, not queued, until it ends).
This file has zero DOM references — swapping the renderer for a
`console.log` would not require touching this file at all. It's the same
fixed-count design already tested and shipped in the real extension's
`content.js`, lifted out of the browser entirely.

**Output layer** (`tateRenderer.js`) — Everything about *how it looks*:
the walk-on/lie-down/breathing/walk-off sequence, the cover image, and a
small always-on "Tate in N scrolls" pill. It receives events from the
logic layer and never decides anything about *when* those events happen.

**Wiring** (`main.js`) — Creates one of each layer and connects them:
input's `onScroll` calls the logic layer's `registerScroll()`; the logic
layer's `onBreakStart`/`onTallyChange` callbacks call the output layer's
`playBreak()`/`setTally()`. It also builds the cosmetic simulated feed,
which the mechanic doesn't actually depend on — swap in a real feed and
nothing else in the project needs to change.

### Visible choice point

The small pill fixed to the top-right corner (`#tate-tally`, "Tate in N
scrolls") is the one required visible choice point for an interrupting
tool. It always shows the exact same number the logic layer is counting
against — never a hidden countdown, never randomized — so at any moment
before a break starts, the person can see exactly how close the next
interruption is rather than have it happen to them with no warning. This
directly implements the Dignity Clause from the tool's own charter (see
Behavior Integrity Check below): "The trigger count is fixed at 10 and
stated plainly... it isn't hidden or randomized."

### Build scripts (not extra logic — just packaging)

`build_artifact.py` and `build_for_artifact_tool.py` are small build
steps that read the exact same `src/` files above and inline the CSS, JS,
and image assets (as base64 `data:` URIs) into one self-contained HTML
file, for platforms that need a single file with no external requests.
`src/` remains the one source of truth for the mechanic; these scripts
only repackage it. `dist/for_artifact_tool.html` is what's published as
the live deployed link.

## Back-End Thinking First

**What data does this tool actually need to function?** One integer (how
many scrolls since the last break) and one boolean-ish state (is a break
currently active). That's the entire data footprint — no user profile, no
history of past sessions, nothing about *what* was being scrolled.

**Where does that data need to live?** Nowhere outside the browser tab's
own memory. Both values are plain JavaScript variables closed over inside
`createBreakEngine()` — never written to a file, a cookie, `localStorage`,
`sessionStorage`, or any server.

**Does it need to be temporary or persistent?** Temporary, and
deliberately so. Reloading the page resets the scroll count to zero and
returns to `IDLE` — the same behavior the shipped Chrome extension
documents in its own README ("no storage of scroll history — the whole
thing lives in memory and resets the moment the page reloads"). This
isn't a limitation to fix later; it's the Dignity Clause working as
designed (see below).

**Does it need to remember anything across sessions?** No, on purpose.
Remembering scroll counts, break history, or "how many times you've
needed this today" would turn a companion into a tracker — exactly what
the charter's Dignity Clause rules out ("no streaks, no shaming colors,
no score, and no scroll history saved beyond the live count for the
current break cycle").

**Does this tool require any AI or inference?** No. Tate Break is a
scripted, deterministic state machine — the same three states fire the
same way every time given the same scroll count and elapsed time. It was
built explicitly as "a scripted, non-AI stand-in" for a separate
AI-companion project, and nothing in this prototype calls a model or
makes an inference of any kind.

**How many API calls does this tool expect to make, and when?** Zero.
There is no network layer anywhere in `src/` — no `fetch`, no
`XMLHttpRequest`, no analytics beacon. The extension version documents
the same thing under its own privacy statement ("no network calls").

**What happens if an API call fails?** Not applicable today, since none
exist — but the design principle that would govern one if a future
version added, say, a remote-configurable scroll target, is: **fail
open, never fail closed.** A break-and-breathe tool that broke by
*locking the feed* on an error would violate its own Refusal Clause
("never locks the feed permanently"). Any future network dependency
would need to default to the last-known-good local config and let
scrolling continue normally rather than blocking on a failed request.

## Behavior Integrity Check

Cross-referencing this prototype against Tate Break's own
`SYSTEM_CHARTER.md` (written for the prior Interface Ritual Sketch
submission, since Tate Break branched off mid-module before a formal Tool
Intent Statement existed for it):

| Charter says | This prototype does |
|---|---|
| "Fires once shortly after the page opens, and then again every 10 scrolls... a fixed, disclosed number, not a hidden one." | `openDelayMs: 1500` and `scrollTarget: 10` in `main.js`, both plain constants, both shown to the user via the tally pill. |
| "No... scroll history saved beyond the live count for the current break cycle (which resets to zero the moment he appears)." | `endBreak()` in `breakEngine.js` sets `scrollCount = 0` the moment a break ends; nothing is written anywhere before that reset. |
| "Never locks the feed permanently... never nags outside its one 15-second window." | `BREAK_ACTIVE` always transitions back to `IDLE` on a fixed `breakDurationMs` timer — there is no code path that leaves it active indefinitely. |
| "The trigger count is fixed at 10... it isn't hidden or randomized." | The tally pill (`#tate-tally`) renders the real `scrollCount`/`scrollTarget` values on every scroll — the visible choice point above. |

No gaps found between the stated charter and the built mechanic for the
one function this prototype actually implements (the trigger loop and
the on-screen break). The charter's Notes/Reminders/Goals hub is a
separate feature of the full Chrome extension and is intentionally out of
scope for this mechanics prototype, which targets the core interrupting
behavior only.

## Break Log

Three real breaks, found by actually trying to defeat the mechanic instead
of just reading the code. The first two were fixed together in one commit
to `src/input/scrollInput.js`; the third in its own commit to
`src/output/tateRenderer.js`:

**2026-09-24 — `352893b`** — Pressing Page Down (or dragging the scrollbar
thumb) never moved the tally at all. The input layer only listened for
native `wheel` events, so any scroll that didn't come from a mouse wheel
or trackpad produced zero signal — a keyboard-only user could scroll
straight through the whole feed and the break would never trigger, a
direct miss against "does this system interrupt where you claimed it
would." Confirmed with Playwright (12x `PageDown`, tally unchanged), then
switched the listener from `wheel` to the native `scroll` event, which
fires for every scroll input method. Re-ran the same test after: the
tally now moves.

**2026-09-24 — `352893b`** — Holding down one continuous scroll gesture
for a full 3 real seconds (roughly 50 events, each well under the 350ms
burst-gap) only ever moved the tally by 1 — identical to a single quick
flick. The de-noise logic compared each event only to the *previous*
event, so an unbroken gesture never produced a gap bigger than
`burstGapMs` and got folded into one logical scroll no matter how long it
ran. That's a real way to defeat the trigger: never lift your finger and
the count never climbs. Fixed by also tracking when a scroll was last
*counted* (not just last *seen*), so a held gesture counts again every
350ms of continuous motion instead of freezing at 1. Verified: the same
3-second hold now moves the tally by 8.

**2026-09-24 — `1e3ce8a`** — At a 380px-wide viewport (a phone-width
browser window), Tate's on-screen wrapper measured `left: 228px,
right: 628px` against a 380px-wide window — almost 250px past the right
edge, completely invisible, and the breathing invitation above him went
with him. `REST_LEFT_VW` fixed his resting spot at 60% of viewport
*width*, and his height was only ever capped by a pixel value and
viewport *height* — never by viewport width — so a narrow screen pushed
both his position and his size off-screen at once. Added a 640px
breakpoint: below it he rests much closer to the left edge and his
height is also capped by viewport width, so he shrinks with the screen
instead of staying fixed size. Verified with a screenshot at 380px wide:
the breathing pulse and "Take a breath" label are both now fully on
screen, and desktop width (1000px, tested for regression) is unchanged.

## Attribution

Sprite art and the breathing-break background are reused from the
already-completed Tate Break Chrome extension, which itself reuses art
from a separate T.A.T.E. desktop-companion project. See
`docs/PROMPTS.md` in the Interface Ritual Sketch submission for the full
AI-collaboration log covering this tool's design history.
