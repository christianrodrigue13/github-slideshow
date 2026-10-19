// =====================================================================
// options.js — Les options du joueur (écran Options) : leur liste,
// leurs libellés, le passage à la valeur suivante et la sauvegarde.
// Les valeurs proposées (sensibilités, forces…) sont dans config.js.
// =====================================================================

import { CONFIG } from './config.js';
import { load, save } from './save.js';

const O = CONFIG.options;
const yesNo = { false: 'Non', true: 'Oui' };

// Chaque ligne : clé, libellé, liste des valeurs possibles, texte affiché
export const OPTION_ROWS = [
  { key: 'sensitivity', label: 'Sensibilité visée', values: Object.keys(O.sensitivity),
    text: (v) => ({ basse: 'Basse', moyenne: 'Moyenne', haute: 'Haute' })[v] },
  { key: 'aimAssist', label: 'Aide à la visée', values: Object.keys(O.aimAssist),
    text: (v) => ({ off: 'Désactivée', faible: 'Faible', moyenne: 'Moyenne' })[v] },
  { key: 'autoFire', label: 'Tir automatique', values: [false, true], text: (v) => yesNo[v] },
  { key: 'vibration', label: 'Vibrations', values: [false, true], text: (v) => yesNo[v] },
  { key: 'volume', label: 'Volume', values: O.volumes, text: (v) => `${Math.round(v * 100)} %` },
  { key: 'shake', label: 'Tremblement écran', values: Object.keys(O.shake),
    text: (v) => ({ off: 'Désactivé', faible: 'Faible', normal: 'Normal' })[v] },
  { key: 'leftHanded', label: 'Mode gaucher', values: [false, true], text: (v) => yesNo[v] },
  { key: 'fixedSticks', label: 'Joysticks', values: [false, true],
    text: (v) => (v ? 'Fixes' : 'Flottants') },
  { key: 'graphics', label: 'Qualité graphique', values: Object.keys(O.graphics),
    text: (v) => ({ auto: 'Auto', bas: 'Basse', moyen: 'Moyenne', haut: 'Haute' })[v] },
];

// Charge les options sauvegardées (et corrige une valeur qui n'existe plus)
export function loadOptions() {
  const opts = load('options', O.defaults);
  for (const row of OPTION_ROWS) {
    if (!row.values.includes(opts[row.key])) opts[row.key] = O.defaults[row.key];
  }
  return opts;
}

export function saveOptions(opts) {
  save('options', opts);
}

// Passe à la valeur suivante (dir = 1) ou précédente (dir = -1)
export function cycleOption(opts, key, dir) {
  const row = OPTION_ROWS.find((r) => r.key === key);
  if (!row) return;
  const i = row.values.indexOf(opts[key]);
  opts[key] = row.values[(i + dir + row.values.length) % row.values.length];
  saveOptions(opts);
}

// Valeurs numériques utilisées par le jeu
export const aimAssistStrength = (opts) => O.aimAssist[opts.aimAssist];
export const aimSpeed = (opts) => O.sensitivity[opts.sensitivity];
export const shakeFactor = (opts) => O.shake[opts.shake];
