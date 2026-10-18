// =====================================================================
// player.js — Le personnage (utilisé par le joueur ET par les bots).
// Il reçoit une "commande" (voir input.js) et applique la physique :
// course, saut, jetpack, gravité, collisions avec la carte.
// =====================================================================

import { CONFIG } from './config.js';
import { Weapon } from './weapon.js';
import { Bullet } from './bullet.js';

let nextId = 1;

export class Fighter {
  constructor({ name, color, isBot = false }) {
    this.id = nextId++;
    this.name = name;
    this.color = color;
    this.isBot = isBot;

    const F = CONFIG.fighter;
    this.w = F.width;
    this.h = F.height;
    this.x = 0; this.y = 0;      // coin haut-gauche
    this.vx = 0; this.vy = 0;

    this.health = F.maxHealth;
    this.alive = true;
    this.grounded = false;
    this.fuel = CONFIG.jetpack.maxFuel;
    this.regenTimer = 0;
    this.jetting = false;        // en train de voler (pour l'affichage/son)
    this.aimAngle = 0;
    this.facing = 1;             // 1 = droite, -1 = gauche

    // Armes : une de chaque type défini dans config.js
    this.weapons = CONFIG.weapons.map((def) => new Weapon(def));
    this.weaponIndex = 0;
    this.muzzleFlash = 0;        // durée restante de l'éclair au bout du canon

    // Partie
    this.kills = 0;
    this.deaths = 0;
    this.respawnTimer = 0;       // temps avant de réapparaître (si mort)
    this.protectTimer = 0;       // invincibilité après réapparition
    this.hitFlash = 0;           // clignotement blanc quand on est touché
    this.lastAttacker = null;    // dernier tireur (pour les chutes dans le vide)
    this.lastAttackTime = -999;
  }

  // Réapparition : tout est remis à neuf
  respawn(spawn) {
    this.placeAt(spawn.x, spawn.y);
    this.health = CONFIG.fighter.maxHealth;
    this.alive = true;
    this.fuel = CONFIG.jetpack.maxFuel;
    for (const w of this.weapons) w.refill();
    this.weaponIndex = 0;
    this.protectTimer = CONFIG.rules.spawnProtection;
    this.hitFlash = 0;
    this.jetting = false;
    this.lastAttacker = null;
  }

  get weapon() { return this.weapons[this.weaponIndex]; }

  // Point d'où partent les balles (l'épaule)
  get shoulderX() { return this.cx; }
  get shoulderY() { return this.y + 22; }

  // Centre du personnage
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  // Place le personnage les pieds sur la surface (sx, sy)
  placeAt(sx, sy) {
    this.x = sx - this.w / 2;
    this.y = sy - this.h - 1;
    this.vx = 0; this.vy = 0;
  }

  // Une mise à jour (1/60 s) à partir d'une commande.
  // game fournit : map, bullets, et onFighterEvent(fighter, nom) pour les sons.
  update(cmd, dt, game) {
    if (!this.alive) return;
    const map = game.map;
    if (this.protectTimer > 0) this.protectTimer -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    const F = CONFIG.fighter;
    const J = CONFIG.jetpack;

    // --- Visée ---
    this.aimAngle = Math.atan2(cmd.aimY, cmd.aimX);
    this.facing = cmd.aimX >= 0 ? 1 : -1;

    // --- Déplacement horizontal ---
    const target = cmd.moveX * F.runSpeed;
    if (Math.abs(cmd.moveX) > 0.01) {
      const accel = this.grounded ? F.groundAccel : F.airAccel;
      this.vx = approach(this.vx, target, accel * dt);
    } else if (this.grounded) {
      this.vx = approach(this.vx, 0, F.friction * dt);
    } else {
      this.vx = approach(this.vx, 0, F.airAccel * 0.25 * dt); // léger frein en l'air
    }

    // --- Saut et jetpack ---
    // Au sol : "haut" = saut. En l'air : "haut" maintenu = jetpack.
    this.jetting = false;
    if (cmd.up) {
      if (this.grounded) {
        this.vy = -F.jumpSpeed;
        this.grounded = false;
      } else if (this.fuel > 0 && this.vy > -J.maxRiseSpeed) {
        // (pas de poussée tant qu'on monte déjà plus vite que la limite,
        //  par exemple juste après un saut : on n'use pas de carburant)
        this.jetting = true;
        this.vy = Math.max(-J.maxRiseSpeed, this.vy - J.thrust * dt);
        this.fuel = Math.max(0, this.fuel - J.burnPerSecond * dt);
      }
    }

    // --- Gravité ---
    this.vy = Math.min(CONFIG.maxFallSpeed, this.vy + CONFIG.gravity * dt);

    // --- Mouvement + collisions ---
    this.moveAndCollide(dt, map);

    // --- Recharge du carburant au sol ---
    if (this.grounded) {
      this.regenTimer += dt;
      if (this.regenTimer >= J.regenDelay) {
        this.fuel = Math.min(J.maxFuel, this.fuel + J.regenPerSecond * dt);
      }
    } else {
      this.regenTimer = 0;
    }

    // --- Armes ---
    this.updateWeapons(cmd, dt, game);
  }

  updateWeapons(cmd, dt, game) {
    if (this.muzzleFlash > 0) this.muzzleFlash -= dt;
    for (const w of this.weapons) w.update(dt);

    if (cmd.switchWeapon) {
      this.weapon.cancelReload();            // changer d'arme annule le rechargement
      this.weaponIndex = (this.weaponIndex + 1) % this.weapons.length;
      game.onFighterEvent(this, 'switch');
    }
    if (cmd.reload && this.weapon.startReload()) game.onFighterEvent(this, 'reload');

    if (cmd.fire) {
      const result = this.weapon.tryFire();
      if (result === 'fired') this.fire(game);
      else if (result === 'reload') game.onFighterEvent(this, 'reload');
    }
  }

  // Fait partir un tir (un ou plusieurs plombs) + recul
  fire(game) {
    const def = this.weapon.def;
    for (let i = 0; i < def.pellets; i++) {
      const angle = this.aimAngle + (Math.random() - 0.5) * 2 * def.spread;
      game.bullets.push(new Bullet(this.shoulderX, this.shoulderY, angle, def, this));
    }
    // Recul : petite poussée dans le sens opposé au tir
    this.vx -= Math.cos(this.aimAngle) * def.recoil;
    if (!this.grounded) this.vy -= Math.sin(this.aimAngle) * def.recoil * 0.6;
    this.muzzleFlash = 0.05;
    this.protectTimer = 0;                   // tirer annule l'invincibilité
    game.onFighterEvent(this, 'fire');
  }

  // On bouge d'abord en X, puis en Y, et on se recale contre les murs.
  // Les vitesses restent petites par pas (< 16 px), donc pas de traversée.
  moveAndCollide(dt, map) {
    // Axe X
    this.x += this.vx * dt;
    for (let i = 0; i < 4; i++) {
      const s = map.overlap(this);
      if (!s) break;
      if (this.vx > 0) this.x = s.x - this.w;
      else if (this.vx < 0) this.x = s.x + s.w;
      else this.x = (this.cx < s.x + s.w / 2) ? s.x - this.w : s.x + s.w;
      this.vx = 0;
    }

    // Axe Y
    this.y += this.vy * dt;
    this.grounded = false;
    for (let i = 0; i < 4; i++) {
      const s = map.overlap(this);
      if (!s) break;
      if (this.vy > 0) {
        this.y = s.y - this.h;
        this.grounded = true;
      } else {
        this.y = s.y + s.h;
      }
      this.vy = 0;
    }
  }

  // ----------------------------- Dessin -----------------------------
  draw(ctx) {
    if (!this.alive) return;
    const x = this.x, y = this.y, w = this.w, h = this.h;
    // Invincible : le personnage clignote
    if (this.protectTimer > 0 && Math.floor(this.protectTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
    const back = this.facing === 1 ? x - 7 : x + w - 1;

    // Flamme du jetpack
    if (this.jetting) {
      const len = 14 + Math.random() * 12;
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.moveTo(back + 1, y + h * 0.65);
      ctx.lineTo(back + 7, y + h * 0.65);
      ctx.lineTo(back + 4, y + h * 0.65 + len);
      ctx.fill();
    }

    // Jetpack (boîtier sur le dos)
    ctx.fillStyle = '#7d8597';
    ctx.fillRect(back, y + h * 0.25, 8, h * 0.42);

    // Corps (blanc pendant un instant quand on est touché)
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : this.color;
    roundRect(ctx, x, y + 12, w, h - 12, 6);
    // Tête
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 9, 10, 0, Math.PI * 2);
    ctx.fill();
    // Visière (regarde dans la direction de visée)
    ctx.fillStyle = '#1b2440';
    ctx.fillRect(x + w / 2 + (this.facing === 1 ? 0 : -9), y + 5, 9, 6);

    // Arme, orientée vers la visée
    const shotgun = this.weapon.def.pellets > 1;
    const len = shotgun ? 22 : 27;
    ctx.save();
    ctx.translate(this.shoulderX, this.shoulderY);
    ctx.rotate(this.aimAngle);
    ctx.fillStyle = '#a3acbf';
    ctx.fillRect(0, -3, len, shotgun ? 7 : 5);
    ctx.fillStyle = shotgun ? '#8c5a2b' : '#3d4356';
    ctx.fillRect(2, -3, 9, shotgun ? 7 : 5);
    if (this.muzzleFlash > 0) {
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(len + 5, 0, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Nom et petite barre de vie au-dessus des bots
    if (this.isBot) {
      const ratio = this.health / CONFIG.fighter.maxHealth;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - 7, y - 14, w + 14, 5);
      ctx.fillStyle = ratio > 0.35 ? '#69db7c' : '#ff6b6b';
      ctx.fillRect(x - 7, y - 14, (w + 14) * ratio, 5);
      ctx.fillStyle = this.color;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(this.name, x + w / 2, y - 17);
    }
  }
}

// Rapproche une valeur d'une cible sans la dépasser
export function approach(v, target, step) {
  if (v < target) return Math.min(v + step, target);
  return Math.max(v - step, target);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}
