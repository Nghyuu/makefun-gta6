// combat.js: bullets, explosions and particles — the noisy half of the game.
// Bullets fly straight and die on the first thing they hit; an explosion is a
// burst of particles plus a shockwave that hurts cars and people nearby.

let shakeAmt = 0;

function addShake(amount) { shakeAmt = Math.min(10, shakeAmt + amount); }
function shakeTake() { const s = shakeAmt; shakeAmt *= 0.86; if (shakeAmt < 0.05) shakeAmt = 0; return s; }

function addSparks(x, y) {
  for (let i = 0; i < 8; i++) {
    const a = G.rng() * Math.PI * 2, sp = rngRange(G.rng, 60, 260);
    G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rngRange(G.rng, 0.2, 0.5), max: 0.5, size: 2.5, color: '#ffd23f', grav: 0 });
  }
}
function addSmoke(x, y) {
  G.parts.push({
    x: x + rngRange(G.rng, -8, 8), y: y + rngRange(G.rng, -8, 8),
    vx: rngRange(G.rng, -12, 12), vy: rngRange(G.rng, -30, -12),
    life: rngRange(G.rng, 0.7, 1.3), max: 1.3, size: rngRange(G.rng, 6, 12), color: '#555555', grav: 0, smoke: true,
  });
}
function addBlood(x, y) {
  for (let i = 0; i < 6; i++) {
    const a = G.rng() * Math.PI * 2, sp = rngRange(G.rng, 40, 160);
    G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, max: 0.4, size: 3, color: '#c0392b', grav: 0 });
  }
}

function explodeAt(x, y, scale) {
  const n = Math.floor(26 * scale);
  for (let i = 0; i < n; i++) {
    const a = G.rng() * Math.PI * 2, sp = rngRange(G.rng, 60, 380) * scale;
    G.parts.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rngRange(G.rng, 0.4, 1.1), max: 1.1,
      size: rngRange(G.rng, 3, 8) * scale,
      color: rngPick(G.rng, ['#ff6d00', '#ffd23f', '#ff3b30', '#ff9e00']),
      grav: 0,
    });
  }
  for (let i = 0; i < 10; i++) addSmoke(x + rngRange(G.rng, -20, 20), y + rngRange(G.rng, -20, 20));
  addShake(8 * scale);
  // The blast hurts whatever is close.
  const R = 120 * scale;
  for (const c of G.cars) {
    if (c.dead) continue;
    if (dist2(c.x, c.y, x, y) < R * R) carDamage(c, 55, 'blast');
  }
  for (const ped of G.peds) {
    if (ped.state !== 'down' && dist2(ped.x, ped.y, x, y) < R * R) { ped.state = 'down'; ped.downT = 8; }
  }
  const p = G.player;
  if (p.car) {
    if (dist2(p.car.x, p.car.y, x, y) < R * R) carDamage(p.car, 30, 'blast');
  } else if (dist2(p.x, p.y, x, y) < R * R) {
    playerHurt(30, 'blast');
  }
}

function bulletsUpdate(dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && cityBlockedAt(b.x, b.y, 1)) { addSparks(b.x, b.y); dead = true; }
    if (!dead) {
      for (const c of G.cars) {
        if (c.dead) continue;
        const f = carFront(c), r = carRear(c);
        if (dist2(b.x, b.y, f.x, f.y) < 16 * 16 || dist2(b.x, b.y, r.x, r.y) < 16 * 16 || dist2(b.x, b.y, c.x, c.y) < 20 * 20) {
          carDamage(c, 22, 'shot');
          addSparks(b.x, b.y);
          if (c.role === 'police') wantedAdd(6, 'You shot a police car.');
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const ped of G.peds) {
        if (ped.state === 'down') continue;
        if (dist2(b.x, b.y, ped.x, ped.y) < 14 * 14) {
          ped.state = 'down'; ped.downT = 8;
          addBlood(ped.x, ped.y);
          wantedAdd(20, 'You shot someone.');
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      const p = G.player;
      if (p.onFoot && dist2(b.x, b.y, p.x, p.y) < 14 * 14) {
        playerHurt(12, 'shot');
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

function partsUpdate(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const pt = G.parts[i];
    pt.life -= dt;
    if (pt.life <= 0) { G.parts.splice(i, 1); continue; }
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= (1 - 1.8 * dt); pt.vy *= (1 - 1.8 * dt);
    if (pt.smoke) pt.size += 14 * dt;
  }
  if (G.parts.length > 500) G.parts.splice(0, G.parts.length - 500);
}
