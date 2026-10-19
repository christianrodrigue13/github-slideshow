// =====================================================================
// menus.js — Les écrans de menu (accueil, pause, options, fin de partie…).
// Chaque écran fournit la liste de ses boutons (servant au dessin ET
// aux touchers) puis se dessine. Tout est en pixels CSS.
// m = { game, settings, options, profile, summary, stylePreview, overTime } :
// ce dont les écrans ont besoin (fourni par main.js).
// =====================================================================

import { CONFIG, weaponDef } from './config.js';
import { MAPS } from './map.js';
import { unit, font, bar, roundedPath, formatTime } from './ui.js';
import { ranking, teamScores } from './match.js';
import { OPTION_ROWS } from './options.js';
import { Fighter } from './player.js';
import { journalSummary } from './journal.js';
import { levelInfo, missionDef, missionText, timeUntilTomorrow, COSMETIC_TYPES,
         cosmetic, isUnlocked, favoriteWeapon } from './progress.js';

// Lignes de réglage du menu principal
const SETTING_ROWS = [
  { key: 'map', label: 'Carte' },
  { key: 'mode', label: 'Mode' },
  { key: 'difficulty', label: 'Difficulté' },
  { key: 'bots', label: 'Bots' },
];

export const MODE_NAMES = { ffa: 'Chacun pour soi', teams: 'Équipes', hill: 'Roi de la colline' };

function settingValue(key, settings) {
  if (key === 'map') return MAPS[settings.map].name;
  if (key === 'mode') return MODE_NAMES[settings.mode];
  if (key === 'difficulty') return CONFIG.difficulties[settings.difficulty].label;
  return String(settings.bots);
}

// Ajoute une ligne de réglage : [◀] [valeur (touche = suivant)] [▶]
// prefix + ":-1" / ":1" forment les identifiants des boutons
function settingRow(list, prefix, caption, value, x, y, w, h) {
  const aw = h * 1.1;
  list.push({ id: `${prefix}:-1`, label: '◀', x, y, w: aw, h, kind: 'arrow' });
  list.push({ id: `${prefix}:1`, label: value, caption, x: x + aw + 4, y, w: w - 2 * aw - 8, h,
              kind: 'setting' });
  list.push({ id: `${prefix}:1`, label: '▶', x: x + w - aw, y, w: aw, h, kind: 'arrow' });
}

// Zone du titre sur l'écran d'accueil (appui long = écran caché du journal)
export function titleRect(view) {
  return { x: view.w * 0.25, y: 0, w: view.w * 0.5, h: view.h * 0.17 };
}

// Position des boutons de chaque écran (sert au dessin ET aux touchers)
export function menuButtons(state, view, m) {
  const u = unit(view);
  const bw = 200 * u, bh = Math.min(44 * u, view.h * 0.11);
  const cx = view.w / 2 - bw / 2;
  const list = [];

  if (state === 'menu') {
    const rh = Math.min(36 * u, view.h * 0.088), rgap = rh * 0.2;
    const rw = Math.min(view.w - 40, 330 * u);
    const x0 = view.w / 2 - rw / 2;
    let y = view.h * 0.2;
    for (const row of SETTING_ROWS) {
      settingRow(list, row.key, row.label, settingValue(row.key, m.settings), x0, y, rw, rh);
      y += rh + rgap;
    }
    list.push({ id: 'play', label: 'JOUER', x: cx, y: y + rgap * 0.5, w: bw, h: bh, kind: 'primary' });
    // Barre du bas : les autres écrans
    const done = m.profile.missions.list.filter((x) => x.done).length;
    const extra = [['missions', `Missions ${done}/${m.profile.missions.list.length}`],
                   ['style', 'Style'], ['stats', 'Stats'], ['options', 'Options']];
    const sh = Math.min(36 * u, view.h * 0.09), sw = Math.min(130 * u, (view.w - 40) / extra.length - 8);
    let sx = view.w / 2 - (extra.length * (sw + 8) - 8) / 2;
    for (const [id, label] of extra) {
      list.push({ id, label, x: sx, y: view.h - sh - 8 * u, w: sw, h: sh, kind: 'small' });
      sx += sw + 8;
    }
    return list;
  }

  if (state === 'paused') {
    const g2 = bh * 0.25, y0 = view.h * 0.27;
    const b2 = (id, label, i, kind) => ({ id, label, x: cx, y: y0 + i * (bh + g2), w: bw, h: bh, kind });
    return [
      b2('resume', 'Reprendre', 0, 'primary'),
      b2('restart', 'Recommencer', 1),
      b2('options', 'Options', 2),
      b2('mainmenu', 'Menu principal', 3),
    ];
  }

  if (state === 'options') {
    // Deux colonnes de réglages + bouton Retour
    const colW = Math.min((view.w - 60) / 2, 330 * u);
    const rh = Math.min(38 * u, view.h * 0.105), gap = rh * 0.22;
    const xL = view.w / 2 - colW - 10, xR = view.w / 2 + 10;
    const perCol = Math.ceil(OPTION_ROWS.length / 2);
    OPTION_ROWS.forEach((row, i) => {
      const x = i < perCol ? xL : xR;
      const y = view.h * 0.2 + (i % perCol) * (rh + gap);
      settingRow(list, `opt:${row.key}`, row.label, row.text(m.options[row.key]), x, y, colW, rh);
    });
    list.push({ id: 'back', label: 'Retour', x: cx, y: view.h - bh - 12 * u, w: bw, h: bh, kind: 'primary' });
    return list;
  }

  if (state === 'missions') {
    list.push({ id: 'back', label: 'Retour', x: cx, y: view.h - bh - 12 * u, w: bw, h: bh, kind: 'primary' });
    return list;
  }

  if (state === 'style') {
    // Réglages à droite, aperçu du personnage à gauche
    const rw = Math.min(view.w * 0.5, 330 * u);
    const rh = Math.min(38 * u, view.h * 0.105), gap = rh * 0.25;
    const x0 = view.w * 0.45;
    COSMETIC_TYPES.forEach((t, i) => {
      const item = cosmetic(t.key, m.stylePreview[t.key]);
      const lock = isUnlocked(item, m.profile) ? '' : ` 🔒 niv. ${item.level}`;
      settingRow(list, `cos:${t.key}`, t.label, item.name + lock, x0, view.h * 0.24 + i * (rh + gap), rw, rh);
    });
    list.push({ id: 'back', label: 'Retour', x: cx, y: view.h - bh - 12 * u, w: bw, h: bh, kind: 'primary' });
    return list;
  }

  if (state === 'journal') {
    const w3 = Math.min(170 * u, (view.w - 50) / 2), y = view.h - bh - 10 * u;
    list.push({ id: 'journal-clear', label: 'Effacer', x: view.w / 2 - w3 - 6, y, w: w3, h: bh });
    list.push({ id: 'back', label: 'Retour', x: view.w / 2 + 6, y, w: w3, h: bh, kind: 'primary' });
    return list;
  }

  if (state === 'stats') {
    const w3 = Math.min(150 * u, (view.w - 60) / 3), y = view.h - bh - 12 * u;
    const x3 = view.w / 2 - (w3 * 3 + 16) / 2;
    list.push({ id: 'export', label: 'Exporter', x: x3, y, w: w3, h: bh });
    list.push({ id: 'import', label: 'Importer', x: x3 + w3 + 8, y, w: w3, h: bh });
    list.push({ id: 'back', label: 'Retour', x: x3 + 2 * (w3 + 8), y, w: w3, h: bh, kind: 'primary' });
    return list;
  }

  if (state === 'over') {
    const w2 = bw * 0.9, y = view.h - bh - 12 * u;
    return [
      { id: 'replay', label: 'Rejouer', x: view.w / 2 - w2 - 6 * u, y, w: w2, h: bh, kind: 'primary' },
      { id: 'mainmenu', label: 'Menu', x: view.w / 2 + 6 * u, y, w: w2, h: bh },
    ];
  }
  return list;
}

// Renvoie l'id du bouton touché, ou null
export function hitMenu(buttons, tap) {
  // Touche Entrée / Espace = bouton principal de l'écran
  if (tap.key) {
    const main = buttons.find((b) => b.kind === 'primary');
    return main ? main.id : null;
  }
  for (const b of buttons) {
    if (tap.x >= b.x && tap.x <= b.x + b.w && tap.y >= b.y && tap.y <= b.y + b.h) return b.id;
  }
  return null;
}

function drawButtons(ctx, buttons, u) {
  ctx.textBaseline = 'middle';
  for (const b of buttons) {
    if (b.kind === 'arrow') {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      roundedPath(ctx, b.x, b.y, b.w, b.h, 8 * u);
      ctx.fill();
      ctx.font = font(14 * u);
      ctx.fillStyle = '#ffb347';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    } else if (b.kind === 'setting') {
      ctx.fillStyle = 'rgba(20,28,52,0.85)';
      roundedPath(ctx, b.x, b.y, b.w, b.h, 8 * u);
      ctx.fill();
      ctx.font = font(10 * u, false);
      ctx.fillStyle = '#aab4d4';
      ctx.textAlign = 'left';
      ctx.fillText(b.caption, b.x + 10 * u, b.y + b.h / 2);
      ctx.font = font(14 * u);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.fillText(b.label, b.x + b.w - 10 * u, b.y + b.h / 2 + 1);
    } else {
      const primary = b.kind === 'primary';
      ctx.fillStyle = primary ? '#ffb347' : b.kind === 'small' ? 'rgba(58,74,107,0.9)' : '#3a4a6b';
      roundedPath(ctx, b.x, b.y, b.w, b.h, 10 * u);
      ctx.fill();
      ctx.fillStyle = primary ? '#1b2440' : '#fff';
      ctx.font = font((b.kind === 'small' ? 13 : 17) * u);
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    }
  }
}

export function drawMenu(ctx, state, view, m) {
  const u = unit(view);
  const cx = view.w / 2;
  const game = m.game;
  ctx.fillStyle = 'rgba(10,14,28,0.78)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (state === 'menu') {
    ctx.fillStyle = '#ffb347';
    ctx.font = font(Math.min(36 * u, view.h * 0.1));
    ctx.fillText('JET ARENA', cx, view.h * 0.09);
    ctx.fillStyle = '#aab4d4';
    ctx.font = font(10 * u, false);
    const [mv, am] = m.options.leftHanded ? ['droit', 'gauche'] : ['gauche', 'droit'];
    ctx.fillText(`Pouce ${mv} : bouger / voler   ·   Pouce ${am} : viser / tirer   ·   ` +
                 'Clavier : ZQSD + souris', cx, view.h * 0.16);
  }

  if (state === 'menu') drawLevelBadge(ctx, view, m.profile, u);

  if (state === 'paused') {
    ctx.fillStyle = '#fff';
    ctx.font = font(28 * u);
    ctx.fillText('Pause', cx, view.h * 0.15);
  }

  if (state === 'missions') drawMissions(ctx, view, m.profile, u);
  if (state === 'style') drawStyle(ctx, view, m, u);
  if (state === 'stats') drawStats(ctx, view, m.profile, u);
  if (state === 'journal') drawJournal(ctx, view, m.journal, u);

  if (state === 'options') {
    ctx.fillStyle = '#fff';
    ctx.font = font(24 * u);
    ctx.fillText('Options', cx, view.h * 0.1);
  }

  if (state === 'over') {
    ctx.fillStyle = '#ffb347';
    ctx.font = font(28 * u);
    const [first, second] = ranking(game.fighters);
    let title = 'Fin de la partie';
    let rows = ranking(game.fighters);
    if (game.teams) {
      const [s0, s1] = teamScores(game.fighters);
      const T = CONFIG.teams;
      title = s0 === s1 ? 'Égalité !' : (s0 > s1 ? `Victoire des ${T.names[0]} !` : `Victoire des ${T.names[1]}…`);
      ctx.fillStyle = s0 === s1 ? '#fff' : T.colors[s0 > s1 ? 0 : 1];
      // classement regroupé par équipe
      rows = [...rows].sort((a, b) => a.team - b.team);
    } else if (first === game.player) {
      title = second && second.kills === first.kills ? 'Égalité en tête !' : 'Victoire !';
    }
    ctx.fillText(title, cx, 26 * u);
    if (game.teams) {
      const [s0, s1] = teamScores(game.fighters);
      ctx.font = font(13 * u, false);
      ctx.fillStyle = '#dfe6ff';
      ctx.fillText(`${CONFIG.teams.names[0]} ${s0}  —  ${s1} ${CONFIG.teams.names[1]}`, cx, 48 * u);
    }

    // Tableau du classement
    const top = game.teams ? 70 * u : 60 * u;
    const rowH = Math.min(26 * u, (view.h - top - 70 * u) / (rows.length + 1));
    // (avec un résumé d'XP : le tableau passe à gauche, l'XP à droite)
    const tw = m.summary ? Math.min(view.w * 0.55 - 30, 400 * u) : Math.min(view.w - 40, 420 * u);
    const x0 = m.summary ? Math.max(20, view.safeL + 16) : cx - tw / 2;
    if (m.summary) drawXpPanel(ctx, view, m, u, x0 + tw + 24, top - 10 * u);
    let y = top;
    ctx.font = font(12 * u);
    ctx.fillStyle = '#aab4d4';
    ctx.textAlign = 'left';
    ctx.fillText('#', x0 + 8, y);
    ctx.fillText('Joueur', x0 + 40 * u, y);
    ctx.textAlign = 'right';
    ctx.fillText('Éliminations', x0 + tw - 90 * u, y);
    ctx.fillText('Morts', x0 + tw - 8, y);
    const hill = game.mode === 'hill';
    if (hill) ctx.fillText('Points', x0 + tw - 175 * u, y);
    rows.forEach((f, i) => {
      y += rowH;
      if (f === game.player) {
        ctx.fillStyle = 'rgba(255,179,71,0.18)';
        ctx.fillRect(x0, y - rowH / 2, tw, rowH);
      }
      ctx.font = font(14 * u, f === game.player);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(i + 1), x0 + 8, y);
      ctx.fillStyle = game.teams ? CONFIG.teams.colors[f.team] : f.color;
      ctx.fillText(f.tag ? `${f.tag} ${f.name}` : f.name, x0 + 40 * u, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(f.kills), x0 + tw - 90 * u, y);
      ctx.fillText(String(f.deaths), x0 + tw - 8, y);
      if (hill) {
        ctx.fillStyle = '#ffe066';
        ctx.fillText(String(Math.floor(f.hillPoints)), x0 + tw - 175 * u, y);
      }
    });
  }

  drawButtons(ctx, menuButtons(state, view, m), u);
}

// ---------------------------------------------------------------------
// Écrans de progression
// ---------------------------------------------------------------------

// Niveau du joueur en haut à gauche de l'accueil
function drawLevelBadge(ctx, view, profile, u) {
  const L = levelInfo(profile.xp);
  const x = view.safeL + 14 * u, y = 12 * u, w = 120 * u;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe066';
  ctx.font = font(15 * u);
  ctx.fillText(`Niveau ${L.level}`, x, y + 6 * u);
  bar(ctx, x, y + 16 * u, w, 7 * u, L.ratio, '#ffe066');
  ctx.font = font(9 * u, false);
  ctx.fillStyle = '#aab4d4';
  ctx.fillText(L.level >= CONFIG.progression.maxLevel ? 'niveau max' : `${Math.floor(L.rest)} / ${L.need} XP`,
               x, y + 32 * u);
  ctx.textAlign = 'center';
}

function drawMissions(ctx, view, profile, u) {
  const cx = view.w / 2;
  ctx.fillStyle = '#fff';
  ctx.font = font(24 * u);
  ctx.fillText('Missions du jour', cx, view.h * 0.1);
  ctx.font = font(11 * u, false);
  ctx.fillStyle = '#aab4d4';
  ctx.fillText(`Nouvelles missions dans ${timeUntilTomorrow()} · elles comptent à la fin de chaque partie terminée`,
               cx, view.h * 0.18);
  const w = Math.min(view.w - 40, 460 * u), x = cx - w / 2;
  const rh = Math.min(56 * u, view.h * 0.17);
  profile.missions.list.forEach((mi, i) => {
    const def = missionDef(mi.id);
    if (!def) return;
    const y = view.h * 0.25 + i * (rh + 8 * u);
    ctx.fillStyle = mi.done ? 'rgba(81,207,102,0.18)' : 'rgba(20,28,52,0.85)';
    roundedPath(ctx, x, y, w, rh, 10 * u);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = font(14 * u);
    ctx.fillText((mi.done ? '✓ ' : '') + missionText(def), x + 12 * u, y + rh * 0.32);
    bar(ctx, x + 12 * u, y + rh * 0.62, w * 0.6, 8 * u, mi.progress / def.n, mi.done ? '#51cf66' : '#ffb347');
    ctx.font = font(11 * u, false);
    ctx.fillStyle = '#dfe6ff';
    ctx.fillText(`${mi.progress} / ${def.n}`, x + 20 * u + w * 0.6, y + rh * 0.62 + 4 * u);
    ctx.textAlign = 'right';
    ctx.font = font(14 * u);
    ctx.fillStyle = '#ffe066';
    ctx.fillText(`+${def.xp} XP`, x + w - 12 * u, y + rh * 0.32);
  });
  ctx.textAlign = 'center';
}

// Personnage d'aperçu (réutilisé)
let previewFighter = null;

function drawStyle(ctx, view, m, u) {
  const cx = view.w / 2;
  ctx.fillStyle = '#fff';
  ctx.font = font(24 * u);
  ctx.fillText('Style', cx, view.h * 0.1);
  ctx.font = font(11 * u, false);
  ctx.fillStyle = '#aab4d4';
  ctx.fillText('Apparence seulement : aucun avantage en jeu. Monte de niveau pour débloquer plus de styles.',
               cx, view.h * 0.17);
  // Aperçu agrandi du personnage, avec sa traînée
  const pv = m.stylePreview;
  if (!previewFighter) previewFighter = new Fighter({ name: 'Toi', color: '#fff' });
  const f = previewFighter;
  f.color = cosmetic('color', pv.color).color;
  f.pattern = pv.pattern;
  f.alive = true;
  f.x = 0; f.y = 0; f.grounded = false; f.jetting = true;
  f.aimAngle = -0.3; f.facing = 1;
  const k = Math.min(3 * u, view.h / 160);
  const px = view.w * 0.24, py = view.h * 0.5;
  // traînée : quelques bulles de la couleur choisie
  const tr = cosmetic('trail', pv.trail);
  const t = performance.now() / 1000;
  for (let i = 0; i < 6; i++) {
    const age = (t * 1.5 + i / 6) % 1;
    ctx.globalAlpha = 0.6 * (1 - age);
    ctx.fillStyle = tr.rainbow ? `hsl(${(t * 240 + i * 60) % 360},90%,65%)` : tr.color;
    ctx.beginPath();
    ctx.arc(px - 14 * k, py + (10 + age * 30) * k, (2 + age * 5) * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(px - (f.w / 2) * k, py - (f.h / 2) * k);
  ctx.scale(k, k);
  f.draw(ctx, false);
  ctx.restore();
}

function drawStats(ctx, view, profile, u) {
  const cx = view.w / 2;
  const S = profile.stats;
  ctx.fillStyle = '#fff';
  ctx.font = font(24 * u);
  ctx.fillText('Statistiques', cx, view.h * 0.1);
  const fav = favoriteWeapon(profile);
  const rows = [
    ['Parties terminées', S.games],
    ['Victoires', S.wins],
    ['Éliminations', S.kills],
    ['Morts', S.deaths],
    ['Ratio éliminations / morts', S.deaths ? (S.kills / S.deaths).toFixed(2) : String(S.kills)],
    ['Meilleure série', S.bestStreak],
    ['Arme préférée', fav ? weaponDef(fav).name : '—'],
    ['Temps de jeu', S.playTime >= 3600
      ? `${Math.floor(S.playTime / 3600)} h ${String(Math.floor(S.playTime % 3600 / 60)).padStart(2, '0')}`
      : formatTime(S.playTime)],
  ];
  const w = Math.min(view.w - 40, 520 * u), x = cx - w / 2;
  const colW = w / 2 - 10 * u;
  const rh = Math.min(30 * u, view.h * 0.08);
  rows.forEach(([label, value], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const rx = x + col * (colW + 20 * u), ry = view.h * 0.2 + row * (rh + 8 * u);
    ctx.fillStyle = 'rgba(20,28,52,0.85)';
    roundedPath(ctx, rx, ry, colW, rh, 8 * u);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = font(11 * u, false);
    ctx.fillStyle = '#aab4d4';
    ctx.fillText(label, rx + 10 * u, ry + rh / 2);
    ctx.textAlign = 'right';
    ctx.font = font(14 * u);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(value), rx + colW - 10 * u, ry + rh / 2 + 1);
  });
  ctx.textAlign = 'center';
  ctx.font = font(10 * u, false);
  ctx.fillStyle = '#aab4d4';
  ctx.fillText('Sauvegarde de secours : « Exporter » donne un texte à garder, « Importer » le restaure.',
               cx, view.h * 0.2 + 4 * (rh + 8 * u) + 10 * u);
}

// Panneau d'XP sur l'écran de fin : lignes gagnées + barre de niveau animée
function drawXpPanel(ctx, view, m, u, x, y) {
  const sm = m.summary;
  const w = view.w - x - Math.max(20, view.safeR + 16);
  if (w < 120) return;
  ctx.fillStyle = 'rgba(20,28,52,0.85)';
  const h = view.h - y - 70 * u;
  roundedPath(ctx, x, y, w, h, 10 * u);
  ctx.fill();
  // La barre se remplit en 1,2 s, de l'ancienne XP à la nouvelle
  const t = Math.min(1, m.overTime / 1.2);
  const ease = 1 - (1 - t) * (1 - t);
  const xpNow = sm.xpBefore + (sm.xpAfter - sm.xpBefore) * ease;
  const L = levelInfo(xpNow);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe066';
  ctx.font = font(15 * u);
  ctx.fillText(`Niveau ${L.level}`, x + 12 * u, y + 16 * u);
  ctx.textAlign = 'right';
  ctx.fillText(`+${Math.round(sm.total * ease)} XP`, x + w - 12 * u, y + 16 * u);
  bar(ctx, x + 12 * u, y + 28 * u, w - 24 * u, 9 * u, L.ratio, '#ffe066');
  if (sm.after.level > sm.before.level && t >= 1) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#51cf66';
    ctx.font = font(13 * u);
    ctx.fillText('Niveau supérieur !', x + w / 2, y + 50 * u);
  }
  // Détail des gains (puis déblocages)
  let ly = y + 68 * u;
  const lines = sm.lines.map((l) => [l.label, `+${l.xp}`, '#dfe6ff'])
    .concat(sm.unlocked.map((name) => [`Débloqué : ${name}`, '★', '#51cf66']));
  for (const [label, val, color] of lines) {
    if (ly > y + h - 8 * u) break;
    ctx.textAlign = 'left';
    ctx.font = font(11 * u, false);
    ctx.fillStyle = color;
    let txt = label;
    while (ctx.measureText(txt).width > w - 70 * u && txt.length > 4) txt = txt.slice(0, -2);
    if (txt !== label) txt += '…';
    ctx.fillText(txt, x + 12 * u, ly);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe066';
    ctx.fillText(val, x + w - 12 * u, ly);
    ly += 16 * u;
  }
  ctx.textAlign = 'center';
}

// Écran caché (appui long sur le titre) : le journal local des parties
function drawJournal(ctx, view, journal, u) {
  const J = journalSummary(journal);
  const cx = view.w / 2;
  const dur = (sec) => `${Math.floor(sec / 60)} min ${String(Math.round(sec % 60)).padStart(2, '0')}`;
  ctx.fillStyle = '#fff';
  ctx.font = font(20 * u);
  ctx.fillText('Journal de bêta (sur cet appareil)', cx, view.h * 0.07);
  const left = Math.max(16, view.safeL + 12), colW = (view.w - left * 2) / 2 - 8;
  let y = view.h * 0.16;
  const line = (x, label, value, color = '#fff') => {
    ctx.textAlign = 'left';
    ctx.font = font(11 * u, false);
    ctx.fillStyle = '#aab4d4';
    ctx.fillText(label, x, y);
    ctx.textAlign = 'right';
    ctx.font = font(12 * u);
    ctx.fillStyle = color;
    ctx.fillText(String(value), x + colW, y);
  };
  // Colonne de gauche : chiffres clés
  const rows = [
    ['Parties lancées', J.total],
    ['Terminées', J.done],
    ['Abandonnées avant la fin', `${J.quit} (${J.quitRate} %)`, J.quitRate > 30 ? '#ff8787' : '#fff'],
    ['Durée moyenne (terminées)', dur(J.avgDone)],
    ['Durée moyenne avant abandon', dur(J.avgQuit)],
  ];
  for (const [label, value, color] of rows) { line(left, label, value, color); y += 17 * u; }
  y += 6 * u;
  const modeNames = { ffa: 'Chacun pour soi', teams: 'Équipes', hill: 'Roi de la colline' };
  for (const [k, n] of Object.entries(J.byMode)) { line(left, `Mode ${modeNames[k] || k}`, n); y += 15 * u; }
  for (const [k, n] of Object.entries(J.byMap)) { line(left, `Carte ${MAPS[k] ? MAPS[k].name : k}`, n); y += 15 * u; }
  // Colonne de droite : dernières parties
  const rx = left + colW + 16;
  let ry = view.h * 0.16;
  ctx.textAlign = 'left';
  ctx.font = font(11 * u);
  ctx.fillStyle = '#ffe066';
  ctx.fillText('Dernières parties', rx, ry);
  ry += 17 * u;
  ctx.font = font(10 * u, false);
  for (const e of J.last) {
    const d = new Date(e.start);
    const when = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ` +
                 `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
    ctx.fillStyle = e.status === 'terminée' ? '#dfe6ff' : '#ff8787';
    const map = MAPS[e.map] ? MAPS[e.map].name : '?';
    ctx.fillText(`${when}  ${modeNames[e.mode] || e.mode} · ${map} · ${dur(e.duration)} · ${e.status}`, rx, ry);
    ry += 15 * u;
  }
  if (!J.last.length) {
    ctx.fillStyle = '#aab4d4';
    ctx.fillText('Aucune partie pour l\'instant.', rx, ry);
  }
  ctx.textAlign = 'center';
}
