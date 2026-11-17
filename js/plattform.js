/*
 * Plattform-Adapter für Voltköpfe-Spiele.
 * Bündelt alle Aufrufe an das Poki- oder CrazyGames-SDK an einer Stelle.
 * Lokal (ohne SDK) sind alle Funktionen harmlos und schreiben nur ins Konsolenprotokoll.
 * Später wird hier das echte SDK der jeweiligen Plattform angeschlossen; die Spiele bleiben unverändert.
 */
(function () {
  'use strict';

  var laeuft = false;
  var startZeit = 0;
  var statistik = { spielSekunden: 0, starts: 0, werbepausen: 0 };

  function log() {
    try {
      var teile = ['[Plattform]'];
      for (var i = 0; i < arguments.length; i++) teile.push(arguments[i]);
      console.log.apply(console, teile);
    } catch (e) { /* Konsole nicht verfügbar: egal */ }
  }

  var Plattform = {
    name: 'lokal',

    // Beim Start einmal aufrufen. Gibt ein Promise zurück, damit echte SDKs asynchron laden können.
    init: function () {
      log('init');
      return Promise.resolve();
    },

    // Spiel ist geladen und bereit.
    ladenFertig: function () { log('ladenFertig'); },

    // Es wird tatsächlich gespielt.
    spielStart: function () {
      if (laeuft) return;
      laeuft = true;
      startZeit = Date.now();
      statistik.starts++;
      log('spielStart');
    },

    // Pause, Menü, Levelende oder Spielende.
    spielStopp: function () {
      if (!laeuft) return;
      laeuft = false;
      statistik.spielSekunden += Math.round((Date.now() - startZeit) / 1000);
      log('spielStopp', 'gesamt ' + statistik.spielSekunden + ' s');
    },

    // Werbung an einer natürlichen Pause. Lokal gibt es keine Werbung: sofort weiter.
    werbepause: function (danach) {
      statistik.werbepausen++;
      log('werbepause');
      setTimeout(function () { if (typeof danach === 'function') danach(); }, 0);
    },

    // Großer Moment (Poki: happyTime, CrazyGames: happytime).
    freude: function () { log('freude'); },

    // Messpunkt für unsere eigene Auswertung.
    ereignis: function (name, daten) { log('ereignis', name, daten === undefined ? '' : JSON.stringify(daten)); },

    // Für lokale Tests: bisherige Spielzeit dieser Sitzung.
    statistik: function () {
      var s = statistik.spielSekunden + (laeuft ? Math.round((Date.now() - startZeit) / 1000) : 0);
      return { spielSekunden: s, starts: statistik.starts, werbepausen: statistik.werbepausen };
    }
  };

  window.Plattform = Plattform;
})();
