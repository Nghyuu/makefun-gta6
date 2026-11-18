// hud.js: the on-screen HUD — cash, wanted stars, health, ammo, the mission
// line, toast messages and the live minimap. All DOM; the world itself is drawn
// by render.js. Elements are looked up once at boot from index.html.

const Hud = {
  cash: null, mission: null, stars: null, hpFill: null, hpText: null,
  ammo: null, speed: null, toast: null, toastSub: null, hint: null,
  map: null, mapCtx: null, mapW: 200, mapH: 150,
};

// Whether the HUD is currently shown; hudUpdate flips it when the screen
// changes (hidden on the title screen, shown everywhere else).
let hudVisible = true;

function hudInit() {
  Hud.cash = document.getElementById('hud-cash');
  Hud.mission = document.getElementById('hud-mission');
  Hud.stars = document.getElementById('hud-stars');
  Hud.hpFill = document.getElementById('hud-hp-fill');
  Hud.hpText = document.getElementById('hud-hp-text');
  Hud.ammo = document.getElementById('hud-ammo');
  Hud.speed = document.getElementById('hud-speed');
  Hud.toast = document.getElementById('hud-toast');
  Hud.toastSub = document.getElementById('hud-toast-sub');
  Hud.hint = document.getElementById('hud-hint');
  Hud.map = document.getElementById('minimap');
  if (Hud.map) {
    Hud.map.width = Hud.mapW;
    Hud.map.height = Hud.mapH;
    Hud.mapCtx = Hud.map.getContext('2d');
  }
}

function hudStars(n) {
  let s = '';
  for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
  return s;
}

function hudUpdate() {
  // The title screen is a full-screen panel: hide the HUD behind it, or the
  // cash, stars and minimap peek out around its edges. Only touch the DOM
  // when the visibility actually flips.
  const showHud = G.screen !== 'menu';
  if (showHud !== hudVisible) {
    hudVisible = showHud;
    document.querySelectorAll('.hud, #hud-toast-wrap').forEach((el) => { el.style.display = showHud ? '' : 'none'; });
  }
  const p = G.player;
  if (Hud.cash) Hud.cash.textContent = fmtCash(G.cash);
  if (Hud.mission) Hud.mission.textContent = missionObjectiveText();
  if (Hud.stars) {
    Hud.stars.textContent = hudStars(G.wanted);
    Hud.stars.style.color = G.wanted > 0 ? '#ffd23f' : 'rgba(255,255,255,0.45)';
  }
  if (Hud.hpFill) {
    Hud.hpFill.style.width = clamp(p.hp, 0, 100) + '%';
    // The bar itself warns you: green while healthy, amber when hurt, red
    // when one more hit ends the run.
    Hud.hpFill.style.background = p.hp > 50 ? '#58b368' : p.hp > 25 ? '#f2a541' : '#e63946';
  }
  if (Hud.hpText) Hud.hpText.textContent = Math.ceil(p.hp) + ' HP';
  if (Hud.ammo) Hud.ammo.textContent = p.onFoot ? ('AMMO ' + p.ammo + '/12') : '';
  if (Hud.speed) {
    Hud.speed.textContent = p.car ? Math.round(Math.abs(p.car.spd) * 0.22) + ' km/h' : '';
  }
  if (Hud.toast) {
    if (G.messageT > 0) {
      Hud.toast.textContent = G.message;
      if (Hud.toastSub) Hud.toastSub.textContent = G.messageSub;
      Hud.toast.parentElement.style.opacity = '1';
    } else {
      Hud.toast.parentElement.style.opacity = '0';
    }
  }
  hudDrawMinimap();
}

function hudDrawMinimap() {
  const ctx = Hud.mapCtx;
  if (!ctx) return;
  const W = Hud.mapW, H = Hud.mapH;
  const s = Math.min(W / CITY.W, H / CITY.H);
  const ox = (W - CITY.W * s) / 2, oy = (H - CITY.H * s) / 2;
  ctx.clearRect(0, 0, W, H);
  // Ground, beach, water.
  ctx.fillStyle = '#6f9e58';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(ox, oy + CITY.BEACH_Y * s, CITY.W * s, (CITY.WATER_Y - CITY.BEACH_Y) * s);
  ctx.fillStyle = '#2e86ab';
  ctx.fillRect(ox, oy + CITY.WATER_Y * s, CITY.W * s, (CITY.H - CITY.WATER_Y) * s);
  // Roads.
  ctx.strokeStyle = '#3d414c';
  ctx.lineWidth = 2;
  for (const ax of CITY.AVENUES) { ctx.beginPath(); ctx.moveTo(ox + ax * s, 0); ctx.lineTo(ox + ax * s, H); ctx.stroke(); }
  for (const sy of CITY.STREETS.concat([CITY.BOARDWALK_Y])) { ctx.beginPath(); ctx.moveTo(0, oy + sy * s); ctx.lineTo(W, oy + sy * s); ctx.stroke(); }
  // Buildings.
  ctx.fillStyle = 'rgba(40,40,40,0.55)';
  for (const b of G.city.buildings) ctx.fillRect(ox + b.x * s, oy + b.y * s, Math.max(1.5, b.w * s), Math.max(1.5, b.h * s));
  // Mission target: a pulsing yellow diamond.
  const t = missionTargetForMap();
  if (t) {
    const pulse = 3 + Math.sin(G.time * 5) * 1.5;
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.moveTo(ox + t.x * s, oy + t.y * s - pulse - 3);
    ctx.lineTo(ox + t.x * s + pulse + 3, oy + t.y * s);
    ctx.lineTo(ox + t.x * s, oy + t.y * s + pulse + 3);
    ctx.lineTo(ox + t.x * s - pulse - 3, oy + t.y * s);
    ctx.closePath(); ctx.fill();
  }
  // Traffic as grey dots, police as flashing red.
  ctx.fillStyle = 'rgba(220,220,220,0.8)';
  for (const c of G.cars) {
    if (c.role === 'traffic' || c.role === 'parked') ctx.fillRect(ox + c.x * s - 1, oy + c.y * s - 1, 2, 2);
  }
  const flash = Math.floor(G.time * 4) % 2 === 0;
  ctx.fillStyle = flash ? '#ff2e2e' : '#ff7b7b';
  for (const c of G.cars) {
    if (c.role === 'police' && !c.dead) {
      ctx.beginPath(); ctx.arc(ox + c.x * s, oy + c.y * s, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  // The player: a white dot with a direction tick.
  const p = G.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(ox + px * s, oy + py * s, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ox + px * s, oy + py * s);
  ctx.lineTo(ox + (px + Math.cos(p.ang) * 60) * s, oy + (py + Math.sin(p.ang) * 60) * s);
  ctx.stroke();
  // View frame.
  const cam = G.camera;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + (cam.x - viewW() / 2) * s, oy + (cam.y - viewH() / 2) * s, viewW() * s, viewH() * s);
}
