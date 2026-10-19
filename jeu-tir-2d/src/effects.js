// =====================================================================
// effects.js — Effets visuels : étincelles, fumée, éclats, ondes de
// choc. Pour rester fluide sur les petits téléphones, on ne crée PAS
// de nouvelles particules à chaque image : une réserve fixe est créée
// une fois au démarrage, puis réutilisée en boucle (la plus ancienne
// est recyclée quand la réserve est pleine).
// =====================================================================

import { CONFIG } from './config.js';

// Une particule : petit carré ou rond qui vole puis disparaît
class Particle {
  constructor() {
    this.life = 0;                       // 0 = libre (réutilisable)
  }

  // (Ré)initialise la particule. opts : speed, size, life, gravity, drag, grow, up, round
  init(x, y, color, opts) {
    const a = Math.random() * Math.PI * 2;
    const sp = (opts.speed ?? 260) * (0.25 + Math.random() * 0.75);
    this.x = x; this.y = y;
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp - (opts.up ?? 80);
    this.life = this.maxLife = (opts.life ?? 0.45) * (0.6 + Math.random() * 0.8);
    this.color = color;
    this.size = (opts.size ?? 4) * (0.5 + Math.random() * 0.8);
    this.gravity = opts.gravity ?? 900;
    this.drag = opts.drag ?? 0;          // freinage dans l'air (fumée)
    this.grow = opts.grow ?? 0;          // la fumée grossit en vieillissant
    this.round = !!opts.round;
    return this;
  }

  update(dt) {
    this.life -= dt;
    this.vy += this.gravity * dt;
    if (this.drag) {
      const k = Math.max(0, 1 - this.drag * dt);
      this.vx *= k; this.vy *= k;
    }
    this.size += this.grow * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife) * (this.round ? 0.5 : 1);
    ctx.fillStyle = this.color;
    if (this.round) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    }
  }
}

// Réglages de la fumée (réutilisés, pour ne pas recréer l'objet)
const SMOKE = { speed: 50, size: 8, life: 0.9, gravity: -60, drag: 2, grow: 14, up: 20, round: true };
const NO_OPTS = {};

// Onde de choc d'une explosion : un cercle lumineux qui grandit et s'efface
class Blast {
  constructor() {
    this.life = 0;
  }

  init(x, y, radius) {
    this.x = x; this.y = y;
    this.radius = radius;
    this.life = this.maxLife = 0.35;
  }

  update(dt) { this.life -= dt; }

  draw(ctx) {
    const t = 1 - this.life / this.maxLife;         // 0 → 1
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.fillStyle = '#fff3bf';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * (0.3 + 0.4 * t) * (1 - t), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = 6 * (1 - t) + 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * (0.3 + 0.8 * t), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export class Effects {
  constructor() {
    this.particles = [];
    for (let i = 0; i < CONFIG.effects.maxParticles; i++) this.particles.push(new Particle());
    this.cursor = 0;                     // prochaine case à essayer
    this.blasts = [];
    for (let i = 0; i < 8; i++) this.blasts.push(new Blast());
  }

  // Prend une particule libre (ou recycle la plus ancienne) et la lance
  spawn(x, y, color, opts = NO_OPTS) {
    const list = this.particles;
    let p = list[this.cursor];
    // On cherche une case libre parmi les quelques suivantes
    for (let tries = 0; tries < 8 && p.life > 0; tries++) {
      this.cursor = (this.cursor + 1) % list.length;
      p = list[this.cursor];
    }
    this.cursor = (this.cursor + 1) % list.length;
    return p.init(x, y, color, opts);
  }

  sparks(x, y, color, n, opts) {
    for (let i = 0; i < n; i++) this.spawn(x, y, color, opts);
  }

  smoke(x, y, size = 8, color = '#9aa3b5') {
    SMOKE.size = size;
    return this.spawn(x, y, color, SMOKE);
  }

  // Onde de choc d'une explosion
  blast(x, y, radius) {
    const b = this.blasts.find((e) => e.life <= 0) || this.blasts[0];
    b.init(x, y, radius);
  }

  update(dt) {
    for (const p of this.particles) if (p.life > 0) p.update(dt);
    for (const b of this.blasts) if (b.life > 0) b.update(dt);
  }

  draw(ctx) {
    for (const p of this.particles) if (p.life > 0) p.draw(ctx);
    ctx.globalAlpha = 1;
    for (const b of this.blasts) if (b.life > 0) b.draw(ctx);
  }

  // Tout effacer (nouvelle partie, retour au menu)
  clear() {
    for (const p of this.particles) p.life = 0;
    for (const b of this.blasts) b.life = 0;
  }

  // Nombre de particules visibles (tests)
  get activeCount() {
    let n = 0;
    for (const p of this.particles) if (p.life > 0) n++;
    return n;
  }
}
