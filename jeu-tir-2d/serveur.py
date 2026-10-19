#!/usr/bin/env python3
# =====================================================================
# serveur.py — Le petit serveur de Jet Arena, à lancer sur l'ordinateur.
#   1. Il sert les fichiers du jeu (comme "python3 -m http.server").
#   2. Il relie les téléphones entre eux pour les parties ENTRE AMIS
#      (même Wi-Fi) : il transmet les messages, c'est tout. Le jeu
#      lui-même tourne sur le téléphone de celui qui crée la partie.
#
# Lancement (dans le dossier jeu-tir-2d) :   python3 serveur.py
# Autre port :                               python3 serveur.py 3500
#
# Aucune installation nécessaire : seulement Python 3.7 ou plus récent.
# Rien n'est envoyé sur Internet : tout reste sur ton réseau Wi-Fi.
# =====================================================================

import base64
import hashlib
import json
import os
import random
import socket
import struct
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3400
DOSSIER = os.path.dirname(os.path.abspath(__file__))
MAX_JOUEURS = 8                      # joueurs humains par partie (hôte compris)
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'   # constante du protocole WebSocket

salles = {}                          # code → Salle
verrou = threading.Lock()            # protège "salles" (plusieurs connexions en même temps)


# ---------------------------------------------------------------------
# Une connexion WebSocket (un téléphone)
# ---------------------------------------------------------------------
class Connexion:
    def __init__(self, gestionnaire):
        self.rfile = gestionnaire.rfile
        self.wfile = gestionnaire.wfile
        self.verrou_ecriture = threading.Lock()
        self.ouverte = True
        self.salle = None
        self.id = None
        self.nom = 'Joueur'

    # Envoie un message (objet Python → texte JSON)
    def envoyer(self, message):
        if not self.ouverte:
            return
        donnees = json.dumps(message, separators=(',', ':')).encode('utf-8')
        entete = bytearray([0x81])                    # trame texte complète
        n = len(donnees)
        if n < 126:
            entete.append(n)
        elif n < 65536:
            entete.append(126)
            entete += struct.pack('>H', n)
        else:
            entete.append(127)
            entete += struct.pack('>Q', n)
        try:
            with self.verrou_ecriture:
                self.wfile.write(bytes(entete) + donnees)
                self.wfile.flush()
        except OSError:
            self.ouverte = False

    def _lire(self, n):
        donnees = self.rfile.read(n)
        if len(donnees) < n:
            raise ConnectionError('connexion fermée')
        return donnees

    # Lit le prochain message texte (None = connexion fermée)
    def recevoir(self):
        morceaux = b''
        while True:
            b1, b2 = self._lire(2)
            fin, code = b1 & 0x80, b1 & 0x0F
            n = b2 & 0x7F
            if n == 126:
                n = struct.unpack('>H', self._lire(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', self._lire(8))[0]
            masque = self._lire(4) if b2 & 0x80 else None
            contenu = self._lire(n)
            if masque and n:                          # les navigateurs masquent leurs messages
                cle = (masque * (n // 4 + 1))[:n]
                contenu = (int.from_bytes(contenu, 'big') ^ int.from_bytes(cle, 'big')).to_bytes(n, 'big')
            if code == 0x8:                           # fermeture
                return None
            if code == 0x9:                           # ping → pong
                with self.verrou_ecriture:
                    self.wfile.write(bytes([0x8A, len(contenu)]) + contenu)
                    self.wfile.flush()
                continue
            if code in (0x1, 0x0):                    # texte (ou suite d'un texte)
                morceaux += contenu
                if fin:
                    return morceaux.decode('utf-8', errors='replace')


# ---------------------------------------------------------------------
# Une salle = une partie entre amis (un hôte + des invités)
# ---------------------------------------------------------------------
class Salle:
    def __init__(self, code, hote):
        self.code = code
        self.hote = hote
        self.membres = {0: hote}       # id → Connexion (l'hôte a l'id 0)
        self.prochain_id = 1
        self.ouverte = True            # False pendant une partie (on ne peut plus rejoindre)

    def resume(self):
        return {'code': self.code, 'nom': self.hote.nom, 'joueurs': len(self.membres),
                'ouverte': self.ouverte and len(self.membres) < MAX_JOUEURS}


def nouveau_code():
    lettres = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    while True:
        code = ''.join(random.choice(lettres) for _ in range(4))
        if code not in salles:
            return code


def traiter(c, m):
    t = m.get('t')
    if t == 'liste':
        with verrou:
            c.envoyer({'t': 'salles', 'salles': [s.resume() for s in salles.values()]})
    elif t == 'creer' and c.salle is None:
        c.nom = str(m.get('nom', 'Joueur'))[:14]
        with verrou:
            s = Salle(nouveau_code(), c)
            salles[s.code] = s
        c.salle, c.id = s, 0
        c.envoyer({'t': 'cree', 'code': s.code, 'id': 0})
    elif t == 'rejoindre' and c.salle is None:
        c.nom = str(m.get('nom', 'Joueur'))[:14]
        with verrou:
            s = salles.get(str(m.get('code', '')).upper())
            if not s:
                erreur = "Cette partie n'existe plus."
            elif not s.ouverte:
                erreur = 'La partie a déjà commencé.'
            elif len(s.membres) >= MAX_JOUEURS:
                erreur = 'La partie est pleine.'
            else:
                erreur = None
                c.salle, c.id = s, s.prochain_id
                s.prochain_id += 1
                s.membres[c.id] = c
        if erreur:
            c.envoyer({'t': 'erreur', 'texte': erreur})
            return
        c.envoyer({'t': 'rejoint', 'code': s.code, 'id': c.id})
        s.hote.envoyer({'t': 'arrivee', 'id': c.id, 'nom': c.nom, 'd': m.get('d')})
    elif t == 'ouvrir' and c.salle and c.id == 0:
        c.salle.ouverte = bool(m.get('ouverte'))       # l'hôte ouvre / ferme sa salle
    elif t == 'envoi' and c.salle:
        # Transmission : un invité parle à l'hôte ; l'hôte parle à un invité ou à tous
        s = c.salle
        msg = {'t': 'msg', 'de': c.id, 'd': m.get('d')}
        if c.id != 0:
            s.hote.envoyer(msg)
        elif m.get('a') is None:
            for i, autre in list(s.membres.items()):
                if i != 0:
                    autre.envoyer(msg)
        else:
            dest = s.membres.get(m.get('a'))
            if dest:
                dest.envoyer(msg)


def depart(c):
    s = c.salle
    if not s:
        return
    with verrou:
        s.membres.pop(c.id, None)
        if c.id == 0:
            salles.pop(s.code, None)
    if c.id == 0:
        for autre in list(s.membres.values()):        # l'hôte est parti : partie finie
            autre.envoyer({'t': 'fermee'})
            autre.salle = None
    else:
        s.hote.envoyer({'t': 'depart', 'id': c.id})


# ---------------------------------------------------------------------
# Serveur HTTP : fichiers du jeu + adresse /ws pour les WebSockets
# ---------------------------------------------------------------------
class Gestionnaire(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'      # (nécessaire pour les WebSockets des navigateurs)
    # Types des fichiers (Windows se trompe parfois pour les .js)
    extensions_map = {
        '': 'application/octet-stream', '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8', '.json': 'application/json',
        '.webmanifest': 'application/manifest+json', '.png': 'image/png',
        '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8', '.py': 'text/plain; charset=utf-8',
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DOSSIER, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')    # toujours la dernière version du jeu
        super().end_headers()

    def log_message(self, *args):
        pass                                          # pas de ligne pour chaque fichier

    def do_GET(self):
        if self.path.split('?')[0] != '/ws':
            return super().do_GET()
        cle = self.headers.get('Sec-WebSocket-Key')
        if not cle or 'websocket' not in self.headers.get('Upgrade', '').lower():
            self.send_error(400)
            return
        reponse = base64.b64encode(hashlib.sha1((cle + GUID).encode()).digest()).decode()
        self.send_response_only(101)
        self.send_header('Upgrade', 'websocket')
        self.send_header('Connection', 'Upgrade')
        self.send_header('Sec-WebSocket-Accept', reponse)
        self.end_headers()
        self.wfile.flush()
        self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)   # pas d'attente
        c = Connexion(self)
        try:
            while True:
                texte = c.recevoir()
                if texte is None:
                    break
                try:
                    m = json.loads(texte)
                except ValueError:
                    continue
                if isinstance(m, dict):
                    traiter(c, m)
        except (ConnectionError, OSError):
            pass
        finally:
            c.ouverte = False
            depart(c)
        self.close_connection = True


def adresse_locale():
    """Adresse de l'ordinateur sur le Wi-Fi (rien n'est envoyé sur Internet)."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


if __name__ == '__main__':
    ThreadingHTTPServer.daemon_threads = True
    serveur = ThreadingHTTPServer(('0.0.0.0', PORT), Gestionnaire)
    ip = adresse_locale()
    print('Jet Arena est prêt !')
    print(f'  Sur cet ordinateur : http://localhost:{PORT}')
    if ip:
        print(f'  Sur les téléphones (même Wi-Fi) : http://{ip}:{PORT}')
    print('Laisse cette fenêtre ouverte pendant que vous jouez. Pour arrêter : Ctrl + C')
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        print('\nServeur arrêté.')
