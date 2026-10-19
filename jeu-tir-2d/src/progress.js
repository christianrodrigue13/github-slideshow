// =====================================================================
// progress.js — Progression du joueur, sauvegardée sur l'appareil :
// XP et niveaux, missions du jour, cosmétiques débloqués, statistiques.
// Les valeurs (XP, missions, cosmétiques) sont dans config.js.
// =====================================================================

import { CONFIG } from './config.js';
import { load, save } from './save.js';

const PR = CONFIG.progression;
const COS = CONFIG.cosmetics;

const DEFAULT_PROFILE = {
  xp: 0,
  missions: { day: '', list: [] },                 // [{ id, progress, done }]
  cosmetics: { color: 'blanc', pattern: 'uni', trail: 'fumee',
               skin: 'claire', hair: 'court', hairColor: 'brun', face: 'aucun' },
  stats: { games: 0, wins: 0, kills: 0, deaths: 0, bestStreak: 0, playTime: 0, weaponKills: {} },
};

export function loadProfile() {
  const p = load('profile', DEFAULT_PROFILE);
  // (anciennes sauvegardes : on ajoute les choix d'apparence qui n'existaient pas)
  p.cosmetics = { ...DEFAULT_PROFILE.cosmetics, ...p.cosmetics };
  refreshMissions(p);
  return p;
}

export function saveProfile(p) {
  save('profile', p);
}

// ---------------------------------------------------------------------
// Niveaux
// ---------------------------------------------------------------------

// XP nécessaire pour passer du niveau "level" au suivant
export function xpForLevel(level) {
  return PR.levelBase + PR.levelStep * (level - 1);
}

// Niveau atteint avec "xp" points, et avancement vers le suivant (0 à 1)
export function levelInfo(xp) {
  let level = 1, rest = xp;
  while (level < PR.maxLevel && rest >= xpForLevel(level)) {
    rest -= xpForLevel(level);
    level++;
  }
  const need = xpForLevel(level);
  return { level, rest, need, ratio: level >= PR.maxLevel ? 1 : rest / need };
}

// ---------------------------------------------------------------------
// Missions du jour
// ---------------------------------------------------------------------

// Date du jour sur l'appareil, ex. "2026-10-20"
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Nouveau jour → 3 nouvelles missions, tirées "au hasard" à partir de la date
// (le même jour donne toujours les mêmes missions, même si on recharge)
export function refreshMissions(p) {
  const day = today();
  if (p.missions.day === day && p.missions.list.length) return;
  let seed = 0;
  for (const ch of day) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pool = PR.missions.map((m) => m.id);
  const list = [];
  while (list.length < PR.missionsPerDay && pool.length) {
    const id = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    list.push({ id, progress: 0, done: false });
  }
  p.missions = { day, list };
  saveProfile(p);
}

export function missionDef(id) {
  return PR.missions.find((m) => m.id === id);
}

export function missionText(def) {
  return def.text.replace('{n}', def.n);
}

// Ce qu'une partie terminée apporte à chaque mission
function missionGain(id, st, r) {
  switch (id) {
    case 'kills': return st.kills;
    case 'win': return r.won ? 1 : 0;
    case 'games': return 1;
    case 'shotgun': return st.weaponKills.shotgun || 0;
    case 'sniper': return st.weaponKills.sniper || 0;
    case 'explosive': return st.explosiveKills;
    case 'air': return st.airKills;
    case 'pickups': return st.pickups;
    case 'streak': return st.bestStreak;          // meilleure série de la partie
    case 'teams': return r.mode === 'teams' ? 1 : 0;
    case 'hill': return Math.floor(st.hillTime);
    default: return 0;
  }
}

// Temps restant avant les nouvelles missions (texte)
export function timeUntilTomorrow() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const min = Math.ceil((next - now) / 60000);
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

// ---------------------------------------------------------------------
// Cosmétiques
// ---------------------------------------------------------------------
export const COSMETIC_TYPES = [
  { key: 'skin', label: 'Peau', list: COS.skins },
  { key: 'hair', label: 'Coiffure', list: COS.hairs },
  { key: 'hairColor', label: 'Cheveux', list: COS.hairColors },
  { key: 'face', label: 'Visage', list: COS.faces },
  { key: 'color', label: 'Veste', list: COS.colors },
  { key: 'pattern', label: 'Motif', list: COS.patterns },
  { key: 'trail', label: 'Traînée', list: COS.trails },
];

export function cosmetic(key, id) {
  const t = COSMETIC_TYPES.find((c) => c.key === key);
  return t.list.find((x) => x.id === id) || t.list[0];
}

// Apparence prête à l'emploi (couleurs, motif, traînée…) à partir des choix
// de l'écran Style (identifiants). Sert aussi pour les invités entre amis.
export function resolveCosmetics(c = {}) {
  return { color: cosmetic('color', c.color).color, pattern: cosmetic('pattern', c.pattern).id,
           trail: cosmetic('trail', c.trail),
           skin: c.skin, hair: c.hair, hairColor: c.hairColor, face: c.face };
}

export function isUnlocked(item, p) {
  return levelInfo(p.xp).level >= item.level;
}

// ---------------------------------------------------------------------
// Fin de partie : XP, missions, statistiques
// r = { won, mode, duration, kills, hillPoints, stats (statistiques de la partie) }
// Renvoie le résumé affiché sur l'écran de fin.
// ---------------------------------------------------------------------
export function finishMatch(p, r) {
  refreshMissions(p);
  const X = PR.xp, st = r.stats;
  const before = levelInfo(p.xp);
  const lines = [{ label: 'Partie terminée', xp: X.participation }];
  if (st.kills) lines.push({ label: `Éliminations (${st.kills})`, xp: st.kills * X.perKill });
  if (r.won) lines.push({ label: 'Victoire', xp: X.victory });
  if (r.hillPoints >= 1) lines.push({ label: `Colline (${Math.floor(r.hillPoints)} pts)`, xp: Math.round(r.hillPoints * X.perHillPoint) });

  // Missions du jour
  const completed = [];
  for (const m of p.missions.list) {
    if (m.done) continue;
    const def = missionDef(m.id);
    if (!def) continue;
    const gain = missionGain(m.id, st, r);
    // (série et colline : on garde le meilleur, les autres s'additionnent)
    m.progress = m.id === 'streak' ? Math.max(m.progress, gain) : m.progress + gain;
    if (m.progress >= def.n) {
      m.progress = def.n;
      m.done = true;
      completed.push(def);
      lines.push({ label: `Mission : ${missionText(def)}`, xp: def.xp });
    }
  }

  const total = lines.reduce((sum, l) => sum + l.xp, 0);
  p.xp += total;
  const after = levelInfo(p.xp);

  // Cosmétiques débloqués par la montée de niveau
  const unlocked = [];
  for (const t of COSMETIC_TYPES) {
    for (const item of t.list) {
      if (item.level > before.level && item.level <= after.level) unlocked.push(`${t.label} « ${item.name} »`);
    }
  }

  // Statistiques globales
  const S = p.stats;
  S.games++;
  if (r.won) S.wins++;
  S.kills += st.kills;
  S.deaths += st.deaths;
  S.bestStreak = Math.max(S.bestStreak, st.bestStreak);
  S.playTime += r.duration;
  for (const [w, n] of Object.entries(st.weaponKills)) S.weaponKills[w] = (S.weaponKills[w] || 0) + n;

  saveProfile(p);
  return { lines, total, before, after, xpBefore: p.xp - total, xpAfter: p.xp, completed, unlocked };
}

// Arme avec le plus d'éliminations (ou null)
export function favoriteWeapon(p) {
  let best = null, n = 0;
  for (const [w, k] of Object.entries(p.stats.weaponKills)) if (k > n) { best = w; n = k; }
  return best;
}
