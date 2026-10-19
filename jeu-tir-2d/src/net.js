// =====================================================================
// net.js — La connexion au petit serveur de l'ordinateur (serveur.py),
// pour jouer ENTRE AMIS sur le même Wi-Fi. Ce fichier ne fait que
// parler au serveur : créer / rejoindre une partie, envoyer et recevoir
// des messages. Ce que contiennent les messages : voir netgame.js.
// =====================================================================

export class Net {
  constructor() {
    this.ws = null;
    this.status = 'off';      // 'off' | 'connecting' | 'on' | 'error'
    this.code = null;         // code de la partie (4 lettres)
    this.id = null;           // mon numéro dans la partie (0 = hôte)
    this.rooms = [];          // parties ouvertes sur le serveur
    this.inbox = [];          // messages reçus, lus par le jeu à chaque image
  }

  get isHost() { return this.id === 0; }
  get inRoom() { return this.code !== null; }

  // Se connecte au serveur qui a envoyé la page (renvoie une promesse : true / false)
  connect() {
    if (this.status === 'on') return Promise.resolve(true);
    this.status = 'connecting';
    return new Promise((resolve) => {
      let ws;
      try {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${proto}//${location.host}/ws`);
      } catch (_) {
        this.status = 'error';
        resolve(false);
        return;
      }
      this.ws = ws;
      const timer = setTimeout(() => { ws.close(); }, 4000);
      ws.onopen = () => { clearTimeout(timer); this.status = 'on'; resolve(true); };
      ws.onerror = () => {};
      ws.onclose = () => {
        clearTimeout(timer);
        const wasOn = this.status === 'on';
        this.status = wasOn ? 'off' : 'error';
        if (wasOn && this.inRoom) this.inbox.push({ t: 'coupe' });   // connexion perdue
        this.code = null;
        this.id = null;
        this.ws = null;
        resolve(false);
      };
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (_) { return; }
        if (m.t === 'salles') { this.rooms = m.salles; return; }
        if (m.t === 'cree' || m.t === 'rejoint') { this.code = m.code; this.id = m.id; }
        if (m.t === 'fermee') { this.code = null; this.id = null; }
        this.inbox.push(m);
      };
    });
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  listRooms() { this.send({ t: 'liste' }); }
  create(name) { this.send({ t: 'creer', nom: name }); }
  // d : ce que l'hôte doit savoir de moi (apparence)
  join(code, name, d) { this.send({ t: 'rejoindre', code, nom: name, d }); }
  setOpen(open) { this.send({ t: 'ouvrir', ouverte: open }); }

  toHost(d) { this.send({ t: 'envoi', d }); }               // invité → hôte
  toAll(d) { this.send({ t: 'envoi', d }); }                // hôte → tous les invités
  toPeer(id, d) { this.send({ t: 'envoi', a: id, d }); }    // hôte → un invité

  // Quitter la partie (on ferme la connexion : le serveur prévient les autres)
  leave() {
    this.code = null;
    this.id = null;
    this.inbox.length = 0;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.status = 'off';
  }

  takeMessages() {
    const list = this.inbox;
    this.inbox = [];
    return list;
  }
}
