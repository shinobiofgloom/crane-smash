/*
 * Zufall mit Startwert (Seed), damit Level und Splitter immer gleich ausfallen.
 * Läuft im Browser (window.Zufall) und in Node (module.exports).
 */
(function (wurzel) {
  'use strict';

  // mulberry32: klein, schnell, für Spielzwecke völlig ausreichend
  function erzeuge(seed) {
    var a = (seed >>> 0) || 1;

    function zahl() {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    return {
      zahl: zahl,
      // Kommazahl in [von, bis)
      bereich: function (von, bis) { return von + (bis - von) * zahl(); },
      // Ganzzahl in [von, bis] (beide eingeschlossen)
      ganz: function (von, bis) { return von + Math.floor(zahl() * (bis - von + 1)); },
      wahl: function (liste) { return liste[Math.floor(zahl() * liste.length)]; },
      chance: function (p) { return zahl() < p; }
    };
  }

  var Zufall = { erzeuge: erzeuge };

  if (typeof module === 'object' && module.exports) module.exports = Zufall;
  else wurzel.Zufall = Zufall;
})(this);
