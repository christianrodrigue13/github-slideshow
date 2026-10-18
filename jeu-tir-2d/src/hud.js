// =====================================================================
// hud.js — Interface à l'écran : joysticks, boutons, barres, menus.
// Tout est dessiné en pixels CSS (repère écran, pas monde).
// =====================================================================

// Joysticks virtuels et boutons tactiles
export function drawTouchControls(ctx, input) {
  if (!input.touchMode || input.uiMode) return;
  const R = input.stickRadius();

  for (const s of [input.leftStick, input.rightStick]) {
    if (!s) continue;
    const v = input.stickValue(s);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.ox, s.oy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(s.ox + v.x * R, s.oy + v.y * R, R * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  // Indications quand aucun doigt n'est posé
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.font = `${Math.round(input.h * 0.035)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (!input.leftStick) ctx.fillText('bouger / voler', input.w * 0.2, input.h * 0.82);
  if (!input.rightStick) ctx.fillText('viser / tirer', input.w * 0.75, input.h * 0.82);

  // Boutons
  for (const b of Object.values(input.buttons)) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${Math.round(b.r * 0.8)}px system-ui, sans-serif`;
    ctx.fillText(b.label, b.x, b.y + 1);
  }
}
