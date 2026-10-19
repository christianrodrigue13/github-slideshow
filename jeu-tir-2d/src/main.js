// =====================================================================
// main.js — Point d'entrée : canvas, boucle de jeu, caméra, dessin,
// enchaînement des écrans. Les règles de la partie sont dans match.js.
// =====================================================================

import { CONFIG } from './config.js';
import { GameMap, MAPS } from './map.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Scenery } from './scenery.js';
import { load, save } from './save.js';
import { game, startMatch, resetMatch, updateMatch, applyAimAssist, enemyInSights,
         playerWon } from './match.js';
import { loadProfile, saveProfile, finishMatch, cosmetic, isUnlocked, COSMETIC_TYPES } from './progress.js';
import { initBackup, openBackup, backupIsOpen } from './backup.js';
import { loadJournal, journalStart, journalTouch, journalEnd, clearJournal } from './journal.js';
import { loadOptions, cycleOption, aimAssistStrength, aimSpeed } from './options.js';
import { drawHUD, drawTouchControls, drawPauseButton } from './hud.js';
import { drawMenu, menuButtons, hitMenu, titleRect } from './menus.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const sound = new Sound();

// Taille de l'écran (pixels CSS), zoom monde → écran, marges des encoches
// (scale = baseScale × zoom ; le zoom change avec le sniper)
const view = { w: 0, h: 0, dpr: 1, scale: 1, baseScale: 1, zoom: 1, safeL: 0, safeR: 0 };
const cam = { x: 0, y: 0 };

// 'menu' | 'playing' | 'paused' | 'over'
let state = 'menu';

// Réglages choisis dans le menu (mémorisés d'une partie à l'autre)
const DIFFS = Object.keys(CONFIG.difficulties);
const settings = load('settings', { map: 0, mode: 'ffa', difficulty: 'normal', bots: CONFIG.bots.count });
// (sécurité si les valeurs mémorisées ne sont plus valables)
if (!MAPS[settings.map]) settings.map = 0;
if (!DIFFS.includes(settings.difficulty)) settings.difficulty = 'normal';
if (!['ffa', 'teams', 'hill'].includes(settings.mode)) settings.mode = 'ffa';
settings.bots = Math.max(3, Math.min(7, settings.bots | 0));

function saveSettings() {
  save('settings', settings);
}

// Options du joueur (écran Options), sauvegardées sur l'appareil
const options = loadOptions();
function applyOptions() {
  sound.setVolume(options.volume);
  input.setOptions({ leftHanded: options.leftHanded, fixedSticks: options.fixedSticks,
                     aimSpeed: aimSpeed(options) });
}

// Progression du joueur (XP, missions, cosmétiques, statistiques)
const profile = loadProfile();
initBackup();

// Journal local anonyme des parties (écran caché : appui long sur le titre)
const journal = loadJournal();
let journalEntry = null;        // la partie en cours dans le journal

// Décors de la carte affichée (créés une fois par carte)
function scenery() {
  const m = game.map;
  if (!m.scenery) m.scenery = new Scenery(m);
  m.scenery.setQuality(currentQuality());
  return m.scenery;
}

// Qualité graphique : celle choisie, ou en "auto" celle que le téléphone supporte
let autoQuality = 2;
function currentQuality() {
  const q = CONFIG.options.graphics[options.graphics];
  return q >= 0 ? q : autoQuality;
}

// Ce dont les écrans de menu ont besoin
const menuCtx = {
  game, settings, options, profile, journal,
  summary: null,                        // résumé d'XP de la dernière partie
  overTime: 0,                          // temps depuis la fin (animation de la barre d'XP)
  stylePreview: { ...profile.cosmetics },   // choix affiché sur l'écran Style
};
let optionsReturn = 'menu';     // écran où revenir en quittant un sous-écran

// Apparence du joueur pour la partie (cosmétiques équipés)
function playerCosmetics() {
  const c = profile.cosmetics;
  return { color: cosmetic('color', c.color).color, pattern: cosmetic('pattern', c.pattern).id,
           trail: cosmetic('trail', c.trail) };
}

// L'état de la partie vit dans match.js ; on lui confie le son et les réglages
game.sound = sound;
game.settings = settings;
game.options = options;
game.map = new GameMap(MAPS[settings.map]);

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
  view.baseScale = Math.min(view.w / CONFIG.view.minVisibleWidth,
                            view.h / CONFIG.view.minVisibleHeight);
  view.scale = view.baseScale * view.zoom;
  // Marges des encoches (iPhone en paysage…), lues depuis le CSS
  const cs = getComputedStyle(safeProbe);
  view.safeL = parseFloat(cs.paddingLeft) || 0;
  view.safeR = parseFloat(cs.paddingRight) || 0;
  input.resize(view.w, view.h, view.safeR);
}
applyOptions();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

// ---------------------------------------------------------------------
// Caméra : suit le joueur en douceur, sans sortir de la carte
// ---------------------------------------------------------------------
function updateCamera(dt, snap = false) {
  const p = game.player;
  // Zoom : on dézoome doucement quand le joueur tient le sniper
  const sniper = p.alive && p.weapon.def.id === 'sniper';
  const k = snap ? 1 : 1 - Math.exp(-CONFIG.view.followSpeed * dt);
  view.zoom += ((sniper ? CONFIG.view.sniperZoom : 1) - view.zoom) * (snap ? 1 : k * 0.5);
  view.scale = view.baseScale * view.zoom;
  const viewW = view.w / view.scale;
  const viewH = view.h / view.scale;
  // La caméra regarde un peu dans la direction de visée
  const look = p.alive ? (sniper ? CONFIG.view.sniperLookAhead : CONFIG.view.lookAhead) : 0;
  let tx = p.cx + Math.cos(p.aimAngle) * look - viewW / 2;
  let ty = p.cy + Math.sin(p.aimAngle) * look * 0.6 - viewH / 2;
  tx = Math.max(0, Math.min(game.map.width - viewW, tx));
  ty = Math.max(0, Math.min(game.map.height + 100 - viewH, ty));
  if (viewW > game.map.width) tx = (game.map.width - viewW) / 2;
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}

function worldToScreen(x, y) {
  return { x: (x - cam.x) * view.scale, y: (y - cam.y) * view.scale };
}

// Lance une partie avec les réglages du menu
function beginMatch() {
  // Une entrée dans l'historique : le bouton "retour" du téléphone mettra
  // le jeu en pause au lieu de quitter la page (voir plus bas)
  try { if (!history.state || !history.state.jeu) history.pushState({ jeu: 1 }, ''); } catch (_) { /* rien */ }
  // (relancer une partie en cours = l'abandonner)
  journalEnd(journal, journalEntry, game.time, 'abandonnée');
  startMatch(settings, playerCosmetics());
  journalEntry = journalStart(journal, settings);
  menuCtx.summary = null;
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

// ---------------------------------------------------------------------
// Une mise à jour de la logique (toujours 1/60 s)
// ---------------------------------------------------------------------
function update(dt) {
  // Téléphone tenu en portrait pendant la partie → pause automatique
  if (state === 'playing' && input.touchMode && view.h > view.w) setState('paused');

  if (state !== 'playing') {
    if (state === 'over') menuCtx.overTime += dt;
    if (backupIsOpen()) { input.taps.length = 0; return; }   // fenêtre de sauvegarde ouverte
    // Appui long (≈ 1 s) sur le titre de l'accueil → écran caché du journal
    if (state === 'menu' && input.hold && performance.now() - input.hold.time > 900) {
      const r = titleRect(view), h = input.hold;
      input.hold = null;
      if (h.x >= r.x && h.x <= r.x + r.w && h.y >= r.y && h.y <= r.y + r.h) {
        input.taps.length = 0;
        optionsReturn = 'menu';
        setState('journal');
        return;
      }
    }
    handleMenuTaps();
    // Échap / bouton pause : reprend depuis la pause, quitte les sous-écrans
    if (input.takePause()) {
      if (state === 'paused') setState('playing');
      else if (SUB_SCREENS.includes(state)) setState(optionsReturn);
    }
    return;
  }
  if (input.takePause()) { setState('paused'); return; }

  // Commande du joueur (+ aide à la visée quand on vise au doigt)
  const p = game.player;
  const ps = worldToScreen(p.shoulderX, p.shoulderY);
  const playerCmd = input.getCommand(ps.x, ps.y, dt);
  input.grenadeCount = p.grenades;              // (affiché sur le bouton grenade)
  if (p.alive && input.touchMode) {
    if (input.rightStick) applyAimAssist(playerCmd, aimAssistStrength(options));
    // Tir automatique : on tire seul dès qu'un ennemi est dans le viseur
    if (options.autoFire && enemyInSights(playerCmd)) playerCmd.fire = true;
  }
  if (window.__forceFire) { playerCmd.fire = true; playerCmd.aimX = 1; playerCmd.aimY = -0.08; }   // (tests)
  if (updateMatch(dt, playerCmd)) {
    endMatch();
    return;
  }

  sound.setJet(p.alive && p.jetting ? 1 : 0);
  updateCamera(dt);
}

// Sous-écrans ouverts depuis l'accueil ou la pause (bouton Retour)
const SUB_SCREENS = ['options', 'missions', 'style', 'stats', 'journal'];

// Partie terminée normalement : XP, missions, statistiques
function endMatch() {
  journalEnd(journal, journalEntry, game.time, 'terminée');
  menuCtx.summary = finishMatch(profile, {
    won: playerWon(), mode: game.mode, duration: game.time,
    hillPoints: game.player.hillPoints, stats: game.stats,
  });
  menuCtx.overTime = 0;
  setState('over');
}

// Écran Style : passe au cosmétique suivant/précédent ; on l'équipe s'il est débloqué
function changeCosmetic(key, dir) {
  const t = COSMETIC_TYPES.find((c) => c.key === key);
  const i = t.list.findIndex((x) => x.id === menuCtx.stylePreview[key]);
  const item = t.list[(i + dir + t.list.length) % t.list.length];
  menuCtx.stylePreview[key] = item.id;
  if (isUnlocked(item, profile)) {
    profile.cosmetics[key] = item.id;
    saveProfile(profile);
  }
}

// Clics / touchers sur les boutons des menus
function handleMenuTaps() {
  let tap;
  while ((tap = input.takeTap())) {
    const id = hitMenu(menuButtons(state, view, menuCtx), tap);
    if (id === 'play') {
      wantFullscreen = true;       // fait au moment où le doigt se lève (voir plus bas)
      beginMatch();
    } else if (id === 'replay' || id === 'restart') {
      beginMatch();
    } else if (id === 'mainmenu') {
      goToMainMenu();
    } else if (SUB_SCREENS.includes(id)) {
      optionsReturn = state;
      if (id === 'style') menuCtx.stylePreview = { ...profile.cosmetics };
      setState(id);
    } else if (id === 'back') {
      // (en quittant le Style, l'aperçu revient à ce qui est vraiment équipé)
      menuCtx.stylePreview = { ...profile.cosmetics };
      setState(optionsReturn);
    } else if (id === 'journal-clear') {
      if (window.confirm('Effacer tout le journal des parties ?')) clearJournal(journal);
    } else if (id === 'export' || id === 'import') {
      openBackup(id);
    } else if (id && id.startsWith('cos:')) {
      const [, key, dir] = id.split(':');
      changeCosmetic(key, Number(dir));
      sound.play('switch');
    } else if (id && id.startsWith('opt:')) {
      const [, key, dir] = id.split(':');
      cycleOption(options, key, Number(dir));
      applyOptions();
      sound.play('switch');
    } else if (id && id.includes(':')) {
      changeSetting(id);
    } else if (id === 'resume') {
      setState('playing');
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
  if (key === 'mode') settings.mode = cycle(['ffa', 'teams', 'hill'], settings.mode);
  if (key === 'difficulty') settings.difficulty = cycle(DIFFS, settings.difficulty);
  if (key === 'bots') settings.bots = 3 + ((settings.bots - 3 + dir + 5) % 5);
  sound.play('switch');
  saveSettings();
}

function goToMainMenu() {
  journalEnd(journal, journalEntry, game.time, 'abandonnée');   // (sans effet si déjà terminée)
  resetMatch();
  view.zoom = 1;
  view.scale = view.baseScale;
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
  const sc = scenery();
  sc.drawBackground(ctx, cam, view);

  if (game.player) {
    // Repère monde : zoom + décalage caméra (+ tremblement)
    const sh = state === 'playing' ? game.shake : 0;
    ctx.save();
    ctx.scale(view.scale, view.scale);
    ctx.translate(-cam.x + (Math.random() - 0.5) * 2 * sh, -cam.y + (Math.random() - 0.5) * 2 * sh);
    sc.drawWorld(ctx);
    drawHillZone();
    for (const pk of game.pickups) pk.draw(ctx);
    sc.drawShadows(ctx, game.fighters);
    for (const f of game.fighters) if (f !== game.player) f.draw(ctx);
    drawAimGuide();
    game.player.draw(ctx);                       // le joueur par-dessus
    for (const b of game.bullets) b.draw(ctx);
    game.effects.draw(ctx);
    sc.drawLights(ctx, game);
    drawFloaters();
    drawHitMarks();
    ctx.restore();
    sc.drawForeground(ctx, view);

    if (state !== 'over') {
      const pp = worldToScreen(game.player.cx, game.player.cy);
      drawHUD(ctx, game, view, pp, cam);
    }
  } else {
    // Écran d'accueil : la carte en fond
    ctx.save();
    ctx.scale(view.scale, view.scale);
    ctx.translate(-cam.x, -cam.y);
    sc.drawWorld(ctx);
    ctx.restore();
    sc.drawForeground(ctx, view);
  }

  if (state === 'playing') {
    drawTouchControls(ctx, input);
    drawPauseButton(ctx, input);
  } else {
    drawMenu(ctx, state, view, menuCtx);
  }
}

// Ligne de visée du joueur (repère monde) :
// fusil de précision = laser rouge, autres armes = pointillés (seulement quand on vise au doigt)
function drawAimGuide() {
  const p = game.player;
  if (state !== 'playing' || !p.alive) return;
  const def = p.weapon.def;
  const x0 = p.shoulderX, y0 = p.shoulderY;
  const dx = Math.cos(p.aimAngle), dy = Math.sin(p.aimAngle);
  ctx.save();
  if (def.id === 'sniper' || (input.touchMode && input.rightStick)) {
    const len = def.id === 'sniper' ? def.range : 230;
    const x1 = x0 + dx * len, y1 = y0 + dy * len;
    const t = game.map.raycast(x0, y0, x1, y1) ?? 1;
    if (def.id === 'sniper') {
      ctx.strokeStyle = 'rgba(255,70,70,0.55)';
      ctx.lineWidth = 1.5;
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
    }
    ctx.beginPath();
    ctx.moveTo(x0 + dx * 30, y0 + dy * 30);
    ctx.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    ctx.stroke();
  }
  ctx.restore();
}

// Zone du Roi de la colline : sa couleur dit qui la tient
// (blanc = libre, couleur du personnage = tenue, orange = disputée)
function drawHillZone() {
  const z = game.hill;
  if (!z) return;
  const owner = game.hillOwner;
  const color = game.hillContested ? '#ff922b' : owner ? (owner === game.player ? '#ffe066' : owner.color) : '#ffffff';
  const pulse = 0.12 + 0.06 * Math.sin(game.time * 5);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = color;
  ctx.fillRect(z.x, z.y, z.w, z.h);
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(z.x, z.y, z.w, z.h);
  ctx.setLineDash([]);
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = color;
  ctx.fillText('★ COLLINE', z.x + z.w / 2, z.y - 4);
  ctx.restore();
}

// Marqueurs de touche : petite croix blanche (rouge si élimination)
function drawHitMarks() {
  ctx.lineCap = 'round';
  for (const hm of game.hitMarks) {
    const t = hm.life / CONFIG.feel.hitMarkerTime;      // 1 → 0
    const r = (hm.kill ? 14 : 9) * (1.3 - 0.3 * t), gap = 4;
    ctx.globalAlpha = Math.min(1, t * 1.5);
    ctx.strokeStyle = hm.kill ? '#ff4d4d' : '#ffffff';
    ctx.lineWidth = hm.kill ? 3.5 : 2.5;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.moveTo(hm.x + sx * gap, hm.y + sy * gap);
      ctx.lineTo(hm.x + sx * r, hm.y + sy * r);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Chiffres de dégâts (repère monde)
function drawFloaters() {
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const fl of game.floaters) {
    ctx.globalAlpha = Math.min(1, fl.life * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(Math.round(fl.value), fl.x + 1, fl.y + 1);
    ctx.fillStyle = fl.color;
    ctx.fillText(Math.round(fl.value), fl.x, fl.y);
  }
  ctx.globalAlpha = 1;
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
  // Ralenti (après une élimination du joueur) : le temps du jeu avance moins vite
  let timeScale = 1;
  if (game.slowmo > 0 && state === 'playing') {
    timeScale = CONFIG.feel.slowmoScale;
    game.slowmo -= elapsed;
  }
  accumulator += elapsed * timeScale;
  let steps = 0;
  while (accumulator >= STEP && steps < CONFIG.maxStepsPerFrame) {
    update(STEP);
    accumulator -= STEP;
    steps++;
  }
  if (steps === CONFIG.maxStepsPerFrame) accumulator = 0;
  scenery().update(elapsed, view);
  watchPerformance(elapsed);
  render();
  requestAnimationFrame(frame);
}

// Qualité "auto" : si les images prennent trop de temps (téléphone qui rame),
// on retire des effets de décor, un niveau à la fois
let frameAvg = 1 / 60, slowTime = 0;
function watchPerformance(elapsed) {
  if (options.graphics !== 'auto' || document.hidden) return;
  frameAvg += (elapsed - frameAvg) * 0.05;
  if (frameAvg * 1000 > CONFIG.options.autoGraphicsFrameMs && autoQuality > 0) {
    slowTime += elapsed;
    if (slowTime > 2) { autoQuality--; slowTime = 0; frameAvg = 1 / 60; }
  } else {
    slowTime = 0;
  }
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

// Bouton / geste "retour" du téléphone : pendant une partie, il met en
// pause (ou ferme les Options) au lieu de quitter la page
window.addEventListener('popstate', () => {
  if (!game.player) return;                    // sur le menu : retour normal
  if (state === 'playing') setState('paused');
  else if (SUB_SCREENS.includes(state)) setState(optionsReturn);
  try { history.pushState({ jeu: 1 }, ''); } catch (_) { /* rien */ }
});

// Si on quitte l'application pendant la partie → pause
// (et on note la durée jouée dans le journal, au cas où la page serait fermée)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') setState('paused');
  if (document.hidden && game.player) journalTouch(journal, journalEntry, game.time);
});
window.addEventListener('pagehide', () => {
  if (game.player) journalTouch(journal, journalEntry, game.time);
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
window.__input = input;
window.__menuButtons = () => menuButtons(state, view, menuCtx);

centerMenuCamera();
requestAnimationFrame(frame);
