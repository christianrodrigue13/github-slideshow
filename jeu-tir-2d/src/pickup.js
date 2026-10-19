// =====================================================================
// pickup.js — Objets à ramasser sur la carte : trousse de soin,
// bouclier, caisse d'arme. On les ramasse en passant dessus ; ils
// réapparaissent au même endroit après un délai (voir config.js).
// =====================================================================

import { CONFIG, weaponDef } from './config.js';
import { drawWeaponIcon } from './weaponart.js';

export class Pickup {
  // spot = { x, y, type } : x = centre, y = surface du sol sous l'objet
  constructor(spot) {
    this.type = spot.type;            // 'health' | 'shield' | 'ammo' | 'weapon'
    this.x = spot.x;
    this.y = spot.y - 22;             // l'objet flotte un peu au-dessus du sol
    this.size = 26;
    this.active = true;
    this.timer = 0;
    this.weaponId = null;
    this.bob = Math.random() * 6;     // décalage de l'animation de flottement
    if (this.type === 'weapon') this.rollWeapon();
  }

  // Tire au sort le contenu de la caisse
  rollWeapon() {
    const list = CONFIG.pickups.crateWeapons;
    this.weaponId = list[Math.floor(Math.random() * list.length)];
  }

  get respawnTime() {
    const P = CONFIG.pickups;
    if (this.type === 'health') return P.healthRespawn;
    if (this.type === 'shield') return P.shieldRespawn;
    if (this.type === 'ammo') return P.ammoRespawn;
    return P.weaponRespawn;
  }

  // Ce personnage en a-t-il besoin ? (on ne gaspille pas un objet inutile)
  usefulFor(f) {
    if (this.type === 'health') return f.health < CONFIG.fighter.maxHealth;
    if (this.type === 'shield') return f.shield < CONFIG.pickups.shieldAmount;
    if (this.type === 'ammo') return f.weapons.some((w) => w.reserve < (w.def.reserve ?? Infinity));
    return f.weapons[1].def.id !== this.weaponId;
  }

  // Applique l'effet. Renvoie true si l'objet a été pris.
  apply(f) {
    if (!this.active || !this.usefulFor(f)) return false;
    const P = CONFIG.pickups;
    if (this.type === 'health') {
      f.health = Math.min(CONFIG.fighter.maxHealth, f.health + P.healthAmount);
    } else if (this.type === 'shield') {
      f.shield = P.shieldAmount;
    } else if (this.type === 'ammo') {
      for (const w of f.weapons) w.restock();
    } else {
      f.giveSecondary(this.weaponId);
    }
    this.active = false;
    this.timer = this.respawnTime;
    return true;
  }

  update(dt, game) {
    this.bob += dt * 3;
    if (!this.active) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.active = true;
        if (this.type === 'weapon') this.rollWeapon();
      }
      return;
    }
    // Quelqu'un passe dessus ?
    const half = this.size / 2;
    for (const f of game.fighters) {
      if (!f.alive) continue;
      if (f.x < this.x + half && f.x + f.w > this.x - half &&
          f.y < this.y + half && f.y + f.h > this.y - half) {
        if (this.apply(f)) {
          game.onPickup(f, this);
          break;
        }
      }
    }
  }

  draw(ctx) {
    if (!this.active) return;
    const y = this.y + Math.sin(this.bob) * 3;
    const s = this.size, x0 = this.x - s / 2, y0 = y - s / 2;

    // Halo au sol
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 20, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.type === 'health') {
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(x0, y0, s, s);
      ctx.fillStyle = '#fa5252';                       // croix rouge
      ctx.fillRect(this.x - 3, y0 + 5, 6, s - 10);
      ctx.fillRect(x0 + 5, y - 3, s - 10, 6);
    } else if (this.type === 'shield') {
      ctx.fillStyle = '#339af0';                       // écusson bleu
      ctx.beginPath();
      ctx.moveTo(this.x, y0);
      ctx.lineTo(x0 + s, y0 + 6);
      ctx.lineTo(x0 + s - 3, y0 + s * 0.65);
      ctx.lineTo(this.x, y0 + s);
      ctx.lineTo(x0 + 3, y0 + s * 0.65);
      ctx.lineTo(x0, y0 + 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a5d8ff';
      ctx.fillRect(this.x - 2, y0 + 6, 4, s - 12);
    } else if (this.type === 'ammo') {
      ctx.fillStyle = '#5c7a3d';                       // caisse verte de munitions
      ctx.fillRect(x0 - 2, y0 + 4, s + 4, s - 4);
      ctx.fillStyle = '#e0b44c';                       // trois cartouches
      for (let i = 0; i < 3; i++) ctx.fillRect(x0 + 4 + i * 7, y0 - 2, 4, 12);
      ctx.fillStyle = '#2b3a1f';
      ctx.fillRect(x0 + 2, y0 + 14, s - 4, 3);
    } else {
      const def = weaponDef(this.weaponId);
      // caisse en bois ouverte, avec l'arme posée dessus
      ctx.fillStyle = '#8d6e4a';
      ctx.fillRect(x0 - 2, y0 + 10, s + 4, s - 10);
      ctx.strokeStyle = '#5c4630';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 - 1, y0 + 11, s + 2, s - 12);
      ctx.fillStyle = '#5c4630';
      ctx.fillRect(x0 + 3, y0 + 15, s - 6, 2);
      ctx.fillStyle = def.color;                       // petite bande de la couleur de l'arme
      ctx.fillRect(x0 - 2, y0 + s - 4, s + 4, 2);
      drawWeaponIcon(ctx, def.id, this.x, y0 + 6, def.id === 'grenade' ? 14 : 38, def.color);
    }
  }
}
