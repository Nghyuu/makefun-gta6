// main.js: boot and the one loop. Input is read every frame, the world advances
// in fixed 1/60 s steps, and the renderer paints what is there. Screens: menu,
// playing, paused, wasted, busted. ?seed=N fixes the city. ?shot=cover|street|
// chase|menu (with &seed=N) stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const SAVE_KEY = 'solmar-heat-save-v1';

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');

function announce(message) { if (statusEl) statusEl.textContent = message; }

// ---- world setup --------------------------------------------------------------
function resetWorld(s) {
  G.seed = s;
  G.rng = rngCreate(s);
  G.time = 0;
  G.city = cityBuild(s);
  G.cars = [];
  G.peds = [];
  G.bullets = [];
  G.parts = [];
  G.skid = [];
  G.wanted = 0;
  G.heat = 0;
  G.calmTimer = 0;
  G.cash = 0;
  G.missionIndex = 0;
  G.missionStep = 0;
  G.missionTimer = 0;
  G.mission = null;
  G.missionTarget = null;
  G.stats = { carsStolen: 0, pedsHit: 0, shotsFired: 0, copsDown: 0, missionsDone: 0, faresDone: 0 };
  G.flags = {};
  G.policeTimer = 0;
  const start = G.city.spawns.playerStart;
  G.player = makePlayer(start.x, start.y);
  G.camera.x = start.x;
  G.camera.y = start.y;
  carSpawnTraffic(16);
  carSpawnParked(14);
  pedSpawn(18);
  // A few parked cars near the start so the first car is never far away.
  const near1 = makeCar(820, 1180, Math.PI / 2, 'sedan', 'parked');
  const near2 = makeCar(760, 1060, 0, 'taxi', 'parked');
  G.cars.push(near1, near2);
}

// ---- save / load ---------------------------------------------------------------
function saveGame() {
  try {
    const p = G.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1, cash: G.cash, missionIndex: G.missionIndex,
      stats: G.stats, hp: Math.max(20, p.hp),
      x: p.x, y: p.y,
    }));
  } catch (e) { /* storage can be off: progress lasts this visit only */ }
}

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    return d;
  } catch (e) { return null; }
}

function applySave(d) {
  G.cash = d.cash || 0;
  G.stats = d.stats || G.stats;
  G.player.hp = d.hp || 100;
  G.player.x = d.x || G.city.spawns.playerStart.x;
  G.player.y = d.y || G.city.spawns.playerStart.y;
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  missionStart(Math.min(d.missionIndex || 0, MISSIONS.length - 1));
}

// ---- the simulation step --------------------------------------------------------
function worldStep(dt) {
  G.time += dt;
  if (G.messageT > 0) G.messageT -= dt;
  for (let i = G.skid.length - 1; i >= 0; i--) {
    G.skid[i].t -= dt;
    if (G.skid[i].t <= 0) G.skid.splice(i, 1);
  }
  if (G.screen === 'menu') {
    // The city stays alive behind the title screen.
    for (const c of G.cars) if (c.role === 'traffic') carUpdateTraffic(c, dt);
    pedsUpdate(dt);
    partsUpdate(dt);
    return;
  }
  if (G.screen !== 'playing') return;
  const p = G.player;
  // Exit a car with E; pause with P or Escape; M mutes.
  if (p.car && inputPressed('KeyE')) playerExitCar();
  if (inputPressed('KeyP') || inputPressed('Escape')) { pauseGame(); return; }
  if (inputPressed('KeyM')) { AudioSys.muted = !AudioSys.muted; setMessage(AudioSys.muted ? 'Sound off' : 'Sound on', '', 1.5); }
  if (p.car) {
    carUpdatePlayerCar(p.car, dt);
    p.x = p.car.x; p.y = p.car.y; p.ang = p.car.ang;
  } else {
    playerUpdateOnFoot(dt);
  }
  for (const c of G.cars) {
    if (c.dead) continue;
    if (c.role === 'traffic') carUpdateTraffic(c, dt);
    else if (c.role === 'police') carUpdatePolice(c, dt);
  }
  carCollideCars(dt);
  carSweep(dt);
  pedsUpdate(dt);
  bulletsUpdate(dt);
  partsUpdate(dt);
  wantedUpdate(dt);
  missionUpdate(dt);
  cameraUpdate(dt);
  audioUpdate(dt);
}

// ---- screens ----------------------------------------------------------------------
function showOverlay(id) {
  for (const el of ['menu', 'pause', 'end']) {
    const n = document.getElementById(el);
    if (n) n.style.display = el === id ? 'flex' : 'none';
  }
}

function startGame(fromSave) {
  audioInit();
  audioStartMusic();
  const save = fromSave ? loadSave() : null;
  resetWorld(seed);
  G.screen = 'playing';
  showOverlay(null);
  if (save) {
    applySave(save);
    announce('Continuing. ' + fmtCash(G.cash) + ' in your pocket.');
  } else {
    missionStart(0);
    announce('Playing. Rosa has a job for you.');
  }
  setMessage('SOLMAR CITY', 'Rosa: "Milo, the docks. No questions."', 4);
}

function respawn() {
  const p = G.player;
  if (p.car) { p.car.role = 'parked'; p.car = null; }
  p.onFoot = true;
  p.hp = 100;
  p.ammo = PLAYER_START.ammoMax;
  p.x = G.city.spawns.hideout.x;
  p.y = G.city.spawns.hideout.y;
  G.wanted = 0; G.heat = 0;
  G.camera.x = p.x; G.camera.y = p.y;
  G.screen = 'playing';
  showOverlay(null);
  setMessage('Back on your feet', 'Rosa is not done with you yet.', 3);
  saveGame();
}

function pauseGame() {
  if (G.screen !== 'playing') return;
  G.screen = 'paused';
  showOverlay('pause');
  announce('Paused.');
  saveGame();
}

function resumeGame() {
  if (G.screen !== 'paused') return;
  G.screen = 'playing';
  showOverlay(null);
  announce('Playing.');
}

function endScreen(kind) {
  const title = document.getElementById('end-title');
  const text = document.getElementById('end-text');
  if (kind === 'wasted') {
    if (title) title.textContent = 'WASTED';
    if (text) text.textContent = 'Milo got put down in the street. The city keeps moving — so do you.';
  } else {
    if (title) title.textContent = 'BUSTED';
    if (text) text.textContent = 'The Solmar PD took you in. They kept 15% of your cash for the trouble.';
  }
  showOverlay('end');
  announce(kind === 'wasted' ? 'Wasted.' : 'Busted.');
}

function wireButtons() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', () => { audioInit(); sfxClick(); fn(); }); };
  on('btn-start', () => startGame(false));
  on('btn-continue', () => startGame(true));
  on('btn-resume', resumeGame);
  on('btn-restart', () => startGame(false));
  on('btn-respawn', respawn);
  on('btn-menu', () => { G.screen = 'menu'; showOverlay('menu'); saveGame(); });
  on('btn-sound', () => { AudioSys.muted = !AudioSys.muted; const b = document.getElementById('btn-sound'); if (b) b.textContent = AudioSys.muted ? 'Sound: Off' : 'Sound: On'; });
  const cont = document.getElementById('btn-continue');
  if (cont) cont.style.display = loadSave() ? 'inline-block' : 'none';
}

// ---- the loop ----------------------------------------------------------------------
function runGame() {
  inputInit(canvas);
  renderInit(canvas);
  hudInit();
  wireButtons();
  resetWorld(seed);
  G.screen = 'menu';
  showOverlay('menu');
  announce('Solmar Heat. Press Enter or click to start.');
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Menu keys: Enter/Space/click starts, and the buttons do the rest.
    if (G.screen === 'menu' && (inputPressed('Enter') || inputPressed('Space') || Input.clicked)) startGame(false);
    else if (G.screen === 'paused' && (inputPressed('KeyP') || inputPressed('Escape'))) resumeGame();
    else if ((G.screen === 'wasted' || G.screen === 'busted') && inputPressed('KeyR')) respawn();
    while (accumulator >= STEP) {
      worldStep(STEP);
      accumulator -= STEP;
      if (G.screen === 'wasted' || G.screen === 'busted') {
        endScreen(G.screen);
        accumulator = 0;
        break;
      }
    }
    if (G.screen === 'playing' || G.screen === 'paused' || G.screen === 'menu') {
      cameraUpdate(STEP);
      renderDraw();
      hudUpdate();
    } else {
      renderDraw();
      hudUpdate();
    }
    inputEndFrame();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'playing') pauseGame();
  });
  window.addEventListener('beforeunload', saveGame);
  requestAnimationFrame(frame);
}

// ---- screenshots ----------------------------------------------------------------------
function runShot(name) {
  G.shotMode = name;
  inputInit(canvas);
  renderInit(canvas);
  hudInit();
  resetWorld(seed);
  stageShot(name);
  showOverlay(G.screen === 'menu' ? 'menu' : null);
  cameraUpdate(STEP);
  let painted = 0;
  function paint() {
    renderDraw();
    hudUpdate();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shotParam) runShot(shotParam);
else runGame();
