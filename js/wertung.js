/*
 * Wertung: Anteil der geräumten Blöcke, Sterne und Münzen.
 * Reine Rechenfunktionen ohne Physik, damit sie in Node an Beispielen geprüft werden können.
 */
(function (wurzel) {
  'use strict';

  // Münzen je geräumtem Block nach Material
  var MUENZ_WERT = { holz: 1, glas: 2, stein: 3, gold: 1 };
  var GOLD_BONUS = 25;      // zusätzlich je Goldkiste
  var KETTE_BONUS = 2;      // je Block, den die Birne nie direkt berührt hat
  var STERN_BONUS = 10;     // je Stern
  var BIRNE_BONUS = 15;     // je nicht gebrauchter Birne (nur bei Erfolg)
  var EPS = 1e-9;

  // Sterngrenzen: 1 Stern = Ziel erreicht, 2 = halber Weg vom Ziel zu 100 %, 3 = 80 % des Weges
  function sternGrenzen(ziel) {
    return [ziel, ziel + (1 - ziel) * 0.5, ziel + (1 - ziel) * 0.8];
  }

  function sterne(anteil, ziel) {
    var g = sternGrenzen(ziel);
    if (anteil + EPS >= g[2]) return 3;
    if (anteil + EPS >= g[1]) return 2;
    if (anteil + EPS >= g[0]) return 1;
    return 0;
  }

  // Prozent für die Anzeige: abgerundet, damit nie "70 %" dasteht, wenn 69,9 % erreicht sind
  function prozent(anteil) { return Math.floor(anteil * 100 + EPS); }

  // Münzen für einen einzelnen geräumten Block (für die aufsteigenden Zahlen im Spiel)
  function blockMuenzen(mat, kette) {
    var m = MUENZ_WERT[mat] || 1;
    if (mat === 'gold') m += GOLD_BONUS;
    if (kette) m += KETTE_BONUS;
    return m;
  }

  /*
   * stat: { gesamt, geraeumt, proMaterial: {holz, glas, stein, gold}, kette, birnenUebrig }
   * ziel: Zielanteil 0..1
   */
  function berechne(stat, ziel) {
    var gesamt = stat.gesamt || 0;
    var anteil = gesamt ? Math.min(1, stat.geraeumt / gesamt) : 0;
    var st = sterne(anteil, ziel);
    var pm = stat.proMaterial || {};
    var schaden = 0;
    ['holz', 'glas', 'stein', 'gold'].forEach(function (m) { schaden += (pm[m] || 0) * MUENZ_WERT[m]; });
    var gold = pm.gold || 0;
    var kette = stat.kette || 0;
    var uebrig = st > 0 ? (stat.birnenUebrig || 0) : 0;
    var posten = [
      { art: 'schaden', anzahl: stat.geraeumt, muenzen: schaden },
      { art: 'gold', anzahl: gold, muenzen: gold * GOLD_BONUS },
      { art: 'kette', anzahl: kette, muenzen: kette * KETTE_BONUS },
      { art: 'sterne', anzahl: st, muenzen: st * STERN_BONUS },
      { art: 'birnen', anzahl: uebrig, muenzen: uebrig * BIRNE_BONUS }
    ];
    var summe = 0;
    posten.forEach(function (p) { summe += p.muenzen; });
    return {
      anteil: anteil,
      prozent: prozent(anteil),
      sterne: st,
      gewonnen: st > 0,
      muenzen: summe,
      // Münzen, die schon während des Levels sichtbar verdient werden (ohne Stern- und Birnenbonus)
      laufend: posten[0].muenzen + posten[1].muenzen + posten[2].muenzen,
      posten: posten
    };
  }

  var Wertung = {
    berechne: berechne,
    sterne: sterne,
    sternGrenzen: sternGrenzen,
    prozent: prozent,
    blockMuenzen: blockMuenzen,
    MUENZ_WERT: MUENZ_WERT,
    GOLD_BONUS: GOLD_BONUS,
    KETTE_BONUS: KETTE_BONUS,
    STERN_BONUS: STERN_BONUS,
    BIRNE_BONUS: BIRNE_BONUS
  };

  if (typeof module === 'object' && module.exports) module.exports = Wertung;
  else wurzel.Wertung = Wertung;
})(this);
