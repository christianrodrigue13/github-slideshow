// =====================================================================
// match.js — Les règles d'une partie : création des personnages,
// dégâts, explosions, éliminations, réapparitions, chrono, scores.
// L'objet "game" est l'état partagé, transmis aux personnages, aux
// balles et aux bots. main.js s'occupe de l'affichage et des menus.
// =====================================================================

import { CONFIG } from './config.js';
import { GameMap, MAPS } from './map.js';
import { Fighter } from './player.js';
import { lookFromCosmetics } from './character.js';
import { BotBrain } from './bot.js';
import { Pickup } from './pickup.js';
import { Effects } from './effects.js';
import { vibrate } from './audio.js';
import { shakeFactor } from './options.js';
import { updateHiding, canSee } from './hiding.js';

export const game = {
  map: new GameMap(MAPS[0]),
  settings: null,       // réglages de la partie (carte, mode, difficulté, bots)
  options: null,        // options du joueur (vibrations, tremblement…)
  sound: null,          // le module de son (fourni par main.js)
  mode: 'ffa',          // 'ffa' (chacun pour soi) | 'teams' | 'hill' (roi de la colline)
  teams: false,         // vrai en mode équipes
  hill: null,           // zone de la colline {x, y, w, h} (mode 'hill')
  hillOwner: null,      // qui marque des points dans la zone en ce moment
  hillContested: false, // plusieurs personnages dans la zone
  stats: null,          // statistiques du joueur pendant la partie (missions, XP)
  fighters: [],
  bots: [],             // { fighter, brain }
  player: null,
  bullets: [],          // balles, grenades, roquettes
  effects: new Effects(),
  pickups: [],
  shake: 0,             // intensité du tremblement d'écran
  floaters: [],         // chiffres de dégâts qui flottent
  hitMarks: [],         // marqueurs de touche du joueur { x, y, life, kill }
  slowmo: 0,            // ralenti restant (secondes réelles)
  hurtMarks: [],        // directions d'où viennent les tirs reçus par le joueur
  banner: null,         // bandeau "Élimination !" { text, time }
  feed: [],             // fil des éliminations
  time: 0,
  timeLeft: CONFIG.rules.matchDuration,
  // Jeu entre amis (voir netgame.js) : null en solo, 'host' sur le téléphone qui
  // fait tourner la partie, 'guest' sur les téléphones des invités
  net: null,
  emit: null,           // (hôte) fonction qui note chaque événement pour les invités

  // Un tir de "tireur" peut-il toucher "cible" ? (jamais soi-même)
  // (en équipes : jamais un coéquipier, les balles le traversent)
  canHit(shooter, target) {
    if (shooter === target) return false;
    return !game.teams || shooter.team !== target.team;
  },

  // Une balle touche quelqu'un
  onBulletHit(target, bullet) {
    game.sparks(bullet.x, bullet.y, target.color, 6);
    game.damage(target, bullet.damage, bullet.owner, bullet.vx * 0.02, 0, bullet.weaponId);
  },

  // Inflige des dégâts (le bouclier encaisse en premier) + petite poussée.
  // weaponId : l'arme utilisée (statistiques, missions)
  damage(target, amount, attacker, pushX, pushY, weaponId = null) {
    if (!target.alive || target.protectTimer > 0) return;  // invincible après réapparition
    if (attacker && attacker.isBot) amount *= CONFIG.difficulties[game.settings.difficulty].damage;
    const total = amount;
    let absorbedTotal = 0;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, amount);
      target.shield -= absorbed;
      amount -= absorbed;
      absorbedTotal = absorbed;
    }
    target.health -= amount;
    target.vx += pushX;
    target.vy += pushY;
    if (attacker && attacker !== target) {
      target.lastAttacker = attacker;
      target.lastAttackTime = game.time;
      target.lastHitWeapon = weaponId;
    }
    const killed = target.health <= 0;
    presentDamage(target, attacker, total, absorbedTotal, killed);
    emit(['dmg', target.nid, attacker ? attacker.nid : -1, Math.round(total), Math.round(absorbedTotal), killed ? 1 : 0]);
    if (killed) killFighter(target, attacker);
  },

  // Explosion : dégâts qui diminuent avec la distance, bloqués par les
  // murs, et souffle qui projette les personnages
  explode(x, y, def, owner) {
    const R = def.blastRadius;
    for (const f of game.fighters) {
      if (!f.alive) continue;
      if (f !== owner && !game.canHit(owner, f)) continue;     // pas les coéquipiers
      const dx = f.cx - x, dy = f.cy - y;
      const d = Math.hypot(dx, dy);
      if (d > R + f.w / 2) continue;
      if (!game.map.lineOfSight(x, y - 4, f.cx, f.cy)) continue;
      const k = Math.max(0.2, 1 - d / R);
      const self = f === owner ? 0.5 : 1;       // on se blesse moins soi-même
      const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : -1;
      const push = (def.knockback ?? 650) * k;
      game.damage(f, def.damage * k * self, owner, nx * push, ny * push - 150 * k, def.id);
    }
    presentExplosion(x, y, R);
    emit(['boom', Math.round(x), Math.round(y), R]);
  },

  // Quelqu'un ramasse un objet
  onPickup(f, pickup) {
    presentPickup(f);
    emit(['pick', f.nid]);
  },

  // Petites étincelles (opts : voir effects.js)
  sparks(x, y, color, n, opts) {
    game.effects.sparks(x, y, color, n, opts);
    if (!opts) emit(['sp', Math.round(x), Math.round(y), color, n]);
  },

  // Tremblement d'écran (multiplié par l'option choisie : 0 = désactivé)
  addShake(amount) {
    const k = game.options ? shakeFactor(game.options) : 1;
    game.shake = Math.min(CONFIG.feel.maxShake, game.shake + amount * k);
  },

  // Vibration du téléphone (si l'option est activée)
  vibrate(ms) {
    if (!game.options || game.options.vibration) vibrate(ms);
  },

  // Événements des personnages → sons, vibrations, douilles
  onFighterEvent(f, name) {
    presentFighterEvent(f, name);
    emit(['ev', f.nid, name]);
  },
};

// ---------------------------------------------------------------------
// "Présentation" : tout ce qui se voit ou s'entend (sons, effets, chiffres,
// bandeaux, statistiques du joueur). Séparé des règles pour que les invités
// d'une partie entre amis puissent rejouer les mêmes effets chez eux
// (chacun avec SON personnage : game.player). Voir netgame.js.
// ---------------------------------------------------------------------

// Note un événement pour les invités (seulement sur le téléphone hôte)
function emit(ev) {
  if (game.emit) game.emit(ev);
}

// Sons, vibrations, douilles d'un personnage ('fire', 'throw', 'reload'…)
export function presentFighterEvent(f, name) {
    const vol = hearingVolume(f);
    if (name === 'fire') {
      const def = f.weapon.def;
      game.sound.play(def.id, vol);              // un son par arme
      if (f === game.player) {
        game.vibrate(CONFIG.feedback.vibrateOnShoot);
        game.addShake(def.recoil * CONFIG.feel.shakeShootFactor);   // les grosses armes secouent plus
      }
      // Douille éjectée (armes à balles)
      if (def.kind === 'bullet' && vol > 0) {
        const pa = game.effects.spawn(f.shoulderX, f.shoulderY, '#e0b44c', CASING);
        pa.vx = -Math.cos(f.aimAngle) * 80 + (Math.random() - 0.5) * 40;
        pa.vy = -160 - Math.random() * 60;
      }
    } else if (name === 'throw') {
      game.sound.play('grenade', vol);            // le "fouit" du lancer
    } else if (f === game.player) {
      game.sound.play(name);                     // 'reload', 'switch', 'empty'
    }
}

// Quelqu'un est touché : flash blanc, chiffres, marqueurs, sons
export function presentDamage(target, attacker, total, absorbed, killed) {
  target.hitFlash = 0.12;
  if (attacker === game.player && target !== game.player) addFloater(target, total, absorbed);
  if (target === game.player && attacker && attacker !== target) {
    game.hurtMarks.push({ angle: Math.atan2(attacker.cy - target.cy, attacker.cx - target.cx),
                          time: game.time });
    if (game.hurtMarks.length > 6) game.hurtMarks.shift();
  }
  if (attacker === game.player && target !== game.player) {
    game.hitMarks.push({ x: target.cx, y: target.cy, life: CONFIG.feel.hitMarkerTime, kill: killed });
    if (game.hitMarks.length > 6) game.hitMarks.shift();
  }
  if (target === game.player) {
    game.sound.play('hurt');
    game.vibrate(CONFIG.feedback.vibrateOnHit);
    game.addShake(CONFIG.feel.shakeHurt);
  } else if (attacker === game.player) {
    game.sound.play('hitmark');
  }
}

// Explosion : onde de choc, flammes, éclats, fumée, tremblement d'écran
export function presentExplosion(x, y, R) {
  const fx = game.effects;
  fx.blast(x, y, R);
  fx.sparks(x, y, '#ffd43b', 16, BLAST_FIRE);
  fx.sparks(x, y, '#ff6b2b', 16, BLAST_FLAME);
  fx.sparks(x, y, '#495057', 8, BLAST_DEBRIS);
  for (let i = 0; i < 8; i++) fx.smoke(x, y, 12);
  const vol = hearingVolumeAt(x, y);
  game.sound.play('explosion', vol);
  game.addShake(CONFIG.feel.shakeExplosion * vol);
}

// Objet ramassé
export function presentPickup(f) {
  if (f === game.player) {
    game.sound.play('pickup');
    game.stats.pickups++;
  }
}

// Réglages d'effets réutilisés (évite de recréer ces objets à chaque fois)
const BLAST_FIRE = { speed: 420, size: 6 };
const BLAST_FLAME = { speed: 320, size: 7 };
const BLAST_DEBRIS = { speed: 500, size: 4 };
const CASING = { speed: 120, size: 3, life: 0.5 };
const DEATH_BITS = { speed: 380, size: 7, life: 0.8 };
const DEATH_FLASH = { speed: 250, size: 4 };
const TRAIL_SPARK = { speed: 90, size: 3, life: 0.4, gravity: 300, up: -60 };

// Plus un personnage est loin du joueur, moins on l'entend
function hearingVolume(f) {
  return hearingVolumeAt(f.cx, f.cy);
}
function hearingVolumeAt(x, y) {
  const p = game.player;
  const d = Math.hypot(x - p.cx, y - p.cy);
  return Math.max(0, 1 - d / 1100);
}

// Classement : plus d'éliminations d'abord, puis moins de morts
// (Roi de la colline : d'abord les points de colline)
export function ranking(fighters) {
  const hill = game.mode === 'hill';
  return [...fighters].sort((a, b) =>
    (hill ? b.hillPoints - a.hillPoints : 0) || b.kills - a.kills || a.deaths - b.deaths);
}

// Le joueur a-t-il gagné ? (équipes : son équipe ; sinon : premier, égalité comprise)
export function playerWon() {
  if (!game.player) return false;
  if (game.teams) {
    const [s0, s1] = teamScores(game.fighters);
    return s0 > s1;
  }
  const best = ranking(game.fighters)[0];
  if (best === game.player) return true;
  return game.mode === 'hill' ? best.hillPoints === game.player.hillPoints && best.hillPoints > 0
                              : best.kills === game.player.kills && best.kills > 0;
}

// Total des éliminations de chaque équipe : [équipe 0, équipe 1]
export function teamScores(fighters) {
  const sc = [0, 0];
  for (const f of fighters) sc[f.team] += f.kills;
  return sc;
}

// ---------------------------------------------------------------------
// Début et fin de partie
// ---------------------------------------------------------------------
// cosmetics = { color, pattern, trail… } : apparence choisie par le joueur
// guests (entre amis) = [{ peer, name, cosmetics }] : les invités, joués à distance
export function startMatch(settings, cosmetics = null, guests = [], playerName = CONFIG.player.name) {
  prepareMatch(settings);
  game.player = new Fighter({ name: playerName,
                              color: cosmetics ? cosmetics.color : CONFIG.player.color, team: 0 });
  dress(game.player, cosmetics);
  game.fighters = [game.player];
  game.bots = [];
  for (const g of guests) {
    const f = new Fighter({ name: g.name, color: g.cosmetics.color, team: 0 });
    dress(f, g.cosmetics);
    f.peer = g.peer;                               // numéro de son téléphone (serveur.py)
    f.remoteHuman = true;                          // (son nom s'affiche au-dessus de lui)
    f.remoteCmd = { moveX: 0, up: false, aimX: 1, aimY: 0, fire: false,
                    switchWeapon: false, reload: false, throwGrenade: false };
    game.fighters.push(f);
  }
  const B = CONFIG.bots, T = CONFIG.teams;
  const skill = CONFIG.difficulties[settings.difficulty];
  // Personnalités réparties à tour de rôle (en partant d'une au hasard)
  const persKeys = Object.keys(CONFIG.personalities);
  const persStart = Math.floor(Math.random() * persKeys.length);
  // En équipes : l'équipe du joueur a la moitié (arrondie en dessous) des places
  // (entre amis : les humains sont répartis un par un, puis les bots équilibrent)
  const humans = game.fighters.length;
  game.fighters.forEach((f, i) => { f.team = game.teams && guests.length ? i % 2 : 0; });
  const total = settings.bots + humans;
  const team0Size = Math.floor(total / 2);
  for (let i = 0; i < settings.bots; i++) {
    let team = game.teams && i + 1 >= team0Size ? 1 : 0;
    if (game.teams && guests.length) {
      const n0 = game.fighters.filter((o) => o.team === 0).length;
      team = n0 < game.fighters.length - n0 ? 0 : 1;
    }
    const shades = T.shades[team];
    const color = game.teams ? shades[i % shades.length] : B.colors[i % B.colors.length];
    const f = new Fighter({ name: B.names[i % B.names.length], color, isBot: true, team });
    const pers = CONFIG.personalities[persKeys[(persStart + i) % persKeys.length]];
    f.secondaryId = pers.secondary;
    f.tag = pers.tag;
    f.personality = pers.label;
    game.fighters.push(f);
    game.bots.push({ fighter: f, brain: new BotBrain(f, skill, pers) });
  }
  // Chacun sur un point d'apparition différent
  const spawns = [...game.map.spawns].sort(() => Math.random() - 0.5);
  game.fighters.forEach((f, i) => {
    f.nid = i;                                     // numéro du personnage (réseau)
    if (game.teams) f.labelColor = T.colors[f.team];
    f.respawn(spawns[i % spawns.length]);
    f.protectTimer = 0;
    f.hillPoints = 0;
  });
}

// Ce qui est commun à toutes les parties (solo, hôte, invité)
function prepareMatch(settings) {
  game.settings = settings;
  game.map = new GameMap(MAPS[settings.map]);
  game.mode = settings.mode;
  game.teams = settings.mode === 'teams';
  game.hill = settings.mode === 'hill' ? game.map.hill : null;
  game.hillOwner = null;
  game.hillContested = false;
  game.stats = { kills: 0, deaths: 0, streak: 0, bestStreak: 0, weaponKills: {},
                 explosiveKills: 0, airKills: 0, pickups: 0, hillTime: 0 };
  clearMatch();
  game.pickups = game.map.pickupSpots.map((spot) => new Pickup(spot));
  game.time = 0;
  game.timeLeft = CONFIG.rules.matchDuration;
}

// Applique l'apparence choisie (écran Style) à un personnage
function dress(f, c) {
  if (!c) return;
  f.pattern = c.pattern;
  f.trail = c.trail;
  f.look = lookFromCosmetics(c);
}

// Description des personnages, envoyée aux invités au début de la partie
export function rosterOf() {
  return game.fighters.map((f) => ({
    nid: f.nid, peer: f.peer ?? (f === game.player ? 0 : null), name: f.name, color: f.color,
    team: f.team, isBot: f.isBot, tag: f.tag || null, labelColor: f.labelColor || null,
    pattern: f.pattern || null, trail: f.trail || null, look: f.look, secondaryId: f.secondaryId || null,
  }));
}

// Chez un invité : recrée la partie décrite par l'hôte (sans bots ni règles :
// tout l'état arrive ensuite par le réseau, voir netgame.js)
export function startGuestMatch(settings, roster, myPeer) {
  prepareMatch(settings);
  game.bots = [];
  game.fighters = roster.map((r) => {
    const f = new Fighter({ name: r.name, color: r.color, isBot: r.isBot, team: r.team });
    Object.assign(f, { nid: r.nid, peer: r.peer, tag: r.tag, labelColor: r.labelColor,
                       pattern: r.pattern, trail: r.trail, look: r.look, hillPoints: 0 });
    if (r.secondaryId) { f.secondaryId = r.secondaryId; f.resetWeapons(); }
    return f;
  });
  game.player = game.fighters.find((f) => f.peer === myPeer) || game.fighters[0];
  for (const f of game.fighters) f.remoteHuman = !f.isBot && f !== game.player;
}

// Un invité a quitté la partie : son personnage disparaît
export function removeFighter(f) {
  f.alive = false;                                 // (les bots arrêtent de le viser)
  game.fighters = game.fighters.filter((o) => o !== f);
  if (game.hillOwner === f) game.hillOwner = null;
}

// Vide tout ce qui est temporaire (balles, effets…)
function clearMatch() {
  game.bullets = [];
  game.effects.clear();
  game.shake = 0;
  game.floaters = [];
  game.hitMarks = [];
  game.slowmo = 0;
  game.hurtMarks = [];
  game.banner = null;
  game.feed = [];
}

// Retour au menu : plus de personnages
export function resetMatch() {
  game.player = null;
  game.fighters = [];
  game.bots = [];
  game.pickups = [];
  clearMatch();
}

// Point d'apparition le plus éloigné des adversaires vivants
// (on tire au sort parmi les 3 meilleurs pour varier)
function chooseSpawn(f) {
  const others = game.fighters.filter((o) => o.alive && game.canHit(f, o));   // les adversaires
  const scored = game.map.spawns.map((s) => {
    let d = Infinity;
    for (const o of others) d = Math.min(d, Math.hypot(o.cx - s.x, o.cy - s.y));
    return { s, d };
  }).sort((a, b) => b.d - a.d);
  return scored[Math.floor(Math.random() * Math.min(3, scored.length))].s;
}

function killFighter(victim, killer) {
  if (!victim.alive) return;
  victim.alive = false;
  victim.health = 0;
  victim.deaths++;
  victim.jetting = false;
  victim.respawnTimer = CONFIG.rules.respawnDelay;
  if (killer && killer !== victim) killer.kills++;
  const weapon = victim.lastHitWeapon || (killer ? killer.weapon.def.id : null);
  presentKill(victim, killer, weapon);
  emit(['kill', victim.nid, killer ? killer.nid : -1, weapon]);
}

// Élimination : éclats, ralenti, statistiques du joueur, bandeau, fil, sons
export function presentKill(victim, killer, weapon) {
  // Le personnage éclate en morceaux de sa couleur + un peu de fumée
  const fx = game.effects;
  fx.sparks(victim.cx, victim.cy, victim.color, 22, DEATH_BITS);
  fx.sparks(victim.cx, victim.cy, '#ffffff', 6, DEATH_FLASH);
  for (let i = 0; i < 3; i++) fx.smoke(victim.cx, victim.cy, 10);
  if (victim === game.player) game.addShake(CONFIG.feel.shakeDeath);
  // (ralenti seulement en solo : entre amis, il ralentirait tout le monde)
  if (killer === game.player && victim !== game.player && !game.net) game.slowmo = CONFIG.feel.slowmoDuration;

  // Statistiques du joueur (missions, XP, écran Statistiques)
  const st = game.stats;
  if (victim === game.player) {
    st.deaths++;
    st.streak = 0;
  }
  if (killer === game.player && victim !== game.player) {
    st.kills++;
    st.streak++;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    st.weaponKills[weapon] = (st.weaponKills[weapon] || 0) + 1;
    if (weapon === 'rocket' || weapon === 'grenade') st.explosiveKills++;
    if (!game.player.grounded) st.airKills++;
  }

  if (killer && killer !== victim) {
    if (killer === game.player) {
      // Éliminations enchaînées en moins de 4 s → bandeau plus fort
      killer.streak = game.time - (killer.lastKillTime ?? -99) < 4 ? (killer.streak || 1) + 1 : 1;
      killer.lastKillTime = game.time;
      const names = ['Élimination !', 'Double élimination !', 'Triple élimination !', 'Inarrêtable !'];
      game.banner = { text: names[Math.min(killer.streak, 4) - 1], time: game.time };
    }
    addFeed(`${killer.name}  ✕  ${victim.name}`,
            killer === game.player || victim === game.player);
  } else if (killer === victim) {
    addFeed(`${victim.name} s'est fait exploser`, victim === game.player);
  } else {
    addFeed(`${victim.name} est tombé dans le vide`, victim === game.player);
  }
  if (victim === game.player) game.sound.play('death');
  else if (killer === game.player) game.sound.play('kill');
  else game.sound.play('death', hearingVolume(victim) * 0.5);
}

// Chiffre de dégâts au-dessus de la cible (les coups rapprochés s'additionnent)
function addFloater(target, amount, absorbed) {
  const color = absorbed >= amount ? '#74c0fc' : '#ffe066';   // bleu = encaissé par le bouclier
  const fl = game.floaters.find((x) => x.target === target && x.life > 0.55);
  if (fl) {
    fl.value += amount;
    fl.life = 0.9;
    fl.color = color;
  } else {
    game.floaters.push({ target, value: amount, x: target.cx, y: target.y - 22, life: 0.9, color });
  }
}

function addFeed(text, mine) {
  game.feed.unshift({ text, mine, time: game.time });
  if (game.feed.length > 4) game.feed.pop();
}

// ---------------------------------------------------------------------
// Une mise à jour de la partie (1/60 s). Renvoie true quand le temps est écoulé.
// ---------------------------------------------------------------------
const cmds = new Map();      // réutilisée à chaque mise à jour

export function updateMatch(dt, playerCmd) {
  game.time += dt;
  game.timeLeft -= dt;
  if (game.timeLeft <= 0) {
    game.timeLeft = 0;
    return true;
  }

  // 1. Commandes : le joueur (entrées) et les bots (IA) produisent la même chose
  const p = game.player;
  cmds.clear();
  cmds.set(p, playerCmd);
  for (const b of game.bots) cmds.set(b.fighter, b.brain.think(dt, game));
  // (entre amis : les invités envoient leur commande par le réseau, voir netgame.js)
  for (const f of game.fighters) if (f.remoteCmd) cmds.set(f, f.remoteCmd);

  // 2. Les personnages appliquent leur commande
  for (const f of game.fighters) {
    if (f.alive) {
      f.update(cmds.get(f), dt, game);
      if (f.y > game.map.killY) {
        // Tombé dans le vide : l'élimination revient au dernier tireur récent
        const recent = game.time - f.lastAttackTime < CONFIG.rules.killCreditTime;
        killFighter(f, recent ? f.lastAttacker : null);
      }
    } else {
      f.respawnTimer -= dt;
      if (f.respawnTimer <= 0) {
        f.respawn(chooseSpawn(f));
        const brain = game.bots.find((b) => b.fighter === f);
        if (brain) brain.brain.reset();
        if (f === p) game.sound.play('spawn');
      }
    }
  }

  // Qui est caché dans un buisson ? (voir hiding.js)
  updateHiding(game, dt);

  // 3. Objets, balles, effets
  for (const pk of game.pickups) pk.update(dt, game);
  for (const b of game.bullets) b.update(dt, game);
  game.bullets = game.bullets.filter((b) => !b.dead);
  game.effects.update(dt);

  // Les actions "une fois" des invités (changer d'arme, recharger, grenade) sont faites
  for (const f of game.fighters) {
    if (f.remoteCmd) f.remoteCmd.switchWeapon = f.remoteCmd.reload = f.remoteCmd.throwGrenade = false;
  }

  // Roi de la colline : celui qui est SEUL dans la zone marque des points
  if (game.hill && updateHill(dt)) return true;

  updateVisuals(dt);
  return false;
}

// Effets qui ne changent rien aux règles (aussi utilisés chez les invités)
export function updateVisuals(dt) {
  // Fumée qui s'échappe des jetpacks (traînée personnalisée pour le joueur)
  for (const f of game.fighters) {
    if (f.alive && f.jetting && Math.random() < 0.45) {
      const nozzle = f.facing === 1 ? f.x - 2 : f.x + f.w + 2;
      const tr = f.trail;
      let color = '#9aa3b5';
      if (tr) color = tr.rainbow ? `hsl(${(game.time * 240) % 360},90%,65%)` : tr.color;
      game.effects.smoke(nozzle, f.y + 36, 5, color);
      if (tr && tr.sparks) game.effects.spawn(nozzle, f.y + 36, tr.color, TRAIL_SPARK);
    }
  }
  game.shake *= Math.exp(-9 * dt);
  for (const fl of game.floaters) { fl.life -= dt; fl.y -= 40 * dt; }
  game.floaters = game.floaters.filter((fl) => fl.life > 0);
  for (const hm of game.hitMarks) hm.life -= dt;
  game.hitMarks = game.hitMarks.filter((hm) => hm.life > 0);
}

// Renvoie true si quelqu'un atteint le score à atteindre
function updateHill(dt) {
  const z = game.hill;
  let inside = null, count = 0;
  for (const f of game.fighters) {
    if (!f.alive) continue;
    if (f.x < z.x + z.w && f.x + f.w > z.x && f.y < z.y + z.h && f.y + f.h > z.y) {
      inside = f;
      count++;
    }
  }
  game.hillContested = count > 1;
  game.hillOwner = count === 1 ? inside : null;
  if (game.hillOwner) {
    const o = game.hillOwner;
    o.hillPoints += CONFIG.hill.pointsPerSecond * dt;
    if (o === game.player) game.stats.hillTime += dt;
    if (o.hillPoints >= CONFIG.hill.target) {
      o.hillPoints = CONFIG.hill.target;
      return true;
    }
  }
  return false;
}

// Aide à la visée : si un ennemi visible est presque dans l'axe du
// viseur, la visée glisse un peu vers lui. strength : 0 à 1.
export function applyAimAssist(cmd, strength) {
  if (strength <= 0) return;
  const A = CONFIG.touch.aimAssist;
  const p = game.player;
  const aim = Math.atan2(cmd.aimY, cmd.aimX);
  let bestDiff = null;
  for (const f of game.fighters) {
    if (!f.alive || !game.canHit(p, f) || !canSee(game, p, f)) continue;
    const dx = f.cx - p.shoulderX, dy = f.cy - p.shoulderY;
    if (Math.hypot(dx, dy) > p.weapon.def.range) continue;
    let diff = Math.atan2(dy, dx) - aim;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));      // ramène entre -π et π
    if (Math.abs(diff) > A.angle) continue;
    if (bestDiff !== null && Math.abs(diff) >= Math.abs(bestDiff)) continue;
    if (!game.map.lineOfSight(p.shoulderX, p.shoulderY, f.cx, f.cy)) continue;
    bestDiff = diff;
  }
  if (bestDiff !== null) {
    const a = aim + bestDiff * strength;
    cmd.aimX = Math.cos(a);
    cmd.aimY = Math.sin(a);
  }
}

// Tir automatique : vrai si un ennemi visible est presque dans l'axe du
// viseur et à portée de l'arme
export function enemyInSights(cmd) {
  const p = game.player;
  const aim = Math.atan2(cmd.aimY, cmd.aimX);
  const range = p.weapon.def.range * 0.9;
  for (const f of game.fighters) {
    if (!f.alive || !game.canHit(p, f) || f.protectTimer > 0 || !canSee(game, p, f)) continue;
    const dx = f.cx - p.shoulderX, dy = f.cy - p.shoulderY;
    const d = Math.hypot(dx, dy);
    if (d > range) continue;
    // tolérance angulaire un peu plus large pour les cibles proches (elles sont plus grosses)
    const tol = CONFIG.options.autoFireAngle + Math.atan2(f.h / 2, d);
    const diff = Math.atan2(Math.sin(Math.atan2(dy, dx) - aim), Math.cos(Math.atan2(dy, dx) - aim));
    if (Math.abs(diff) > tol) continue;
    if (game.map.lineOfSight(p.shoulderX, p.shoulderY, f.cx, f.cy)) return true;
  }
  return false;
}
