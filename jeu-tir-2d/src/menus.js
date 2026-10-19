// =====================================================================
// menus.js — Les écrans de menu (accueil, pause, fin de partie…).
// Chaque écran fournit la liste de ses boutons (servant au dessin ET
// aux touchers) puis se dessine. Tout est en pixels CSS.
// =====================================================================

import { CONFIG } from './config.js';
import { MAPS } from './map.js';
import { unit, font } from './ui.js';
import { ranking, teamScores } from './match.js';

// Lignes de réglage du menu principal
const SETTING_ROWS = [
  { key: 'map', label: 'Carte' },
  { key: 'mode', label: 'Mode' },
  { key: 'difficulty', label: 'Difficulté' },
  { key: 'bots', label: 'Bots' },
];

function settingValue(key, settings) {
  if (key === 'map') return MAPS[settings.map].name;
  if (key === 'mode') return settings.mode === 'teams' ? 'Équipes' : 'Chacun pour soi';
  if (key === 'difficulty') return CONFIG.difficulties[settings.difficulty].label;
  return String(settings.bots);
}

// Position des boutons de chaque menu (sert au dessin ET aux clics)
export function menuButtons(state, view, game) {
  const u = unit(view);
  const bw = 200 * u, bh = 44 * u, gap = 12 * u;
  const cx = view.w / 2 - bw / 2;
  const btn = (id, label, y) => ({ id, label, x: cx, y, w: bw, h: bh });
  if (state === 'menu') {
    // Chaque réglage : [◀] [valeur (touche = suivant)] [▶]
    const list = [];
    const rh = Math.min(40 * u, view.h * 0.105), rgap = rh * 0.2;
    const rw = Math.min(view.w - 40, 330 * u), aw = rh * 1.1;
    const x0 = view.w / 2 - rw / 2;
    let y = view.h * 0.27;
    for (const row of SETTING_ROWS) {
      list.push({ id: `${row.key}:-1`, label: '◀', x: x0, y, w: aw, h: rh, small: true });
      list.push({ id: `${row.key}:1`, label: settingValue(row.key, game.settings), caption: row.label,
                  x: x0 + aw + 4, y, w: rw - 2 * aw - 8, h: rh, setting: true });
      list.push({ id: `${row.key}:1`, label: '▶', x: x0 + rw - aw, y, w: aw, h: rh, small: true });
      y += rh + rgap;
    }
    list.push({ ...btn('play', 'JOUER', y + rgap), h: Math.min(bh, view.h * 0.12) });
    return list;
  }
  if (state === 'paused') {
    const h2 = Math.min(bh, view.h * 0.115), g2 = h2 * 0.25;
    const y0 = view.h * 0.27;
    const b2 = (id, label, i) => ({ id, label, x: cx, y: y0 + i * (h2 + g2), w: bw, h: h2 });
    return [
      b2('resume', 'Reprendre', 0),
      b2('restart', 'Recommencer', 1),
      b2('sound', game.sound.muted ? 'Son : coupé' : 'Son : activé', 2),
      b2('mainmenu', 'Menu principal', 3),
    ];
  }
  if (state === 'over') {
    const w2 = bw * 0.9;
    return [
      { id: 'replay', label: 'Rejouer', x: view.w / 2 - w2 - 6 * u, y: view.h - bh - 12 * u, w: w2, h: bh },
      { id: 'mainmenu', label: 'Menu', x: view.w / 2 + 6 * u, y: view.h - bh - 12 * u, w: w2, h: bh },
    ];
  }
  return [];
}

// Renvoie l'id du bouton touché, ou null
export function hitMenu(buttons, tap) {
  // Touche Entrée / Espace = premier bouton
  if (tap.key) {
    const main = buttons.find((b) => ['play', 'resume', 'replay'].includes(b.id));
    return main ? main.id : null;
  }
  for (const b of buttons) {
    if (tap.x >= b.x && tap.x <= b.x + b.w && tap.y >= b.y && tap.y <= b.y + b.h) return b.id;
  }
  return null;
}

function drawButtons(ctx, buttons, u) {
  for (const b of buttons) {
    if (b.setting || b.small) {
      ctx.fillStyle = b.small ? 'rgba(255,255,255,0.10)' : 'rgba(20,28,52,0.85)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, 8 * u) : ctx.rect(b.x, b.y, b.w, b.h);
      ctx.fill();
      ctx.textBaseline = 'middle';
      if (b.setting) {
        ctx.font = font(10 * u, false);
        ctx.fillStyle = '#aab4d4';
        ctx.textAlign = 'left';
        ctx.fillText(b.caption, b.x + 10 * u, b.y + b.h / 2);
        ctx.font = font(15 * u);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, b.x + b.w / 2 + 20 * u, b.y + b.h / 2 + 1);
      } else {
        ctx.font = font(14 * u);
        ctx.fillStyle = '#ffb347';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
      }
      continue;
    }
    ctx.fillStyle = b.id === 'play' || b.id === 'replay' || b.id === 'resume' ? '#ffb347' : '#3a4a6b';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, 10 * u) : ctx.rect(b.x, b.y, b.w, b.h);
    ctx.fill();
    ctx.fillStyle = b.id === 'play' || b.id === 'replay' || b.id === 'resume' ? '#1b2440' : '#fff';
    ctx.font = font(17 * u);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  }
}

export function drawMenu(ctx, state, view, game) {
  const u = unit(view);
  const cx = view.w / 2;
  ctx.fillStyle = 'rgba(10,14,28,0.78)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (state === 'menu') {
    ctx.fillStyle = '#ffb347';
    ctx.font = font(Math.min(40 * u, view.h * 0.11));
    ctx.fillText('JET ARENA', cx, view.h * 0.11);
    ctx.fillStyle = '#aab4d4';
    ctx.font = font(11 * u, false);
    ctx.fillText('Pouce gauche : bouger / voler   ·   Pouce droit : viser / tirer   ·   ' +
                 'Clavier : ZQSD + souris', cx, view.h * 0.205);
  }

  if (state === 'paused') {
    ctx.fillStyle = '#fff';
    ctx.font = font(28 * u);
    ctx.fillText('Pause', cx, view.h * 0.15);
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

  drawButtons(ctx, menuButtons(state, view, game), u);
}
