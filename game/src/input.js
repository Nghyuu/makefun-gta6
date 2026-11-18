// input.js: keyboard and mouse state. Keys are tracked by code (WASD and arrows
// both drive), the mouse is tracked in world coordinates for aiming, and clicks
// are queued so the game can consume them once per frame.

const Input = {
  keys: {},
  pressed: {},
  mouseX: 0,
  mouseY: 0,
  mouseWorldX: 0,
  mouseWorldY: 0,
  mouseDown: false,
  clicked: false,
  anyKey: false,
};

function inputInit(canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    Input.keys[e.code] = true;
    Input.pressed[e.code] = true;
    Input.anyKey = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    audioInit();
  });
  window.addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => { Input.keys = {}; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    Input.mouseX = e.clientX - r.left;
    Input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { Input.mouseDown = true; Input.clicked = true; }
    audioInit();
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) Input.mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function inputEndFrame() {
  Input.pressed = {};
  Input.clicked = false;
  Input.anyKey = false;
}

function inputDown(code) { return !!Input.keys[code]; }
function inputPressed(code) { return !!Input.pressed[code]; }

// Scripted input for screenshot staging: when ShotDrive is set, the drive and
// walk vectors come from it instead of the keys (shots.js sets and clears it).
let ShotDrive = null;

// The shared movement vector from the keys, in screen terms: x is left/right
// (-1 left, 1 right), y is up/down (-1 up, 1 down). Drive and walk both read
// the same keys; they only differ in what y means (a car wants throttle, a
// walker wants a screen direction), so inputDrive flips y and inputWalk
// normalises.
function inputAxes() {
  let x = 0, y = 0;
  if (inputDown('KeyA') || inputDown('ArrowLeft')) x -= 1;
  if (inputDown('KeyD') || inputDown('ArrowRight')) x += 1;
  if (inputDown('KeyW') || inputDown('ArrowUp')) y -= 1;
  if (inputDown('KeyS') || inputDown('ArrowDown')) y += 1;
  return { x, y };
}
function inputDrive() {
  if (ShotDrive) return ShotDrive;
  const v = inputAxes();
  // Throttle is forward-positive: W (screen up) is full throttle.
  return { x: v.x, y: -v.y };
}
function inputWalk() {
  if (ShotDrive) return ShotDrive;
  const v = inputAxes();
  const len = Math.hypot(v.x, v.y);
  if (len > 0) { v.x /= len; v.y /= len; }
  return v;
}
