// city.js: Solmar City — a sun-soaked coastal grid city, generated from a seed.
// Roads are a regular grid; blocks hold pastel buildings, a park, a plaza, a dock
// yard on the west edge and a beach with water along the south edge. The module
// also answers the spatial questions the rest of the game asks: is this point on
// a road, inside a building, where is the nearest road, and where do cars spawn.

const CITY = {
  W: 2560,
  H: 1920,
  ROAD_HALF: 36,
  AVENUES: [160, 480, 800, 1120, 1440, 1760, 2080, 2400],
  STREETS: [160, 480, 800, 1120, 1440],
  BOARDWALK_Y: 1760,
  BEACH_Y: 1800,
  WATER_Y: 1884,
  DOCKS_X: 124,
};

const BUILDING_COLORS = ['#f2c14e', '#e07a5f', '#81b29a', '#e9c46a', '#f4a261', '#a8dadc', '#e5989b', '#ffcdb2', '#b7e4c7', '#ffdab9'];
const ROOF_COLORS = ['#c96f4a', '#8a6d4b', '#5d7a6a', '#7a6a8a', '#b08968'];

// One building: a rect with a fake height (its south and east walls are drawn
// darker), a roof colour and a few rooftop details.
function cityMakeBuilding(rng, x, y, w, h) {
  return {
    x, y, w, h,
    hgt: rngInt(rng, 10, 34),
    color: rngPick(rng, BUILDING_COLORS),
    roof: rngPick(rng, ROOF_COLORS),
    units: rngInt(rng, 1, 4),
    seed: rng(),
  };
}

function cityBuild(seed) {
  const rng = rngCreate(seed);
  const city = {
    seed,
    buildings: [],
    trees: [],
    lamps: [],
    containers: [],
    park: null,
    plaza: null,
    beach: { y: CITY.BEACH_Y },
    water: { y: CITY.WATER_Y },
    spawns: {},
  };
  // Blocks: the rectangles between neighbouring roads. Each block is a park, a
  // plaza, or 1-4 buildings with a little yard around them.
  const xs = [0].concat(CITY.AVENUES).concat([CITY.W]);
  const ys = [0].concat(CITY.STREETS).concat([CITY.BOARDWALK_Y]);
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const bx0 = xs[bi] + CITY.ROAD_HALF + 8, bx1 = xs[bi + 1] - CITY.ROAD_HALF - 8;
      const by0 = ys[bj] + CITY.ROAD_HALF + 8, by1 = ys[bj + 1] - CITY.ROAD_HALF - 8;
      if (bx1 - bx0 < 60 || by1 - by0 < 60) continue;
      // The dock yard: the whole west strip is containers, not buildings.
      if (bx0 < CITY.DOCKS_X + 40) {
        for (let i = 0; i < 5; i++) {
          city.containers.push({
            x: rngRange(rng, bx0, bx1 - 90), y: rngRange(rng, by0, by1 - 30),
            w: rngInt(rng, 60, 90), h: 26,
            color: rngPick(rng, ['#d64541', '#2e86ab', '#f2c14e', '#81b29a']),
          });
        }
        continue;
      }
      // The park: one block in the middle of the city, with a pond and trees.
      if (bi === 3 && bj === 2) {
        city.park = { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 };
        for (let i = 0; i < 26; i++) {
          city.trees.push({ x: rngRange(rng, bx0 + 14, bx1 - 14), y: rngRange(rng, by0 + 14, by1 - 14), r: rngInt(rng, 10, 16) });
        }
        continue;
      }
      // The plaza: one block with a fountain and benches, in the north-east.
      if (bi === 4 && bj === 1) {
        city.plaza = { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 };
        for (let i = 0; i < 8; i++) {
          city.trees.push({ x: rngRange(rng, bx0 + 16, bx1 - 16), y: rngRange(rng, by0 + 16, by1 - 16), r: rngInt(rng, 9, 13) });
        }
        continue;
      }
      // Ordinary block: split into a 2x2-ish grid of buildings so the city
      // reads dense, not as empty lawns with one hut.
      const n = rngInt(rng, 2, 4);
      const cols = n <= 2 ? n : 2;
      const rows = Math.ceil(n / cols);
      const cw = (bx1 - bx0) / cols, ch = (by1 - by0) / rows;
      for (let k = 0; k < n; k++) {
        const cx = k % cols, cy = Math.floor(k / cols);
        const cellX0 = bx0 + cx * cw, cellY0 = by0 + cy * ch;
        const bw = rngRange(rng, cw * 0.55, cw - 14);
        const bh = rngRange(rng, ch * 0.5, ch - 14);
        const px = cellX0 + rngRange(rng, 4, Math.max(5, cw - bw - 4));
        const py = cellY0 + rngRange(rng, 4, Math.max(5, ch - bh - 4));
        city.buildings.push(cityMakeBuilding(rng, px, py, bw, bh));
      }
      // A few street trees on the block's corners.
      for (let i = 0; i < 4; i++) {
        city.trees.push({ x: rngRange(rng, bx0, bx1), y: rngRange(rng, by0, by1), r: rngInt(rng, 8, 12) });
      }
    }
  }
  // Palm trees along the boardwalk and lamps on every intersection.
  for (let x = 200; x < CITY.W - 100; x += 130) {
    city.trees.push({ x: x + rngRange(rng, -20, 20), y: CITY.BOARDWALK_Y + 58, r: 13, palm: true });
  }
  for (const ax of CITY.AVENUES) for (const sy of CITY.STREETS) {
    city.lamps.push({ x: ax + 44, y: sy - 44 });
  }
  city.lamps.push({ x: 200, y: CITY.BOARDWALK_Y - 44 });
  // Named places the missions use.
  city.spawns = {
    playerStart: { x: 800, y: 1120 },
    docks: { x: 90, y: 800 },
    marina: { x: 2320, y: 1700 },
    plaza: { x: 1600, y: 640 },
    garage: { x: 2080, y: 1440 },
    hideout: { x: 480, y: 1440 },
    park: { x: 1280, y: 960 },
  };
  return city;
}

// ---- spatial queries ---------------------------------------------------------
// Which road (if any) is this point on? Returns {axis:'v'|'h', line} or null.
function cityRoadAt(x, y) {
  for (const ax of CITY.AVENUES) if (Math.abs(x - ax) <= CITY.ROAD_HALF) return { axis: 'v', line: ax };
  for (const sy of CITY.STREETS) if (Math.abs(y - sy) <= CITY.ROAD_HALF) return { axis: 'h', line: sy };
  if (Math.abs(y - CITY.BOARDWALK_Y) <= CITY.ROAD_HALF) return { axis: 'h', line: CITY.BOARDWALK_Y };
  return null;
}
function cityIsRoad(x, y) { return cityRoadAt(x, y) !== null; }
// The nearest road line to a point (used to put traffic back on a road).
function cityNearestRoad(x, y) {
  let best = null, bestD = Infinity;
  for (const ax of CITY.AVENUES) { const d = Math.abs(x - ax); if (d < bestD) { bestD = d; best = { axis: 'v', line: ax }; } }
  for (const sy of CITY.STREETS.concat([CITY.BOARDWALK_Y])) { const d = Math.abs(y - sy); if (d < bestD) { bestD = d; best = { axis: 'h', line: sy }; } }
  return best;
}
// Is this point (with radius r) inside a building, a container, the water or
// outside the world? Water and the map edge are solid for cars and people.
function cityBlockedAt(x, y, r) {
  if (x < r || y < r || x > CITY.W - r || y > CITY.H - r) return true;
  if (y + r > CITY.WATER_Y) return true;
  const bs = G.city.buildings;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (circleHitsRect(x, y, r, b.x, b.y, b.w, b.h)) return true;
  }
  const cs = G.city.containers;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (circleHitsRect(x, y, r, c.x, c.y, c.w, c.h)) return true;
  }
  return false;
}
// Push a circle out of every building/container it overlaps. Returns true if moved.
function cityResolveCircle(c, r) {
  let moved = false;
  const bs = G.city.buildings;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (circlePushRect(c, r, b.x, b.y, b.w, b.h) > 0) moved = true;
  }
  const cs = G.city.containers;
  for (let i = 0; i < cs.length; i++) {
    const cc = cs[i];
    if (circlePushRect(c, r, cc.x, cc.y, cc.w, cc.h) > 0) moved = true;
  }
  if (c.y + r > CITY.WATER_Y) { c.y = CITY.WATER_Y - r; moved = true; }
  if (c.x < r) { c.x = r; moved = true; }
  if (c.y < r) { c.y = r; moved = true; }
  if (c.x > CITY.W - r) { c.x = CITY.W - r; moved = true; }
  if (c.y > CITY.H - r) { c.y = CITY.H - r; moved = true; }
  return moved;
}
// A random point on a road (for traffic spawns), away from a given point.
function cityRandomRoadPoint(rng, awayX, awayY, minDist) {
  for (let tries = 0; tries < 40; tries++) {
    const v = rng() < 0.5;
    let x, y;
    if (v) { x = rngPick(rng, CITY.AVENUES); y = rngRange(rng, 80, CITY.H - 160); }
    else { y = rngPick(rng, CITY.STREETS.concat([CITY.BOARDWALK_Y])); x = rngRange(rng, 80, CITY.W - 80); }
    if (awayX === undefined || dist2(x, y, awayX, awayY) > minDist * minDist) return { x, y };
  }
  return { x: 480, y: 480 };
}
// A random sidewalk point near a road (for pedestrian spawns).
function cityRandomSidewalkPoint(rng) {
  const p = cityRandomRoadPoint(rng);
  const road = cityRoadAt(p.x, p.y);
  if (road && road.axis === 'v') return { x: p.x + (rng() < 0.5 ? -52 : 52), y: p.y };
  return { x: p.x, y: p.y + (rng() < 0.5 ? -52 : 52) };
}
