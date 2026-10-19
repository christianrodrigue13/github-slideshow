// =====================================================================
// weapon.js — Une arme : chargeur, réserve de munitions, cadence de
// tir, rechargement.
// Les caractéristiques (dégâts, cadence…) viennent de config.js.
// =====================================================================

export class Weapon {
  constructor(def) {
    this.def = def;              // caractéristiques (voir CONFIG.weapons)
    this.ammo = def.magazine;    // balles dans le chargeur
    this.reserve = def.reserve ?? Infinity;   // munitions de réserve
    this.cooldown = 0;           // temps avant le prochain tir possible
    this.reloadLeft = 0;         // temps de rechargement restant (0 = pas en cours)
  }

  get reloading() { return this.reloadLeft > 0; }

  // Avancement du rechargement de 0 à 1 (pour l'interface)
  get reloadProgress() {
    return this.reloading ? 1 - this.reloadLeft / this.def.reloadTime : 1;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.reloadLeft > 0) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) {
        // on prend dans la réserve ce qu'il faut pour remplir le chargeur
        this.reloadLeft = 0;
        const take = Math.min(this.def.magazine - this.ammo, this.reserve);
        this.ammo += take;
        this.reserve -= take;
      }
    }
  }

  // Lance un rechargement. Renvoie true s'il a vraiment commencé.
  startReload() {
    if (this.reloading || this.ammo === this.def.magazine || this.reserve <= 0) return false;
    this.reloadLeft = this.def.reloadTime;
    return true;
  }

  cancelReload() {
    this.reloadLeft = 0;
  }

  // Essaie de tirer. Renvoie :
  //  'fired'  → un tir part
  //  'reload' → chargeur vide, le rechargement automatique démarre
  //  'empty'  → plus aucune munition (chargeur ET réserve vides)
  //  null     → rien (cadence, rechargement en cours)
  tryFire() {
    if (this.reloading || this.cooldown > 0) return null;
    if (this.ammo <= 0) return this.startReload() ? 'reload' : 'empty';
    this.ammo--;
    this.cooldown = 1 / this.def.fireRate;
    return 'fired';
  }

  // Plus aucune munition du tout ?
  get empty() { return this.ammo <= 0 && this.reserve <= 0; }

  // Part des munitions restantes (0 à 1), chargeur + réserve
  get ammoRatio() {
    const max = this.def.magazine + (this.def.reserve ?? 0);
    return max === Infinity ? 1 : (this.ammo + this.reserve) / max;
  }

  // Caisse de munitions : la réserve est remplie. Renvoie true si c'était utile.
  restock() {
    const full = this.def.reserve ?? Infinity;
    if (this.reserve >= full) return false;
    this.reserve = full;
    return true;
  }

  // Remet l'arme à neuf (réapparition)
  refill() {
    this.ammo = this.def.magazine;
    this.reserve = this.def.reserve ?? Infinity;
    this.cooldown = 0;
    this.reloadLeft = 0;
  }
}
