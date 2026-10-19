// =====================================================================
// main.js — Point d'entrée : canvas, boucle de jeu, caméra, dessin,
// enchaînement des écrans. Les règles de la partie sont dans match.js.
// =====================================================================

import { CONFIG } from './config.js';
import { GameMap, MAPS } from './map.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Scenery } from './scenery.js';
import { drawHides, canSee } from './hiding.js';
import { load, save } from './save.js';
import { game, startMatch, resetMatch, updateMatch, applyAimAssist, enemyInSights,
         playerWon, startGuestMatch, rosterOf, removeFighter } from './match.js';
import { loadProfile, saveProfile, finishMatch, isUnlocked, COSMETIC_TYPES,
         resolveCosmetics } from './progress.js';
import { Net } from './net.js';
import { HostSync, GuestSync } from './netgame.js';
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
  get net() { return net; },            // (jeu entre amis, défini plus bas)
  get lobby() { return lobby; },
  get pseudo() { return pseudo; },
  summary: null,                        // résumé d'XP de la dernière partie
  overTime: 0,                          // temps depuis la fin (animation de la barre d'XP)
  stylePreview: { ...profile.cosmetics },   // choix affiché sur l'écran Style
};
let optionsReturn = 'menu';     // écran où revenir en quittant un sous-écran

// Apparence du joueur pour la partie (cosmétiques équipés)
function playerCosmetics() {
  return resolveCosmetics(profile.cosmetics);
}

// ---------------------------------------------------------------------
// Jeu entre amis (même Wi-Fi) : net.js parle au serveur de l'ordinateur,
// netgame.js synchronise la partie. Ici : les écrans et l'enchaînement.
// ---------------------------------------------------------------------
const net = new Net();
let sync = null;                 // HostSync (hôte) ou GuestSync (invité) pendant une partie
const lobby = {
  guests: [],                    // (hôte) invités : { peer, name, cosmetics }
  info: null,                    // (invité) ce que l'hôte a envoyé : nom, joueurs, réglages
  error: '',                     // dernier message d'erreur à afficher
  settings: { map: settings.map, mode: settings.mode, difficulty: settings.difficulty, bots: 2 },
};
let pseudo = load('pseudo', { name: '' }).name || `Joueur${Math.floor(10 + Math.random() * 90)}`;
let roomsTimer = 0;

// Liste des joueurs et réglages, envoyée à tous les invités du salon
function broadcastLobby() {
  const players = [pseudo, ...lobby.guests.map((g) => g.name)];
  lobby.info = { host: pseudo, code: net.code, players, settings: { ...lobby.settings } };
  net.toAll({ k: 'lobby', ...lobby.info });
}

// Ouvre l'écran "Entre amis" (connexion au serveur si besoin)
function openMulti() {
  lobby.error = '';
  setState('multi');
  net.connect().then((ok) => { if (ok) net.listRooms(); });
}

function changePseudo() {
  let name = null;
  try { name = window.prompt('Ton pseudo (14 lettres maximum) :', pseudo); } catch (_) { /* rien */ }
  if (name && name.trim()) {
    pseudo = name.trim().slice(0, 14);
    save('pseudo', { name: pseudo });
  }
}

// Quitte la partie entre amis (le serveur prévient les autres)
function leaveNet(error = '') {
  net.leave();
  if (sync) sync.stop?.();
  sync = null;
  game.net = null;
  lobby.guests = [];
  lobby.info = null;
  lobby.error = error;
}

// Hôte : lance la partie pour tout le monde
function beginHostMatch() {
  try { if (!history.state || !history.state.jeu) history.pushState({ jeu: 1 }, ''); } catch (_) { /* rien */ }
  net.setOpen(false);                            // plus personne ne rejoint pendant la partie
  if (sync) sync.stop();
  startMatch(lobby.settings, playerCosmetics(), lobby.guests, pseudo);
  game.net = 'host';
  sync = new HostSync(net);
  net.toAll({ k: 'start', settings: lobby.settings, roster: rosterOf() });
  menuCtx.summary = null;
  updateCamera(0, true);
  setState('playing');
}

// Invité : l'hôte a lancé la partie
function beginGuestMatch(d) {
  try { if (!history.state || !history.state.jeu) history.pushState({ jeu: 1 }, ''); } catch (_) { /* rien */ }
  startGuestMatch(d.settings, d.roster, net.id);
  game.net = 'guest';
  sync = new GuestSync(net);
  menuCtx.summary = null;
  updateCamera(0, true);
  setState('playing');
}

// Messages du serveur et des autres joueurs
function handleNet() {
  for (const m of net.takeMessages()) {
    if (m.t === 'cree') {                        // notre partie est créée : salon
      lobby.guests = [];
      broadcastLobby();
      setState('lobby');
    } else if (m.t === 'rejoint') {
      lobby.info = null;
      setState('lobby');
    } else if (m.t === 'erreur') {
      lobby.error = m.texte;
      net.listRooms();
    } else if (m.t === 'arrivee') {              // (hôte) un ami arrive
      if (!lobby.guests.some((g) => g.peer === m.id)) {
        lobby.guests.push({ peer: m.id, name: m.nom, cosmetics: resolveCosmetics(m.d || {}) });
      }
      broadcastLobby();
      sound.play('pickup');
    } else if (m.t === 'depart') {               // (hôte) un ami s'en va
      lobby.guests = lobby.guests.filter((g) => g.peer !== m.id);
      const f = game.net === 'host' && game.fighters.find((o) => o.peer === m.id);
      if (f) {
        removeFighter(f);
        net.toAll({ k: 'gone', nid: f.nid });
      }
      broadcastLobby();
    } else if (m.t === 'fermee' || m.t === 'coupe') {
      const text = m.t === 'fermee' ? "L'hôte a quitté la partie." : 'Connexion au serveur perdue.';
      leaveNet(text);
      resetMatch();
      openMulti();
      lobby.error = text;
    } else if (m.t === 'msg') {
      const d = m.d || {};
      if (game.net === 'host' || net.isHost) {
        if (sync && sync.onMessage) sync.onMessage(m.de, d);
      } else if (d.k === 'lobby') {
        if (!game.player && (!lobby.info || lobby.info.settings.map !== d.settings.map)) showMenuMap(d.settings.map);
        lobby.info = d;
      } else if (d.k === 'start') {
        beginGuestMatch(d);
      } else if (d.k === 's' && game.net === 'guest') {
        sync.apply(d);
      } else if (d.k === 'end' && game.net === 'guest' && state !== 'over') {
        endMatch();
      } else if (d.k === 'gone' && game.net === 'guest') {
        const f = game.fighters.find((o) => o.nid === d.nid);
        if (f) removeFighter(f);
      }
    }
  }
}

// Une mise à jour de la partie entre amis (hôte : règles ; invité : affichage)
function netStep(dt, cmd) {
  if (game.net === 'guest') {
    sync.update(dt, cmd);
    return false;
  }
  sync.beforeUpdate();
  const over = updateMatch(dt, cmd);
  sync.afterUpdate();
  return over;
}
const IDLE_CMD = { moveX: 0, up: false, aimX: 1, aimY: 0, fire: false,
                   switchWeapon: false, reload: false, throwGrenade: false };

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
  // Messages du jeu entre amis
  if (net.inbox.length) handleNet();
  // Téléphone tenu en portrait pendant la partie → pause automatique
  if (state === 'playing' && input.touchMode && view.h > view.w) setState('paused');

  // Entre amis, la partie continue pendant la pause (on ne bouge plus, c'est tout)
  if (state !== 'playing' && game.net && game.player && state !== 'over') {
    IDLE_CMD.aimX = Math.cos(game.player.aimAngle);
    IDLE_CMD.aimY = Math.sin(game.player.aimAngle);
    if (netStep(dt, IDLE_CMD)) { endMatch(); return; }
  }
  // Écran "Entre amis" : la liste des parties se met à jour toute seule
  if (state === 'multi' && net.status === 'on' && (roomsTimer -= dt) <= 0) {
    net.listRooms();
    roomsTimer = 1.5;
  }

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
      else if (state === 'multi') setState('menu');
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
  if (game.net ? netStep(dt, playerCmd) : updateMatch(dt, playerCmd)) {
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
  if (game.net === 'host') {
    net.toAll(sync.snapshot());                  // dernier état (scores définitifs)
    net.toAll({ k: 'end' });
    net.setOpen(true);                           // de nouveaux amis peuvent rejoindre
  }
  if (!game.net) journalEnd(journal, journalEntry, game.time, 'terminée');
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
    } else if (id === 'replay' && game.net === 'host') {
      beginHostMatch();
    } else if (id === 'replay' || id === 'restart') {
      beginMatch();
    } else if (id === 'multi') {
      wantFullscreen = true;
      openMulti();
    } else if (id === 'back-menu') {
      lobby.error = '';
      setState('menu');
    } else if (id === 'multi-retry') {
      openMulti();
    } else if (id === 'pseudo') {
      changePseudo();
    } else if (id === 'create') {
      lobby.error = '';
      net.create(pseudo);
    } else if (id && id.startsWith('room:')) {
      lobby.error = '';
      net.join(id.slice(5), pseudo, profile.cosmetics);
    } else if (id === 'launch') {
      beginHostMatch();
    } else if (id === 'tolobby') {
      if (sync) sync.stop();                     // (la partie finie s'efface : retour au salon)
      sync = null;
      game.net = null;
      resetMatch();
      broadcastLobby();
      setState('lobby');
    } else if (id === 'leave') {
      leaveNet();
      goToMainMenu();
    } else if (id && id.startsWith('lob:')) {
      changeLobbySetting(id.slice(4));
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

// Salon (hôte) : réglages de la partie entre amis
function changeLobbySetting(id) {
  const [key, dirStr] = id.split(':');
  const dir = Number(dirStr);
  const L = lobby.settings;
  const cycle = (list, cur) => list[(list.indexOf(cur) + dir + list.length) % list.length];
  if (key === 'map') {
    L.map = (L.map + dir + MAPS.length) % MAPS.length;
    showMenuMap(L.map);
  }
  if (key === 'mode') L.mode = cycle(['ffa', 'teams', 'hill'], L.mode);
  if (key === 'difficulty') L.difficulty = cycle(DIFFS, L.difficulty);
  if (key === 'bots') L.bots = (L.bots + dir + 8) % 8;                 // 0 à 7 bots
  sound.play('switch');
  broadcastLobby();
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

// La carte affichée en fond des menus
function showMenuMap(i) {
  if (game.map.def !== MAPS[i]) game.map = new GameMap(MAPS[i]);
  centerMenuCamera();
}

function goToMainMenu() {
  if (game.net || net.inRoom) leaveNet();
  journalEnd(journal, journalEntry, game.time, 'abandonnée');   // (sans effet si déjà terminée)
  resetMatch();
  view.zoom = 1;
  view.scale = view.baseScale;
  showMenuMap(settings.map);
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

// Petit œil barré au-dessus du joueur quand il est caché dans un buisson
// (et "repéré !" s'il est dans un buisson mais vient de tirer)
function drawHiddenMark() {
  const p = game.player;
  if (!p.alive || !p.hideZone) return;
  const x = p.cx, y = p.y - 12;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 27, y - 13, 54, 14);
  ctx.fillStyle = p.hidden ? '#b2f2bb' : '#ffa8a8';
  ctx.fillText(p.hidden ? 'caché' : 'repéré !', x, y);
}
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
    // (un adversaire caché dans un buisson n'est pas dessiné du tout)
    const seen = game.fighters.filter((f) => canSee(game, game.player, f));
    sc.drawShadows(ctx, seen);
    for (const f of seen) if (f !== game.player) f.draw(ctx);
    drawAimGuide();
    game.player.draw(ctx);                       // le joueur par-dessus
    drawHides(ctx, game, game.time, { x: cam.x, y: cam.y, w: view.w / view.scale, h: view.h / view.scale });
    drawHiddenMark();
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
    drawHides(ctx, game, performance.now() / 1000, { x: cam.x, y: cam.y, w: view.w / view.scale, h: view.h / view.scale });
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
window.__net = net;

centerMenuCamera();
requestAnimationFrame(frame);
