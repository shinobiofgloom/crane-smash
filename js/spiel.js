/*
 * Spielsteuerung: Ablauf der Level, Eingabe (ein Tipp), Anzeige, Ergebnis, Upgrades,
 * Werbepausen und Plattform-Aufrufe. Startet sofort in einem Level, ohne Startmenü.
 */
(function () {
  'use strict';

  var K = AbrissWelt.K;
  var SCHRITT = K.SCHRITT_MS;

  var el = function (id) { return document.getElementById(id); };
  var canvas = el('spielfeld');
  var bild = Darstellung.erzeuge(canvas);
  var eff = new Effekte();
  var stand = Fortschritt.laden();

  var zustand = 'start';                // 'spiel' | 'ergebnis' | 'laden' | 'werbung'
  var welt = null, level = null, levelNr = 1;
  var akku = 0, letzteZeit = 0;
  var zeitlupe = { rest: 0, benutzt: false, staerke: 0 };
  var levelStart = 0, letzterTipp = 0, endeTimer = -1, ergebnis = null;
  var platsch = {}, ketteZeiten = [], raeumZeiten = [], ketteGezeigt = 0, zielGemeldet = false;
  var obenFrei = 70;
  var hudAlt = {};
  var bannerTimer = null;
  var handFenster = null;               // Phasenfenster der Tutorial-Hand (aus der Vorschau berechnet)
  var idealWunsch = false;              // Testhilfe: im Idealmoment lösen
  var idealFenster = null;

  function jetzt() { return performance.now(); }

  // ---------------------------------------------------------------- Größe und Kamera

  function groesseAnpassen() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    bild.groesse(window.innerWidth, window.innerHeight, dpr);
    obenFrei = el('hud').offsetHeight + 12;
    if (welt) bild.setzeKamera(welt.grenzen(), obenFrei, 8);
  }

  // ---------------------------------------------------------------- Level

  function starteLevel(nr) {
    levelNr = nr;
    level = Level.holeLevel(nr);
    welt = AbrissWelt.erzeuge(level, Fortschritt.weltOptionen(stand));
    welt.vorlauf(60);                   // Physik ruhen lassen, Bauwerk schlafen legen
    handFenster = welt.handFenster();
    idealWunsch = false;
    eff.leeren();
    akku = 0;
    zeitlupe = { rest: 0, benutzt: false, staerke: 0 };
    endeTimer = -1;
    ergebnis = null;
    platsch = {};
    ketteZeiten = [];
    raeumZeiten = [];
    ketteGezeigt = 0;
    zielGemeldet = false;
    levelStart = jetzt();
    letzterTipp = jetzt();
    hudAlt = {};
    schliesseFenster();
    groesseAnpassen();
    zeigeBanner();
    zustand = 'spiel';
    Plattform.spielStart();
    Plattform.ereignis('level_start', { level: nr, typ: level.typ, bloecke: level.bloecke.length });
  }

  function zeigeBanner() {
    el('bannerTitel').textContent = TEXTE.level + ' ' + levelNr;
    el('bannerZiel').textContent = TEXTE.ziel + ' ' + Math.round(level.ziel * 100) + '%';
    var b = el('banner');
    b.classList.add('sichtbar');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { b.classList.remove('sichtbar'); }, 1500);
  }

  // ---------------------------------------------------------------- Eingabe

  function tippen() {
    Ton.start();
    if (zustand !== 'spiel' || !welt) return;
    letzterTipp = jetzt();
    if (welt.loesen()) el('banner').classList.remove('sichtbar');
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    tippen();
  });
  // Ton darf erst nach der ersten Berührung starten, egal wo
  ['pointerdown', 'touchend', 'click'].forEach(function (art) {
    document.addEventListener(art, function () { Ton.start(); }, true);   // iOS entsperrt Ton teils erst bei touchend
  });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  document.addEventListener('keydown', function (e) {
    var taste = e.key;
    if (taste === ' ' || taste === 'Enter') {
      e.preventDefault();
      Ton.start();
      if (zustand === 'spiel') tippen();
      else if (zustand === 'ergebnis') weiter();
      else if (zustand === 'laden') schliesseLaden();
    } else if (taste === 'Escape' && zustand === 'laden') {
      schliesseLaden();
    }
  });

  function knopf(id, fn) {
    el(id).addEventListener('click', function (e) {
      e.preventDefault();
      this.blur();
      fn();
    });
  }

  knopf('tonKnopf', function () {
    Ton.start();
    stand.stumm = !Ton.istStumm();
    Ton.setzeStumm(stand.stumm);
    Fortschritt.speichern(stand);
    tonSymbol();
  });

  function tonSymbol() {
    el('tonKnopf').innerHTML = '<svg class="icon"><use href="#' + (stand.stumm ? 'i-ton-aus' : 'i-ton-an') + '"/></svg>';
  }

  // ---------------------------------------------------------------- Ereignisse der Welt

  var SPLITTER_FARBEN = {
    holz: ['#f2a65a', '#c97a35', '#ffd09a'],
    stein: ['#a7b0bd', '#7c8696', '#d5dae2'],
    gold: ['#ffd23f', '#fff3a0', '#e0a100'],
    glas: ['#bfefff', '#ffffff'],
    stahl: ['#7d8798', '#5d6676']
  };

  function verarbeiteEreignisse() {
    var liste = welt.holeEreignisse();
    var t = jetzt();
    for (var i = 0; i < liste.length; i++) {
      var e = liste[i];
      if (e.art === 'treffer') {
        if (e.staerke < 1.5) continue;
        if (e.mat === 'holz' || e.mat === 'gold') Ton.holz(e.staerke);
        else if (e.mat === 'stein') Ton.stein(e.staerke);
        else if (e.mat === 'glas') Ton.glasKling(e.staerke);
        else Ton.stahl(e.staerke);
        if (e.staerke > 2.2) {
          eff.staub(e.x, e.y, e.birne ? 5 : 2, '#efe3cc');
          eff.splitter(e.x, e.y, e.birne ? 7 : 3, SPLITTER_FARBEN[e.mat] || SPLITTER_FARBEN.stahl, e.birne ? 1 : 0.6);
        }
        if (e.birne) eff.wackle(Math.min(14, e.staerke * 1.3) * (e.mat === 'stein' ? 1.2 : 1));
      } else if (e.art === 'glas') {
        Ton.glas();
        eff.scherben(e.x, e.y, e.vx, e.vy, e.b, e.h);
        eff.wackle(4);
      } else if (e.art === 'geraeumt') {
        geraeumt(e, t);
      } else if (e.art === 'boom') {
        Ton.boom();
        eff.ring(e.x, e.y, e.r, '#ffffff', 0.5);
        eff.ring(e.x, e.y, e.r * 0.7, '#ffd23f', 0.6);
        eff.konfetti(e.x, e.y, 40);
        eff.staub(e.x, e.y, 10, '#fff1d6');
        eff.text(e.x, e.y - 40, TEXTE.boom, '#ff5d73', 40);
        eff.wackle(20);
      } else if (e.art === 'geloest') {
        Ton.loesen();
      } else if (e.art === 'bereit') {
        Ton.kette();
        handFenster = welt.handFenster();          // Bauwerk hat sich verändert
      } else if (e.art === 'fehlwurf') {
        var kr = welt.kran;
        eff.hinweis({
          text: e.richtung === 'frueh' ? TEXTE.zuFrueh : TEXTE.zuSpaet,
          px: kr.px, py: kr.py, R: kr.L + kr.r + 16, von: e.thetaLoes, bis: e.thetaIdeal,
          farbe: e.richtung === 'frueh' ? '#ffd23f' : '#ff9f1c'
        });
      } else if (e.art === 'fertig') {
        endeTimer = 750;
      }
    }
  }

  function geraeumt(e, t) {
    var muenzen = Wertung.blockMuenzen(e.mat, e.kette);
    var x = Math.max(welt.plattform.links + 20, Math.min(welt.plattform.rechts - 10, e.x));
    var y = Math.min(e.y, -10) - 24;
    if (e.gold) {
      Ton.gold();
      eff.glanz(x, y, 18, '#fff3a0');
      eff.text(x, y - 26, TEXTE.gold + ' +' + muenzen, '#ffd23f', 30);
    } else {
      Ton.muenze(e.kette);
      eff.text(x, y, '+' + muenzen, e.kette ? '#7cf0c8' : '#ffd23f', 22);
    }
    // Kettenreaktion: Blöcke, die die Birne nie berührt hat, kurz hintereinander
    if (e.kette) {
      ketteZeiten.push(t);
      while (ketteZeiten.length && t - ketteZeiten[0] > 1600) ketteZeiten.shift();
      var n = ketteZeiten.length;
      if (n >= 3 && n >= ketteGezeigt + 2) {
        ketteGezeigt = n;
        var b = welt.bauwerk;
        eff.text((b.links + b.rechts) / 2, b.oben - 30, text(TEXTE.kettenreaktion, { n: n }), '#7cf0c8', 32);
      }
      if (n === 1) ketteGezeigt = 0;
    }
    // Ziel erreicht?
    var stat = welt.statistik();
    if (!zielGemeldet && stat.anteil + 1e-9 >= level.ziel) {
      zielGemeldet = true;
      var bw = welt.bauwerk;
      eff.text((bw.links + bw.rechts) / 2, bw.oben - 70, TEXTE.zielErreicht, '#ffffff', 36);
      eff.glanz((bw.links + bw.rechts) / 2, bw.oben - 70, 14, '#ffffff');
      Ton.sieg();
      if (welt.zustand === 'ausrollen') starteZeitlupe();
    }
    // Zeitlupe beim letzten großen Einsturz
    raeumZeiten.push(t);
    while (raeumZeiten.length && t - raeumZeiten[0] > 800) raeumZeiten.shift();
    if (welt.zustand === 'ausrollen' && raeumZeiten.length >= 4) starteZeitlupe();
  }

  function starteZeitlupe() {
    if (zeitlupe.benutzt) return;
    zeitlupe.benutzt = true;
    zeitlupe.rest = 1.1;
  }

  // Blöcke, die ins Wasser fallen, spritzen
  function pruefePlatsch() {
    var wy = Darstellung.WASSER_Y;
    for (var i = 0; i < welt.bloecke.length; i++) {
      var b = welt.bloecke[i];
      if (b.entfernt || !b.geraeumt || platsch[i]) continue;
      if (b.koerper.position.y > wy) {
        platsch[i] = true;
        eff.spritzer(b.koerper.position.x, wy, 8);
        Ton.platsch();
      }
    }
    for (var j = 0; j < welt.birnen.length; j++) {
      var bi = welt.birnen[j];
      if (!bi.platsch && bi.koerper.position.y > wy) {
        bi.platsch = true;
        eff.spritzer(bi.koerper.position.x, wy, 14);
        Ton.platsch();
      }
    }
  }

  // ---------------------------------------------------------------- Anzeige oben

  function setze(id, schluessel, wert, fn) {
    if (hudAlt[schluessel] === wert) return;
    hudAlt[schluessel] = wert;
    fn(el(id), wert);
  }

  function aktualisiereHud() {
    if (!welt) return;
    var stat = welt.statistik();
    var w = Wertung.berechne(stat, level.ziel);
    setze('levelAnzeige', 'level', levelNr, function (e, v) { e.textContent = TEXTE.level + ' ' + v; });
    var birnenText = welt.optionen.birnen + ':' + welt.birnenUebrig + ':' + welt.optionen.sprengStufe;
    setze('birnenAnzeige', 'birnen', birnenText, function (e) {
      // Reihenfolge wie geworfen: verbrauchte links (blass), die letzte ist ggf. die Sprengbirne
      var html = '';
      var n = welt.optionen.birnen;
      for (var i = 0; i < n; i++) {
        var verbraucht = i < n - welt.birnenUebrig;
        var spreng = welt.optionen.sprengStufe > 0 && i === n - 1;
        html += '<svg class="icon' + (verbraucht ? ' leer' : '') + '" style="color:' + (spreng ? '#ff5d73' : '#ffffff') + '"><use href="#i-birne"/></svg>';
      }
      e.innerHTML = html;
    });
    setze('prozentText', 'prozent', w.prozent, function (e, v) { e.textContent = v + '%'; });
    setze('balken', 'balken', w.prozent, function (e, v) { e.style.width = 'calc(' + v + '% - 4px)'; });
    var grenzen = Wertung.sternGrenzen(level.ziel);
    setze('fortschritt', 'grenzen', level.ziel, function () {
      for (var i = 0; i < 3; i++) el('marke' + i).style.left = (grenzen[i] * 100) + '%';
      el('zielStrich').style.left = (grenzen[0] * 100) + '%';
    });
    setze('fortschritt', 'sterne', w.sterne, function (e, v) {
      for (var i = 0; i < 3; i++) el('marke' + i).classList.toggle('an', v > i);
      e.classList.toggle('erreicht', v > 0);
    });
    setze('muenzZahl', 'muenzen', stand.muenzen + (ergebnis ? 0 : w.laufend), function (e, v) { e.textContent = v; });
  }

  // ---------------------------------------------------------------- Tutorial-Hand

  function berechneHand() {
    if (zustand !== 'spiel' || !welt || welt.zustand !== 'schwingt') return null;
    var tutorial = levelNr === 1 && !stand.tutorialFertig;
    var leerlauf = jetzt() - letzterTipp > 6000;
    if (!tutorial && !leerlauf) return null;
    var tipp = handFenster;
    if (!tipp) return null;
    var ph = welt.pendel(akku).phase;
    var vor = 0.08, nach = 0.06, druck = 0;
    if (ph >= tipp.von - vor && ph < tipp.von) druck = (ph - (tipp.von - vor)) / vor;
    else if (ph >= tipp.von && ph <= tipp.bis) druck = 1;
    else if (ph > tipp.bis && ph < tipp.bis + nach) druck = 1 - (ph - tipp.bis) / nach;
    // Hand unter der Stelle, an der die Birne im richtigen Moment ist
    var kr = welt.kran;
    var mitte = (tipp.von + tipp.bis) / 2;
    var th = -kr.A * Math.cos(2 * Math.PI * mitte);
    var p = bild.weltZuBild(kr.px + kr.L * Math.sin(th), kr.py + kr.L * Math.cos(th) + kr.r);
    var groesse = Math.max(48, Math.min(96, 80 * bild.kam.s * 1.6));
    return { x: p.x, y: p.y + groesse * 0.68 + 8, groesse: groesse, druck: druck, alpha: tutorial ? 1 : 0.85 };
  }

  // ---------------------------------------------------------------- Ergebnis

  function zeigeErgebnis() {
    var stat = welt.statistik();
    ergebnis = Wertung.berechne(stat, level.ziel);
    var dauer = Math.round((jetzt() - levelStart) / 1000);
    var alteSterne = stand.sterne[levelNr] || 0;
    stand.muenzen += ergebnis.muenzen;
    if (ergebnis.gewonnen) {
      stand.sterne[levelNr] = Math.max(alteSterne, ergebnis.sterne);
      stand.hoechstes = Math.max(stand.hoechstes, levelNr + 1);
      stand.level = levelNr + 1;
      if (levelNr === 1) stand.tutorialFertig = true;
    } else {
      stand.level = levelNr;
    }
    Fortschritt.speichern(stand);
    zustand = 'ergebnis';
    Plattform.spielStopp();
    Plattform.ereignis('level_ende', {
      level: levelNr, dauer: dauer, ergebnis: ergebnis.gewonnen ? 'geschafft' : 'verfehlt',
      sterne: ergebnis.sterne, prozent: ergebnis.prozent, muenzen: ergebnis.muenzen
    });
    if (ergebnis.sterne === 3 || (ergebnis.gewonnen && alteSterne > 0 && ergebnis.sterne > alteSterne)) Plattform.freude();

    // Fenster füllen
    var titel = TEXTE.nichtGeschafft;
    if (ergebnis.sterne === 3) titel = TEXTE.perfekt;
    else if (ergebnis.gewonnen) titel = TEXTE.geschafft;
    else if (ergebnis.anteil >= level.ziel - 0.1) titel = TEXTE.knapp;
    el('ergTitel').textContent = titel;
    el('ergProzent').textContent = ergebnis.prozent + '%  ·  ' + TEXTE.ziel + ' ' + Math.round(level.ziel * 100) + '%';
    var symbole = { schaden: 'i-schaden', gold: 'i-gold', kette: 'i-kettenreaktion', sterne: 'i-stern', birnen: 'i-birne' };
    var html = '';
    ergebnis.posten.forEach(function (p) {
      if (!p.muenzen) return;
      var farbe = p.art === 'sterne' ? ' style="color:#ffcc00"' : (p.art === 'birnen' ? ' style="color:#2d3142"' : '');
      html += '<li><svg class="icon"' + farbe + '><use href="#' + symbole[p.art] + '"/></svg>' + TEXTE.posten[p.art] +
        ' ×' + p.anzahl + '<span class="wert">+' + p.muenzen + '<svg class="icon"><use href="#i-muenze"/></svg></span></li>';
    });
    el('ergPosten').innerHTML = html;
    var sterne = el('ergSterne').children;
    for (var i = 0; i < 3; i++) sterne[i].classList.remove('an');
    el('knopfNochmal').style.display = ergebnis.gewonnen ? '' : 'none';
    el('knopfWeiterText').textContent = ergebnis.gewonnen ? TEXTE.weiter : TEXTE.nochmal;
    el('knopfWeiter').querySelector('use').setAttribute('href', ergebnis.gewonnen ? '#i-weiter' : '#i-nochmal');
    ladenPunkt();
    oeffne('ergebnis');

    // Sterne nacheinander, Münzen zählen hoch
    for (var s = 0; s < ergebnis.sterne; s++) {
      (function (nr) {
        setTimeout(function () {
          sterne[nr].classList.add('an');
          Ton.stern(nr);
          eff.glanz((welt.bauwerk.links + welt.bauwerk.rechts) / 2, welt.bauwerk.oben - 40, 6, '#fff3a0');
        }, 350 + nr * 320);
      })(s);
    }
    if (!ergebnis.gewonnen) setTimeout(function () { Ton.pech(); }, 250);
    else if (ergebnis.sterne === 3) setTimeout(function () { eff.konfetti((welt.bauwerk.links + welt.bauwerk.rechts) / 2, welt.bauwerk.oben - 60, 50); Ton.sieg(); }, 1350);
    var ziel = ergebnis.muenzen, start = jetzt();
    (function zaehlen() {
      var f = Math.min(1, (jetzt() - start) / 900);
      el('ergSummeZahl').textContent = '+' + Math.round(ziel * f);
      if (f < 1 && zustand !== 'spiel') requestAnimationFrame(zaehlen);
    })();
  }

  function weiter() {
    if (zustand !== 'ergebnis') return;
    Ton.klick();
    var naechstes = ergebnis && ergebnis.gewonnen ? levelNr + 1 : levelNr;
    if (ergebnis && ergebnis.gewonnen) {
      // Natürliche Pause nach jedem geschafften Level, vor dem nächsten. Wie oft wirklich Werbung kommt,
      // steuert die Plattform selbst (Poki verbietet eigene Zähler, CrazyGames hat eine Abkühlzeit).
      zustand = 'werbung';
      schliesseFenster();
      Ton.anhalten();
      Plattform.werbepause(function () {
        Ton.fortsetzen();
        starteLevel(naechstes);
      });
    } else {
      starteLevel(naechstes);
    }
  }

  knopf('knopfWeiter', weiter);
  knopf('knopfNochmal', function () {
    if (zustand !== 'ergebnis') return;
    Ton.klick();
    starteLevel(levelNr);
  });
  knopf('knopfLaden', function () {
    if (zustand !== 'ergebnis') return;
    Ton.klick();
    oeffneLaden();
  });
  knopf('knopfLadenFertig', function () { schliesseLaden(); });

  function oeffne(id) {
    el('ergebnis').classList.toggle('offen', id === 'ergebnis');
    el('laden').classList.toggle('offen', id === 'laden');
  }
  function schliesseFenster() { oeffne(null); }

  function ladenPunkt() {
    el('ladenPunkt').classList.toggle('an', Fortschritt.etwasKaufbar(stand));
  }

  // ---------------------------------------------------------------- Upgrades

  var UP_SYMBOL = { schwer: 'i-schwer', kette: 'i-kette', birne: 'i-plus', spreng: 'i-boom', ziel: 'i-ziel' };

  function oeffneLaden() {
    zustand = 'laden';
    zeichneLaden(null);
    oeffne('laden');
  }

  function schliesseLaden() {
    if (zustand !== 'laden') return;
    Ton.klick();
    zustand = 'ergebnis';
    ladenPunkt();
    oeffne('ergebnis');
  }

  function zeichneLaden(gekauftId) {
    el('ladenMuenzZahl').textContent = stand.muenzen;
    el('muenzZahl').textContent = stand.muenzen;
    hudAlt.muenzen = stand.muenzen;
    var gitter = el('ladenGitter');
    gitter.innerHTML = '';
    Fortschritt.UPGRADES.forEach(function (up) {
      var stufe = stand.upgrades[up.id];
      var p = Fortschritt.pruefeKauf(stand, up.id);
      var karte = document.createElement('div');
      karte.className = 'upkarte' + (gekauftId === up.id ? ' gekauft' : '');
      var stufen = '';
      for (var i = 0; i < up.kosten.length; i++) stufen += '<i class="' + (i < stufe ? 'an' : '') + '"></i>';
      var knopfInhalt;
      if (p.grund === 'max') knopfInhalt = TEXTE.max;
      else if (p.grund === 'gesperrt') knopfInhalt = '<svg class="icon"><use href="#i-schloss"/></svg>' + text(TEXTE.abLevel, { n: up.abLevel });
      else knopfInhalt = '<svg class="icon"><use href="#i-muenze"/></svg>' + p.preis;
      karte.innerHTML = '<div class="bild"><svg class="icon"><use href="#' + UP_SYMBOL[up.id] + '"/></svg></div>' +
        '<div class="name">' + TEXTE.upgrade[up.id].name + '</div>' +
        '<div class="info">' + TEXTE.upgrade[up.id].info + '</div>' +
        '<div class="stufen">' + stufen + '</div>' +
        '<button' + (p.ok ? '' : ' disabled') + '>' + knopfInhalt + '</button>';
      karte.querySelector('button').addEventListener('click', function (e) {
        e.preventDefault();
        var r = Fortschritt.kaufe(stand, up.id);
        if (!r.ok) return;
        Ton.kauf();
        Fortschritt.speichern(stand);
        Plattform.ereignis('kauf', { upgrade: up.id, stufe: r.stufe, preis: r.preis });
        zeichneLaden(up.id);
      });
      gitter.appendChild(karte);
    });
  }

  // ---------------------------------------------------------------- Hauptschleife

  function schleife(t) {
    requestAnimationFrame(schleife);
    var dtMs = letzteZeit ? Math.min(50, t - letzteZeit) : 16.67;
    letzteZeit = t;

    // Zeitlupe: kurz auf 30 % Tempo, dann weich zurück
    var faktor = 1;
    if (zeitlupe.rest > 0) {
      zeitlupe.rest -= dtMs / 1000;
      faktor = zeitlupe.rest > 0.3 ? 0.3 : 0.3 + (0.3 - Math.max(0, zeitlupe.rest)) / 0.3 * 0.7;
    }
    zeitlupe.staerke = zeitlupe.rest > 0 ? Math.min(1, zeitlupe.rest / 0.3) : 0;

    if (welt && zustand !== 'werbung' && zustand !== 'start') {
      akku += dtMs * faktor;
      var n = 0;
      while (akku >= SCHRITT && n < 4) {
        if (idealWunsch) pruefeIdeal();
        welt.schritt();
        akku -= SCHRITT;
        n++;
      }
      if (akku >= SCHRITT) akku = 0;   // nach langer Pause nicht aufholen
      verarbeiteEreignisse();
      pruefePlatsch();
      if (endeTimer > 0) {
        endeTimer -= dtMs;
        if (endeTimer <= 0 && zustand === 'spiel') zeigeErgebnis();
      }
    }
    eff.update(dtMs / 1000 * faktor);
    aktualisiereHud();
    bild.zeichne(welt, {
      dt: dtMs / 1000, alpha: Math.min(1, akku / SCHRITT), effekte: eff, hand: berechneHand(),
      zeitlupe: zeitlupe.staerke, schrittMs: SCHRITT, vorschau: berechneVorschau()
    });
  }

  // Flugbahn-Vorschau: Level 1–5 immer, danach mit dem Upgrade "Zielhilfe" (nur der Anfang der Bahn)
  function berechneVorschau() {
    if (zustand !== 'spiel' || !welt || welt.zustand !== 'schwingt') return null;
    var art = Fortschritt.vorschau(stand, levelNr);
    if (!art) return null;
    var v = welt.vorschau(Math.min(1, akku / SCHRITT) * SCHRITT);
    if (!v) return null;
    return { punkte: v.punkte, kontakt: v.kontakt, anteil: art.anteil, farbe: art.farbe };
  }

  // Testhilfe: löst, sobald die Pendelphase die Mitte des Trefferfensters erreicht
  function pruefeIdeal() {
    if (zustand !== 'spiel' || !welt || welt.zustand !== 'schwingt') return;
    if (!idealFenster) idealFenster = welt.trefferFenster(0.01) || { mitte: 0.25 };
    var jetztPh = welt.phase();
    var naechste = welt.pendel(SCHRITT).phase;
    var m = idealFenster.mitte;
    var trifft = naechste >= jetztPh ? (m >= jetztPh && m < naechste) : (m >= jetztPh || m < naechste);
    if (trifft) {
      idealWunsch = false;
      idealFenster = null;
      welt.loesen();
    }
  }

  // ---------------------------------------------------------------- Start

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (zustand === 'spiel') Plattform.spielStopp();
      Ton.anhalten();
    } else {
      if (zustand === 'spiel') Plattform.spielStart();
      if (zustand !== 'werbung') Ton.fortsetzen();
    }
  });
  window.addEventListener('resize', groesseAnpassen);
  window.addEventListener('orientationchange', function () { setTimeout(groesseAnpassen, 200); });

  el('knopfWeiterText').textContent = TEXTE.weiter;
  el('knopfLadenFertig').textContent = TEXTE.fertig;
  el('ladenTitel').textContent = TEXTE.upgrades;
  document.title = TEXTE.titel;
  Ton.setzeStumm(stand.stumm);
  tonSymbol();
  groesseAnpassen();

  // Testhilfe nur mit URL-Parameter ?debug=1 (ohne Parameter existiert window.__spiel nicht)
  var mitDebug = false;
  try { mitDebug = /[?&]debug=1(&|$)/.test(window.location.search); } catch (e) { mitDebug = false; }
  if (mitDebug) {
    window.__spiel = {
      // Löst die nächste Birne im Idealmoment (Mitte des Trefferfensters), sobald sie schwingt
      loeseIdeal: function () {
        if (zustand !== 'spiel') return false;
        idealWunsch = true;
        idealFenster = null;
        return true;
      },
      // Springt direkt in Level n (Fortschritt wird erst beim Abschluss gespeichert)
      springeZuLevel: function (n) {
        var nr = Math.max(1, Math.floor(Number(n) || 1));
        starteLevel(nr);
        return nr;
      }
    };
  }

  Plattform.init().then(function () {
    starteLevel(Math.max(1, stand.level));
    Plattform.ladenFertig();
    requestAnimationFrame(schleife);
  });
})();
