# CROAKFALL: Pond Wars — Design & Roadmap

## The honest pitch

"AAA MMO" describes a production scale (hundreds of developers, years, nine-figure
budgets), not a starting point. Every big game starts as a small playable loop.
This document describes the loop we have **today** and a staged path to grow it.

**Fantasy:** you are a frog. The pond is alive with other frogs — real players and
bots. Eat flies, out-hop rivals, claim lily pads, and croak your dominance.

## What exists now (v0.1 — this repo)

| Piece | Status |
|---|---|
| 3D pond world (water, lily pads, cattails, rocks) | ✅ `game/index.html` |
| Frog avatar with hop physics, squash & stretch | ✅ |
| Tongue-snap fly hunting + score | ✅ |
| Croak emote with sound (WebAudio) + speech bubble | ✅ |
| Bot frogs that hop, hunt flies, and croak | ✅ (offline mode) |
| Real multiplayer: join/leave, 10 Hz position relay, croak relay | ✅ `server/server.js` |
| Name tags, player count, online/offline HUD | ✅ |
| Golden-hour rendering: gradient sky + sun glow, shader water with swell/sparkle, ACES tone mapping | ✅ |
| Ambience: splash ripples, fireflies, drifting clouds, swaying cattails, blinking eyes, croak throat sac | ✅ |
| Story quest chain: Elder Toad NPC, 3 quests ("The Great Croak"), Whispering Stones, Golden Fly hunt | ✅ |
| Vendor: Madame Bufo's Bazaar — 4 wearable hats + 2 upgrades (Long Tongue, Spring Legs), coin economy | ✅ |
| Hats sync over multiplayer; progress/coins/gear persist in localStorage | ✅ |

Zero build step. Three.js is vendored (`game/vendor/`), so `game/index.html`
runs from disk with no install. The server is optional — without it the pond
fills with bots.

### Controls

- **WASD / arrows** — hop
- **Space** — big jump
- **Click** — tongue-snap a fly you're facing (9 m range, 12 m with Long Tongue)
- **C** — croak
- **E** — talk to NPCs / browse the shop

### Story: "The Great Croak"

Elder Toad waits on his rock islet. Long ago the pond rang with the Great
Croak — a song that kept the herons away — until its verses were forgotten.
The quest chain restores it:

1. **A Hungry Start** — eat 5 flies (10 🪙)
2. **The Whispering Stones** — visit the 3 glowing stones at the pond's rim (15 🪙)
3. **The Golden Fly** — catch the shimmering golden fly (30 🪙, triggers the
   pond-wide Great Croak finale)

Coins also drop 1-per-fly. **Madame Bufo's Bazaar** (the stall islet) sells
the Lily Hat, Top Hat, Wizard Hat, and Royal Crown, plus two gameplay
upgrades: Long Tongue (+3 m) and Spring Legs (+20% hop). Hats are visible to
other players online; progress, coins, and gear persist in localStorage.

### Running it

```bash
# offline (bots): just open game/index.html in a browser, or:
npx serve game

# multiplayer: start the pond server, then open the game in 2+ tabs
cd server && npm install && npm start
```

Query params: `?name=Bogart` sets your name, `?server=ws://host:8080` points at
a remote pond.

## Architecture notes (prototype)

- **Client-authoritative movement.** Clients send `{x,y,z,ry}` at 10 Hz; the
  server relays. Fine for a friendly prototype, unacceptable at scale — see
  Phase 2.
- **Flies are client-local.** Each client simulates its own flies, so scores
  aren't shared truth yet. First thing to move server-side.
- **Interpolation, not prediction.** Remote frogs lerp toward last-known state.
  Hop arcs make this forgiving (discrete jumps hide latency well — a genuine
  design advantage of frogs).

## Roadmap

### Phase 1 — Sticky pond (small multiplayer game)
- Server-simulated flies and score (shared truth, leaderboard)
- Frog customization: color, hat, croak pitch
- Lily-pad king-of-the-hill: hold a golden pad to earn points
- Deploy server + static client so friends can join a public pond

### Phase 2 — Real netcode
- Authoritative server movement with client-side prediction + reconciliation
- Interest management (only sync frogs near you) — the first true "M" in MMO
- Persistence: accounts, XP, unlocks (SQLite → Postgres)

### Phase 3 — World
- Multiple ponds connected by streams (zones/sharding)
- Predators (herons strike periodically — shared PvE threat)
- Seasons/weather, day-night cycle, tadpole progression system

### Phase 4 — "AA and beyond" (requires a team + budget)
- Custom art pipeline (modeled/rigged frogs replacing primitive-built ones)
- Dedicated server fleet, matchmaking, live-ops
- This is where money and headcount, not code in this repo, become the constraint

## Why frogs are actually a great MMO protagonist

- Hop-based movement is **latency-tolerant**: motion is discrete and ballistic,
  so interpolation looks natural even at 150 ms+ ping.
- Tongue attacks are single-target, short-range, cooldown-gated — cheap to
  validate server-side.
- Ponds are naturally instanced, load-boundable zones.
