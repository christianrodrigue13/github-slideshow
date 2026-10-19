// =====================================================================
// save.js — Sauvegarde sur l'appareil (localStorage).
// Tout est protégé par try/catch : en navigation privée ou si le
// stockage est plein, le jeu continue de marcher (sans mémoriser).
// Rien n'est jamais envoyé sur Internet.
// =====================================================================

const PREFIX = 'jetarena-';

// Clés sauvegardées (et incluses dans la sauvegarde de secours)
export const SAVE_KEYS = ['settings', 'options', 'profile', 'journal'];

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

// Lit une valeur ; si elle manque ou est abîmée, renvoie les valeurs par défaut.
// Les champs absents (ajoutés dans une nouvelle version du jeu) sont complétés.
export function load(key, defaults) {
  let stored = null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw) stored = JSON.parse(raw);
  } catch (_) { /* stockage indisponible ou abîmé : valeurs par défaut */ }
  if (Array.isArray(defaults)) return Array.isArray(stored) ? stored : clone(defaults);
  const out = clone(defaults);
  if (stored && typeof stored === 'object') {
    for (const k of Object.keys(stored)) {
      const d = out[k];
      // un niveau d'objets imbriqués est complété aussi (ex. stats)
      if (d && typeof d === 'object' && !Array.isArray(d) &&
          stored[k] && typeof stored[k] === 'object' && !Array.isArray(stored[k])) {
        out[k] = { ...d, ...stored[k] };
      } else {
        out[k] = stored[k];
      }
    }
  }
  return out;
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

// --- Sauvegarde de secours : tout en un seul texte à copier ---
export function exportText() {
  const data = {};
  for (const k of SAVE_KEYS) {
    try {
      const raw = localStorage.getItem(PREFIX + k);
      if (raw) data[k] = JSON.parse(raw);
    } catch (_) { /* on saute cette partie */ }
  }
  const json = JSON.stringify({ jeu: 'jet-arena', version: 1, data });
  // base64 (en passant par l'UTF-8 pour les accents)
  return btoa(unescape(encodeURIComponent(json)));
}

// Restaure un texte exporté. Renvoie true si tout s'est bien passé.
export function importText(text) {
  try {
    const json = decodeURIComponent(escape(atob(String(text).trim())));
    const obj = JSON.parse(json);
    if (!obj || obj.jeu !== 'jet-arena' || typeof obj.data !== 'object') return false;
    for (const k of SAVE_KEYS) {
      if (obj.data[k] !== undefined) localStorage.setItem(PREFIX + k, JSON.stringify(obj.data[k]));
    }
    return true;
  } catch (_) {
    return false;
  }
}
