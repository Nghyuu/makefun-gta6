// vehicles.js: cars — arcade physics, road-following traffic, police chases and
// the wanted system. A car is two collision circles (nose and tail) on a heading
// with a scalar speed; traffic follows the road grid toward a destination
// intersection, police steer straight at the player.

const CAR_KINDS = {
  sedan: { len: 46, wid: 22, max: 470, accel: 380, colors: ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#7f8c8d', '#2c3e50'] },
  taxi: { len: 46, wid: 22, max: 480, accel: 390, colors: ['#f1c40f'] },
  sport: { len: 48, wid: 22, max: 620, accel: 540, colors: ['#ff2e63', '#ffe600', '#00e5ff', '#ff6d00'] },
  truck: { len: 58, wid: 24, max: 380, accel: 300, colors: ['#95a5a6', '#6c7a89', '#a1887f'] },
  cop: { len: 48, wid: 22, max: 560, accel: 470, colors: ['#222831'] },
};

let carIdNext = 1;

function makeCar(x, y, ang, kind, role) {
  const spec = CAR_KINDS[kind];
  return {
    id: carIdNext++,
    x, y, ang,
    vx: 0, vy: 0,
    spd: 0,
    len: spec.len, wid: spec.wid,
    max: spec.max, accel: spec.accel,
    color: rngPick(G.rng, spec.colors),
    kind, role,
    hp: kind === 'cop' ? 130 : 100,
    maxHp: kind === 'cop' ? 130 : 100,
    burning: false,
    burnT: 0,
    dead: false,
    deadT: 0,
    // traffic AI
    dest: null,
    path: [],
    pathI: 0,
    cruise: rngRange(G.rng, 130, 180),
    waitT: 0,
    // police AI
    bustT: 0,
    stuckT: 0,
    lastX: x, lastY: y,
    smokeT: 0,
    honkT: 0,
  };
}

// The right-hand lane offset for a direction of travel: 18 px to the right.
function laneOffset(dx, dy) { return { x: -dy * 18, y: dx * 18 }; }

// A route for a traffic car: two waypoints over the grid to a destination
// intersection (avenue, street). From a vertical road go to the destination
// street first, then along it; from a horizontal road the reverse.
function carPlanRoute(car, dest) {
  const road = cityRoadAt(car.x, car.y);
  const pts = [];
  if (road && road.axis === 'v') {
    pts.push({ x: road.line, y: dest.y });
    pts.push({ x: dest.x, y: dest.y });
  } else if (road && road.axis === 'h') {
    pts.push({ x: dest.x, y: road.line });
    pts.push({ x: dest.x, y: dest.y });
  } else {
    const near = cityNearestRoad(car.x, car.y);
    if (near.axis === 'v') pts.push({ x: near.line, y: car.y });
    else pts.push({ x: car.x, y: near.line });
    pts.push({ x: dest.x, y: dest.y });
  }
  car.path = pts;
  car.pathI = 0;
}

function carPickDestination(car) {
  const dest = {
    x: rngPick(G.rng, CITY.AVENUES),
    y: rngPick(G.rng, CITY.STREETS.concat([CITY.BOARDWALK_Y])),
  };
  car.dest = dest;
  carPlanRoute(car, dest);
}

function carSpawnTraffic(n) {
  for (let i = 0; i < n; i++) {
    const p = cityRandomRoadPoint(G.rng, G.player ? G.player.x : undefined, G.player ? G.player.y : undefined, 260);
    const road = cityRoadAt(p.x, p.y);
    let ang = 0;
    if (road) {
      if (road.axis === 'v') ang = G.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      else ang = G.rng() < 0.5 ? 0 : Math.PI;
    }
    const kind = rngPick(G.rng, ['sedan', 'sedan', 'sedan', 'taxi', 'truck', 'sport']);
    const car = makeCar(p.x, p.y, ang, kind, 'traffic');
    car.spd = rngRange(G.rng, 80, 160);
    carPickDestination(car);
    G.cars.push(car);
  }
}

function carSpawnParked(n) {
  for (let i = 0; i < n; i++) {
    const p = cityRandomRoadPoint(G.rng, G.player ? G.player.x : undefined, G.player ? G.player.y : undefined, 200);
    const road = cityRoadAt(p.x, p.y);
    if (!road) continue;
    let x = p.x, y = p.y, ang = 0;
    if (road.axis === 'v') { x = road.line + (G.rng() < 0.5 ? -52 : 52); ang = G.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
    else { y = road.line + (G.rng() < 0.5 ? -52 : 52); ang = G.rng() < 0.5 ? 0 : Math.PI; }
    if (cityBlockedAt(x, y, 20)) continue;
    const kind = rngPick(G.rng, ['sedan', 'sedan', 'taxi', 'sport', 'truck']);
    G.cars.push(makeCar(x, y, ang, kind, 'parked'));
  }
}

// Steer a car toward a point at up to maxSpeed. Returns the new speed.
function carSteerToward(car, tx, ty, maxSpeed, dt) {
  const want = angTo(car.x, car.y, tx, ty);
  const diff = angDiff(car.ang, want);
  const turn = 2.4 / (1 + Math.abs(car.spd) / 320);
  car.ang += clamp(diff, -turn * dt, turn * dt);
  const target = Math.abs(diff) > 0.9 ? maxSpeed * 0.35 : maxSpeed;
  if (car.spd < target) car.spd = Math.min(target, car.spd + car.accel * dt);
  else car.spd = Math.max(target, car.spd - car.accel * 1.4 * dt);
  return car.spd;
}

function carFront(car) {
  return { x: car.x + Math.cos(car.ang) * car.len * 0.28, y: car.y + Math.sin(car.ang) * car.len * 0.28 };
}
function carRear(car) {
  return { x: car.x - Math.cos(car.ang) * car.len * 0.28, y: car.y - Math.sin(car.ang) * car.len * 0.28 };
}

// Move a car by its speed and heading, then push it out of buildings.
function carIntegrate(car, dt) {
  const fx = Math.cos(car.ang), fy = Math.sin(car.ang);
  car.x += fx * car.spd * dt;
  car.y += fy * car.spd * dt;
  const f = carFront(car), r = carRear(car);
  const hitF = cityResolveCircle(f, car.wid * 0.5);
  const hitR = cityResolveCircle(r, car.wid * 0.5);
  if (hitF || hitR) {
    // Re-centre from the two circles and bleed speed on the impact.
    const nx = (f.x + r.x) / 2, ny = (f.y + r.y) / 2;
    const impact = Math.abs(car.spd);
    car.x = nx; car.y = ny;
    car.ang = Math.atan2(f.y - r.y, f.x - r.x);
    car.spd *= 0.55;
    if (impact > 220) {
      carDamage(car, (impact - 220) / 22, 'crash');
      if (car.role === 'player') { sfxCrash(); addShake(Math.min(7, impact / 90)); }
    }
  }
}

function carUpdateTraffic(car, dt) {
  if (car.waitT > 0) { car.waitT -= dt; car.spd = Math.max(0, car.spd - car.accel * dt); carIntegrate(car, dt); return; }
  if (!car.path || car.pathI >= car.path.length) { carPickDestination(car); }
  const wp = car.path[car.pathI];
  const dx = wp.x - car.x, dy = wp.y - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 26) { car.pathI++; return; }
  // Slow for a car ahead in the same lane.
  let ahead = false;
  for (const o of G.cars) {
    if (o === car || o.role === 'parked') continue;
    const ox = o.x - car.x, oy = o.y - car.y;
    const along = ox * Math.cos(car.ang) + oy * Math.sin(car.ang);
    const side = Math.abs(-ox * Math.sin(car.ang) + oy * Math.cos(car.ang));
    if (along > 0 && along < 78 && side < 26) { ahead = true; break; }
  }
  const off = laneOffset(dx / d, dy / d);
  const maxSpd = ahead ? 0 : car.cruise;
  carSteerToward(car, wp.x + off.x, wp.y + off.y, maxSpd, dt);
  carIntegrate(car, dt);
  // Stuck detection: pick a new destination rather than sit forever.
  if (Math.hypot(car.x - car.lastX, car.y - car.lastY) < 2 && Math.abs(car.spd) > 40) car.stuckT += dt;
  else car.stuckT = 0;
  car.lastX = car.x; car.lastY = car.y;
  if (car.stuckT > 3) { car.stuckT = 0; carPickDestination(car); }
}

function carUpdatePolice(car, dt) {
  const p = G.player;
  const d = Math.hypot(p.x - car.x, p.y - car.y);
  if (d > 1100) { // too far: give up and fade out
    car.dead = true; car.deadT = 0; return;
  }
  const maxSpd = Math.min(600, 500 + G.wanted * 22);
  carSteerToward(car, p.x, p.y, maxSpd, dt);
  carIntegrate(car, dt);
  // Busted: a cop sitting on the player while the player is slow or on foot.
  const playerSlow = p.car ? Math.abs(p.car.spd) < 60 : true;
  if (d < 64 && playerSlow) {
    car.bustT += dt;
    if (car.bustT > 2.2) { bustPlayer(); return; }
  } else car.bustT = 0;
  car.honkT -= dt;
  if (car.honkT <= 0 && d < 420 && G.rng() < 0.5) { sfxHorn(); car.honkT = 4 + G.rng() * 4; }
}

function carUpdatePlayerCar(car, dt) {
  const drive = inputDrive();
  const handbrake = inputDown('Space');
  const fwd = drive.y;
  if (fwd > 0) car.spd = Math.min(car.max, car.spd + car.accel * dt);
  else if (fwd < 0) {
    if (car.spd > 20) car.spd = Math.max(0, car.spd - car.accel * 1.6 * dt); // brake
    else car.spd = Math.max(-170, car.spd - car.accel * 0.6 * dt); // reverse
  } else {
    car.spd -= car.spd * (handbrake ? 2.6 : 0.55) * dt;
    if (Math.abs(car.spd) < 4) car.spd = 0;
  }
  const steer = drive.x;
  const turnRate = 2.7 / (1 + Math.abs(car.spd) / 260);
  car.ang += steer * turnRate * dt * (car.spd >= 0 ? 1 : -1) * clamp(Math.abs(car.spd) / 60, 0, 1);
  if (handbrake && Math.abs(car.spd) > 120) {
    // Handbrake turn: extra yaw and a skid mark.
    car.ang += steer * 1.1 * dt;
    if (G.rng() < 0.6) {
      const r = carRear(car);
      G.skid.push({ x: r.x, y: r.y, ang: car.ang, t: 3 });
    }
  }
  carIntegrate(car, dt);
  if (car.hp < 45 && !car.burning) {
    car.burning = true;
    setMessage('Your car is burning out!', 'Ditch it before it blows.', 3);
  }
  if (car.burning) {
    car.burnT += dt;
    car.smokeT -= dt;
    if (car.smokeT <= 0) {
      car.smokeT = 0.12;
      addSmoke(car.x, car.y);
    }
    if (car.burnT > 5) { explodeCar(car); }
  }
}

// ---- collisions between cars -------------------------------------------------
function carCollideCars(dt) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.dead || b.dead) continue;
      const fa = carFront(a), ra = carRear(a), fb = carFront(b), rb = carRear(b);
      const pts = [[fa, fb], [fa, rb], [ra, fb], [ra, rb]];
      for (const [pa, pb] of pts) {
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        const d = Math.hypot(dx, dy);
        const min = a.wid * 0.5 + b.wid * 0.5;
        if (d > 0.01 && d < min) {
          const push = (min - d) / 2;
          const nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const rel = Math.abs(a.spd - b.spd);
          if (rel > 140) {
            carDamage(a, rel / 60, 'crash');
            carDamage(b, rel / 60, 'crash');
            addSparks((pa.x + pb.x) / 2, (pa.y + pb.y) / 2);
            if (a.role === 'player' || b.role === 'player') sfxCrash();
          }
          a.spd *= 0.86; b.spd *= 0.86;
        }
      }
    }
  }
}

// ---- damage, wanted, police spawning ------------------------------------------
function carDamage(car, amount, cause) {
  if (car.dead || amount <= 0) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    if (car.role === 'police') { G.stats.copsDown++; wantedAdd(30, 'cop down'); }
    explodeCar(car);
  }
}

function explodeCar(car) {
  if (car.dead) return;
  car.dead = true; car.deadT = 0;
  explodeAt(car.x, car.y, 1.4);
  sfxCrash();
  if (G.player.car === car) {
    G.player.car = null;
    G.player.onFoot = true;
    G.player.hp = Math.max(20, G.player.hp - 25);
    setMessage('Your car blew up!', 'You made it out — barely.', 3);
  }
}

function wantedAdd(amount, reason) {
  G.heat = clamp(G.heat + amount, 0, 100);
  const stars = Math.min(5, Math.floor(G.heat / 20));
  if (stars > G.wanted) {
    G.wanted = stars;
    if (reason) setMessage('Wanted level up — ' + G.wanted + (G.wanted === 1 ? ' star' : ' stars'), reason, 2.5);
  } else G.wanted = stars;
  G.calmTimer = 0;
}

function wantedUpdate(dt) {
  const p = G.player;
  let copNear = false;
  for (const c of G.cars) {
    if (c.role === 'police' && !c.dead && dist2(c.x, c.y, p.x, p.y) < 480 * 480) { copNear = true; break; }
  }
  if (!copNear) G.calmTimer += dt; else G.calmTimer = 0;
  if (G.calmTimer > 6 && G.heat > 0) {
    G.heat = Math.max(0, G.heat - 5 * dt);
    G.wanted = Math.min(5, Math.floor(G.heat / 20));
  }
  // Spawn police while wanted.
  if (G.wanted > 0) {
    const cops = G.cars.filter(c => c.role === 'police' && !c.dead).length;
    const want = Math.min(4, G.wanted);
    if (cops < want) {
      G.policeTimer = (G.policeTimer || 0) - dt;
      if (G.policeTimer <= 0) {
        G.policeTimer = 2.2;
        const pt = cityRandomRoadPoint(G.rng, p.x, p.y, 520);
        const cop = makeCar(pt.x, pt.y, angTo(pt.x, pt.y, p.x, p.y), 'cop', 'police');
        G.cars.push(cop);
      }
    }
  }
}

// Remove dead cars after their wreck has burned a while; keep the street clear.
function carSweep(dt) {
  for (let i = G.cars.length - 1; i >= 0; i--) {
    const c = G.cars[i];
    if (c.dead) {
      c.deadT += dt;
      if (c.deadT > 14) G.cars.splice(i, 1);
    }
  }
  if (G.skid.length > 220) G.skid.splice(0, G.skid.length - 220);
}
