// =====================================================================
// netgame.js — Le jeu ENTRE AMIS : la partie tourne sur UN téléphone,
// l'« hôte ». Les autres, les « invités », envoient leurs commandes
// (bouger, viser, tirer…) et affichent ce que l'hôte leur renvoie.
//
//   invité  --- commande (30 fois/s) --->  hôte
//   invité  <-- instantané (30 fois/s) ---  hôte
//
// Un « instantané » contient la position et l'état de chaque personnage,
// les balles, les objets, le chrono, et les ÉVÉNEMENTS récents (tirs,
// touches, éliminations, explosions) pour que chaque invité joue les
// mêmes sons et effets chez lui. Le transport : net.js + serveur.py.
// =====================================================================

import { CONFIG, weaponDef } from './config.js';
import { game, presentDamage, presentKill, presentExplosion, presentPickup,
         presentFighterEvent, updateVisuals } from './match.js';
import { Weapon } from './weapon.js';
import { Bullet, Rocket, Grenade } from './bullet.js';
import { updateRustle } from './hiding.js';

const N = CONFIG.network;

// Arrondis (messages plus courts)
const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;
const byNid = (nid) => (nid < 0 ? null : game.fighters.find((f) => f.nid === nid) || null);
const KIND = { bullet: 0, rocket: 1, grenade: 2 };

// ---------------------------------------------------------------------
// Côté HÔTE
// ---------------------------------------------------------------------
export class HostSync {
  constructor(net) {
    this.net = net;
    this.events = [];
    this.tick = 0;
    this.nextBullet = 1;
    game.emit = (ev) => this.events.push(ev);       // match.js note chaque événement ici
  }

  stop() {
    game.emit = null;
  }

  // Message d'un invité
  onMessage(from, d) {
    if (!d || d.k !== 'c') return;
    const f = game.fighters.find((o) => o.peer === from && o.remoteCmd);
    if (!f) return;
    f.remoteSeen = performance.now();
    const c = f.remoteCmd;
    c.moveX = Math.max(-1, Math.min(1, +d.m || 0));
    c.up = !!d.u;
    c.aimX = +d.ax || 0;
    c.aimY = +d.ay || 0;
    if (!c.aimX && !c.aimY) c.aimX = 1;
    c.fire = !!d.f;
    if (d.s) c.switchWeapon = true;                 // (gardé jusqu'à la prochaine mise à jour)
    if (d.r) c.reload = true;
    if (d.g) c.throwGrenade = true;
  }

  // Avant chaque mise à jour : un invité muet depuis un moment (téléphone mis
  // en veille, Wi-Fi coupé…) s'arrête au lieu de continuer à courir tout seul
  beforeUpdate() {
    const now = performance.now();
    for (const f of game.fighters) {
      if (f.remoteCmd && f.remoteSeen && now - f.remoteSeen > N.silenceMs) {
        f.remoteCmd.moveX = 0;
        f.remoteCmd.up = false;
        f.remoteCmd.fire = false;
      }
    }
  }

  // Après chaque mise à jour de la partie : de temps en temps, un instantané
  afterUpdate() {
    if (++this.tick % N.sendEvery) return;
    this.net.toAll(this.snapshot());
    this.events = [];
  }

  snapshot() {
    const f = game.fighters.map((o) => {
      const w = o.weapon;
      const flags = (o.alive ? 1 : 0) | (o.grounded ? 2 : 0) | (o.jetting ? 4 : 0) |
                    (o.facing < 0 ? 8 : 0) | (o.hidden ? 16 : 0);
      return [o.nid, r1(o.x), r1(o.y), Math.round(o.vx), Math.round(o.vy), r3(o.aimAngle), flags,
              Math.round(o.health), Math.round(o.shield), Math.round(o.fuel), o.weaponIndex,
              o.weapons[0].def.id, o.weapons[1].def.id, w.ammo, Number.isFinite(w.reserve) ? w.reserve : null,
              w.reloading ? r3(w.reloadProgress) : -1, o.grenades, o.kills, o.deaths,
              r1(o.hillPoints || 0), r1(Math.max(0, o.respawnTimer)), r1(Math.max(0, o.protectTimer)),
              o.hideZone ? game.map.hides.indexOf(o.hideZone) : -1];
    });
    const b = game.bullets.map((x) => {
      if (!x.nid) x.nid = this.nextBullet++;
      const kind = x instanceof Grenade ? 2 : x instanceof Rocket ? 1 : 0;
      const wid = kind === 0 ? x.weaponId : x.def.id;
      return [x.nid, kind, r1(x.x), r1(x.y), Math.round(x.vx), Math.round(x.vy), wid,
              kind === 2 ? r1(x.fuse) : 0];
    });
    const p = game.pickups.map((pk) => (pk.active ? pk.weaponId || 1 : 0));
    const h = game.hill ? [game.hillOwner ? game.hillOwner.nid : -1, game.hillContested ? 1 : 0] : null;
    return { k: 's', t: r3(game.time), tl: r1(game.timeLeft), f, b, p, h, e: this.events };
  }
}

// ---------------------------------------------------------------------
// Côté INVITÉ
// ---------------------------------------------------------------------
export class GuestSync {
  constructor(net) {
    this.net = net;
    this.tick = 0;
    this.pending = { s: false, r: false, g: false };   // actions "une fois" pas encore envoyées
    this.interval = 1 / 30;     // temps moyen entre deux instantanés (mesuré)
    this.lastAt = 0;
    this.bullets = new Map();   // numéro → balle affichée
    this.got = false;           // au moins un instantané reçu
    // (prédiction : notre propre personnage bouge tout de suite, sans attendre l'hôte)
    this.stub = { map: null, bullets: [], time: 0, onFighterEvent() {} };
  }

  stop() {}

  // Notre commande : envoyée à l'hôte 30 fois par seconde
  sendCommand(cmd) {
    if (cmd.switchWeapon) this.pending.s = true;
    if (cmd.reload) this.pending.r = true;
    if (cmd.throwGrenade) this.pending.g = true;
    if (++this.tick % N.sendEvery) return;
    const P = this.pending;
    this.net.toHost({ k: 'c', m: r3(cmd.moveX), u: cmd.up ? 1 : 0, ax: r3(cmd.aimX), ay: r3(cmd.aimY),
                      f: cmd.fire ? 1 : 0, s: P.s ? 1 : 0, r: P.r ? 1 : 0, g: P.g ? 1 : 0 });
    P.s = P.r = P.g = false;
  }

  // Un instantané de l'hôte
  apply(s) {
    const now = performance.now() / 1000;
    if (this.lastAt) {
      const gap = Math.min(0.25, now - this.lastAt);
      this.interval += (gap - this.interval) * 0.15;
    }
    this.lastAt = now;
    this.got = true;
    game.time = s.t;
    game.timeLeft = s.tl;

    const me = game.player;
    for (const a of s.f) {
      const f = byNid(a[0]);
      if (!f) continue;
      const [, x, y, vx, vy, aim, fl, hp, sh, fuel, wi, w0, w1, ammo, res, rel, gr, k, d, hill, rt, pt, hz] = a;
      const wasAlive = f.alive;
      f.alive = !!(fl & 1);
      f.health = hp; f.shield = sh; f.fuel = fuel;
      f.grenades = gr; f.kills = k; f.deaths = d; f.hillPoints = hill;
      f.respawnTimer = rt; f.protectTimer = pt;
      f.hidden = !!(fl & 16);
      f.hideZone = hz >= 0 ? game.map.hides[hz] || null : null;
      // Armes (on recrée l'arme seulement si elle a changé)
      if (f.weapons[0].def.id !== w0) f.weapons[0] = new Weapon(weaponDef(w0));
      if (f.weapons[1].def.id !== w1) f.weapons[1] = new Weapon(weaponDef(w1));
      f.weaponIndex = wi;
      const w = f.weapon;
      w.ammo = ammo;
      w.reserve = res === null ? Infinity : res;
      w.reloadLeft = rel >= 0 ? (1 - rel) * w.def.reloadTime : 0;

      if (f === me) {
        // Notre personnage : on garde notre prédiction, en la recalant doucement
        // sur la position de l'hôte (un peu projetée vers l'avant : elle date)
        const ex = x + vx * this.interval, ey = y + vy * this.interval;
        f.netX = x; f.netY = y;                     // (tests)
        if (!wasAlive || !f.alive || Math.hypot(ex - f.x, ey - f.y) > N.snapDistance) {
          f.x = x; f.y = y; f.vx = vx; f.vy = vy;
          f.corrX = f.corrY = 0;
        } else {
          f.corrX = ex - f.x;
          f.corrY = ey - f.y;
          f.vx += (vx - f.vx) * 0.5;                 // (reçoit les poussées des explosions)
          f.vy += (vy - f.vy) * 0.5;
        }
        if (!wasAlive && f.alive) game.sound.play('spawn');
      } else {
        // Les autres : on glisse de la position affichée vers la nouvelle
        f.grounded = !!(fl & 2);
        f.jetting = !!(fl & 4);
        f.facing = fl & 8 ? -1 : 1;
        f.aimAngle = aim;
        f.vx = vx; f.vy = vy;
        if (!wasAlive || Math.hypot(x - f.x, y - f.y) > N.snapDistance) { f.x = x; f.y = y; }
        f.fromX = f.x; f.fromY = f.y;
        f.toX = x; f.toY = y;
        f.lerpT = 0;
      }
    }

    // Balles : on garde les mêmes objets d'un instantané à l'autre (traînées fluides)
    const seen = new Set();
    for (const [id, kind, x, y, vx, vy, wid, extra] of s.b) {
      let o = this.bullets.get(id);
      if (!o) {
        const def = weaponDef(wid);
        const ang = Math.atan2(vy, vx);
        if (kind === 2) o = new Grenade(x, y, ang, def, { vx: 0, vy: 0 });
        else if (kind === 1) o = new Rocket(x, y, ang, def, null);
        else o = new Bullet(x, y, ang, def, null);
        this.bullets.set(id, o);
      }
      o.x = x; o.y = y; o.vx = vx; o.vy = vy;
      if (kind === 2) o.fuse = extra;
      seen.add(id);
    }
    for (const id of this.bullets.keys()) if (!seen.has(id)) this.bullets.delete(id);
    game.bullets = [...this.bullets.values()];

    // Objets à ramasser
    s.p.forEach((v, i) => {
      const pk = game.pickups[i];
      if (!pk) return;
      pk.active = v !== 0;
      if (typeof v === 'string') pk.weaponId = v;
    });
    if (s.h) {
      game.hillOwner = byNid(s.h[0]);
      game.hillContested = !!s.h[1];
    }

    // Événements : mêmes sons et effets que chez l'hôte
    for (const ev of s.e) this.event(ev);
  }

  event(ev) {
    const [type] = ev;
    if (type === 'dmg') {
      const t = byNid(ev[1]);
      if (t) presentDamage(t, byNid(ev[2]), ev[3], ev[4], !!ev[5]);
    } else if (type === 'kill') {
      const v = byNid(ev[1]);
      if (v) presentKill(v, byNid(ev[2]), ev[3]);
    } else if (type === 'boom') {
      presentExplosion(ev[1], ev[2], ev[3]);
    } else if (type === 'sp') {
      game.effects.sparks(ev[1], ev[2], ev[3], ev[4]);
    } else if (type === 'pick') {
      const f = byNid(ev[1]);
      if (f) presentPickup(f);
    } else if (type === 'ev') {
      const f = byNid(ev[1]);
      if (!f) return;
      if (ev[2] === 'fire') f.muzzleFlash = 0.05;
      if (ev[2] === 'throw') f.throwAnim = 0.25;
      presentFighterEvent(f, ev[2]);
    }
  }

  // Chaque image (1/60 s) chez l'invité
  update(dt, cmd) {
    this.sendCommand(cmd);
    game.time += dt;
    game.timeLeft = Math.max(0, game.timeLeft - dt);
    const me = game.player;
    for (const f of game.fighters) {
      if (f === me) continue;                       // (le nôtre : voir plus bas)
      if (f.hitFlash > 0) f.hitFlash -= dt;
      if (f.muzzleFlash > 0) f.muzzleFlash -= dt;
      if (f.throwAnim > 0) f.throwAnim -= dt;
      if (!f.alive) continue;
      // glissement entre deux instantanés, puis on prolonge un peu avec la vitesse
      f.lerpT = (f.lerpT || 0) + dt / this.interval;
      if (f.toX !== undefined) {
        const t = Math.min(1, f.lerpT);
        const extra = Math.min(0.5, Math.max(0, f.lerpT - 1)) * this.interval;
        f.x = f.fromX + (f.toX - f.fromX) * t + f.vx * extra;
        f.y = f.fromY + (f.toY - f.fromY) * t + f.vy * extra;
      }
      if (f.grounded) f.walkPhase += f.vx * dt * 0.09;
    }
    // Notre personnage : physique jouée tout de suite (sans tirer : c'est l'hôte qui tire)
    if (!me.alive && me.hitFlash > 0) me.hitFlash -= dt;
    if (me.alive && this.got) {
      const stub = this.stub;
      stub.map = game.map;
      stub.time = game.time;
      const pc = PRED_CMD;
      pc.moveX = cmd.moveX; pc.up = cmd.up; pc.aimX = cmd.aimX; pc.aimY = cmd.aimY;
      me.update(pc, dt, stub);
      // recalage doux vers la position de l'hôte
      const k = Math.min(1, dt * N.correction);
      if (me.corrX) { me.x += me.corrX * k; me.corrX -= me.corrX * k; }
      if (me.corrY) { me.y += me.corrY * k; me.corrY -= me.corrY * k; }
    }
    // Balles : elles avancent seules entre deux instantanés
    for (const b of game.bullets) {
      if (b instanceof Grenade) {
        b.vy += CONFIG.grenadeGravity * dt;
        b.spin += b.vx * dt * 0.05;
        b.fuse -= dt;
      } else if (b instanceof Rocket && Math.random() < 0.6) {
        game.effects.smoke(b.x - b.vx * 0.02, b.y - b.vy * 0.02, 4);
      }
      if (b.px !== undefined) { b.px = b.x; b.py = b.y; }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    for (const pk of game.pickups) pk.bob += dt * 3;
    game.effects.update(dt);
    updateRustle(game, dt);
    updateVisuals(dt);
  }
}

// Commande utilisée pour la prédiction (jamais de tir ni d'action)
const PRED_CMD = { moveX: 0, up: false, aimX: 1, aimY: 0, fire: false,
                   switchWeapon: false, reload: false, throwGrenade: false };
