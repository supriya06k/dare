# DARE — Platform Design Documentation

## Concept

The only platform where your reputation is built in the real world and witnessed by real people — and the AI is your opponent, not your judge.

---

## Behavioral Design Principles

### 1. The Hook — First 90 Seconds
**Problem:** Cold starts kill platforms. Users open the app and feel nothing.

**Solution:** The moment the app opens, users land on a live feed of real task submissions happening *right now*. No tutorial, no signup wall. Social proof and FOMO before the user has invested anything.

- **Component:** `LiveFeed.tsx` — real-time stream of task submissions, vote counts ticking live, new items sliding in every ~4 seconds
- **Mechanic:** Status badges (verified ✓ / AI rejected ✗ / voting live) create instant narrative

---

### 2. Variable Reward — The Dopamine Loop
**Problem:** Predictable reward → boredom.

**Solution:** Task verification is a slot machine. Will the crowd vote for me? Did the humans override the AI?

- **Component:** `VerifyArena.tsx` — live vote counter ticking up during verification window
- **Mechanics:**
  - Vote bar animates in real time as humans vote
  - 60-second countdown creates urgency
  - AI confidence score shown as the villain to beat
  - "Humans vs The Machine" framing makes every vote feel epic
- **Upcoming:** Legend Tasks (absurdly hard, massive reward, anyone can attempt), surprise bonus tasks mid-tournament

---

### 3. Identity Investment — Making Leaving Painful
**Problem:** Users with no history have no reason to stay.

**Solution:** Every completed task is permanently on your public profile. Your record *is* your identity.

- **Component:** `ProfileCard.tsx`
  - Permanent task record — verified and rejected both visible
  - Specialization tags (Speed Tasks, Creative, Physical) — algorithm learns your strengths
  - City rank (#3 in SF) — smallness creates attachment vs global leaderboard anonymity
  - Streak counter with social visibility (crew can see it)
  - Earned badges — AI Slayer, Speed Demon, Streak King

---

### 4. Social Layer — Real Human Connection
**Problem:** Most platforms simulate connection. DARE creates it.

**Solution:** Verification mechanics require real humans to judge real humans. That's a relationship seed.

- **Component:** `CrewPanel.tsx`
  - Crews of 4–6 compete together locally
  - Crew challenges with expiring countdown — notification will be opened
  - Member presence and streak visibility — social accountability > personal motivation
  - Challenge accept/forfeit with real stakes (forfeit = loss on record)

---

### 5. FOMO Engine — Compulsive Checking
- **Component:** `TournamentCard.tsx`
  - Scheduled tournament start times — like a sports match, you think about it all week
  - Participant fill bars — FOMO when 80%+ full
  - Prize display creates real stakes
  - Legend Tournaments — invite-only, massive reward, mythology-building
  - Tier system: Open → Ranked → Legend

---

### 6. AI as Opponent — The Core Narrative
**Component:** `AIChallengeBanner.tsx` + `VerifyArena.tsx`

Frame: **Humans vs The Machine**
- AI tries to reject your submission. Humans can override it.
- AI Challenge Weeks: rejection threshold raised, community must adapt
- Historical stats: "Last week humans won 73% of appeals"
- Community mythology builds around beating the AI — legendary appeals, famous failures

This turns a technical verification feature into a *story people want to be part of.*

---

## App Structure

```
app/
├── page.tsx                  — Shell with tab routing (feed / verify / crew / profile)
├── layout.tsx                — Root layout, metadata, fonts
├── globals.css               — Design tokens, animations
└── components/
    ├── NavBar.tsx            — Sticky header + bottom nav + post FAB
    ├── LiveFeed.tsx          — Real-time task stream (live-updating)
    ├── TournamentCard.tsx    — Countdown timer + fill bar + tier system
    ├── VerifyArena.tsx       — Human-vs-AI voting interface (live vote bar)
    ├── ProfileCard.tsx       — Identity layer (record, badges, stats, rank)
    ├── CrewPanel.tsx         — Crew management + expiring challenge notifications
    └── AIChallengeBanner.tsx — Narrative framing for AI antagonist mechanic
```

---

## MVP Assumptions Being Tested

| Assumption | Signal | Component |
|---|---|---|
| Live feed creates FOMO at cold start | Session length > 60s on first open | LiveFeed |
| Human override is emotionally compelling | Verification completion rate | VerifyArena |
| Local rank is stickier than global | Return rate of ranked users | ProfileCard |
| Crew challenges drive daily opens | Notification open rate | CrewPanel |
| Countdown timers drive tournament entry | Conversion within 30min of start | TournamentCard |
| AI framing creates narrative engagement | AI Challenge Week participation rate | AIChallengeBanner |

---

## Monetization Alignment

- **Entry fees** for ranked tournaments — small stakes create real investment
- **Crew subscriptions** — scheduling, analytics, challenge history
- **City sponsors** — local businesses sponsor local tournaments
- **Verification reputation scores** — sold as trust signals to employers/platforms
  - Your task history proves you're real, reliable, creative

---

## Design Tokens

```css
--accent:    #ff3d6e   /* Primary action / AI villain / urgency */
--accent-2:  #7c3aed   /* Ranked / crew / identity */
--accent-3:  #06b6d4   /* Verify arena */
--surface:   #12121e   /* Card backgrounds */
--surface-2: #1a1a2e   /* Deeper surfaces */
```
