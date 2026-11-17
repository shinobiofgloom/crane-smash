/*
 * Level: die ersten 5 sind handgebaut, danach baut ein Generator mit Seed die Bauwerke.
 *
 * Koordinaten: x = 0 ist die linke Kante des Bauwerks, y = 0 ist die Oberkante der Plattform,
 * nach oben wird y negativ (wie in matter-js). Jeder Block: Mitte (x, y), Breite b, Höhe h, Material mat.
 * Materialien: holz (leicht), glas (zerbricht), stein (schwer), gold (Goldkiste, bringt viele Münzen).
 */
(function (wurzel) {
  'use strict';

  var istNode = typeof module === 'object' && module.exports;
  var Zufall = istNode ? require('./zufall.js') : wurzel.Zufall;

  // Standardmaße der Blöcke
  var W = 40;            // Würfel 40 x 40
  var BALKEN_B = 120;    // Balken 120 x 20
  var BALKEN_H = 20;
  var SAEULE_B = 20;     // Säule 20 x 80
  var SAEULE_H = 80;
  var LANG_B = 240;      // langer Balken 240 x 20 (Brückendeck)
  var ZIEGEL_B = 80;     // Ziegel 80 x 40

  var MAX_BLOECKE = 46;  // Grenze, damit mit Birnen und Splittern höchstens ~80 Körper entstehen

  // Kleiner Bauhelfer: Blöcke über linke Kante und Unterkante angeben
  function Bau() { this.bloecke = []; }
  Bau.prototype.block = function (xLinks, yUnten, b, h, mat) {
    this.bloecke.push({ x: xLinks + b / 2, y: -(yUnten + h / 2), b: b, h: h, mat: mat || 'holz' });
    return this;
  };
  Bau.prototype.wuerfel = function (xLinks, yUnten, mat) { return this.block(xLinks, yUnten, W, W, mat); };

  // Ein Turmfeld (zwei Säulen und ein Balken darauf). Gibt die neue Oberkante zurück.
  function feld(bau, xLinks, yUnten, matSaeule, matBalken) {
    bau.block(xLinks, yUnten, SAEULE_B, SAEULE_H, matSaeule);
    bau.block(xLinks + BALKEN_B - SAEULE_B, yUnten, SAEULE_B, SAEULE_H, matSaeule);
    bau.block(xLinks, yUnten + SAEULE_H, BALKEN_B, BALKEN_H, matBalken);
    return yUnten + SAEULE_H + BALKEN_H;
  }

  // ---------------------------------------------------------------- handgebaute Level 1–5

  function level1() {
    // Zwei schlanke Würfelstapel direkt an der Kante: fällt fast von selbst
    var bau = new Bau();
    var mats = ['holz', 'holz', 'holz', 'glas'];
    for (var i = 0; i < 4; i++) {
      bau.wuerfel(0, i * W, mats[i]);
      bau.wuerfel(W, i * W, i === 3 ? 'gold' : mats[i]);
    }
    return { typ: 'stapel', ziel: 0.5, randRechts: 20, bloecke: bau.bloecke };
  }

  function level2() {
    // Schmale, hohe Mauer aus versetzten Ziegeln mit Glasreihe, oben die Goldkiste
    var bau = new Bau();
    for (var reihe = 0; reihe < 5; reihe++) {
      var mat = reihe === 3 ? 'glas' : 'holz';
      var y = reihe * W;
      if (reihe % 2 === 0) {
        for (var i = 0; i < 2; i++) bau.block(i * ZIEGEL_B, y, ZIEGEL_B, W, mat);
      } else {
        bau.wuerfel(0, y, mat);
        bau.block(W, y, ZIEGEL_B, W, mat);
        bau.wuerfel(W + ZIEGEL_B, y, mat);
      }
    }
    bau.wuerfel(60, 5 * W, 'gold');
    // drehpunkt: Bogen noch weiter links, damit die Birne länger zur Flanke gelenkt werden kann
    return { typ: 'mauer', ziel: 0.6, randRechts: 30, drehpunkt: 1.2, bloecke: bau.bloecke };
  }

  function level3() {
    // Pyramide 4-3-2-1, oben die Goldkiste
    var bau = new Bau();
    for (var reihe = 0; reihe < 4; reihe++) {
      var anzahl = 4 - reihe;
      for (var i = 0; i < anzahl; i++) {
        var mat = 'holz';
        if (reihe === 2) mat = 'glas';
        if (reihe === 3) mat = 'gold';
        bau.wuerfel(reihe * W / 2 + i * W, reihe * W, mat);
      }
    }
    return { typ: 'pyramide', ziel: 0.6, randRechts: 40, bloecke: bau.bloecke };
  }

  function level4() {
    // Turm mit zwei Feldern und drei Etagen, Würfel in den Feldern
    var bau = new Bau();
    var y = 0;
    for (var etage = 0; etage < 3; etage++) {
      for (var f = 0; f < 2; f++) {
        var x = f * BALKEN_B;
        bau.wuerfel(x + 40, y, etage === 1 ? 'glas' : 'holz');
        feld(bau, x, y, 'holz', etage === 0 ? 'stein' : 'holz');
      }
      y += SAEULE_H + BALKEN_H;
    }
    bau.wuerfel(BALKEN_B - W / 2, y, 'gold');
    return { typ: 'turm', ziel: 0.55, randRechts: 25, bloecke: bau.bloecke };
  }

  function level5() {
    // Brücke: zwei Pfeiler, langes Deck, kleine Pyramide obendrauf
    var bau = new Bau();
    for (var i = 0; i < 3; i++) {
      var mat = i === 0 ? 'stein' : 'holz';
      bau.wuerfel(0, i * W, mat);
      bau.wuerfel(LANG_B - W, i * W, mat);
    }
    bau.wuerfel(100, 0, 'glas');
    var deck = 3 * W;
    bau.block(0, deck, LANG_B, BALKEN_H, 'holz');
    var oben = deck + BALKEN_H;
    for (var reihe = 0; reihe < 3; reihe++) {
      for (var k = 0; k < 3 - reihe; k++) {
        var m = reihe === 2 ? 'gold' : (reihe === 1 ? 'glas' : 'holz');
        bau.wuerfel(60 + reihe * W / 2 + k * W, oben + reihe * W, m);
      }
    }
    return { typ: 'bruecke', ziel: 0.6, randRechts: 40, bloecke: bau.bloecke };
  }

  var HANDGEBAUT = [level1, level2, level3, level4, level5];

  // ---------------------------------------------------------------- Generator

  function bauTurm(rng, groesse) {
    var bau = new Bau();
    var felder = rng.ganz(1, 1 + Math.round(groesse));              // 1..2 (höchstens 240 breit)
    var etagen = rng.ganz(2, 2 + Math.round(groesse * 3));          // 2..5
    var y = 0;
    for (var e = 0; e < etagen; e++) {
      for (var f = 0; f < felder; f++) {
        var x = f * BALKEN_B;
        if (rng.chance(0.6)) bau.wuerfel(x + 40, y);
        feld(bau, x, y);
      }
      y += SAEULE_H + BALKEN_H;
    }
    // Spitze: ein oder zwei Würfel auf dem obersten Balken
    var spitzen = rng.ganz(1, felder);
    for (var s = 0; s < spitzen; s++) bau.wuerfel(s * BALKEN_B + 40, y);
    return bau.bloecke;
  }

  function bauPyramide(rng, groesse) {
    var bau = new Bau();
    var basis = rng.ganz(3, 3 + Math.round(groesse * 3));           // 3..6
    var reihen = rng.ganz(Math.max(2, basis - 2), basis);           // ggf. abgeflacht
    for (var r = 0; r < reihen; r++) {
      for (var i = 0; i < basis - r; i++) bau.wuerfel(r * W / 2 + i * W, r * W);
    }
    return bau.bloecke;
  }

  function bauMauer(rng, groesse) {
    var bau = new Bau();
    var breite = rng.ganz(2, 2 + Math.round(groesse));              // Ziegel je Reihe 2..3
    var hoehe = rng.ganz(3, 3 + Math.round(groesse * 5));           // Reihen 3..8
    for (var r = 0; r < hoehe; r++) {
      var y = r * W;
      if (r % 2 === 0) {
        for (var i = 0; i < breite; i++) bau.block(i * ZIEGEL_B, y, ZIEGEL_B, W);
      } else {
        bau.wuerfel(0, y);
        for (var k = 0; k < breite - 1; k++) bau.block(W + k * ZIEGEL_B, y, ZIEGEL_B, W);
        bau.wuerfel(W + (breite - 1) * ZIEGEL_B, y);
      }
    }
    return bau.bloecke;
  }

  function bauBruecke(rng, groesse) {
    var bau = new Bau();
    var dreiPfeiler = false;                                         // nur zwei Pfeiler: höchstens 240 breit
    var pfeilerHoehe = rng.ganz(2, 2 + Math.round(groesse * 2));    // Würfel je Pfeiler 2..4
    var pfeiler = dreiPfeiler ? [[0, 1], [200, 2], [440, 1]] : [[0, 1], [200, 1]];
    for (var p = 0; p < pfeiler.length; p++) {
      for (var j = 0; j < pfeilerHoehe; j++) {
        for (var w = 0; w < pfeiler[p][1]; w++) bau.wuerfel(pfeiler[p][0] + w * W, j * W);
      }
    }
    var deck = pfeilerHoehe * W;
    var decks = dreiPfeiler ? [0, 240] : [0];
    for (var d = 0; d < decks.length; d++) {
      bau.block(decks[d], deck, LANG_B, BALKEN_H);
      // Unter dem Deck ein einzelner Würfel (oft Glas)
      if (rng.chance(0.6)) bau.wuerfel(decks[d] + 100, 0, rng.chance(0.6) ? 'glas' : 'holz');
      // Auf dem Deck: kleine Pyramide oder Würfelstapel
      var oben = deck + BALKEN_H;
      var form = rng.chance(0.5) ? 'pyramide' : 'stapel';
      if (form === 'pyramide') {
        var basis = rng.ganz(2, 3 + Math.round(groesse));
        for (var r = 0; r < basis; r++) {
          for (var i = 0; i < basis - r; i++) {
            bau.wuerfel(decks[d] + 120 - basis * W / 2 + r * W / 2 + i * W, oben + r * W);
          }
        }
      } else {
        var stapel = rng.ganz(2, 2 + Math.round(groesse * 2));
        for (var s = 0; s < stapel; s++) {
          bau.wuerfel(decks[d] + 60, oben + s * W);
          bau.wuerfel(decks[d] + 140, oben + s * W);
        }
      }
    }
    return bau.bloecke;
  }

  function bauMix(rng, groesse) {
    // Abgeschnittene Pyramide als Sockel, darauf ein Turmfeld
    var bau = new Bau();
    var basis = rng.ganz(4, 4 + Math.round(groesse * 2));           // 4..6
    var reihen = basis - 3 + 1;                                     // bis zur Reihe mit 3 Würfeln
    for (var r = 0; r < reihen; r++) {
      for (var i = 0; i < basis - r; i++) bau.wuerfel(r * W / 2 + i * W, r * W);
    }
    var xFeld = (reihen - 1) * W / 2;
    var y = reihen * W;
    var etagen = rng.ganz(1, 1 + Math.round(groesse * 2));
    for (var e = 0; e < etagen; e++) {
      if (rng.chance(0.5)) bau.wuerfel(xFeld + 40, y);
      y = feld(bau, xFeld, y);
    }
    bau.wuerfel(xFeld + 40, y);
    return bau.bloecke;
  }

  var BAUARTEN = { turm: bauTurm, pyramide: bauPyramide, mauer: bauMauer, bruecke: bauBruecke, mix: bauMix };
  var BAUART_NAMEN = ['turm', 'pyramide', 'mauer', 'bruecke', 'mix'];

  // Materialien verteilen: Stein eher unten, Glas überall, eine Goldkiste weit oben
  function materialien(bloecke, rng, steinAnteil, glasAnteil) {
    var hoechste = 1;
    bloecke.forEach(function (b) { hoechste = Math.max(hoechste, -(b.y - b.h / 2)); });
    bloecke.forEach(function (b) {
      if (b.mat !== 'holz') return;            // vom Bauplan schon festgelegt
      var unten = -(b.y + b.h / 2);
      var rel = unten / hoechste;              // 0 = unten, 1 = oben
      // Stein nur in der unteren Hälfte: schwere Last oben auf schlanken Säulen knickt sonst ein
      var pStein = rel < 0.5 ? steinAnteil * (1.6 - 1.2 * rel) : 0;
      var pGlas = b.b >= LANG_B ? 0 : glasAnteil;
      var z = rng.zahl();
      if (z < pStein) b.mat = 'stein';
      else if (z < pStein + pGlas) b.mat = 'glas';
    });
    // Goldkiste: ein Würfel im oberen Bereich
    var kandidaten = bloecke.filter(function (b) {
      return b.b === W && b.h === W && -(b.y + b.h / 2) >= hoechste * 0.45;
    });
    if (kandidaten.length) rng.wahl(kandidaten).mat = 'gold';
  }

  // Baut ein Level aus Seed und Schwierigkeit (0 = Level 6, steigt langsam)
  function erzeuge(seed, schwierigkeit) {
    var d = Math.max(0, schwierigkeit || 0);
    var budget = Math.min(MAX_BLOECKE, 12 + Math.round(d * 1.3));
    var groesse = Math.min(1, 0.15 + d / 28);
    var grund = Zufall.erzeuge(seed);
    var typ = grund.wahl(BAUART_NAMEN);
    var bloecke = null;
    for (var versuch = 0; versuch < 12; versuch++) {
      var rng = Zufall.erzeuge(seed * 31 + versuch * 977 + 7);
      bloecke = BAUARTEN[typ](rng, groesse);
      if (bloecke.length <= budget && bloecke.length >= 8) break;
      if (bloecke.length > budget) groesse *= 0.8;
      else groesse = Math.min(1, groesse + 0.15);
      if (versuch === 11 && bloecke.length > budget) { typ = 'pyramide'; bloecke = bauPyramide(rng, 0.2); }
    }
    var steinAnteil = Math.min(0.35, 0.04 + d * 0.012);
    var glasAnteil = 0.1 + grund.zahl() * 0.1;
    materialien(bloecke, Zufall.erzeuge(seed * 7 + 3), steinAnteil, glasAnteil);
    return {
      typ: typ,
      seed: seed,
      ziel: Math.round(Math.min(0.78, 0.6 + d * 0.006) * 100) / 100,
      randRechts: 30 + Math.min(50, d * 2),
      bloecke: bloecke
    };
  }

  /*
   * Zielführung je Level (siehe welt.js, abwurfBei): wie weit die Wurfrichtung zur Bauwerksflanke gedreht
   * werden darf (rad) und wie viel Tempo höchstens dazukommt. Level 1–3 großzügig für den Einstieg,
   * danach enger, damit das Timing der Kern bleibt. Geprüft im Machbarkeitstest (Fensterbreiten).
   */
  function lenkung(nr) {
    if (nr <= 3) return { winkel: 1.6, schub: 10, tempo: 11 };
    if (nr <= 10) return { winkel: 0.8, schub: 4, tempo: 11 };
    var t = Math.min(1, (nr - 10) / 30);
    return { winkel: 0.8 - 0.3 * t, schub: 4 - 1.5 * t, tempo: 11 };
  }

  var PERIODE_EINSTIEG = 2800;   // langsameres Pendel in Level 1–3 (sonst 2200 ms, siehe welt.js)

  // Level nach Nummer (ab 1). Gleiche Nummer = immer gleiches Bauwerk.
  function holeLevel(nr) {
    var level;
    if (nr >= 1 && nr <= HANDGEBAUT.length) level = HANDGEBAUT[nr - 1]();
    else level = erzeuge(nr * 7919 + 104729, nr - HANDGEBAUT.length - 1);
    level.nr = nr;
    level.lenkung = lenkung(nr);
    if (nr <= 3) {
      level.periode = PERIODE_EINSTIEG;
      level.drehpunkt = level.drehpunkt || 1.05;   // Bogen weiter links: länger zur Flanke lenkbar
    }
    return level;
  }

  var Level = {
    holeLevel: holeLevel,
    erzeuge: erzeuge,
    lenkung: lenkung,
    ANZAHL_HANDGEBAUT: HANDGEBAUT.length,
    MAX_BLOECKE: MAX_BLOECKE
  };

  if (istNode) module.exports = Level;
  else wurzel.Level = Level;
})(this);
