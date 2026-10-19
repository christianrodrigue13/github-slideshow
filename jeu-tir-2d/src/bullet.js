// =====================================================================
// bullet.js — Les balles et les petites particules (étincelles, sang
// stylisé). Les balles vont très vite : à chaque mise à jour on trace
// un segment entre l'ancienne et la nouvelle position, et on regarde
// ce qu'il touche en premier (mur ou personnage). Aucune traversée.
// =====================================================================

import { segmentVsRect } from './map.js';
import { CONFIG } from './config.js';

export class Bullet {
  constructor(x, y, angle, def, owner) {
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * def.bulletSpeed;
    this.vy = Math.sin(angle) * def.bulletSpeed;
    this.damage = def.damage;
    this.color = def.color;
    this.owner = owner;                          // qui a tiré
    this.life = def.range / def.bulletSpeed;     // durée de vie (portée)
    this.dead = false;
    this.trail = def.id === 'sniper' ? 0.035 : 0.014;  // longueur de la traînée
    this.width = def.id === 'sniper' ? 2.5 : 3;
    // Ancienne position et point de départ (pour dessiner une traînée)
    this.px = x; this.py = y;
    this.ox = x; this.oy = y;
  }

  // game doit fournir : map, fighters, canHit(tireur, cible),
  //                     onBulletHit(cible, balle), sparks(x, y, couleur, n)
  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;

    // Premier mur touché sur le trajet
    let bestT = game.map.raycast(this.x, this.y, nx, ny);
    let hitFighter = null;

    // Premier personnage touché (avant le mur)
    for (const f of game.fighters) {
      if (!f.alive || !game.canHit(this.owner, f)) continue;
      const t = segmentVsRect(this.x, this.y, nx, ny, f);
      if (t !== null && (bestT === null || t < bestT)) {
        bestT = t;
        hitFighter = f;
      }
    }

    this.px = this.x; this.py = this.y;
    if (bestT !== null) {
      // Point d'impact
      const ix = this.x + (nx - this.x) * bestT;
      const iy = this.y + (ny - this.y) * bestT;
      this.x = ix; this.y = iy;
      this.dead = true;
      if (hitFighter) game.onBulletHit(hitFighter, this);
      else game.sparks(ix, iy, '#c9d6ff', 4);
    } else {
      this.x = nx; this.y = ny;
    }
  }

  draw(ctx) {
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Petite traînée derrière la balle
    // (la traînée ne remonte jamais plus loin que le canon)
    const k = Math.min(this.trail, Math.hypot(this.x - this.ox, this.y - this.oy) /
                                   Math.hypot(this.vx, this.vy));
    ctx.moveTo(this.x - this.vx * k, this.y - this.vy * k);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
  }
}

// --- Grenade : projectile soumis à la gravité, qui rebondit sur les murs
// et explose au bout de quelques instants ou au contact d'un ennemi ---
export class Grenade {
  constructor(x, y, angle, def, owner) {
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * def.bulletSpeed + owner.vx * 0.5;
    this.vy = Math.sin(angle) * def.bulletSpeed + owner.vy * 0.3;
    this.def = def;
    this.owner = owner;
    this.fuse = def.fuse;
    this.size = 10;
    this.dead = false;
    this.spin = 0;
  }

  // game doit fournir en plus : explode(x, y, def, tireur)
  update(dt, game) {
    this.fuse -= dt;
    this.vy += CONFIG.grenadeGravity * dt;
    this.spin += this.vx * dt * 0.05;
    const half = this.size / 2;
    const box = () => ({ x: this.x - half, y: this.y - half, w: this.size, h: this.size });

    // Mouvement en deux petits pas pour ne jamais traverser un mur fin
    for (let step = 0; step < 2; step++) {
      this.x += this.vx * dt / 2;
      let s = game.map.overlap(box());
      if (s) {
        this.x = this.vx > 0 ? s.x - half - 0.1 : s.x + s.w + half + 0.1;
        this.vx *= -0.45;                       // rebond amorti
      }
      this.y += this.vy * dt / 2;
      s = game.map.overlap(box());
      if (s) {
        this.y = this.vy > 0 ? s.y - half - 0.1 : s.y + s.h + half + 0.1;
        this.vy *= -0.4;
        this.vx *= 0.75;                        // frottement au sol
      }
    }

    // Contact direct avec un ennemi → explosion immédiate
    for (const f of game.fighters) {
      if (!f.alive || !game.canHit(this.owner, f)) continue;
      if (this.x > f.x && this.x < f.x + f.w && this.y > f.y && this.y < f.y + f.h) {
        this.fuse = 0;
      }
    }

    if (this.y > game.map.killY) { this.dead = true; return; }
    if (this.fuse <= 0) {
      this.dead = true;
      game.explode(this.x, this.y, this.def, this.owner);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);
    ctx.fillStyle = '#4b6b4f';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.fillStyle = this.fuse < 0.4 && Math.floor(this.fuse * 20) % 2 === 0 ? '#ff4d4d' : this.def.color;
    ctx.fillRect(-2, -2, 4, 4);                 // voyant qui clignote avant d'exploser
    ctx.restore();
  }
}

// --- Particules : petits morceaux qui volent et disparaissent ---
// opts (facultatif) : speed, size, life, gravity, drag, grow, up
export class Particle {
  constructor(x, y, color, opts = {}) {
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
    ctx.globalAlpha = 1;
  }
}

// Fumée : grosse particule ronde, grise, qui monte doucement et grossit
export function smoke(x, y, size = 8) {
  return new Particle(x, y, '#9aa3b5', { speed: 50, size, life: 0.9, gravity: -60,
                                         drag: 2, grow: 14, up: 20, round: true });
}

// Onde de choc d'une explosion : un cercle lumineux qui grandit et s'efface
export class Blast {
  constructor(x, y, radius) {
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
