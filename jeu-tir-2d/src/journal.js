// =====================================================================
// journal.js — Journal local ANONYME des parties (pour la bêta).
// Rien n'est envoyé sur Internet : tout reste sur l'appareil.
// On note : début, mode, carte, difficulté, nombre de bots, durée, et si
// la partie a été terminée ou abandonnée. Écran caché : appui long sur
// le titre du menu principal.
// =====================================================================

import { load, save } from './save.js';

const MAX_ENTRIES = 300;          // on garde les 300 dernières parties

export function loadJournal() {
  const list = load('journal', []);
  // Une partie restée "en cours" = la page a été fermée pendant la partie
  let changed = false;
  for (const e of list) {
    if (e.status === 'en cours') { e.status = 'abandonnée'; changed = true; }
  }
  if (changed) save('journal', list);
  return list;
}

// Une partie commence : on l'inscrit tout de suite (si la page est fermée,
// elle comptera comme abandonnée au prochain lancement)
export function journalStart(list, settings) {
  const entry = { start: Date.now(), mode: settings.mode, map: settings.map,
                  difficulty: settings.difficulty, bots: settings.bots, duration: 0, status: 'en cours' };
  list.push(entry);
  if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES);
  save('journal', list);
  return entry;
}

// Met à jour la durée d'une partie en cours (ex. quand on quitte l'appli)
export function journalTouch(list, entry, duration) {
  if (!entry || entry.status !== 'en cours') return;
  entry.duration = Math.round(duration);
  save('journal', list);
}

// Fin de partie : status = 'terminée' ou 'abandonnée'
export function journalEnd(list, entry, duration, status) {
  if (!entry || entry.status !== 'en cours') return;
  entry.duration = Math.round(duration);
  entry.status = status;
  save('journal', list);
}

export function clearJournal(list) {
  list.length = 0;
  save('journal', list);
}

// Chiffres résumés pour l'écran caché
export function journalSummary(list) {
  const done = list.filter((e) => e.status === 'terminée');
  const quit = list.filter((e) => e.status === 'abandonnée');
  const avg = (arr) => (arr.length ? arr.reduce((s, e) => s + e.duration, 0) / arr.length : 0);
  const count = (key) => {
    const out = {};
    for (const e of list) out[e[key]] = (out[e[key]] || 0) + 1;
    return out;
  };
  return {
    total: list.length,
    done: done.length,
    quit: quit.length,
    quitRate: list.length ? Math.round((100 * quit.length) / list.length) : 0,
    avgDone: avg(done),
    avgQuit: avg(quit),
    byMode: count('mode'),
    byMap: count('map'),
    last: list.slice(-6).reverse(),
  };
}
