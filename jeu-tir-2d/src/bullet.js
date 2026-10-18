// =====================================================================
// bullet.js — Les balles et les petites particules (étincelles, sang
// stylisé). Les balles vont très vite : à chaque mise à jour on trace
// un segment entre l'ancienne et la nouvelle position, et on regarde
// ce qu'il touche en premier (mur ou personnage). Aucune traversée.
// =====================================================================

import { segmentVsRect } from './map.js';

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
    // Ancienne position (pour dessiner une traînée)
    this.px = x; this.py = y;
  }

  // game doit fournir : map, fighters, onBulletHit(target, bullet), sparks(x, y, color)
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
      if (!f.alive || f === this.owner) continue;
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
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Petite traînée derrière la balle
    ctx.moveTo(this.x - this.vx * 0.012, this.y - this.vy * 0.012);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
  }
}

// --- Particules : petits carrés qui volent et disparaissent ---
export class Particle {
  constructor(x, y, color) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 260;
    this.x = x; this.y = y;
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s - 80;
    this.life = this.maxLife = 0.25 + Math.random() * 0.35;
    this.color = color;
    this.size = 2 + Math.random() * 3;
  }

  update(dt) {
    this.life -= dt;
    this.vy += 900 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}
