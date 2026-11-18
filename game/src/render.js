// render.js: everything the eye sees — the camera, the city, the cars, the
// people, the effects and the warm afternoon light. Canvas 2D, top-down, with
// fake-height buildings (a darker south and east wall under each roof).

let RC = null; // the game canvas
let Rctx = null;

function viewW() { return RC ? RC.width : 1280; }
function viewH() { return RC ? RC.height : 720; }

function renderInit(canvas) {
  RC = canvas;
  Rctx = canvas.getContext('2d');
  renderResize();
  window.addEventListener('resize', renderResize);
}
function renderResize() {
  if (!RC) return;
  RC.width = window.innerWidth;
  RC.height = window.innerHeight;
}

function cameraUpdate(dt) {
  const p = G.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const cam = G.camera;
  cam.x = lerp(cam.x, tx, 1 - Math.pow(0.001, dt));
  cam.y = lerp(cam.y, ty, 1 - Math.pow(0.001, dt));
  // Never show the void past the map edge.
  cam.x = viewW() >= CITY.W ? CITY.W / 2 : clamp(cam.x, viewW() / 2, CITY.W - viewW() / 2);
  cam.y = viewH() >= CITY.H ? CITY.H / 2 : clamp(cam.y, viewH() / 2, CITY.H - viewH() / 2);
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function renderDraw() {
  const ctx = Rctx;
  const cam = G.camera;
  const shake = shakeTake();
  const sx = shake ? (G.rng() * 2 - 1) * shake : 0;
  const sy = shake ? (G.rng() * 2 - 1) * shake : 0;
  const vx = cam.x - viewW() / 2 + sx;
  const vy = cam.y - viewH() / 2 + sy;
  const vw = viewW(), vh = viewH();
  ctx.save();
  ctx.clearRect(0, 0, vw, vh);
  ctx.translate(-vx, -vy);
  drawGround(ctx, vx, vy, vw, vh);
  drawRoads(ctx, vx, vy, vw, vh);
  drawParkPlaza(ctx, vx, vy, vw, vh);
  drawContainers(ctx, vx, vy, vw, vh);
  drawBuildings(ctx, vx, vy, vw, vh);
  drawTrees(ctx, vx, vy, vw, vh);
  drawSkid(ctx);
  drawMissionMarker(ctx);
  drawCars(ctx, vx, vy, vw, vh);
  drawPeds(ctx, vx, vy, vw, vh);
  drawPlayer(ctx);
  drawBullets(ctx);
  drawParts(ctx);
  drawSun(ctx, vx, vy, vw, vh);
  ctx.restore();
  drawEdgeArrow(ctx);
}

function inView(x, y, m, vx, vy, vw, vh) {
  return x > vx - m && x < vx + vw + m && y > vy - m && y < vy + vh + m;
}

function drawGround(ctx, vx, vy, vw, vh) {
  // Lawns.
  ctx.fillStyle = '#7fb069';
  ctx.fillRect(vx - 20, vy - 20, vw + 40, vh + 40);
  // Dock yard concrete on the west strip.
  ctx.fillStyle = '#9a9a92';
  ctx.fillRect(0, 0, CITY.DOCKS_X, CITY.H);
  // Beach sand and water along the south edge.
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(0, CITY.BEACH_Y, CITY.W, CITY.WATER_Y - CITY.BEACH_Y);
  ctx.fillStyle = '#2e86ab';
  ctx.fillRect(0, CITY.WATER_Y, CITY.W, CITY.H - CITY.WATER_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let x = 0; x < CITY.W; x += 90) {
    const wob = Math.sin(x * 0.02 + G.time * 0.7) * 4;
    ctx.beginPath(); ctx.moveTo(x, CITY.WATER_Y + 12 + wob); ctx.lineTo(x + 44, CITY.WATER_Y + 12 + wob); ctx.stroke();
  }
}

function drawRoads(ctx, vx, vy, vw, vh) {
  // Sidewalks first (a pale border), then asphalt, then markings.
  ctx.fillStyle = '#cfc8b4';
  for (const ax of CITY.AVENUES) ctx.fillRect(ax - CITY.ROAD_HALF - 10, 0, (CITY.ROAD_HALF + 10) * 2, CITY.H);
  for (const sy of CITY.STREETS.concat([CITY.BOARDWALK_Y])) ctx.fillRect(0, sy - CITY.ROAD_HALF - 10, CITY.W, (CITY.ROAD_HALF + 10) * 2);
  ctx.fillStyle = '#41454f';
  for (const ax of CITY.AVENUES) ctx.fillRect(ax - CITY.ROAD_HALF, 0, CITY.ROAD_HALF * 2, CITY.H);
  for (const sy of CITY.STREETS.concat([CITY.BOARDWALK_Y])) ctx.fillRect(0, sy - CITY.ROAD_HALF, CITY.W, CITY.ROAD_HALF * 2);
  // Centre dashes.
  ctx.fillStyle = '#f5d76e';
  for (const ax of CITY.AVENUES) {
    for (let y = 40; y < CITY.H; y += 64) ctx.fillRect(ax - 2, y, 4, 30);
  }
  for (const sy of CITY.STREETS.concat([CITY.BOARDWALK_Y])) {
    for (let x = 40; x < CITY.W; x += 64) ctx.fillRect(x, sy - 2, 30, 4);
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const ax of CITY.AVENUES) {
    for (const sy of CITY.STREETS.concat([CITY.BOARDWALK_Y])) {
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(ax + i * 10 - 3, sy - CITY.ROAD_HALF - 4, 6, 8);
        ctx.fillRect(ax + i * 10 - 3, sy + CITY.ROAD_HALF - 4, 6, 8);
      }
    }
  }
}

function drawParkPlaza(ctx, vx, vy, vw, vh) {
  const city = G.city;
  if (city.park) {
    const pk = city.park;
    ctx.fillStyle = '#5d9b4a';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.fillStyle = '#4a8fd4';
    ctx.beginPath(); ctx.ellipse(pk.x + pk.w * 0.68, pk.y + pk.h * 0.6, 34, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d8cfae';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(pk.x + 10, pk.y + pk.h / 2); ctx.lineTo(pk.x + pk.w - 10, pk.y + pk.h / 2); ctx.stroke();
  }
  if (city.plaza) {
    const pl = city.plaza;
    ctx.fillStyle = '#d8cfae';
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    ctx.strokeStyle = '#b8ab8a';
    ctx.lineWidth = 2;
    for (let x = pl.x + 20; x < pl.x + pl.w; x += 40) { ctx.beginPath(); ctx.moveTo(x, pl.y); ctx.lineTo(x, pl.y + pl.h); ctx.stroke(); }
    for (let y = pl.y + 20; y < pl.y + pl.h; y += 40) { ctx.beginPath(); ctx.moveTo(pl.x, y); ctx.lineTo(pl.x + pl.w, y); ctx.stroke(); }
    ctx.fillStyle = '#4a8fd4';
    ctx.beginPath(); ctx.arc(pl.x + pl.w / 2, pl.y + pl.h / 2, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bfe3f0';
    ctx.beginPath(); ctx.arc(pl.x + pl.w / 2, pl.y + pl.h / 2, 16, 0, Math.PI * 2); ctx.fill();
  }
}

function drawContainers(ctx, vx, vy, vw, vh) {
  for (const c of G.city.containers) {
    if (!inView(c.x, c.y, 100, vx, vy, vw, vh)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(c.x + 4, c.y + 5, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    for (let x = c.x + 10; x < c.x + c.w; x += 12) { ctx.beginPath(); ctx.moveTo(x, c.y); ctx.lineTo(x, c.y + c.h); ctx.stroke(); }
  }
}

function drawBuildings(ctx, vx, vy, vw, vh) {
  for (const b of G.city.buildings) {
    if (!inView(b.x, b.y, Math.max(b.w, b.h) + 60, vx, vy, vw, vh)) continue;
    const h = b.hgt;
    // Drop shadow, then the south and east walls for fake height.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 6, b.y + h * 0.4 + 6, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x, b.y + b.h, b.w, h * 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + b.w, b.y + h * 0.4, h * 0.3, b.h);
    // Roof.
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // Rooftop units and skylights.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const u = b.units;
    for (let i = 0; i < u; i++) {
      const ux = b.x + 12 + ((i * 37 + b.seed * 91) % Math.max(20, b.w - 30));
      const uy = b.y + 12 + ((i * 23 + b.seed * 57) % Math.max(16, b.h - 28));
      ctx.fillRect(ux, uy, 10, 8);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
  }
}

function drawTrees(ctx, vx, vy, vw, vh) {
  for (const t of G.city.trees) {
    if (!inView(t.x, t.y, 40, vx, vy, vw, vh)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    if (t.palm) {
      ctx.strokeStyle = '#8a6d4b';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(t.x, t.y + 6); ctx.lineTo(t.x + 2, t.y - 6); ctx.stroke();
      ctx.fillStyle = '#3f9142';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath(); ctx.ellipse(t.x + Math.cos(a) * 9, t.y - 6 + Math.sin(a) * 6, 10, 4, a, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#4e9b47';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#66b364';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const l of G.city.lamps) {
    if (!inView(l.x, l.y, 20, vx, vy, vw, vh)) continue;
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(l.x - 1, l.y - 1, 3, 3);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(l.x, l.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawSkid(ctx) {
  ctx.strokeStyle = 'rgba(20,20,20,0.4)';
  ctx.lineWidth = 4;
  for (const s of G.skid) {
    ctx.globalAlpha = clamp(s.t / 3, 0, 0.5);
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.ang) * 12, s.y - Math.sin(s.ang) * 12);
    ctx.lineTo(s.x + Math.cos(s.ang) * 12, s.y + Math.sin(s.ang) * 12);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawMissionMarker(ctx) {
  const t = missionTargetForMap();
  if (!t) return;
  const pulse = 1 + Math.sin(G.time * 4) * 0.15;
  const r = t.radius * 0.4 * pulse;
  ctx.strokeStyle = '#ffe600';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(t.x, t.y, Math.max(14, r), 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,230,0,0.18)';
  ctx.beginPath(); ctx.arc(t.x, t.y, Math.max(14, r), 0, Math.PI * 2); ctx.fill();
  // A light pillar so the marker reads from anywhere on screen.
  const grad = ctx.createLinearGradient(t.x, t.y - 220, t.x, t.y);
  grad.addColorStop(0, 'rgba(255,230,0,0)');
  grad.addColorStop(1, 'rgba(255,230,0,0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(t.x - 8, t.y - 220, 16, 220);
  ctx.fillStyle = '#ffe600';
  ctx.beginPath(); ctx.arc(t.x, t.y, 5, 0, Math.PI * 2); ctx.fill();
}

function drawCarShape(ctx, car) {
  const len = car.len, wid = car.wid;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.ang);
  // Wheels.
  ctx.fillStyle = '#151515';
  ctx.fillRect(-len * 0.32, -wid / 2 - 2, 12, 5);
  ctx.fillRect(len * 0.18, -wid / 2 - 2, 12, 5);
  ctx.fillRect(-len * 0.32, wid / 2 - 3, 12, 5);
  ctx.fillRect(len * 0.18, wid / 2 - 3, 12, 5);
  // Body.
  ctx.fillStyle = car.color;
  rr(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  if (car.kind === 'cop') {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-len * 0.08, -wid / 2, len * 0.22, wid);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#222';
    for (let x = -len / 2 + 6; x < len / 2 - 6; x += 10) ctx.fillRect(x, -2, 5, 4);
  }
  if (car.isTarget) {
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 2.5;
    rr(ctx, -len / 2 - 4, -wid / 2 - 4, len + 8, wid + 8, 9);
    ctx.stroke();
  }
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  rr(ctx, -len * 0.1, -wid / 2 + 4, len * 0.34, wid - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,240,0.7)';
  ctx.fillRect(len * 0.2, -wid / 2 + 4, 4, wid - 8);
  // Lights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 3, 3, 4);
  ctx.fillRect(len / 2 - 2, wid / 2 - 7, 3, 4);
  ctx.fillStyle = '#ff2e2e';
  ctx.fillRect(-len / 2 - 1, -wid / 2 + 3, 3, 4);
  ctx.fillRect(-len / 2 - 1, wid / 2 - 7, 3, 4);
  // Police light bar, flashing.
  if (car.kind === 'cop') {
    const on = Math.floor(G.time * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff2e2e' : '#2e7bff';
    ctx.fillRect(-4, -wid / 2 + 2, 8, 5);
    ctx.fillStyle = on ? '#2e7bff' : '#ff2e2e';
    ctx.fillRect(-4, wid / 2 - 7, 8, 5);
  }
  // A burning car gets a dark tint.
  if (car.burning) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rr(ctx, -len / 2, -wid / 2, len, wid, 7);
    ctx.fill();
  }
  ctx.restore();
  // Wreck: a dead car is drawn dark and still.
  if (car.dead) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(car.x, car.y, car.len * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawCars(ctx, vx, vy, vw, vh) {
  const cars = G.cars.slice().sort((a, b) => a.y - b.y);
  // The player's car gets a soft ring so it reads at a glance.
  const pc = G.player.car;
  if (pc && !pc.dead) {
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(pc.x, pc.y, pc.len * 0.62, pc.wid * 0.9, pc.ang, 0, Math.PI * 2); ctx.stroke();
  }
  for (const c of cars) {
    if (!inView(c.x, c.y, 80, vx, vy, vw, vh)) continue;
    drawCarShape(ctx, c);
  }
}

function drawPeds(ctx, vx, vy, vw, vh) {
  for (const ped of G.peds) {
    if (!inView(ped.x, ped.y, 30, vx, vy, vw, vh)) continue;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(ped.ang + Math.PI / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(0, 2, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.fillRect(-9, -4, 18, 8);
      ctx.fillStyle = ped.skin;
      ctx.beginPath(); ctx.arc(12, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    } else {
      const bob = Math.sin(G.time * 9 + ped.x) * 1.5;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(0, 4, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(ped.ang);
      ctx.fillStyle = ped.shirt;
      rr(ctx, -6, -5, 12, 10, 3); ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath(); ctx.arc(8 + bob * 0.3, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawPlayer(ctx) {
  const p = G.player;
  if (!p.onFoot) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 5, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  const aim = p.aim !== undefined ? p.aim : p.ang;
  ctx.rotate(aim);
  // Milo: red jacket, yellow shirt, cap.
  ctx.fillStyle = p.jacket;
  rr(ctx, -7, -6, 13, 12, 4); ctx.fill();
  ctx.fillStyle = p.color;
  ctx.fillRect(2, -3, 4, 6);
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(9, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(4, -5, 7, 3);
  // The pistol, when armed.
  if (p.ammo > 0) {
    ctx.fillStyle = '#222';
    ctx.fillRect(10, -1.5, 9, 3);
    if (p.shootT > 0.1) {
      ctx.fillStyle = '#ffe600';
      ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(28, -4); ctx.lineTo(28, 4); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  // A soft ring under the player so he never gets lost in a crowd.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.stroke();
}

function drawBullets(ctx) {
  ctx.strokeStyle = '#ffe600';
  ctx.lineWidth = 2.5;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParts(ctx) {
  for (const pt of G.parts) {
    const a = clamp(pt.life / pt.max, 0, 1);
    if (pt.smoke) {
      ctx.fillStyle = 'rgba(80,80,80,' + (a * 0.45) + ')';
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * a + 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawSun(ctx, vx, vy, vw, vh) {
  // Warm afternoon light: a soft radial glow and a gentle vignette.
  const g = ctx.createRadialGradient(vx + vw * 0.72, vy + vh * 0.18, 60, vx + vw * 0.72, vy + vh * 0.18, Math.max(vw, vh) * 0.75);
  g.addColorStop(0, 'rgba(255,214,140,0.10)');
  g.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(vx, vy, vw, vh);
  const v = ctx.createRadialGradient(vx + vw / 2, vy + vh / 2, Math.min(vw, vh) * 0.42, vx + vw / 2, vy + vh / 2, Math.max(vw, vh) * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,10,30,0.20)');
  ctx.fillStyle = v;
  ctx.fillRect(vx, vy, vw, vh);
}

// An arrow at the screen edge pointing at the mission target when it is off-screen.
function drawEdgeArrow(ctx) {
  const t = missionTargetForMap();
  if (!t || G.screen !== 'playing') return;
  const cam = G.camera;
  const sx = t.x - (cam.x - viewW() / 2);
  const sy = t.y - (cam.y - viewH() / 2);
  if (sx > 40 && sx < viewW() - 40 && sy > 40 && sy < viewH() - 40) return;
  // Keep clear of the mission text (top-left) and the minimap (bottom-right).
  const cx = clamp(sx, 50, viewW() - 50), cy = clamp(sy, 130, viewH() - 190);
  const a = Math.atan2(sy - viewH() / 2, sx - viewW() / 2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = '#ffe600';
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffe600';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(Math.hypot(t.x - G.player.x, t.y - G.player.y) / 10) * 10 + 'm', cx, cy + 26);
}
