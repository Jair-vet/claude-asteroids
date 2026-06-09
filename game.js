'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT    = hyperDrive > 0 ? 6.0  : 3.5;
    const THRUST = hyperDrive > 0 ? 620  : 260;
    const DRAG   = hyperDrive > 0 ? 0.994 : 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(triple = false) {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (triple) {
      return [
        new Bullet(ox, oy, this.angle - 0.25),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + 0.25),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (hyperDrive > 0) {
      ctx.shadowColor = 'rgba(200,80,255,0.9)';
      ctx.shadowBlur  = 18;
    }
    ctx.strokeStyle = hyperDrive > 0 ? 'rgba(220,120,255,1)' : '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── PowerUp ───────────────────────────────────────────────────────────────────
class PowerUp {
  constructor(x, y) {
    this.x      = x;
    this.y      = y;
    this.radius = 14;
    this.dead   = false;
    this.ttl    = 8;
    this.age    = 0;
  }

  update(dt) {
    this.ttl -= dt;
    this.age += dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const pulse = 0.7 + 0.3 * Math.sin(this.age * 5);
    const alpha = Math.min(1, this.ttl / 2) * pulse;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = `rgba(0,255,220,${alpha.toFixed(2)})`;
    ctx.shadowColor = 'rgba(0,255,220,0.8)';
    ctx.shadowBlur  = 10;
    ctx.lineWidth   = 1.8;
    // círculo exterior
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    // 3 líneas en abanico (símbolo triple disparo)
    const angles = [-0.4, 0, 0.4];
    for (const a of angles) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
      ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── HyperPowerUp ──────────────────────────────────────────────────────────────
class HyperPowerUp {
  constructor(x, y) {
    this.x      = x;
    this.y      = y;
    this.radius = 14;
    this.dead   = false;
    this.ttl    = 8;
    this.age    = 0;
  }

  update(dt) {
    this.ttl -= dt;
    this.age += dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const pulse = 0.7 + 0.3 * Math.sin(this.age * 6);
    const alpha = Math.min(1, this.ttl / 2) * pulse;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = `rgba(200,80,255,${alpha.toFixed(2)})`;
    ctx.shadowColor = 'rgba(200,80,255,0.9)';
    ctx.shadowBlur  = 12;
    ctx.lineWidth   = 1.8;
    // Círculo exterior
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    // Símbolo: flecha de velocidad (rayo/chevron)
    ctx.beginPath();
    ctx.moveTo(-6, -7);
    ctx.lineTo( 2, -1);
    ctx.lineTo(-6,  7);
    ctx.moveTo(-1, -7);
    ctx.lineTo( 7, -1);
    ctx.lineTo(-1,  7);
    ctx.stroke();
    ctx.restore();
  }
}

// ── BombaNova ─────────────────────────────────────────────────────────────────
class BombaNova {
  constructor() {
    let x, y;
    do {
      x = rand(80, W - 80);
      y = rand(80, H - 80);
    } while (Math.hypot(x - W / 2, y - H / 2) < 150);
    this.x      = x;
    this.y      = y;
    this.radius = 18;
    this.dead   = false;
    this.ttl    = 9;
    this.age    = 0;
  }

  update(dt) {
    this.ttl -= dt;
    this.age += dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const pulse = 0.65 + 0.35 * Math.sin(this.age * 7);
    const alpha = Math.min(1, this.ttl / 2) * pulse;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = `rgba(255,90,0,${alpha.toFixed(2)})`;
    ctx.fillStyle   = `rgba(255,90,0,${(alpha * 0.12).toFixed(2)})`;
    ctx.shadowColor = 'rgba(255,90,0,0.9)';
    ctx.shadowBlur  = 16;
    ctx.lineWidth   = 2;
    // Círculo exterior
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Rayos de explosión (8 puntas)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
      ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
      ctx.stroke();
    }
    // Círculo central relleno
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,200,0,${alpha.toFixed(2)})`;
    ctx.fill();
    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerups;
let score, lives, level;
let tripleShot;
let hyperDrive;
let bombaNova, bombNovaCount, bombNovaTimer;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;

const BOMB_MAX_PER_LEVEL = 3;
const BOMB_FIRST_DELAY   = 4;   // segundos hasta la primera aparición
const BOMB_NEXT_DELAY    = 5;   // segundos hasta la siguiente si la anterior expiró

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
  // Marcar dos asteroides distintos como portadores de power-ups
  const idx1 = randInt(0, asteroids.length - 1);
  let idx2;
  do { idx2 = randInt(0, asteroids.length - 1); } while (idx2 === idx1 || asteroids.length < 2);
  asteroids[idx1].dropsPowerUp = true;
  if (asteroids.length >= 2) asteroids[idx2].dropsHyper = true;
}

function resetBombaNova() {
  bombaNova      = null;
  bombNovaCount  = 0;
  bombNovaTimer  = BOMB_FIRST_DELAY;
}

function initGame() {
  ship      = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerups  = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  tripleShot = 0;
  hyperDrive = 0;
  resetBombaNova();
  state  = 'playing';
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerups  = [];
  hyperDrive = 0;
  resetBombaNova();
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot(tripleShot > 0));
  }

  if (tripleShot > 0) tripleShot -= dt;
  if (hyperDrive > 0) hyperDrive -= dt;

  // Spawn BombaNova (hasta 3 veces por nivel)
  if (!bombaNova && bombNovaCount < BOMB_MAX_PER_LEVEL) {
    bombNovaTimer -= dt;
    if (bombNovaTimer <= 0) {
      bombaNova     = new BombaNova();
      bombNovaCount++;
      bombNovaTimer = BOMB_NEXT_DELAY;
    }
  }
  if (bombaNova) {
    bombaNova.update(dt);
    if (bombaNova.dead) bombaNova = null;
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerups.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerups  = powerups.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        if (a.dropsPowerUp) powerups.push(new PowerUp(a.x, a.y));
        if (a.dropsHyper)   powerups.push(new HyperPowerUp(a.x, a.y));
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs BombaNova
  if (!ship.dead && bombaNova && !bombaNova.dead && dist(ship, bombaNova) < ship.radius + bombaNova.radius) {
    bombaNova.dead = true;
    bombaNova = null;
    for (const a of asteroids) {
      explode(a.x, a.y, a.size * 6);
      a.dead = true;
    }
    asteroids = [];
    score += 500;
  }

  // Nave vs power-up
  if (!ship.dead) {
    for (const p of powerups) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        explode(p.x, p.y, 10);
        if (p instanceof HyperPowerUp) {
          hyperDrive = 8;
        } else {
          tripleShot = 5;
        }
      }
    }
  }

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  if (tripleShot > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,255,220,0.9)';
    ctx.font = '13px monospace';
    ctx.fillText(`TRIPLE SHOT  ${Math.ceil(tripleShot)}s`, 14, 46);
  }

  if (hyperDrive > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200,80,255,0.9)';
    ctx.font = '13px monospace';
    const lineH = tripleShot > 0 ? 62 : 46;
    ctx.fillText(`HIPERPROPULSION  ${Math.ceil(hyperDrive)}s`, 14, lineH);
  }

  if (bombaNova && !bombaNova.dead) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,90,0,0.9)';
    ctx.font = '13px monospace';
    let lineB = 46;
    if (tripleShot > 0) lineB += 16;
    if (hyperDrive > 0) lineB += 16;
    ctx.fillText(`BOMBA NOVA  ${Math.ceil(bombaNova.ttl)}s`, 14, lineB);
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  powerups.forEach(p => p.draw());
  if (bombaNova) bombaNova.draw();
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
