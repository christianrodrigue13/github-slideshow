// =====================================================================
// weapon.js — Une arme : chargeur, cadence de tir, rechargement.
// Les caractéristiques (dégâts, cadence…) viennent de config.js.
// =====================================================================

export class Weapon {
  constructor(def) {
    this.def = def;              // caractéristiques (voir CONFIG.weapons)
    this.ammo = def.magazine;    // balles dans le chargeur
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
        this.reloadLeft = 0;
        this.ammo = this.def.magazine;
      }
    }
  }

  // Lance un rechargement. Renvoie true s'il a vraiment commencé.
  startReload() {
    if (this.reloading || this.ammo === this.def.magazine) return false;
    this.reloadLeft = this.def.reloadTime;
    return true;
  }

  cancelReload() {
    this.reloadLeft = 0;
  }

  // Essaie de tirer. Renvoie :
  //  'fired'  → un tir part
  //  'reload' → chargeur vide, le rechargement automatique démarre
  //  null     → rien (cadence, rechargement en cours)
  tryFire() {
    if (this.reloading || this.cooldown > 0) return null;
    if (this.ammo <= 0) return this.startReload() ? 'reload' : null;
    this.ammo--;
    this.cooldown = 1 / this.def.fireRate;
    return 'fired';
  }

  // Remet l'arme à neuf (réapparition)
  refill() {
    this.ammo = this.def.magazine;
    this.cooldown = 0;
    this.reloadLeft = 0;
  }
}
