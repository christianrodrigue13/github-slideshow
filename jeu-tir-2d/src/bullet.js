// =====================================================================
// bullet.js — Les projectiles : balles, roquettes, grenades.
// Balles et roquettes vont vite : à chaque mise à jour on trace un
// segment entre l'ancienne et la nouvelle position, et on regarde ce
// qu'il touche en premier (mur ou personnage). Aucune traversée.
// =====================================================================

import { segmentVsRect } from './map.js';
import { CONFIG } from './config.js';

export class Bullet {
  constructor(x, y, angle, def, owner) {
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * def.bulletSpeed;
    this.vy = Math.sin(angle) * def.bulletSpeed;
    this.damage = def.damage;
    this.weaponId = def.id;                      // pour les statistiques et missions
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

// --- Roquette : file tout droit et explose au premier contact
// (mur ou ennemi), avec une traînée de fumée ---
export class Rocket {
  constructor(x, y, angle, def, owner) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.vx = Math.cos(angle) * def.bulletSpeed;
    this.vy = Math.sin(angle) * def.bulletSpeed;
    this.def = def;
    this.owner = owner;
    this.life = def.range / def.bulletSpeed;
    this.dead = false;
  }

  update(dt, game) {
    this.life -= dt;
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    let bestT = game.map.raycast(this.x, this.y, nx, ny);
    for (const f of game.fighters) {
      if (!f.alive || !game.canHit(this.owner, f)) continue;
      const t = segmentVsRect(this.x, this.y, nx, ny, f);
      if (t !== null && (bestT === null || t < bestT)) bestT = t;
    }
    if (bestT !== null || this.life <= 0 || ny > game.map.killY) {
      // point d'impact, légèrement en retrait du mur pour que le souffle passe
      const t = bestT === null ? 1 : Math.max(0, bestT - 0.05);
      this.x += (nx - this.x) * t;
      this.y += (ny - this.y) * t;
      this.dead = true;
      if (this.y <= game.map.killY) game.explode(this.x, this.y, this.def, this.owner);
      return;
    }
    this.x = nx; this.y = ny;
    if (Math.random() < 0.6) game.effects.smoke(this.x - this.vx * 0.02, this.y - this.vy * 0.02, 4);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = '#ffd43b';                    // flamme
    ctx.beginPath();
    ctx.moveTo(-8, -3); ctx.lineTo(-16 - Math.random() * 8, 0); ctx.lineTo(-8, 3);
    ctx.fill();
    ctx.fillStyle = '#dee2e6';                    // corps
    ctx.fillRect(-8, -3, 14, 6);
    ctx.fillStyle = this.def.color;               // ogive
    ctx.beginPath();
    ctx.moveTo(6, -3); ctx.lineTo(11, 0); ctx.lineTo(6, 3);
    ctx.fill();
    ctx.restore();
  }
}

// --- Grenade : projectile soumis à la gravité, qui rebondit sur les murs
// et explose au bout de quelques instants (def.fuse) ---
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

    // Option : explosion au contact d'un ennemi (sinon, seulement après le délai)
    if (this.def.contactFuse) {
      for (const f of game.fighters) {
        if (!f.alive || !game.canHit(this.owner, f)) continue;
        if (this.x > f.x && this.x < f.x + f.w && this.y > f.y && this.y < f.y + f.h) {
          this.fuse = 0;
        }
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
