// ── Constants ─────────────────────────────────────────────────────────────────
const TILE      = 40;          // tile size in pixels
const COLS      = 20;
const ROWS      = 14;
const HUD_H     = 46;          // height of HUD bar

const PLAYER_SPEED   = 3;
const WATER_CAPACITY = 10;
const CONTAM_PENALTY = 3;      // water lost on mud tile

// Colours (canvas)
const CLR = {
  ground:    '#c8a96e',
  path:      '#e8d5a3',
  water_src: '#1e90ff',
  mud:       '#6b4f2a',
  village:   '#e07b39',
  player:    '#ffd700',
  drop:      '#00bfff',
  mudPuddle: '#8b5e3c',
  tree:      '#2d6a2d',
};

// ── Level definitions ──────────────────────────────────────────────────────────
//  Each level: { time, villages, drops, muds }
const LEVELS = [
  { time: 60, dropCount: 8,  mudCount: 3,  villageCount: 3 },
  { time: 55, dropCount: 10, mudCount: 5,  villageCount: 4 },
  { time: 50, dropCount: 12, mudCount: 7,  villageCount: 5 },
  { time: 45, dropCount: 14, mudCount: 9,  villageCount: 5 },
  { time: 40, dropCount: 16, mudCount: 11, villageCount: 6 },
];

// ── State ──────────────────────────────────────────────────────────────────────
let state, level, timer, animFrame, lastTime;

// ── DOM refs ───────────────────────────────────────────────────────────────────
const screens      = {};
const $ = id => document.getElementById(id);

const canvas       = $('game-canvas');
const ctx          = canvas.getContext('2d');
const hudWaterBar  = $('water-bar');
const hudWaterTxt  = $('water-text');
const hudVillages  = $('villages-text');
const hudTimer     = $('timer-text');
const hudScore     = $('score-text');
const levelBanner  = $('level-banner');
const messageBox   = $('message-box');

// ── Utility ───────────────────────────────────────────────────────────────────
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function showMessage(text, duration = 2000) {
  messageBox.textContent = text;
  messageBox.classList.remove('hidden');
  clearTimeout(messageBox._t);
  messageBox._t = setTimeout(() => messageBox.classList.add('hidden'), duration);
}

function showBanner(text, duration = 1500) {
  levelBanner.textContent = text;
  levelBanner.classList.remove('hidden');
  clearTimeout(levelBanner._t);
  levelBanner._t = setTimeout(() => levelBanner.classList.add('hidden'), duration);
}

// ── Canvas resize ─────────────────────────────────────────────────────────────
function resizeCanvas() {
  const W = window.innerWidth;
  const H = window.innerHeight - HUD_H;
  canvas.width  = W;
  canvas.height = H;
  if (state) render();
}

// ── Level Initialisation ──────────────────────────────────────────────────────
function initLevel(lvlIndex) {
  level = lvlIndex;
  const cfg = LEVELS[Math.min(lvlIndex, LEVELS.length - 1)];

  const W = canvas.width;
  const H = canvas.height;

  // helper: random position in canvas avoiding edges
  const rndPos = () => ({
    x: rnd(TILE, W - TILE * 2),
    y: rnd(TILE, H - TILE * 2),
  });

  // water source — always top-left area
  const waterSource = { x: TILE, y: TILE, radius: TILE * 0.8 };

  // drops
  const drops = [];
  for (let i = 0; i < cfg.dropCount; i++) {
    const p = rndPos();
    drops.push({ x: p.x, y: p.y, collected: false });
  }

  // mud puddles
  const muds = [];
  for (let i = 0; i < cfg.mudCount; i++) {
    const p = rndPos();
    muds.push({ x: p.x, y: p.y, w: rnd(TILE, TILE * 2), h: rnd(TILE / 2, TILE) });
  }

  // villages
  const villages = [];
  for (let i = 0; i < cfg.villageCount; i++) {
    const p = rndPos();
    villages.push({ x: p.x, y: p.y, watered: false });
  }

  state = {
    player: { x: W / 2, y: H / 2, w: 24, h: 24, vx: 0, vy: 0 },
    water:  0,
    waterSource,
    drops,
    muds,
    villages,
    score:          0,
    villagesDone:   0,
    timeLeft:       cfg.time,
    cfg,
    running:        false,
    contaminateCooldown: 0,
  };

  updateHUD();
}

// ── HUD update ────────────────────────────────────────────────────────────────
function updateHUD() {
  const pct = (state.water / WATER_CAPACITY) * 100;
  hudWaterBar.style.width = pct + '%';
  hudWaterTxt.textContent = `${state.water} / ${WATER_CAPACITY}`;
  hudVillages.textContent = `${state.villagesDone} / ${state.villages.length}`;
  hudScore.textContent    = state.score;

  const t = Math.ceil(state.timeLeft);
  hudTimer.textContent    = t;
  hudTimer.classList.toggle('urgent', t <= 10);
}

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true; });
window.addEventListener('keyup',   e => { keys[e.key] = false; });

function handleInput() {
  const p = state.player;
  p.vx = 0;
  p.vy = 0;
  if (keys['ArrowLeft']  || keys['a'] || keys['A']) p.vx = -PLAYER_SPEED;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) p.vx =  PLAYER_SPEED;
  if (keys['ArrowUp']    || keys['w'] || keys['W']) p.vy = -PLAYER_SPEED;
  if (keys['ArrowDown']  || keys['s'] || keys['S']) p.vy =  PLAYER_SPEED;

  // diagonal normalise
  if (p.vx !== 0 && p.vy !== 0) {
    p.vx *= 0.707;
    p.vy *= 0.707;
  }
}

// ── Collision helpers ─────────────────────────────────────────────────────────
function circleHit(px, py, pw, cx, cy, r) {
  const dx = (px + pw / 2) - cx;
  const dy = (py + pw / 2) - cy;
  return Math.sqrt(dx * dx + dy * dy) < r + pw / 2;
}

function rectHit(px, py, pw, rx, ry, rw, rh) {
  return px < rx + rw && px + pw > rx && py < ry + rh && py + pw > ry;
}

// ── Game Update ───────────────────────────────────────────────────────────────
function update(dt) {
  if (!state.running) return;

  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    endGame(false);
    return;
  }

  handleInput();

  const p = state.player;
  p.x += p.vx * 60 * dt;   // frame-rate independent movement
  p.y += p.vy * 60 * dt;

  // clamp to canvas
  p.x = Math.max(0, Math.min(canvas.width  - p.w, p.x));
  p.y = Math.max(0, Math.min(canvas.height - p.h, p.y));

  // ── Water Source: refill ──
  if (circleHit(p.x, p.y, p.w, state.waterSource.x, state.waterSource.y, state.waterSource.radius)) {
    if (state.water < WATER_CAPACITY) {
      state.water = Math.min(WATER_CAPACITY, state.water + 0.12);
      if (Math.floor(state.water) === WATER_CAPACITY) showMessage('💧 Bucket full! Deliver to a village!');
    }
  }

  // ── Collect drops ──
  state.drops.forEach(d => {
    if (!d.collected && circleHit(p.x, p.y, p.w, d.x, d.y, 8)) {
      d.collected = true;
      state.water = Math.min(WATER_CAPACITY, state.water + 1);
      state.score += 10;
    }
  });

  // ── Mud contamination ──
  if (state.contaminateCooldown > 0) {
    state.contaminateCooldown -= dt;
  } else {
    state.muds.forEach(m => {
      if (rectHit(p.x, p.y, p.w, m.x, m.y, m.w, m.h)) {
        if (state.water > 0) {
          state.water = Math.max(0, state.water - CONTAM_PENALTY);
          state.contaminateCooldown = 1.5;
          showMessage('🤢 Muddy water! You lost some water.', 1500);
        }
      }
    });
  }

  // ── Village delivery ──
  state.villages.forEach(v => {
    if (!v.watered && circleHit(p.x, p.y, p.w, v.x, v.y, 22)) {
      if (state.water >= 3) {
        v.watered = true;
        state.water -= 3;
        state.villagesDone++;
        const bonus = Math.ceil(state.timeLeft) * 5;
        state.score += 100 + bonus;
        showMessage(`🏠 Village helped! +${100 + bonus} pts`, 2000);

        if (state.villagesDone === state.villages.length) {
          setTimeout(() => endGame(true), 600);
        }
      } else {
        showMessage('💧 Not enough water! Collect more first.', 1500);
      }
    }
  });

  if (state.contaminateCooldown < 0) state.contaminateCooldown = 0;

  updateHUD();
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const W = canvas.width;
  const H = canvas.height;

  // background
  ctx.fillStyle = CLR.ground;
  ctx.fillRect(0, 0, W, H);

  // subtle grid
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth   = 1;
  for (let x = 0; x < W; x += TILE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += TILE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // mud puddles
  state.muds.forEach(m => {
    ctx.fillStyle = CLR.mud;
    ctx.beginPath();
    ctx.ellipse(m.x + m.w / 2, m.y + m.h / 2, m.w / 2, m.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // label
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☠️', m.x + m.w / 2, m.y + m.h / 2 + 5);
  });

  // water source
  const ws = state.waterSource;
  const t  = Date.now() / 1000;
  // glow
  const grd = ctx.createRadialGradient(ws.x, ws.y, 0, ws.x, ws.y, ws.radius * 2);
  grd.addColorStop(0, 'rgba(30,144,255,0.4)');
  grd.addColorStop(1, 'rgba(30,144,255,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(ws.x, ws.y, ws.radius * 2, 0, Math.PI * 2);
  ctx.fill();
  // circle
  ctx.fillStyle = CLR.water_src;
  ctx.beginPath();
  ctx.arc(ws.x, ws.y, ws.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `${ws.radius * 1.2}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💧', ws.x, ws.y);

  // drops
  state.drops.forEach(d => {
    if (d.collected) return;
    const bounce = Math.sin(t * 3 + d.x) * 3;
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💧', d.x, d.y + bounce);
  });

  // villages
  state.villages.forEach(v => {
    const icon = v.watered ? '✅' : '🏠';
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, v.x, v.y);
    if (!v.watered) {
      // pulse ring
      const pulse = 0.5 + 0.5 * Math.sin(t * 4);
      ctx.strokeStyle = `rgba(255,160,0,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 28 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // player
  const p = state.player;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(p.x + p.w / 2, p.y + p.h + 2, p.w / 2, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // body
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('🚶', p.x + p.w / 2, p.y + p.h + 2);

  // water bucket indicator
  if (state.water > 0) {
    const bucketPct = state.water / WATER_CAPACITY;
    ctx.fillStyle = `rgba(0,191,255,${0.5 + bucketPct * 0.5})`;
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y - 10, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Game Loop ─────────────────────────────────────────────────────────────────
function loop(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  update(dt);
  render();

  animFrame = requestAnimationFrame(loop);
}

function startLoop() {
  if (animFrame) cancelAnimationFrame(animFrame);
  lastTime = null;
  animFrame = requestAnimationFrame(loop);
}

function stopLoop() {
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
}

// ── Game flow ─────────────────────────────────────────────────────────────────
function startGame(lvl = 0) {
  showScreen('game-screen');
  resizeCanvas();
  initLevel(lvl);
  levelBanner.classList.add('hidden');
  messageBox.classList.add('hidden');
  state.running = true;
  showBanner(`Level ${lvl + 1}`, 1500);
  startLoop();
}

function endGame(win) {
  state.running = false;
  stopLoop();

  if (win) {
    $('win-score').textContent = `⭐ Score: ${state.score}`;
    const nextLevelBtn = $('next-level-btn');
    const nextLvl = level + 1;
    if (nextLvl < LEVELS.length) {
      nextLevelBtn.textContent = 'Next Level';
      nextLevelBtn.onclick = () => startGame(nextLvl);
    } else {
      nextLevelBtn.textContent = 'Play Again';
      nextLevelBtn.onclick = () => startGame(0);
    }
    showScreen('win-screen');
  } else {
    $('gameover-score').textContent = `⭐ Score: ${state.score}`;
    showScreen('gameover-screen');
  }
}

// ── Button wiring ─────────────────────────────────────────────────────────────
$('start-btn').onclick         = () => startGame(0);
$('retry-btn').onclick         = () => startGame(level);
$('win-menu-btn').onclick      = () => showScreen('start-screen');
$('gameover-menu-btn').onclick = () => showScreen('start-screen');

// ── Window resize ─────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  resizeCanvas();
  if (state) {
    // Reposition entities to stay in bounds
    const clampToCanvas = (v, max) => Math.max(TILE, Math.min(v, max - TILE));
    state.drops.forEach(d => { d.x = clampToCanvas(d.x, canvas.width); d.y = clampToCanvas(d.y, canvas.height); });
    state.villages.forEach(v => { v.x = clampToCanvas(v.x, canvas.width); v.y = clampToCanvas(v.y, canvas.height); });
    state.muds.forEach(m => { m.x = clampToCanvas(m.x, canvas.width); m.y = clampToCanvas(m.y, canvas.height); });
  }
});

// ── Init ───────────────────────────────────────────────────────────────────────
resizeCanvas();
showScreen('start-screen');
