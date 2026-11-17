/*
 * Fortschritt: Upgrades (nur Spielmünzen, keine Käufe), Speicherstand in localStorage.
 * Jeder Speicherzugriff steckt in try/catch; ohne Speicher läuft das Spiel mit frischem Stand.
 */
(function (wurzel) {
  'use strict';

  var SCHLUESSEL = 'wreckcrew_stand_v1';

  // Upgrades: Kosten je Stufe. abLevel = erst ab diesem Level kaufbar.
  var UPGRADES = [
    { id: 'schwer', kosten: [40, 90, 160, 260] },     // schwerere Birne
    { id: 'kette', kosten: [50, 110, 190, 300] },     // längere Kette = schnellerer, weiterer Wurf
    { id: 'birne', kosten: [150, 350] },              // zusätzliche Birne je Level
    { id: 'spreng', kosten: [220, 420], abLevel: 6 }, // letzte Birne wird zur Sprengbirne (Stufe 2: größere Druckwelle)
    { id: 'ziel', kosten: [60, 160], abLevel: 6 }     // Zielhilfe: Anfang der Flugbahn-Vorschau ab Level 6 (in 1–5 immer an)
  ];

  // Anteil der Flugbahn, den die Vorschau ab Level 6 je Stufe der Zielhilfe zeigt
  var ZIELHILFE_ANTEIL = [0, 0.3, 0.55];

  var GRUND = { dichte: 0.03, radius: 26, kette: 150, birnen: 3 };

  function neuerStand() {
    return {
      version: 1,
      level: 1,                 // nächstes zu spielendes Level
      hoechstes: 1,             // höchstes freigeschaltetes Level
      muenzen: 0,
      upgrades: { schwer: 0, kette: 0, birne: 0, spreng: 0, ziel: 0 },
      sterne: {},               // bestes Ergebnis je Level
      stumm: false,
      tutorialFertig: false
    };
  }

  function upgrade(id) {
    for (var i = 0; i < UPGRADES.length; i++) if (UPGRADES[i].id === id) return UPGRADES[i];
    return null;
  }

  // Werte für die Spielwelt aus den gekauften Stufen
  function weltOptionen(stand) {
    var u = stand.upgrades;
    return {
      birnenDichte: GRUND.dichte * (1 + 0.35 * u.schwer),
      birnenRadius: GRUND.radius + 2 * u.schwer,
      kettenLaenge: GRUND.kette + 25 * u.kette,
      birnen: GRUND.birnen + u.birne,
      sprengStufe: u.spreng
    };
  }

  // Prüft einen Kauf: { ok, grund: 'max' | 'gesperrt' | 'muenzen' | null, preis, stufe }
  function pruefeKauf(stand, id) {
    var up = upgrade(id);
    if (!up) return { ok: false, grund: 'unbekannt', preis: 0, stufe: 0 };
    var stufe = stand.upgrades[id] || 0;
    if (stufe >= up.kosten.length) return { ok: false, grund: 'max', preis: 0, stufe: stufe };
    var preis = up.kosten[stufe];
    if (up.abLevel && stand.hoechstes < up.abLevel) return { ok: false, grund: 'gesperrt', preis: preis, stufe: stufe };
    if (stand.muenzen < preis) return { ok: false, grund: 'muenzen', preis: preis, stufe: stufe };
    return { ok: true, grund: null, preis: preis, stufe: stufe };
  }

  // Führt den Kauf aus (verändert stand). Gibt das Prüfergebnis zurück.
  function kaufe(stand, id) {
    var p = pruefeKauf(stand, id);
    if (!p.ok) return p;
    stand.muenzen -= p.preis;
    stand.upgrades[id] = p.stufe + 1;
    return { ok: true, grund: null, preis: p.preis, stufe: p.stufe + 1 };
  }

  // Gibt es etwas, das man sich gerade leisten kann? (für das Ausrufezeichen am Knopf)
  function etwasKaufbar(stand) {
    for (var i = 0; i < UPGRADES.length; i++) if (pruefeKauf(stand, UPGRADES[i].id).ok) return true;
    return false;
  }

  function zahl(wert, standard, min, max) {
    var n = Number(wert);
    if (!isFinite(n)) return standard;
    return Math.max(min, Math.min(max, Math.floor(n)));
  }

  // Gelesenen Stand prüfen: unbekannte oder kaputte Felder fallen auf Standardwerte zurück
  function bereinige(roh) {
    var s = neuerStand();
    if (!roh || typeof roh !== 'object') return s;
    s.level = zahl(roh.level, 1, 1, 9999);
    s.hoechstes = Math.max(s.level, zahl(roh.hoechstes, 1, 1, 9999));
    s.muenzen = zahl(roh.muenzen, 0, 0, 1e9);
    UPGRADES.forEach(function (up) {
      s.upgrades[up.id] = zahl(roh.upgrades && roh.upgrades[up.id], 0, 0, up.kosten.length);
    });
    if (roh.sterne && typeof roh.sterne === 'object') {
      Object.keys(roh.sterne).forEach(function (k) {
        if (/^\d+$/.test(k)) s.sterne[k] = zahl(roh.sterne[k], 0, 0, 3);
      });
    }
    s.stumm = roh.stumm === true;
    s.tutorialFertig = roh.tutorialFertig === true;
    return s;
  }

  // Nur im Browser über window (in Node gibt es keinen Spielstand)
  function speicher() {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  }

  function laden() {
    try {
      var sp = speicher();
      if (!sp) return neuerStand();
      var text = sp.getItem(SCHLUESSEL);
      return text ? bereinige(JSON.parse(text)) : neuerStand();
    } catch (e) {
      return neuerStand();
    }
  }

  function speichern(stand) {
    try {
      var sp = speicher();
      if (!sp) return false;
      sp.setItem(SCHLUESSEL, JSON.stringify(stand));
      return true;
    } catch (e) {
      return false;
    }
  }

  /*
   * Flugbahn-Vorschau für ein Level: Level 1–5 immer ganz und mit Trefferfarbe,
   * danach nur mit gekaufter Zielhilfe und nur der Anfang der Bahn (Timing bleibt der Kern).
   * Ergebnis: { anteil: 0..1, farbe: true/false } oder null.
   */
  function vorschau(stand, levelNr) {
    if (levelNr <= 5) return { anteil: 1, farbe: true };
    var a = ZIELHILFE_ANTEIL[stand.upgrades.ziel || 0] || 0;
    return a > 0 ? { anteil: a, farbe: false } : null;
  }

  var Fortschritt = {
    UPGRADES: UPGRADES,
    vorschau: vorschau,
    neuerStand: neuerStand,
    weltOptionen: weltOptionen,
    pruefeKauf: pruefeKauf,
    kaufe: kaufe,
    etwasKaufbar: etwasKaufbar,
    bereinige: bereinige,
    laden: laden,
    speichern: speichern,
    upgrade: upgrade
  };

  if (typeof module === 'object' && module.exports) module.exports = Fortschritt;
  else wurzel.Fortschritt = Fortschritt;
})(this);
