# Dare & Validate — UI Prototype Documentation

**Project:** Dare & Validate  
**Type:** Single-file HTML/CSS/JS prototypes (no build tools, no dependencies)  
**Location:** Repository root (flat layout)  
**PRD:** `PRD_Dare_and_Validate.docx` (external, not included in this repo)

---

## What Is This

Dare & Validate is a crowd-verified challenge platform. Users submit video proof of completing a dare, the crowd votes to verify it, and verified completions earn points toward a leaderboard. These files are interactive UI prototypes exploring two radically different visual directions for that concept.

---

## Files

| File | Role | Status |
|------|------|--------|
| `v2.html` | Option 1 — physics orb field | Frozen baseline, do not modify |
| `option2.html` | Option 2 — sacred mandala wheel | Active development |
| `index.html` | Earlier experiment | Archived |
| `PRD_Dare_and_Validate.docx` | Product requirements | Source of truth for challenges/rules |

---

## Option 1 — `v2.html` (Frozen)

**Concept:** Six challenge orbs float in a black void, repelled by the cursor via spring physics. Click an orb to open its challenge detail view.

### Visual Architecture

- **Background:** Pure black (`#000`). No layers.
- **Orbs:** Each is a canvas-drawn colored blob — radial gradient fill, wobbly path via `Math.sin` on arc segments, neon bloom aura using `globalCompositeOperation:'screen'`.
- **Cursor:** Three lag-ring DOM elements (`.c1`/`.c2`/`.c3`) animated via `requestAnimationFrame`. Each ring lerps toward mouse at a different rate (0.15 / 0.10 / 0.07) creating a trailing comet effect.

### Physics

```
// Spring toward home position, cursor repulsion radius = 160px
vx = (vx + (bx - x) * 0.04) * 0.88   // spring + damping
vy = (vy + (by - y) * 0.04) * 0.88

// Repulsion
if (dist < 160) {
  force = (160 - dist) / 160
  vx -= (dx/dist) * force * 8
  vy -= (dy/dist) * force * 8
}
```

### Click Detection (fixed)

The click handler does a fresh distance check at event time — it does NOT use a stale `hoveredOrb` variable from the draw loop:

```js
document.addEventListener('click', e => {
  const clicked = orbs.find(o => {
    const dx = e.clientX - o.x, dy = e.clientY - o.y;
    return Math.sqrt(dx*dx + dy*dy) < o.r + 24;
  });
  if (clicked) openChallenge(clicked.ch);
});
```

### Challenge View

Opens as a fullscreen overlay with `backdrop-filter: blur(30px)`. Challenge data (title, description, rules, points) is populated from the `CHALLENGES` array. A hold-to-accept button is present but the hold mechanic is not implemented in this version.

---

## Option 2 — `option2.html` (Active)

**Concept:** A living sacred geometry mandala at center, six animated sigils orbiting it — each sigil is a unique challenge with a stick figure doing the actual dare, visible inside the orb. Hover a sigil to start a hold-to-select timer; hold to completion to open the challenge flood panel.

### File Structure (1486 lines)

```
Lines   1–414   CSS — all styles, overlays, panels
Lines 415–456   DARES array — 6 challenge data objects
Lines 457–474   Canvas setup + resize handler
Lines 475–505   Cursor system
Lines 506–547   Sigil layout (buildSigils)
Lines 548–598   Trail particles + ember field
Lines 599–624   Hold-to-select timer system
Lines 625–720   drawBackground()
Lines 721–744   bgStars / initStars()
Lines 745–997   drawMandala()
Lines 998–1340  drawSigil() — per-sigil rendering + 6 stick figure types
Lines 1341–1387 Hover detection + hold trigger
Lines 1388–1415 Main animation loop
Lines 1416–1429 Awakening sequence
Lines 1430–1535 UI panels: Flood, Rite (submit), Leaderboard, Ascension, Toast
```

---

### Data Model

Each entry in `DARES`:

```js
{
  id:    0,               // 0-5, matches stick figure type
  emoji: '🤹',
  label: 'Juggle 5×30s', // short label shown under sigil
  cat:   'SKILL CHALLENGE',
  title: 'Juggle 5 Objects for 30 Seconds',
  desc:  '...',
  pts:   75,              // points awarded on verification
  ver:   48,              // number of verifiers (social proof)
  hype:  847,             // engagement score (hearts/reactions)
  ca:    '#0ff4c6',       // primary gradient color
  cb:    '#7b2fff',       // secondary gradient color
  rules: ['...', '...']   // 4 verification rules shown in flood panel
}
```

---

### Layer Stack (z-index order)

| Layer | z-index | What |
|-------|---------|------|
| `#c` (main canvas) | 1 | Background + mandala + sigils |
| `#c-fx` (fx canvas) | 2 | Cursor trail particles |
| `#grain` | 3 | SVG fractalNoise texture at 4% opacity, `mix-blend-mode:overlay` |
| `#hints` | 10 | Bottom hint bar |
| `#awaken` | 20 | Intro overlay (fades on first mouse move) |
| `#flood` | 100 | Challenge detail panel |
| `#rite` | 200 | Submit proof panel |
| `#lb` | 200 | Leaderboard panel |
| `#ascend` | 300 | Success/ascension screen |
| `#cur` | 9999 | Custom cursor rings |

---

### Background — `drawBackground()`

10 large radial blob lights orbiting their home positions at independent speeds, rendered with `globalCompositeOperation:'screen'` over a dark void base (`#03000a`).

```js
const BLOBS = [
  {cx:0.5, cy:0.5, rx:0.7, ry:0.55, ox:0.32, oy:0.26, spx:0.41, spy:0.37, h:200, h2:260},
  // ... 9 more
];

// Each frame:
bgT += 0.008;
const bx = (b.cx + Math.sin(bgT * b.spx + i*1.1) * b.ox) * W;
const by = (b.cy + Math.cos(bgT * b.spy + i*0.7) * b.oy) * H;
```

Each blob:
- Has its own elliptical orbit (`rx/ry`) and orbit speed (`spx/spy`)
- Has a slow hue drift (`h + bgT*18`)
- Is drawn as a radial gradient ellipse using `ctx.scale()` to distort a circle
- Screen blend means overlapping blobs add light — no muddy mixing

200 white sparkles drift across the surface with `vx/vy` velocity, twinkling via `Math.abs(Math.sin(s.t))`. Bright ones get a 4-pixel crosshair.

---

### Mandala — `drawMandala()`

Pure gold palette. No rainbow. All layers share a single `pulse` variable so the entire structure breathes as one organism.

```js
manT += 0.004;
const pulse = 0.88 + Math.sin(manT * 2.5) * 0.12; // all layers use this
```

**Color system — two gold helpers:**

```js
function goldStroke(alpha, width, warm) {
  const h = warm ? 38 : 48;   // amber vs pale gold
  const l = warm ? 58 : 78;
  ctx.strokeStyle = `hsla(${h}, 100%, ${l}%, ${alpha})`;
}
function goldFill(alpha, warm) { ... }
```

**9 layers (center-out render order):**

| # | Layer | Speed | Notes |
|---|-------|-------|-------|
| 1 | Outer golden haze | static | Radial gradient, `oR*2.4` radius |
| 2 | 5 polygon rings (3/4/6/8/12 sides) | `0.06–0.18 rad/s` counter-alternating | All scale with `pulse` |
| 3 | 6-petal lotus | `0.15 rad/s` CW | Circle arcs at petal centers, light fill |
| 4 | Flower of Life (19 circles) | `0.10 rad/s` CCW | Classic sacred geometry |
| 5 | 12 spokes + pulsing gold diamonds | `0.22 rad/s` CW | Diamond size pulses via `Math.sin(manT*3+sp)` |
| 6 | Metatron's Cube | `0.07 rad/s` CW | All point pairs connected if `dist < mR*2.2` |
| 7 | 8 concentric circles | breathe only | Alpha oscillates via shared `pulse` |
| 8 | Central sun rays (24) | `1.8 rad/s` CW | Alternating long/short rays, gold fill |
| 9 | Gold sun disk + Star of David | `2.2 rad/s` CW | Radial gradient white→amber→dark gold, crown emoji center |

---

### Sigil System

Each sigil is a physics-driven node in a 6-point orbit. The orbit radius is `Math.min(W,H)*0.3`.

**Object shape:**

```js
{
  d,              // DARES[i] reference
  x, y,           // current screen position
  bx, by,         // spring target (breathes slightly via main loop)
  vx, vy,         // velocity
  phase,          // i * (PI*2 / 6) — angular offset
  innerRot,       // increments each frame
  hover,          // 0–1, lerps on/off
  holdProgress,   // 0–1, fills during hold
  holdActive,
  labelEl,        // DOM div for name/pts label below sigil
  particles,      // Array(12) orbital particles {a, dist, size}
}
```

**Spring physics (main loop):**

```js
s.bx = CX + orbitR() * breath * Math.cos(angle);
s.vx = (s.vx + (s.bx - s.x) * 0.04) * 0.88;  // spring 0.04, damping 0.88
s.x += s.vx;
```

**`drawSigil()` render order (per sigil, all on `ctx`, translated to `s.x/s.y`):**

1. Screen-blend neon bloom aura (two radial gradients)
2. Chromatic aberration ghost (two offset radial fills)
3. Unique geometry per `d.id` (hexagram / Fibonacci spiral / diamonds / triangles)
4. Wobbly blob body — 40-segment path, `Math.sin` radial wobble, radial gradient fill
5. Neon rim stroke + specular highlight
6. Animated stick figure (see below)
7. Orbital particle ring — 12 particles on `orbRing = R*1.6`
8. Hold progress arc (yellow, only when `holdProgress > 0`)
9. Resonance line to center (only when `hover > 0.02`)

---

### Animated Stick Figures

Each figure type is drawn procedurally via canvas lines/arcs. All animation uses `anim = mainT*1.4 + s.phase` so each sigil is phase-offset and never in sync.

| `d.id` | Figure | Animation |
|--------|--------|-----------|
| 0 | Juggler | Arms bob alternately via `Math.sin(anim)` / `Math.sin(anim+PI)`. 5 colored balls orbit above head on an elliptical path. |
| 1 | Rapper | Head bobs at `2×` frequency, torso leans, mic arm sweeps. 3 sound-wave arcs emanate from mic. Legs bounce. |
| 2 | Artist | Tilted drawing board with an in-progress portrait arc that grows via `(Math.sin(anim*0.5)+1)/2`. Arm sweeps across canvas. |
| 3 | Guitarist | Orange ellipse guitar body with sound hole. Strumming arm moves via `Math.sin(anim*3)`. 3 floating ♪ notes rise and fade. |
| 4 | Fitness | Burpee cycle: `cycle=(Math.sin(anim*1.8)+1)/2` drives 0=squat to 1=jump. Legs spread/close, arms raise/lower, body lifts vertically. Sweat drops appear at peak jump. |
| 5 | Social | Two mirrored stick figures. Alternating speech bubbles (ellipses) appear above each via `Math.sin(anim*2) > 0` toggle. |

Scale unit `sc = R * 0.018` — figures self-scale with the sigil radius.

---

### Hold-to-Select System

Hovering a sigil starts a 1600ms hold timer. A yellow arc (`rgba(255,255,100,0.95)`) fills clockwise around the sigil as `holdProgress` goes 0→1. Completing the hold calls `openFlood()`.

```js
const HOLD_DURATION = 1600; // ms
holdTimer = setInterval(() => {
  s.holdProgress = Math.min(1, (performance.now() - start) / HOLD_DURATION);
  if (s.holdProgress >= 1) { cancelHold(); openFlood(s.d, s.x, s.y); }
}, 16);
```

Moving the cursor off the sigil calls `cancelHold()` which resets `holdProgress = 0` immediately.

---

### Flood Panel (Challenge Detail)

Opens as a full-screen radial-gradient overlay erupting from the sigil's screen position.

```js
function openFlood(d, sx, sy) {
  const pctX = ((sx / W) * 100).toFixed(1) + '%';
  const pctY = ((sy / H) * 100).toFixed(1) + '%';
  veil.style.setProperty('--ox', pctX);  // CSS var drives radial-gradient center
  veil.style.setProperty('--oy', pctY);
}
```

CSS:
```css
#flood-veil {
  background: radial-gradient(ellipse at var(--ox,50%) var(--oy,50%),
    var(--fc) 0%, rgba(99,30,180,0.85) 60%, rgba(6,182,212,0.88) 100%
  );
}
```

The flood panel shows: emoji (animated float), category tag, title, description, 4 verification rules, and an "Accept the Dare" button that transitions to the Rite panel.

---

### Submit Rite Panel

Opened after accepting a dare. Three checklist items must be ticked AND the upload vessel must be tapped to unlock the "Cast Into the Network" button.

- Vessel tap triggers an emoji animation sequence: `🌀→🔮→✨→💫→🌊→⚡→🔥→🌀→✅`
- Send button only enables when `rckCount === 3 && vesselOpen`
- On submit: closes rite, shows Ascension screen with `+N pts pending`

---

### Leaderboard Panel

Triggered by clicking the central crown or pressing `L`. Shows Season 1 mock data with 5 ranked players plus a placeholder "You — unranked" row. Closes on backdrop click or `Escape`.

---

### Cursor System

Three concentric DOM rings with different lag factors:

```js
lx  += (mx - lx)  * 0.15;  // .cd1 — snappy core dot
c2x += (mx - c2x) * 0.10;  // .cd2 — medium ring
c3x += (mx - c3x) * 0.07;  // .cd3 — slow outer ring
```

State changes via CSS body classes:
- `body.hovering` — rings expand when cursor is over a sigil
- `body.holding`  — rings glow bright white during hold-to-select

---

### Cursor Trail (FX Canvas)

Every 4px of cursor movement spawns a particle on `#c-fx` (z-index 2, pointer-events none):

```js
trailPts.push({ x, y, life:1, hue: (trailTick*4)%360, size, decay });
```

Particles fade via `life -= decay` each frame and are removed when `life <= 0`. Rendered as soft radial gradient dots at `hsla(hue, 100%, 70%, life*0.5)`.

---

### Awakening Sequence

On first mouse move, a 400ms delay fires `doAwaken()`:
- `#awaken` overlay gets class `gone` (opacity: 0, pointer-events: none)
- After 2s it's `display:none`
- `#hints` bar fades in

Fallback timeout at 6s fires it automatically if the user doesn't move the mouse.

---

## Key Technical Patterns

### Screen Blend for Glow
```js
ctx.globalCompositeOperation = 'screen';
// draw radial gradient
ctx.globalCompositeOperation = 'source-over';
```
Screen blend adds light values — overlapping gradients brighten rather than muddy. Used for bloom auras on sigils and background blobs.

### Why Two Canvases
`#c` (main canvas) is cleared and fully redrawn every frame — background, mandala, sigils. `#c-fx` (fx canvas) is only partially cleared via `clearRect` and holds the cursor trail, which needs to persist between frames to fade naturally.

### Sigil Particles Bug (fixed)
The `particles` array was missing from the initial sigil object definition. `s.particles.forEach` in `drawSigil()` crashed immediately, killing the entire draw loop after the first partial render. Fix: add `particles: Array.from({length:12}, ...)` to the `DARES.map()` object.

### Click vs Hover Race Condition (v2.html, fixed)
Original click handler checked `hoveredOrb` — a variable set inside the draw loop running on rAF. Between the mousedown and click events, the loop could update `hoveredOrb` to `null` if the cursor drifted slightly. Fix: re-compute distance at click time directly in the event handler.

---

## Running Locally

```bash
# from the repository root
python3 -m http.server 8080
# open http://localhost:8080/option2.html
```

Or open `option2.html` directly as a `file://` URL — no server required, no external dependencies.

---

## What's Not Implemented (UI only)

- Video upload — vessel animation is cosmetic, no actual file input
- Real verification voting — leaderboard is static mock data
- Auth / user accounts — "You — unranked" is a placeholder
- Points persistence — ascension screen resets on page reload
- Real-time hype/ver counts — hardcoded in `DARES` array
