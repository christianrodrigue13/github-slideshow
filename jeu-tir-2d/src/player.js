// =====================================================================
// player.js — Le personnage (utilisé par le joueur ET par les bots).
// Il reçoit une "commande" (voir input.js) et applique la physique :
// course, saut, jetpack, gravité, collisions avec la carte.
// =====================================================================

import { CONFIG, weaponDef } from './config.js';
import { Weapon } from './weapon.js';
import { Bullet, Rocket, Grenade } from './bullet.js';

// Projectile tiré selon le type d'arme
const PROJECTILE = { bullet: Bullet, rocket: Rocket, grenade: Grenade };

// Apparence de chaque arme : longueur, épaisseur, couleur de la crosse
const GUN_LOOK = {
  rifle:    { len: 27, thick: 5, stock: '#3d4356' },
  shotgun:  { len: 22, thick: 7, stock: '#8c5a2b' },
  sniper:   { len: 38, thick: 4, stock: '#2f3b52', scope: true },
  smg:      { len: 20, thick: 6, stock: '#5c940d' },
  rocket:   { len: 30, thick: 9, stock: '#c92a2a', tube: true },
  grenade:  { len: 10, thick: 0, stock: '#4b6b4f', ball: true },
};

let nextId = 1;

export class Fighter {
  constructor({ name, color, isBot = false, team = 0 }) {
    this.id = nextId++;
    this.name = name;
    this.color = color;
    this.isBot = isBot;
    this.team = team;            // équipe (utilisé en mode équipes)

    const F = CONFIG.fighter;
    this.w = F.width;
    this.h = F.height;
    this.x = 0; this.y = 0;      // coin haut-gauche
    this.vx = 0; this.vy = 0;

    this.health = F.maxHealth;
    this.shield = 0;             // points de bouclier (absorbent les dégâts en premier)
    this.alive = true;
    this.grounded = false;
    this.fuel = CONFIG.jetpack.maxFuel;
    this.regenTimer = 0;
    this.jetting = false;        // en train de voler (pour l'affichage/son)
    this.aimAngle = 0;
    this.facing = 1;             // 1 = droite, -1 = gauche
    this.walkPhase = 0;          // avancement de l'animation des jambes

    // Armes : [0] = principale, [1] = secondaire (remplaçable)
    this.weapons = [];
    this.resetWeapons();
    this.muzzleFlash = 0;        // durée restante de l'éclair au bout du canon

    // Partie
    this.kills = 0;
    this.deaths = 0;
    this.respawnTimer = 0;       // temps avant de réapparaître (si mort)
    this.protectTimer = 0;       // invincibilité après réapparition
    this.hitFlash = 0;           // clignotement blanc quand on est touché
    this.lastAttacker = null;    // dernier tireur (pour les chutes dans le vide)
    this.lastAttackTime = -999;
    this.lastShotTime = -999;    // moment du dernier tir (radar de la minicarte)
  }

  resetWeapons() {
    this.weapons = [new Weapon(weaponDef(CONFIG.loadout.primary)),
                    new Weapon(weaponDef(CONFIG.loadout.secondary))];
    this.weaponIndex = 0;
  }

  // Ramasser une arme : elle remplace l'arme secondaire et on la prend en main
  giveSecondary(id) {
    this.weapons[1] = new Weapon(weaponDef(id));
    this.weaponIndex = 1;
  }

  // Réapparition : tout est remis à neuf
  respawn(spawn) {
    this.placeAt(spawn.x, spawn.y);
    this.health = CONFIG.fighter.maxHealth;
    this.shield = 0;
    this.alive = true;
    this.fuel = CONFIG.jetpack.maxFuel;
    this.resetWeapons();
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
    if (this.grounded) this.walkPhase += this.vx * dt * 0.09;

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
      else if (result === 'empty') {
        // Plus de munitions : on passe à l'autre arme si elle en a encore
        const other = this.weapons[1 - this.weaponIndex];
        if (!other.empty) {
          this.weaponIndex = 1 - this.weaponIndex;
          game.onFighterEvent(this, 'switch');
        } else if (!this.emptyClick) {
          game.onFighterEvent(this, 'empty');
        }
        this.emptyClick = true;               // (un seul "clic" à vide par appui)
      }
    } else {
      this.emptyClick = false;
    }
  }

  // Fait partir un tir (un ou plusieurs plombs) + recul
  fire(game) {
    const def = this.weapon.def;
    for (let i = 0; i < def.pellets; i++) {
      const angle = this.aimAngle + (Math.random() - 0.5) * 2 * def.spread;
      const P = PROJECTILE[def.kind];
      game.bullets.push(new P(this.shoulderX, this.shoulderY, angle, def, this));
    }
    this.lastShotTime = game.time;
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
  draw(ctx, showName = true) {
    if (!this.alive) return;
    const x = this.x, y = this.y, w = this.w, h = this.h;
    const cx = this.cx;
    const dark = shade(this.color, -0.35);
    // Invincible : le personnage clignote
    if (this.protectTimer > 0 && Math.floor(this.protectTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
    const back = this.facing === 1 ? x - 6 : x + w - 2;

    // --- Jambes : se balancent en courant, pendent en vol ---
    const hipY = y + h - 14;
    let a1, a2;
    if (this.grounded) {
      const speed = Math.min(1, Math.abs(this.vx) / CONFIG.fighter.runSpeed);
      a1 = Math.sin(this.walkPhase) * 0.75 * speed;
      a2 = -a1;
    } else if (this.jetting) {
      a1 = -0.12 * this.facing; a2 = 0.12 * this.facing;
    } else {
      a1 = -0.45 * this.facing; a2 = 0.25 * this.facing;   // jambes repliées en l'air
    }
    ctx.strokeStyle = dark;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (const [hx, a] of [[cx - 4, a1], [cx + 4, a2]]) {
      ctx.beginPath();
      ctx.moveTo(hx, hipY);
      ctx.lineTo(hx + Math.sin(a) * 11, hipY + Math.cos(a) * 11);
      ctx.stroke();
    }

    // --- Flamme du jetpack ---
    if (this.jetting) {
      const len = 14 + Math.random() * 14;
      ctx.fillStyle = '#ff922b';
      ctx.beginPath();
      ctx.moveTo(back + 1, y + 32);
      ctx.lineTo(back + 8, y + 32);
      ctx.lineTo(back + 4.5, y + 32 + len);
      ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(back + 3, y + 32);
      ctx.lineTo(back + 6, y + 32);
      ctx.lineTo(back + 4.5, y + 32 + len * 0.55);
      ctx.fill();
    }

    // --- Jetpack (boîtier sur le dos) ---
    ctx.fillStyle = '#6c7489';
    roundRect(ctx, back, y + 15, 9, 18, 3);
    ctx.fillStyle = '#495063';
    ctx.fillRect(back + 1, y + 30, 7, 3);           // tuyère

    // --- Corps et tête (blancs un instant quand on est touché) ---
    const body = this.hitFlash > 0 ? '#ffffff' : this.color;
    ctx.fillStyle = body;
    roundRect(ctx, x + 2, y + 15, w - 4, h - 27, 6);
    ctx.beginPath();
    ctx.arc(cx, y + 8, 9, 0, Math.PI * 2);
    ctx.fill();
    // Ceinture
    ctx.fillStyle = dark;
    ctx.fillRect(x + 2, hipY - 3, w - 4, 3);
    // Visière (regarde dans la direction de visée)
    ctx.fillStyle = '#1b2440';
    roundRect(ctx, cx + (this.facing === 1 ? 0 : -9), y + 4, 9, 6, 2);
    ctx.fillStyle = 'rgba(160,220,255,0.6)';
    ctx.fillRect(cx + (this.facing === 1 ? 5 : -7), y + 5, 2, 2);   // reflet

    // --- Arme, orientée vers la visée, tenue par le bras ---
    const look = GUN_LOOK[this.weapon.def.id] || GUN_LOOK.rifle;
    const len = look.len;
    ctx.save();
    ctx.translate(this.shoulderX, this.shoulderY);
    ctx.rotate(this.aimAngle);
    if (look.ball) {                        // grenade tenue dans la main
      if (this.weapon.ammo > 0) {
        ctx.fillStyle = look.stock;
        ctx.beginPath();
        ctx.arc(13, 1, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ced4da';
        ctx.fillRect(11, -6, 4, 3);
      }
    } else {
      ctx.fillStyle = '#a3acbf';
      ctx.fillRect(0, -3, len, look.thick);
      ctx.fillStyle = look.stock;
      ctx.fillRect(2, -3, 9, look.thick);
    }
    if (look.tube) {                        // embout du lance-roquettes
      ctx.fillStyle = '#495057';
      ctx.fillRect(len - 5, -5, 6, look.thick + 4);
    }
    if (look.scope) {                       // lunette du fusil de précision
      ctx.fillStyle = '#1b2440';
      ctx.fillRect(12, -7, 12, 4);
    }
    // Bras
    ctx.strokeStyle = dark;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-2, 1);
    ctx.lineTo(12, 1);
    ctx.stroke();
    // Éclair au bout du canon (étoile à 4 branches)
    if (this.muzzleFlash > 0 && !look.ball) {
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.moveTo(len, -6); ctx.lineTo(len + 6, -1); ctx.lineTo(len + 16, 0);
      ctx.lineTo(len + 6, 1); ctx.lineTo(len, 6); ctx.lineTo(len + 3, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // --- Bouclier : bulle bleue autour du personnage ---
    if (this.shield > 0) {
      ctx.strokeStyle = `rgba(77,171,247,${0.25 + 0.5 * this.shield / CONFIG.pickups.shieldAmount})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, this.cy, w * 0.95, h * 0.68, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // --- Nom et petite barre de vie au-dessus des bots ---
    if (this.isBot && showName) {
      const ratio = this.health / CONFIG.fighter.maxHealth;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - 7, y - 14, w + 14, 5);
      ctx.fillStyle = ratio > 0.35 ? '#69db7c' : '#ff6b6b';
      ctx.fillRect(x - 7, y - 14, (w + 14) * ratio, 5);
      ctx.fillStyle = this.labelColor || this.color;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(this.name, x + w / 2, y - 17);
    }
  }
}

// Éclaircit (k > 0) ou assombrit (k < 0) une couleur "#rrggbb"
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r},${g},${b})`;
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
