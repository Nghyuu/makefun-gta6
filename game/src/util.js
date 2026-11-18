// SOLMAR HEAT — an original open-world crime game (2D top-down, Canvas 2D).
// util.js: seeded random numbers, maths helpers, and the one shared game state G.
// Every other classic script reads and writes G; nothing here touches the DOM.

// ---- seeded random (mulberry32) -------------------------------------------
function rngCreate(seed) {
  let a = seed >>> 0;
  return function rngNext() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function rngPick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function rngRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

// ---- maths ------------------------------------------------------------------
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
function angTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function angDiff(a, b) { return wrapAngle(b - a); }
// Circle (cx,cy,r) against rect (rx,ry,rw,rh): true when they overlap.
function circleHitsRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
// Push a circle out of a rect; returns the push distance (0 when clear).
function circlePushRect(c, r, rx, ry, rw, rh) {
  const nx = clamp(c.x, rx, rx + rw), ny = clamp(c.y, ry, ry + rh);
  let dx = c.x - nx, dy = c.y - ny;
  let d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return 0;
  if (d2 < 0.0001) { dx = 0; dy = -1; d2 = 1; }
  const d = Math.sqrt(d2), push = r - d;
  c.x += (dx / d) * push; c.y += (dy / d) * push;
  return push;
}
function fmtCash(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
// Seconds as a short clock ("0:32"): the survive-step countdown reads
// better as a timer than as a bare number of seconds.
function fmtClock(s) {
  const t = Math.max(0, Math.ceil(s));
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

// ---- shared game state ------------------------------------------------------
// G is the one object every module reads and writes. resetGameState() rebuilds
// the run (city, player, cars, peds, missions) from a seed; the city itself is
// generated once per seed by cityBuild and kept on G.city.
const G = {
  seed: 1,
  rng: null,
  time: 0,
  city: null,
  player: null,
  cars: [],
  peds: [],
  bullets: [],
  parts: [],
  skid: [],
  wanted: 0,
  heat: 0,
  calmTimer: 0,
  cash: 0,
  missionIndex: 0,
  missionStep: 0,
  missionTimer: 0,
  mission: null,
  camera: { x: 0, y: 0, zoom: 1 },
  screen: 'menu',
  message: '',
  messageT: 0,
  messageSub: '',
  stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, copsDown: 0, missionsDone: 0, faresDone: 0 },
  flags: {},
  save: null,
  shotMode: null,
};

function setMessage(text, sub, seconds) {
  G.message = text; G.messageSub = sub || ''; G.messageT = seconds || 3.5;
}
