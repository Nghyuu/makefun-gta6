# makefun-gta6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Nghyuu/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Nghyuu/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLMAR HEAT** — an original 2D top-down open-world crime game, built for make.fun's "Make GTA 6" bounty. Milo Reyes came back to Solmar City with a fast car and no money. Rosa, the fixer who runs the docks, has jobs — pickups, borrowed cars, police chases — and every one of them pays.

Drive the city. Steal what you need. Mind the stars: the Solmar PD answers fast, and they do not forget.

## The game

- **Open world:** Solmar City (2560×1920) — avenues, streets, boardwalk, beach, docks, park and plaza, 137 buildings, traffic and pedestrians living their own lives.
- **On foot and by car:** walk the sidewalks, steal any parked car (or yank a driver out of a moving one), arcade driving with handbrake turns.
- **Wanted system:** 0–5 stars with heat and decay. Run someone over, shoot near a cop, steal a cruiser — the PD sends cruisers, and a cop sitting on you while you are slow busts you (and keeps 15% of your cash).
- **Missions:** a 4-job chain from Rosa — First Fare ($400), Borrowed Wheels ($600), Hot Pursuit ($800), Payday Run ($1200) — then repeatable taxi fares in free roam.
- **Combat:** pistol with mouse aim, punches, reloads, car explosions, screen shake and particles.
- **HUD:** cash, stars, health, ammo, speed, mission line, live minimap with the mission target pulsing.
- **Polish:** start/pause/wasted/busted screens, localStorage save with Continue, WebAudio synth SFX and a bassline, deterministic screenshot scenes (`?shot=cover|street|chase|menu&seed=7`).

An original game: its city, characters, story, art and sound are its own. Nothing in it comes from any commercial game.

## Run it

```sh
# Play it: open game/index.html in desktop Chrome
# Or build the submission output:
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Controls

WASD / arrows — drive & walk · E — enter / exit car · Mouse — aim, click — shoot · F — punch · R — reload · Space — handbrake · P — pause · M — sound

## Development

No build step and no dependencies: the game is plain static files under `game/`
(classic `<script>` files, no modules, no network requests). Play it by opening
`game/index.html` in desktop Chrome, or serve it with `node serve.ts`
(`http://localhost:8080`) — note that on some locked-down machines Chrome's
Local Network Access check blocks `http://localhost`, so `file://` is the
reliable way to open it there.

```sh
node serve.ts                    # play at http://localhost:8080 (or file://game/index.html)
MAKEFUN_OUTPUT_DIR=out node main.ts   # build the submission output (dossier.json ≤ 1.5 MB)
node --check game/src/*.js       # syntax-check every game file
```

Screenshots are staged deterministically: open
`game/index.html?shot=cover|street|chase|menu&seed=7` (see `shots.json` for
the four submission scenes). The mission playthrough harness lives outside
this repo, in the builder's tooling directory.

## Layout

- `game/index.html` — the game page (classic `<script>` files, no network requests)
- `game/src/` — one-job files: `city.js`, `vehicles.js`, `people.js`, `combat.js`, `missions.js`, `render.js`, `hud.js`, `audio.js`, `input.js`, `util.js`, `shots.js`, `main.js`
- `main.ts` — Node 22 entrypoint: copies `game/` + `screenshots/` to the output and writes `dossier.json`
- `screenshots/` — the four submission screenshots (cover first)
- `shots.json` — the screenshot scenes

---

<sub>Entered on [make.fun](https://make.fun/?ref=sgg7ehtv&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
