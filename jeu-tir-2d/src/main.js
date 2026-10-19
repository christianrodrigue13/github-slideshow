// =====================================================================
// main.js — Point d'entrée : canvas, boucle de jeu, caméra, règles de
// la partie (éliminations, réapparition, chrono) et menus.
// =====================================================================

import { CONFIG } from './config.js';
import { GameMap, MAPS } from './map.js';
import { Fighter } from './player.js';
import { BotBrain } from './bot.js';
import { Input } from './input.js';
import { Particle, Blast, smoke } from './bullet.js';
import { Pickup } from './pickup.js';
import { Sound, vibrate } from './audio.js';
import { drawHUD, drawTouchControls, drawPauseButton, drawMenu,
         menuButtons, hitMenu } from './hud.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const sound = new Sound();

// Taille de l'écran (pixels CSS), zoom monde → écran, marges des encoches
const view = { w: 0, h: 0, dpr: 1, scale: 1, safeL: 0, safeR: 0 };
const cam = { x: 0, y: 0 };

// 'menu' | 'playing' | 'paused' | 'over'
let state = 'menu';

// Réglages choisis dans le menu (mémorisés d'une partie à l'autre)
const DIFFS = Object.keys(CONFIG.difficulties);
const settings = { map: 0, mode: 'ffa', difficulty: 'normal', bots: CONFIG.bots.count };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem('jetarena-settings') || '{}'));
} catch (_) { /* réglages par défaut */ }
// (sécurité si les valeurs mémorisées ne sont plus valables)
if (!MAPS[settings.map]) settings.map = 0;
if (!DIFFS.includes(settings.difficulty)) settings.difficulty = 'normal';
settings.bots = Math.max(3, Math.min(7, settings.bots | 0));

function saveSettings() {
  try { localStorage.setItem('jetarena-settings', JSON.stringify(settings)); } catch (_) { /* rien */ }
}

// L'état partagé de la partie, transmis aux personnages et aux balles
const game = {
  map: new GameMap(MAPS[settings.map]),
  settings,
  teams: false,         // vrai en mode équipes
  fighters: [],
  bots: [],             // { fighter, brain }
  player: null,
  bullets: [],          // balles ET grenades
  particles: [],
  effects: [],          // ondes de choc des explosions
  pickups: [],
  shake: 0,             // intensité du tremblement d'écran
  feed: [],             // fil des éliminations
  time: 0,
  timeLeft: CONFIG.rules.matchDuration,
  sound,

  // Un tir de "tireur" peut-il toucher "cible" ? (jamais soi-même)
  // (en équipes : jamais un coéquipier, les balles le traversent)
  canHit(shooter, target) {
    if (shooter === target) return false;
    return !game.teams || shooter.team !== target.team;
  },

  // Une balle touche quelqu'un
  onBulletHit(target, bullet) {
    game.sparks(bullet.x, bullet.y, target.color, 6);
    game.damage(target, bullet.damage, bullet.owner, bullet.vx * 0.02, 0);
  },

  // Inflige des dégâts (le bouclier encaisse en premier) + petite poussée
  damage(target, amount, attacker, pushX, pushY) {
    if (!target.alive || target.protectTimer > 0) return;  // invincible après réapparition
    if (attacker && attacker.isBot) amount *= CONFIG.difficulties[settings.difficulty].damage;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, amount);
      target.shield -= absorbed;
      amount -= absorbed;
    }
    target.health -= amount;
    target.hitFlash = 0.12;
    target.vx += pushX;
    target.vy += pushY;
    if (attacker && attacker !== target) {
      target.lastAttacker = attacker;
      target.lastAttackTime = game.time;
    }
    if (target === game.player) {
      sound.play('hurt');
      vibrate(CONFIG.feedback.vibrateOnHit);
      game.addShake(3);
    } else if (attacker === game.player) {
      sound.play('hitmark');
    }
    if (target.health <= 0) killFighter(target, attacker);
  },

  // Explosion de grenade : dégâts qui diminuent avec la distance,
  // bloqués par les murs, et souffle qui projette les personnages
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
      game.damage(f, def.damage * k * self, owner, nx * 650 * k, ny * 650 * k - 150 * k);
    }
    // Effets : onde de choc, flammes, éclats, fumée, tremblement d'écran
    game.effects.push(new Blast(x, y, R));
    game.sparks(x, y, '#ffd43b', 16, { speed: 420, size: 6 });
    game.sparks(x, y, '#ff6b2b', 16, { speed: 320, size: 7 });
    game.sparks(x, y, '#495057', 8, { speed: 500, size: 4 });
    for (let i = 0; i < 8; i++) game.addParticle(smoke(x, y, 12));
    const vol = hearingVolumeAt(x, y);
    sound.play('explosion', vol);
    game.addShake(14 * vol);
  },

  // Quelqu'un ramasse un objet
  onPickup(f, pickup) {
    if (f === game.player) sound.play('pickup');
  },

  // Petites étincelles (opts : voir Particle dans bullet.js)
  sparks(x, y, color, n, opts) {
    for (let i = 0; i < n; i++) game.addParticle(new Particle(x, y, color, opts));
  },

  // Ajoute une particule (au-delà de 500, on oublie les plus vieilles : fluidité)
  addParticle(pa) {
    game.particles.push(pa);
    if (game.particles.length > 500) game.particles.shift();
  },

  addShake(amount) {
    game.shake = Math.min(18, game.shake + amount);
  },

  // Événements des personnages → sons et vibrations
  onFighterEvent(f, name) {
    const vol = hearingVolume(f);
    if (name === 'fire') {
      const def = f.weapon.def;
      sound.play(def.id, vol);                   // un son par arme
      if (f === game.player) {
        vibrate(CONFIG.feedback.vibrateOnShoot);
        game.addShake(def.recoil / 50);          // les grosses armes secouent plus
      }
      // Douille éjectée (armes à balles)
      if (def.kind === 'bullet' && vol > 0) {
        const pa = new Particle(f.shoulderX, f.shoulderY, '#e0b44c',
                                { speed: 120, size: 3, life: 0.5 });
        pa.vx = -Math.cos(f.aimAngle) * 80 + (Math.random() - 0.5) * 40;
        pa.vy = -160 - Math.random() * 60;
        game.addParticle(pa);
      }
    } else if (f === game.player) {
      sound.play(name);                            // 'reload', 'switch'
    }
  },
};

// Plus un personnage est loin du joueur, moins on l'entend
function hearingVolume(f) {
  return hearingVolumeAt(f.cx, f.cy);
}
function hearingVolumeAt(x, y) {
  const p = game.player;
  const d = Math.hypot(x - p.cx, y - p.cy);
  return Math.max(0, 1 - d / 1100);
}

// Élément invisible dont le CSS donne la taille des encoches
const safeProbe = document.createElement('div');
safeProbe.id = 'safe-probe';
document.body.appendChild(safeProbe);

// ---------------------------------------------------------------------
// Adaptation à la taille de l'écran (et netteté sur écrans haute densité)
// ---------------------------------------------------------------------
function resize() {
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  view.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.view.maxPixelRatio);
  // Le canvas a plus de pixels réels que de pixels CSS → rendu net
  canvas.width = Math.round(view.w * view.dpr);
  canvas.height = Math.round(view.h * view.dpr);
  // Zoom : on garantit une surface minimale de monde visible
  view.scale = Math.min(view.w / CONFIG.view.minVisibleWidth,
                        view.h / CONFIG.view.minVisibleHeight);
  // Marges des encoches (iPhone en paysage…), lues depuis le CSS
  const cs = getComputedStyle(safeProbe);
  view.safeL = parseFloat(cs.paddingLeft) || 0;
  view.safeR = parseFloat(cs.paddingRight) || 0;
  input.resize(view.w, view.h, view.safeR);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

// ---------------------------------------------------------------------
// Caméra : suit le joueur en douceur, sans sortir de la carte
// ---------------------------------------------------------------------
function updateCamera(dt, snap = false) {
  const p = game.player;
  const viewW = view.w / view.scale;
  const viewH = view.h / view.scale;
  let tx = p.cx - viewW / 2;
  let ty = p.cy - viewH / 2;
  tx = Math.max(0, Math.min(game.map.width - viewW, tx));
  ty = Math.max(0, Math.min(game.map.height + 100 - viewH, ty));
  if (viewW > game.map.width) tx = (game.map.width - viewW) / 2;
  const k = snap ? 1 : 1 - Math.exp(-CONFIG.view.followSpeed * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}

function worldToScreen(x, y) {
  return { x: (x - cam.x) * view.scale, y: (y - cam.y) * view.scale };
}

// ---------------------------------------------------------------------
// Règles de la partie
// ---------------------------------------------------------------------
function startMatch() {
  game.map = new GameMap(MAPS[settings.map]);
  game.teams = settings.mode === 'teams';
  game.player = new Fighter({ name: CONFIG.player.name, color: CONFIG.player.color, team: 0 });
  game.fighters = [game.player];
  game.bots = [];
  const B = CONFIG.bots, T = CONFIG.teams;
  const skill = CONFIG.difficulties[settings.difficulty];
  // En équipes : l'équipe du joueur a la moitié (arrondie en dessous) des places
  const total = settings.bots + 1;
  const team0Size = Math.floor(total / 2);
  for (let i = 0; i < settings.bots; i++) {
    const team = game.teams && i + 1 >= team0Size ? 1 : 0;
    const shades = T.shades[team];
    const color = game.teams ? shades[i % shades.length] : B.colors[i % B.colors.length];
    const f = new Fighter({ name: B.names[i % B.names.length], color, isBot: true, team });
    if (game.teams) f.labelColor = T.colors[team];
    game.fighters.push(f);
    game.bots.push({ fighter: f, brain: new BotBrain(f, skill) });
  }
  // Chacun sur un point d'apparition différent
  const spawns = [...game.map.spawns].sort(() => Math.random() - 0.5);
  game.fighters.forEach((f, i) => {
    f.respawn(spawns[i % spawns.length]);
    f.protectTimer = 0;
  });
  game.bullets = [];
  game.particles = [];
  game.effects = [];
  game.shake = 0;
  game.pickups = game.map.pickupSpots.map((spot) => new Pickup(spot));
  game.feed = [];
  game.time = 0;
  game.timeLeft = CONFIG.rules.matchDuration;
  updateCamera(0, true);
  setState('playing');
}

function setState(s) {
  state = s;
  input.uiMode = s !== 'playing';
  input.taps.length = 0;
  if (s !== 'playing') {
    input.releaseAll();
    sound.setJet(0);
  }
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
  // Le personnage éclate en morceaux de sa couleur + un peu de fumée
  game.sparks(victim.cx, victim.cy, victim.color, 22, { speed: 380, size: 7, life: 0.8 });
  game.sparks(victim.cx, victim.cy, '#ffffff', 6, { speed: 250, size: 4 });
  for (let i = 0; i < 3; i++) game.addParticle(smoke(victim.cx, victim.cy, 10));
  if (victim === game.player) game.addShake(8);

  if (killer && killer !== victim) {
    killer.kills++;
    addFeed(`${killer.name}  ✕  ${victim.name}`,
            killer === game.player || victim === game.player);
  } else if (killer === victim) {
    addFeed(`${victim.name} s'est fait exploser`, victim === game.player);
  } else {
    addFeed(`${victim.name} est tombé dans le vide`, victim === game.player);
  }
  if (victim === game.player) sound.play('death');
  else if (killer === game.player) sound.play('kill');
  else sound.play('death', hearingVolume(victim) * 0.5);
}

function addFeed(text, mine) {
  game.feed.unshift({ text, mine, time: game.time });
  if (game.feed.length > 4) game.feed.pop();
}

// ---------------------------------------------------------------------
// Une mise à jour de la logique (toujours 1/60 s)
// ---------------------------------------------------------------------
function update(dt) {
  // Téléphone tenu en portrait pendant la partie → pause automatique
  if (state === 'playing' && input.touchMode && view.h > view.w) setState('paused');

  if (state !== 'playing') {
    handleMenuTaps();
    // Échap / bouton pause : reprend depuis la pause, ignoré dans les autres menus
    if (input.takePause() && state === 'paused') setState('playing');
    return;
  }
  if (input.takePause()) { setState('paused'); return; }

  game.time += dt;
  game.timeLeft -= dt;
  if (game.timeLeft <= 0) {
    game.timeLeft = 0;
    setState('over');
    return;
  }

  // 1. Commandes : le joueur (entrées) et les bots (IA) produisent la même chose
  const p = game.player;
  const ps = worldToScreen(p.shoulderX, p.shoulderY);
  const playerCmd = input.getCommand(ps.x, ps.y);
  const cmds = new Map([[p, playerCmd]]);
  for (const b of game.bots) cmds.set(b.fighter, b.brain.think(dt, game));

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
        if (f === p) sound.play('spawn');
      }
    }
  }

  // 3. Objets, balles, particules
  for (const pk of game.pickups) pk.update(dt, game);
  for (const b of game.bullets) b.update(dt, game);
  game.bullets = game.bullets.filter((b) => !b.dead);
  for (const pa of game.particles) pa.update(dt);
  game.particles = game.particles.filter((pa) => pa.life > 0);
  for (const e of game.effects) e.update(dt);
  game.effects = game.effects.filter((e) => e.life > 0);

  // Fumée qui s'échappe des jetpacks
  for (const f of game.fighters) {
    if (f.alive && f.jetting && Math.random() < 0.45) {
      const nozzle = f.facing === 1 ? f.x - 2 : f.x + f.w + 2;
      game.addParticle(smoke(nozzle, f.y + 36, 5));
    }
  }
  game.shake *= Math.exp(-9 * dt);

  sound.setJet(p.alive && p.jetting ? 1 : 0);
  updateCamera(dt);
}

// Clics / touchers sur les boutons des menus
function handleMenuTaps() {
  let tap;
  while ((tap = input.takeTap())) {
    const id = hitMenu(menuButtons(state, view, game), tap);
    if (id === 'play') {
      wantFullscreen = true;       // fait au moment où le doigt se lève (voir plus bas)
      startMatch();
    } else if (id === 'replay' || id === 'restart') {
      startMatch();
    } else if (id === 'mainmenu') {
      goToMainMenu();
    } else if (id && id.includes(':')) {
      changeSetting(id);
    } else if (id === 'resume') {
      setState('playing');
    } else if (id === 'sound') {
      sound.toggleMute();
    }
  }
}

// Boutons ◀ ▶ du menu : id = "réglage:sens" (ex. "map:+1")
function changeSetting(id) {
  const [key, dirStr] = id.split(':');
  const dir = Number(dirStr);
  const cycle = (list, cur) => list[(list.indexOf(cur) + dir + list.length) % list.length];
  if (key === 'map') {
    settings.map = (settings.map + dir + MAPS.length) % MAPS.length;
    game.map = new GameMap(MAPS[settings.map]);   // la carte s'affiche en fond
    centerMenuCamera();
  }
  if (key === 'mode') settings.mode = cycle(['ffa', 'teams'], settings.mode);
  if (key === 'difficulty') settings.difficulty = cycle(DIFFS, settings.difficulty);
  if (key === 'bots') settings.bots = 3 + ((settings.bots - 3 + dir + 5) % 5);
  sound.play('switch');
  saveSettings();
}

function goToMainMenu() {
  game.player = null;
  game.fighters = [];
  game.bots = [];
  game.bullets = [];
  game.pickups = [];
  game.particles = [];
  game.effects = [];
  centerMenuCamera();
  setState('menu');
}

// Sur le menu : la caméra montre le centre de la carte choisie
function centerMenuCamera() {
  const viewW = view.w / view.scale, viewH = view.h / view.scale;
  cam.x = (game.map.width - viewW) / 2;
  cam.y = Math.max(0, game.map.height - viewH - 50);
}

// Plein écran + verrouillage paysage (Android ; ignoré ailleurs)
let wantFullscreen = false;
function goFullscreen() {
  if (!input.touchMode) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || document.fullscreenElement) return;
  try {
    const pr = req.call(el, { navigationUI: 'hide' });
    if (pr && pr.then) {
      pr.then(() => screen.orientation && screen.orientation.lock &&
                    screen.orientation.lock('landscape').catch(() => {}))
        .catch(() => {});
    }
  } catch (_) { /* pas grave : on joue sans plein écran */ }
}

// ---------------------------------------------------------------------
// Dessin
// ---------------------------------------------------------------------
function render() {
  // Repère écran (pixels CSS) avec prise en compte de la densité
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  game.map.drawBackground(ctx, cam, view);

  if (game.player) {
    // Repère monde : zoom + décalage caméra (+ tremblement)
    const sh = state === 'playing' ? game.shake : 0;
    ctx.save();
    ctx.scale(view.scale, view.scale);
    ctx.translate(-cam.x + (Math.random() - 0.5) * 2 * sh, -cam.y + (Math.random() - 0.5) * 2 * sh);
    game.map.draw(ctx, cam);
    for (const pk of game.pickups) pk.draw(ctx);
    for (const f of game.fighters) if (f !== game.player) f.draw(ctx);
    game.player.draw(ctx);                       // le joueur par-dessus
    for (const b of game.bullets) b.draw(ctx);
    for (const pa of game.particles) pa.draw(ctx);
    for (const e of game.effects) e.draw(ctx);
    ctx.restore();

    if (state !== 'over') drawHUD(ctx, game, view);
  } else {
    // Écran d'accueil : la carte en fond
    ctx.save();
    ctx.scale(view.scale, view.scale);
    ctx.translate(-cam.x, -cam.y);
    game.map.draw(ctx, cam);
    ctx.restore();
  }

  if (state === 'playing') {
    drawTouchControls(ctx, input);
    drawPauseButton(ctx, input);
  } else {
    drawMenu(ctx, state, view, game);
  }
}

// ---------------------------------------------------------------------
// Boucle à pas de temps fixe : la logique tourne exactement 60 fois par
// seconde quel que soit l'appareil ; l'affichage suit l'écran.
// ---------------------------------------------------------------------
const STEP = 1 / CONFIG.updatesPerSecond;
let accumulator = 0;
let last = performance.now();

function frame(now) {
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25;   // onglet en arrière-plan, gros ralentissement…
  accumulator += elapsed;
  let steps = 0;
  while (accumulator >= STEP && steps < CONFIG.maxStepsPerFrame) {
    update(STEP);
    accumulator -= STEP;
    steps++;
  }
  if (steps === CONFIG.maxStepsPerFrame) accumulator = 0;
  render();
  requestAnimationFrame(frame);
}

// Le son ne peut démarrer qu'après un premier geste (règle des navigateurs)
input.onFirstGesture = () => sound.unlock();
// Sur mobile, le navigateur n'autorise le son et le plein écran qu'au moment
// où le doigt SE LÈVE : on (re)tente donc à ce moment-là.
function onGestureEnd() {
  sound.unlock();
  if (wantFullscreen) {
    wantFullscreen = false;
    goFullscreen();
  }
}
window.addEventListener('pointerup', onGestureEnd);
window.addEventListener('touchend', onGestureEnd);
window.addEventListener('click', onGestureEnd);

// Si on quitte l'application pendant la partie → pause
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') setState('paused');
});

// Petit accès de débogage pour les tests automatiques
window.__debug = () => ({
  state,
  feed: game.feed.map((f) => f.text),
  audio: sound.ctx ? sound.ctx.state : 'aucun',
  timeLeft: game.timeLeft,
  pickupsActive: game.pickups.filter((p) => p.active).length,
  fighters: game.fighters.map((f) => ({ name: f.name, alive: f.alive, hp: Math.round(f.health),
    shield: Math.round(f.shield), arme2: f.weapons[1].def.id,
    kills: f.kills, deaths: f.deaths, x: Math.round(f.x), y: Math.round(f.y) })),
});
window.__game = game;   // (tests automatiques uniquement)

centerMenuCamera();
requestAnimationFrame(frame);
