// missions.js: Rosa's job chain — four missions that teach every system, then
// repeatable taxi fares in free roam. A mission is data: steps of goto, steal,
// survive or deliver, each with a map target the HUD and minimap point at.

const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    giver: 'Rosa',
    brief: 'Rosa needs a package picked up at the docks and delivered to the marina. No questions, Milo.',
    reward: 400,
    steps: [
      { type: 'goto', x: 90, y: 800, radius: 70, text: 'Pick up the package at the docks' },
      { type: 'goto', x: 2320, y: 1700, radius: 80, text: 'Deliver the package to the marina' },
    ],
  },
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    giver: 'Rosa',
    brief: 'A yellow Comet GT is parked by the plaza. Borrow it. Bring it to the garage on Palm Row.',
    reward: 600,
    steps: [
      { type: 'goto', x: 1600, y: 640, radius: 90, text: 'Head to the plaza' },
      { type: 'steal', x: 1600, y: 640, radius: 60, text: 'Take the yellow Comet GT (press E)' },
      { type: 'goto', x: 2080, y: 1440, radius: 80, text: 'Deliver the Comet to the garage', needCar: true },
    ],
  },
  {
    id: 'hot-pursuit',
    title: 'Hot Pursuit',
    giver: 'Rosa',
    brief: 'The cops made the Comet. Three stars, Milo. Stay loose for 45 seconds, then vanish to the hideout.',
    reward: 800,
    steps: [
      { type: 'survive', seconds: 45, text: 'Lose the heat — survive 45 seconds' },
      { type: 'goto', x: 480, y: 1440, radius: 80, text: 'Slip away to the hideout' },
    ],
  },
  {
    id: 'payday-run',
    title: 'Payday Run',
    giver: 'Rosa',
    brief: 'The garage is holding the take. Grab it, carry it to the hideout, and do not get caught with it.',
    reward: 1200,
    steps: [
      { type: 'goto', x: 2080, y: 1440, radius: 80, text: 'Pick up the take at the garage' },
      { type: 'goto', x: 480, y: 1440, radius: 80, text: 'Carry the cash to the hideout', needCar: false },
    ],
  },
];

let fare = null;
let fareCooldown = 0;

function missionCurrent() { return MISSIONS[G.missionIndex] || null; }
function missionTarget() { return G.missionTarget || null; }

function missionStart(index) {
  G.missionIndex = index;
  G.missionStep = 0;
  G.mission = MISSIONS[index] || null;
  if (!G.mission) { G.missionTarget = null; return; }
  setMessage(G.mission.title, G.mission.brief, 5);
  missionEnterStep();
}

function missionEnterStep() {
  const m = G.mission;
  if (!m) return;
  const step = m.steps[G.missionStep];
  if (!step) { missionComplete(); return; }
  if (step.type === 'steal') {
    // Park the yellow Comet GT by the plaza for the player to take.
    const car = makeCar(1600, 700, Math.PI / 2, 'sport', 'parked');
    car.color = '#ffe600';
    car.isTarget = true;
    G.cars.push(car);
  }
  if (step.type === 'survive') {
    G.missionTimer = step.seconds;
    wantedAdd(60, 'Three stars. The whole city is looking for you.');
    // A survive step has no map target: the timer is the objective.
    G.missionTarget = null;
    setMessage(step.text, m.title + ' — ' + m.giver, 4);
    return;
  }
  G.missionTarget = { x: step.x || 0, y: step.y || 0, radius: step.radius || 70, text: step.text, type: step.type };
  setMessage(step.text, m.title + ' — ' + m.giver, 4);
}

function missionAdvance() {
  const m = G.mission;
  if (!m) return;
  sfxPickup();
  G.missionStep++;
  if (G.missionStep >= m.steps.length) missionComplete();
  else missionEnterStep();
}

function missionComplete() {
  const m = G.mission;
  if (!m) return;
  G.cash += m.reward;
  G.stats.missionsDone++;
  sfxJingle();
  setMessage('Job done — ' + m.title, fmtCash(m.reward) + ' paid. ' + (G.missionIndex + 1 < MISSIONS.length ? 'Rosa has another job.' : 'That is the whole chapter. Solmar is yours now.'), 5);
  G.mission = null;
  G.missionTarget = null;
  G.missionIndex++;
  saveGame();
  if (G.missionIndex < MISSIONS.length) {
    setTimeout(() => { if (G.screen === 'playing' && !G.shotMode) missionStart(G.missionIndex); }, 4000);
  }
}

function missionObjectiveText() {
  if (G.mission) {
    const step = G.mission.steps[G.missionStep];
    if (step) {
      let text = G.mission.title + ': ' + step.text;
      if (step.type === 'survive') text += ' — ' + Math.max(0, Math.ceil(G.missionTimer)) + 's';
      return text;
    }
  }
  if (fare) return 'Fare: ' + (fare.state === 'pickup' ? 'Pick up the fare' : 'Drop off the fare') + ' — ' + fmtCash(fare.reward);
  if (G.missionIndex >= MISSIONS.length) return 'Free roam — fares pay the rent. Find a car, find trouble.';
  return 'Talk to Rosa — a new job is coming.';
}

function missionUpdate(dt) {
  if (G.mission) {
    const step = G.mission.steps[G.missionStep];
    if (!step) return;
    const p = G.player;
    if (step.type === 'goto') {
      const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
      if (step.needCar && !p.car) { /* must arrive by car */ }
      if (dist2(px, py, step.x, step.y) < step.radius * step.radius) missionAdvance();
    } else if (step.type === 'steal') {
      if (p.car && p.car.isTarget) missionAdvance();
    } else if (step.type === 'survive') {
      G.missionTimer -= dt;
      if (G.missionTimer <= 0) missionAdvance();
    }
    return;
  }
  // Free roam: repeatable taxi fares.
  fareCooldown -= dt;
  if (!fare && fareCooldown <= 0 && G.missionIndex >= 1) {
    const p = G.player;
    const spot = cityRandomSidewalkPoint(G.rng);
    if (dist2(spot.x, spot.y, p.x, p.y) > 350 * 350 && dist2(spot.x, spot.y, p.x, p.y) < 900 * 900) {
      const drop = cityRandomRoadPoint(G.rng, spot.x, spot.y, 500);
      fare = {
        pickup: spot, dropoff: drop,
        reward: rngInt(G.rng, 80, 160),
        state: 'pickup',
        ped: null,
      };
      const ped = makePed(spot.x, spot.y);
      ped.shirt = '#ffffff';
      fare.ped = ped;
      G.peds.push(ped);
      setMessage('A fare is waiting', 'Pick them up — ' + fmtCash(fare.reward) + ' if you deliver.', 4);
    }
  }
  if (fare) {
    const p = G.player;
    const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
    if (fare.state === 'pickup') {
      if (p.car && dist2(px, py, fare.pickup.x, fare.pickup.y) < 60 * 60) {
        fare.state = 'dropoff';
        if (fare.ped) { fare.ped.state = 'down'; fare.ped.downT = 999; }
        setMessage('Fare aboard', 'Drop them at the marker.', 3);
      }
    } else if (fare.state === 'dropoff') {
      if (dist2(px, py, fare.dropoff.x, fare.dropoff.y) < 70 * 70) {
        G.cash += fare.reward;
        G.stats.faresDone++;
        sfxJingle();
        setMessage('Fare delivered', fmtCash(fare.reward) + ' in the meter.', 3);
        fare = null;
        fareCooldown = 12;
        saveGame();
      }
    }
  }
}

function missionTargetForMap() {
  if (G.missionTarget) return G.missionTarget;
  if (fare) return fare.state === 'pickup'
    ? { x: fare.pickup.x, y: fare.pickup.y, radius: 40, text: 'Fare pickup' }
    : { x: fare.dropoff.x, y: fare.dropoff.y, radius: 50, text: 'Fare drop-off' };
  return null;
}
