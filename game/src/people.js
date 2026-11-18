// people.js: the player on foot and in a car, and the pedestrians who fill the
// sidewalks. Stealing a car yanks its driver out; hitting a pedestrian is a crime
// the whole street sees.

const PLAYER_START = { hp: 100, ammo: 12, ammoMax: 12 };

function makePlayer(x, y) {
  return {
    x, y, ang: -Math.PI / 2,
    vx: 0, vy: 0,
    hp: PLAYER_START.hp,
    onFoot: true,
    car: null,
    ammo: PLAYER_START.ammo,
    reloadT: 0,
    punchT: 0,
    hurtT: 0,
    color: '#ffd23f',
    jacket: '#e63946',
  };
}

function makePed(x, y) {
  const shirts = ['#f4a261', '#2a9d8f', '#e9c46a', '#6d6875', '#b5838d', '#90be6d', '#577590'];
  return {
    x, y,
    ang: rngRange(G.rng, 0, Math.PI * 2),
    spd: rngRange(G.rng, 34, 62),
    state: 'walk', // walk | flee | down
    downT: 0,
    fleeT: 0,
    shirt: rngPick(G.rng, shirts),
    skin: rngPick(G.rng, ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']),
    dest: null,
    waitT: rngRange(G.rng, 0, 3),
  };
}

function pedSpawn(n) {
  for (let i = 0; i < n; i++) {
    const p = cityRandomSidewalkPoint(G.rng);
    if (cityBlockedAt(p.x, p.y, 10)) continue;
    G.peds.push(makePed(p.x, p.y));
  }
}

// The player on foot: WASD walks, E enters the nearest car, mouse aims,
// click shoots, F punches, R reloads.
function playerUpdateOnFoot(dt) {
  const p = G.player;
  const w = inputWalk();
  const spd = 195;
  p.vx = w.x * spd; p.vy = w.y * spd;
  if (w.x !== 0 || w.y !== 0) p.ang = Math.atan2(w.y, w.x);
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  cityResolveCircle(p, 12);
  // Aim at the mouse.
  const cam = G.camera;
  const wx = Input.mouseX / cam.zoom + cam.x - (viewW() / 2) / cam.zoom;
  const wy = Input.mouseY / cam.zoom + cam.y - (viewH() / 2) / cam.zoom;
  Input.mouseWorldX = wx; Input.mouseWorldY = wy;
  p.aim = Math.atan2(wy - p.y, wx - p.x);
  // Enter a car.
  if (inputPressed('KeyE')) playerTryEnterCar();
  // Punch: F, or Space when something is close.
  p.punchT -= dt;
  if ((inputPressed('KeyF') || inputPressed('Space')) && p.punchT <= 0) {
    p.punchT = 0.45;
    playerPunch();
  }
  // Shoot: hold the mouse button, 6 shots a second.
  p.reloadT -= dt;
  p.shootT = (p.shootT || 0) - dt;
  if (Input.mouseDown && p.reloadT <= 0 && p.shootT <= 0 && p.ammo > 0) {
    p.shootT = 0.16;
    playerShoot();
  }
  if (inputPressed('KeyR') && p.ammo < PLAYER_START.ammoMax && p.reloadT <= 0) {
    p.reloadT = 1.1;
    p.ammo = PLAYER_START.ammoMax;
    sfxReload();
  }
  p.hurtT -= dt;
  if (p.hp < 100 && G.calmTimer > 4) p.hp = Math.min(100, p.hp + 2.5 * dt);
  if (p.hp <= 0) wastePlayer();
}

function playerTryEnterCar() {
  const p = G.player;
  let best = null, bestD = 60 * 60;
  for (const c of G.cars) {
    if (c.dead) continue;
    const d = dist2(p.x, p.y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best) return;
  if (best.role === 'traffic') {
    // Yank the driver out: that is a carjacking, and the street notices.
    const d = makePed(best.x - Math.cos(best.ang) * 30, best.y - Math.sin(best.ang) * 30);
    d.state = 'flee'; d.fleeT = 4;
    G.peds.push(d);
    G.stats.carsStolen++;
    wantedAdd(22, 'Carjacking in broad daylight.');
  } else if (best.role === 'parked') {
    let seen = false;
    for (const c of G.cars) if (c.role === 'police' && !c.dead && dist2(c.x, c.y, best.x, best.y) < 320 * 320) seen = true;
    if (seen) wantedAdd(18, 'A cop saw you take that car.');
    G.stats.carsStolen++;
  } else if (best.role === 'police') {
    // Stealing a police cruiser is bold: wanted jumps.
    wantedAdd(35, 'You just stole a police cruiser.');
    G.stats.carsStolen++;
  }
  best.role = 'player';
  best.spd = 0;
  p.car = best;
  p.onFoot = false;
  p.x = best.x; p.y = best.y;
  sfxClick();
}

function playerExitCar() {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.role = 'parked';
  car.spd *= 0.2;
  p.car = null;
  p.onFoot = true;
  // Step out on the car's left side, clear of the doors and the traffic lane.
  p.x = car.x - Math.sin(car.ang) * 34;
  p.y = car.y + Math.cos(car.ang) * 34;
  p.ang = car.ang + Math.PI / 2;
  cityResolveCircle(p, 12);
}

function playerPunch() {
  const p = G.player;
  const px = p.x + Math.cos(p.aim || p.ang) * 26;
  const py = p.y + Math.sin(p.aim || p.ang) * 26;
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (dist2(px, py, ped.x, ped.y) < 26 * 26) {
      ped.state = 'down'; ped.downT = 6;
      wantedAdd(12, 'Assault in the street.');
      addSparks(ped.x, ped.y);
      sfxCrash();
      return;
    }
  }
  for (const c of G.cars) {
    if (c.dead) continue;
    if (dist2(px, py, c.x, c.y) < 40 * 40) {
      carDamage(c, 6, 'punch');
      addSparks(c.x, c.y);
      return;
    }
  }
}

function playerShoot() {
  const p = G.player;
  p.ammo--;
  G.stats.shotsFired++;
  const a = p.aim || p.ang;
  G.bullets.push({
    x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18,
    vx: Math.cos(a) * 900, vy: Math.sin(a) * 900,
    life: 0.9, from: 'player',
  });
  sfxShot();
  addShake(1.5);
  // A gunshot in earshot of the law is a crime.
  let copNear = false;
  for (const c of G.cars) if (c.role === 'police' && !c.dead && dist2(c.x, c.y, p.x, p.y) < 420 * 420) copNear = true;
  if (copNear) wantedAdd(10, 'Shots fired near the police.');
  if (p.ammo === 0) { p.reloadT = 1.1; p.ammo = PLAYER_START.ammoMax; sfxReload(); }
}

function playerHurt(amount, cause) {
  const p = G.player;
  if (p.hurtT > 0 || G.screen !== 'playing') return;
  p.hp -= amount;
  p.hurtT = 0.5;
  addShake(3);
  if (p.hp <= 0) wastePlayer();
}

function wastePlayer() {
  if (G.screen !== 'playing') return;
  G.screen = 'wasted';
  sfxWasted();
  saveGame();
}

function bustPlayer() {
  if (G.screen !== 'playing') return;
  G.screen = 'busted';
  sfxBusted();
  // Busted costs the mission's cut and a night in the cells: lose 15% of cash.
  G.cash = Math.floor(G.cash * 0.85);
  G.wanted = 0; G.heat = 0;
  saveGame();
}

// ---- pedestrians --------------------------------------------------------------
function pedUpdate(ped, dt) {
  if (ped.state === 'down') {
    ped.downT -= dt;
    if (ped.downT <= 0) { ped.state = 'walk'; }
    return;
  }
  // Flee from gunfire, explosions and speeding cars.
  let danger = null;
  if (G.bullets.length) {
    const b = G.bullets[G.bullets.length - 1];
    if (dist2(b.x, b.y, ped.x, ped.y) < 260 * 260) danger = b;
  }
  if (!danger) {
    for (const c of G.cars) {
      if (c.role === 'parked' || c.dead) continue;
      if (Math.abs(c.spd) > 200 && dist2(c.x, c.y, ped.x, ped.y) < 200 * 200) { danger = c; break; }
    }
  }
  if (danger) { ped.state = 'flee'; ped.fleeT = 2.5; }
  if (ped.state === 'flee') {
    ped.fleeT -= dt;
    if (ped.fleeT <= 0) ped.state = 'walk';
    const away = Math.atan2(ped.y - (danger ? danger.y : G.player.y), ped.x - (danger ? danger.x : G.player.x));
    ped.ang = away;
    ped.x += Math.cos(away) * 150 * dt;
    ped.y += Math.sin(away) * 150 * dt;
  } else {
    // Amble along the sidewalk; pick a new wander target when reached.
    ped.waitT -= dt;
    if (ped.waitT > 0) return;
    if (!ped.dest || dist2(ped.x, ped.y, ped.dest.x, ped.dest.y) < 20 * 20) {
      const p = cityRandomSidewalkPoint(G.rng);
      ped.dest = p;
      ped.waitT = rngRange(G.rng, 0, 4);
    }
    const a = angTo(ped.x, ped.y, ped.dest.x, ped.dest.y);
    ped.ang = a;
    ped.x += Math.cos(a) * ped.spd * dt;
    ped.y += Math.sin(a) * ped.spd * dt;
  }
  cityResolveCircle(ped, 9);
  // Run over by a car: down, and a crime if anyone is watching.
  for (const c of G.cars) {
    if (c.dead || c.role === 'parked') continue;
    if (Math.abs(c.spd) > 60 && dist2(c.x, c.y, ped.x, ped.y) < 26 * 26) {
      ped.state = 'down'; ped.downT = 8;
      G.stats.pedsHit++;
      if (c.role === 'player') wantedAdd(24, 'You ran someone over.');
      addSparks(ped.x, ped.y);
      break;
    }
  }
}

function pedsUpdate(dt) {
  for (const ped of G.peds) pedUpdate(ped, dt);
  // Keep the streets populated.
  if (G.peds.length < 16 && G.rng() < dt * 0.8) {
    const p = cityRandomSidewalkPoint(G.rng);
    const pl = G.player;
    if (dist2(p.x, p.y, pl.x, pl.y) > 500 * 500 && !cityBlockedAt(p.x, p.y, 10)) G.peds.push(makePed(p.x, p.y));
  }
}
