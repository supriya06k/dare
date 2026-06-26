# Drop — Season 4 · UI Strategy & Architecture

## Product Concept
Drop is a social challenge platform where real people post short video dares, the crowd votes PASS or FAIL in real-time, and every vote earns Coins (non-cashable) from the season prize pool. The platform is designed to be human-only (phone-verified, behaviour-checked) to prevent bot manipulation of voting outcomes.

---

## Design Language: Solid Glass Arena

### Inspiration
The UI was inspired by two references:
1. **Squid Game set** — deep crimson arena walls, gold structural trim, overhead spotlights, grid/scaffolding patterns, theatrical tension
2. **AI-generated glass objects** (glass fruit: strawberries, avocado, pancakes) — solid carved glass with rich specular highlights, deep color gradients, physical depth, NOT frosted/blurred panels

### Core Principle: Solid Glass, Not Frosted Glass
Every surface uses a two-layer stacked gradient:
```css
radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255,255,255,0.44) 0%, transparent 62%),
linear-gradient(170deg, <light-top> 0%, <saturated-mid> 45%, <deep-bot> 100%)
```
- **Layer 1** (radial): Specular highlight — simulates light hitting the top face of a carved glass object
- **Layer 2** (linear): Color body — deep rich gradient from lit face to shadowed underside
- `backdrop-filter: blur(4px) saturate(2.0)` kept minimal — subtle refraction, not frosted

### Glass Color System
Each color has a triplet + metadata:
```
glTop   — light face color (rgba, high opacity)
glMid   — saturated body color
glBot   — deep shadow color (full opacity)
border  — lighter than top, semi-transparent
deep    — hex shadow color (used for bottom-face depth)
hi      — specular highlight alpha (0.42–0.68)
```

**Active color palette:**
- **Teal** (votes/pass): `#35BDB3 → #1B8B82 → #083D38`
- **Wall/Crimson** (fail/arena): `#F58CA0 → #E8506A → #7A1230`
- **Gold** (prize/rank): `#FADE6E → #F0C040 → #A06C0C`
- **Cream** (neutral/cards): `rgba(255,255,255,0.18) → #F2E4CC → #D7C0A2`
- **Blue** (social): `#64A0E0 → #4A82C0 → #1C3C78`
- **Dark** (toggles/CTA): `rgba(40,16,40,0.96) → #180818 → #080408`

### Physical Press Feel
Buttons have `transform: translateY(-3px)` resting state with a bottom-face box-shadow:
```css
box-shadow:
  inset 0 3px 0 rgba(255,255,255,0.52),   /* top rim specular */
  inset 0 -2px 0 rgba(8,61,56,0.55),       /* dark bottom rim */
  0 6px 0 #0C5E57,                          /* bottom face — depth */
  0 8px 16px rgba(12,94,87,0.4);            /* ambient blur */
```
`:active` snaps `translateY(3px)` — button physically presses in.

---

## Arena Background System

### Fixed Arena Wall (`arena-bg`)
A `position: fixed; z-index: -1` div sits behind all content:
- Base color `#C23358` (deep crimson)
- Ceiling spotlight: `radial-gradient` at top center
- Column shadows: side `linear-gradient` strips
- Structural grid: `repeating-linear-gradient` at 196px intervals (horizontal) + 80px (vertical)

### Scroll-Driven Shine
A CSS variable `--shine-y` is set by a scroll listener in `page.tsx`:
```js
const pct = el.scrollTop / (el.scrollHeight - el.clientHeight)
const y = -20 + pct * 140  // -20% to 120%
bg.style.setProperty('--shine-y', `${y}%`)
```
The arena wall's `::after` pseudo-element uses this to sweep a diagonal specular beam across the wall as the user scrolls.

### Tab-Level Backgrounds
- `arena-world` (DareFeed, SeasonBoard, ProfileCard): transparent — shows fixed arena wall through
- `arena-world-dark` (LiveArena): transparent with darker overlay gradients

---

## Component Architecture

### NavBar
- Deep crimson glass header slab
- FAB (+) button: solid teal glass gem, raised center
- Bottom nav: solid pink glass pill strip
- Active tab: gold glow stripe indicator
- Tab transitions: `document.startViewTransition()` for smooth switching

### DareFeed
- **2-column staggered grid** (`gridTemplateColumns: 1fr 1fr`, `gridAutoRows: 160px`)
- `tall: true` cards span 2 rows (320px) for visual rhythm
- Each card: solid glass slab, dark inner screen overlay, play button orb, category label, trending/duration badge, bottom gradient with title + views + pool contribution
- Tap → `VoteModal` bottom sheet: earn nudge, PASS/FAIL solid glass buttons, confirmation

### LiveArena
- Live performer cards with transparent glass (`backdrop-filter: blur(20px)`)
- Real-time countdown timer, vote tallies, viewer count (all update every second)
- PASS/FAIL vote bar animates live
- Hover shimmer: diagonal light sweep on mouse enter

### SeasonBoard
- Prize pool: transparent glass slab with live counter
- 3-way split blocks (Voters 30% / Creators 50% / Platform 20%)
- Leaderboard: transparent glass rows, rank badges (gold/silver/bronze solid glass)
- Toggle Earnings ↔ Points

### ProfileCard
- Identity slab: solid teal glass
- Earnings card: solid cream glass with gold top stripe
- Breakdown: solid colored glass badges per income stream
- Impact gems: 3-column solid glass stats
- Stats footer: Rep / Challenges / City Rank colored glass blocks

### PostDareSheet
- Multi-step form: Category → Title → Difficulty → Time + Bounty → Preview
- Bottom sheet with animated entry (`sheet-up` keyframe)
- Step bar: solid glass fill segments
- Selected state: buttons flip from cream glass → color-matched solid glass

---

## Animation System (globals.css)

| Keyframe | Use |
|---|---|
| `sheet-up / sheet-down` | PostDareSheet enter/exit |
| `fade-in / fade-out` | Overlay backdrops |
| `tab-exit / tab-enter` | Tab switch cross-fade |
| `slide-up` | Earned notification toast |
| `live-ping` | LIVE dot pulse |
| `num-flip` | Ticking number transitions |
| `urgent-pulse` | Timer <30s warning |
| `glass-shimmer` | Card load shimmer sweep |
| `card-rise` | IntersectionObserver card entrance |

---

## Revenue Model (reflected in UI)
```
Every vote → 3 Coins to voter (non-cashable)
Season prize pool split:
  50% → Challenge creators (by vote-weighted share)
  30% → Voters (by participation share)
  20% → Platform
```
The UI surfaces this explicitly at every touchpoint — the goal is radical transparency about how Coins flow. Coins are **non-cashable** (a platform-funded contest, never cash — see DESIGN.md ADR-017/021).

---

## Technical Stack
- **Next.js 16.2.9** — App Router, Turbopack
- **React 19** — `useState`, `useEffect`, `useRef`, `useCallback`
- **TypeScript** strict
- **Tailwind CSS v4** — `@import "tailwindcss"` (NOT `@tailwind` directives)
- **lucide-react** — icons
- **clsx** — conditional classnames
- Max width: 430px (mobile-first, centered on desktop)

### Tailwind v4 Gotcha
Base reset zeroes `border-radius` on `<button>`. Must add `rounded-2xl` as a utility class directly on JSX — CSS-only class won't override the base reset.

---

## Pending / Next Steps
1. **AI Challenge Review Pipeline** — `app/api/review/route.ts` using Claude API: AI screening → human reviewer panel → approval UI in PostDareSheet
2. **Video upload** — actual media capture/upload flow
3. **Auth** — phone verification flow
4. **Backend** — prize pool ledger, vote recording, payout calculation
