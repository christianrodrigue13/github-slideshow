// =====================================================================
// menus.js — Les écrans de menu (accueil, pause, options, fin de partie…).
// Chaque écran fournit la liste de ses boutons (servant au dessin ET
// aux touchers) puis se dessine. Tout est en pixels CSS.
// m = { game, settings, options } : ce dont les écrans ont besoin.
// =====================================================================

import { CONFIG } from './config.js';
import { MAPS } from './map.js';
import { unit, font, roundedPath } from './ui.js';
import { ranking, teamScores } from './match.js';
import { OPTION_ROWS } from './options.js';

// Lignes de réglage du menu principal
const SETTING_ROWS = [
  { key: 'map', label: 'Carte' },
  { key: 'mode', label: 'Mode' },
  { key: 'difficulty', label: 'Difficulté' },
  { key: 'bots', label: 'Bots' },
];

export const MODE_NAMES = { ffa: 'Chacun pour soi', teams: 'Équipes' };

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
    const extra = [['options', 'Options']];
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

  if (state === 'paused') {
    ctx.fillStyle = '#fff';
    ctx.font = font(28 * u);
    ctx.fillText('Pause', cx, view.h * 0.15);
  }

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
    const tw = Math.min(view.w - 40, 420 * u);
    const x0 = cx - tw / 2;
    let y = top;
    ctx.font = font(12 * u);
    ctx.fillStyle = '#aab4d4';
    ctx.textAlign = 'left';
    ctx.fillText('#', x0 + 8, y);
    ctx.fillText('Joueur', x0 + 40 * u, y);
    ctx.textAlign = 'right';
    ctx.fillText('Éliminations', x0 + tw - 90 * u, y);
    ctx.fillText('Morts', x0 + tw - 8, y);
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
      ctx.fillText(f.name, x0 + 40 * u, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(f.kills), x0 + tw - 90 * u, y);
      ctx.fillText(String(f.deaths), x0 + tw - 8, y);
    });
  }

  drawButtons(ctx, menuButtons(state, view, m), u);
}
