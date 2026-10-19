// =====================================================================
// backup.js — Fenêtre "sauvegarde de secours" : affiche un texte qui
// contient toute la progression (à copier et garder), ou permet de
// coller un tel texte pour tout restaurer (nouveau téléphone, etc.).
// =====================================================================

import { exportText, importText } from './save.js';

const $ = (id) => document.getElementById(id);

export function initBackup() {
  $('backup-close').addEventListener('click', closeBackup);
  $('backup-copy').addEventListener('click', () => {
    const text = $('backup-text').value;
    const done = () => { $('backup-msg').textContent = 'Copié ! Garde ce texte dans tes notes ou un e-mail.'; };
    const fallback = () => {
      $('backup-text').select();
      try { document.execCommand('copy'); done(); } catch (_) {
        $('backup-msg').textContent = 'Sélectionne le texte et copie-le à la main.';
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  });
  $('backup-import').addEventListener('click', () => {
    if (importText($('backup-text').value)) {
      $('backup-msg').textContent = 'Sauvegarde restaurée ! Le jeu redémarre…';
      setTimeout(() => location.reload(), 900);
    } else {
      $('backup-msg').textContent = 'Ce texte n\'est pas une sauvegarde de Jet Arena.';
    }
  });
}

// mode : 'export' (montrer le texte) ou 'import' (coller un texte)
export function openBackup(mode) {
  const exp = mode === 'export';
  $('backup-title').textContent = exp
    ? 'Ta sauvegarde de secours : copie ce texte et garde-le (notes, e-mail…).'
    : 'Colle ici le texte de ta sauvegarde, puis touche « Restaurer ».';
  $('backup-text').value = exp ? exportText() : '';
  $('backup-text').readOnly = exp;
  $('backup-copy').hidden = !exp;
  $('backup-import').hidden = exp;
  $('backup-msg').textContent = exp ? '' : 'Attention : la progression actuelle sera remplacée.';
  $('backup').hidden = false;
}

export function closeBackup() {
  $('backup').hidden = true;
}

export function backupIsOpen() {
  return !$('backup').hidden;
}
