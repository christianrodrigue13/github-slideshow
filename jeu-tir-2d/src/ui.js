// =====================================================================
// ui.js — Petits outils de dessin partagés par l'interface (hud.js)
// et les menus (menus.js) : tailles, polices, barres, boutons.
// =====================================================================

// Unité de taille : s'adapte à la hauteur de l'écran
export function unit(view) {
  return Math.max(0.8, Math.min(1.6, view.h / 400));
}

export function font(px, bold = true) {
  return `${bold ? 'bold ' : ''}${Math.round(px)}px system-ui, -apple-system, sans-serif`;
}

// Barre horizontale avec fond
export function bar(ctx, x, y, w, h, ratio, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

// Rectangle aux coins arrondis (chemin seulement)
export function roundedPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export function formatTime(t) {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
