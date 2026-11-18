// audio.js: every sound is synthesised with WebAudio — no audio files, no network.
// Engine hum, sirens, gunshots, crashes, pickups and a small bassline loop.
// AudioContext is created on the first user gesture (start button / key press).

const AudioSys = {
  ctx: null,
  master: null,
  engineOsc: null,
  engineGain: null,
  sirenOsc: null,
  sirenGain: null,
  sirenHigh: false,
  sirenT: 0,
  musicT: 0,
  musicStep: 0,
  musicOn: false,
  muted: false,
};

function audioInit() {
  if (AudioSys.ctx) { if (AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    AudioSys.ctx = ctx;
    AudioSys.master = ctx.createGain();
    AudioSys.master.gain.value = 0.5;
    AudioSys.master.connect(ctx.destination);
    // Engine: a low sawtooth whose pitch follows speed.
    AudioSys.engineOsc = ctx.createOscillator();
    AudioSys.engineOsc.type = 'sawtooth';
    AudioSys.engineOsc.frequency.value = 55;
    AudioSys.engineGain = ctx.createGain();
    AudioSys.engineGain.gain.value = 0;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 420;
    AudioSys.engineOsc.connect(filt); filt.connect(AudioSys.engineGain); AudioSys.engineGain.connect(AudioSys.master);
    AudioSys.engineOsc.start();
    // Siren: a sine that alternates between two notes.
    AudioSys.sirenOsc = ctx.createOscillator();
    AudioSys.sirenOsc.type = 'sine';
    AudioSys.sirenOsc.frequency.value = 700;
    AudioSys.sirenGain = ctx.createGain();
    AudioSys.sirenGain.gain.value = 0;
    AudioSys.sirenOsc.connect(AudioSys.sirenGain); AudioSys.sirenGain.connect(AudioSys.master);
    AudioSys.sirenOsc.start();
  } catch (e) { /* no audio on this browser: the game stays silent */ }
}

function audioTone(freq, dur, type, vol, slideTo) {
  if (!AudioSys.ctx || AudioSys.muted) return;
  const ctx = AudioSys.ctx, t0 = ctx.currentTime;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol || 0.15, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g); g.connect(AudioSys.master);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function audioNoise(dur, vol, lowpass) {
  if (!AudioSys.ctx || AudioSys.muted) return;
  const ctx = AudioSys.ctx, t0 = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); g.gain.value = vol || 0.25;
  if (lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; src.connect(f); f.connect(g); }
  else src.connect(g);
  g.connect(AudioSys.master);
  src.start(t0);
}

function sfxClick() { audioTone(660, 0.06, 'square', 0.08); }
function sfxPickup() { audioTone(880, 0.09, 'sine', 0.16); setTimeout(() => audioTone(1320, 0.12, 'sine', 0.14), 70); }
function sfxShot() { audioNoise(0.12, 0.3, 3000); audioTone(180, 0.08, 'square', 0.12, 60); }
function sfxCrash() { audioNoise(0.25, 0.35, 900); }
function sfxHorn() { audioTone(370, 0.18, 'square', 0.1, 350); }
function sfxBusted() { audioTone(220, 0.5, 'sawtooth', 0.18, 110); }
function sfxWasted() { audioTone(330, 0.7, 'sawtooth', 0.16, 55); }
function sfxJingle() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => setTimeout(() => audioTone(n, 0.16, 'triangle', 0.16), i * 110));
}
function sfxReload() { audioTone(440, 0.05, 'square', 0.08); setTimeout(() => audioTone(550, 0.05, 'square', 0.08), 90); }

// Called every frame: engine pitch follows the player's car, siren wails with police.
function audioUpdate(dt) {
  if (!AudioSys.ctx) return;
  const p = G.player;
  const driving = p && p.car;
  const spd = driving ? Math.abs(p.car.spd) : 0;
  if (AudioSys.engineGain) {
    AudioSys.engineGain.gain.value = driving ? 0.05 + Math.min(0.06, spd / 9000) : 0.0;
    AudioSys.engineOsc.frequency.value = 55 + spd * 0.28;
  }
  const copsNear = G.cars.some(c => c.role === 'police' && dist2(c.x, c.y, p.x, p.y) < 700 * 700);
  if (AudioSys.sirenGain) {
    AudioSys.sirenGain.gain.value = copsNear && G.wanted > 0 ? 0.045 : 0;
    AudioSys.sirenT += dt;
    if (AudioSys.sirenT > 0.42) {
      AudioSys.sirenT = 0;
      AudioSys.sirenHigh = !AudioSys.sirenHigh;
      AudioSys.sirenOsc.frequency.value = AudioSys.sirenHigh ? 920 : 660;
    }
  }
  // A lazy bassline loop (A minor): kick + bass note each step, 8 steps a bar.
  if (AudioSys.musicOn) {
    AudioSys.musicT += dt;
    const stepDur = 60 / 112 / 2; // 112 BPM, eighth notes
    while (AudioSys.musicT >= stepDur) {
      AudioSys.musicT -= stepDur;
      const bass = [55, 0, 55, 65.41, 0, 55, 82.41, 73.42][AudioSys.musicStep % 8];
      if (bass) audioTone(bass, stepDur * 0.9, 'triangle', 0.10);
      if (AudioSys.musicStep % 2 === 0) audioTone(150, 0.05, 'sine', 0.10, 50);
      AudioSys.musicStep++;
    }
  }
}
function audioStartMusic() { AudioSys.musicOn = true; }
