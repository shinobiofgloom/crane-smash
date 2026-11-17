/*
 * Darstellung auf Canvas 2D: Himmel, Wasser, Kran mit Kette und Birne, Plattform, Blöcke,
 * Splitter, Effekte und Tutorial-Hand. Liest nur aus der Welt, verändert sie nie.
 */
var Darstellung = (function () {
  'use strict';

  var WASSER_Y = AbrissWelt.K.WASSER_Y;   // Wasserlinie in Welt-Einheiten (unter der Plattform)
  var SCHRIFT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

  var FARBE = {
    himmelOben: '#5cb8f0', himmelUnten: '#c7ecff',
    sonne: '#ffe066', wolke: '#ffffff',
    stadt1: '#a9d3ee', stadt2: '#8fc2e4',
    wasserOben: '#3ba7e6', wasserUnten: '#17609f', welle: '#9fdcff',
    kran: '#ffb400', kranDunkel: '#c77f00', kontur: '#1d2b53',
    stahl: '#5d6676', stahlHell: '#7d8798', warnGelb: '#ffcc00',
    beton: '#b9b2a6', betonDunkel: '#8f887c',
    kette: '#3a3f4b'
  };

  function rundRechteck(c, x, y, b, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + b - r, y);
    c.quadraticCurveTo(x + b, y, x + b, y + r);
    c.lineTo(x + b, y + h - r);
    c.quadraticCurveTo(x + b, y + h, x + b - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  // Kleiner fester Zufall für Muster (Steinsprenkel), damit Sprites stabil aussehen
  function musterZufall(seed) {
    var a = seed * 9301 + 49297;
    return function () { a = (a * 9301 + 49297) % 233280; return a / 233280; };
  }

  // Ein Block in lokalen Koordinaten (Mitte = 0,0), Einheit = Welt-Einheiten
  function zeichneBlock(c, mat, b, h) {
    var r = Math.min(5, b / 5, h / 5);
    var x = -b / 2, y = -h / 2;
    var i, z;
    c.lineJoin = 'round';
    if (mat === 'holz') {
      rundRechteck(c, x, y, b, h, r);
      c.fillStyle = '#f2a65a';
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = 'rgba(255,255,255,0.28)';
      c.fillRect(x, y, b, Math.min(5, h * 0.2));
      c.fillStyle = 'rgba(120,60,15,0.18)';
      c.fillRect(x, y + h - Math.min(5, h * 0.2), b, Math.min(5, h * 0.2));
      c.strokeStyle = 'rgba(140,70,20,0.5)';
      c.lineWidth = 1.5;
      if (b >= h) {
        var reihen = Math.max(1, Math.round(h / 14));
        for (i = 1; i <= reihen; i++) {
          var yy = y + h * i / (reihen + 1);
          c.beginPath();
          c.moveTo(x + 3, yy);
          c.bezierCurveTo(x + b * 0.3, yy - 2, x + b * 0.6, yy + 2, x + b - 3, yy);
          c.stroke();
        }
      } else {
        var spalten = Math.max(1, Math.round(b / 14));
        for (i = 1; i <= spalten; i++) {
          var xx = x + b * i / (spalten + 1);
          c.beginPath();
          c.moveTo(xx, y + 3);
          c.bezierCurveTo(xx - 2, y + h * 0.3, xx + 2, y + h * 0.6, xx, y + h - 3);
          c.stroke();
        }
      }
      c.restore();
      c.fillStyle = '#7a4214';
      if (b >= 30 && h >= 30) {
        [[x + 5, y + 5], [x + b - 5, y + 5], [x + 5, y + h - 5], [x + b - 5, y + h - 5]].forEach(function (p) {
          c.beginPath(); c.arc(p[0], p[1], 1.6, 0, Math.PI * 2); c.fill();
        });
      }
      rundRechteck(c, x, y, b, h, r);
      c.strokeStyle = '#6b3410';
      c.lineWidth = 2.5;
      c.stroke();
    } else if (mat === 'glas') {
      rundRechteck(c, x, y, b, h, r);
      c.fillStyle = 'rgba(170,232,255,0.62)';
      c.fill();
      c.save();
      c.clip();
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.lineWidth = Math.max(2, Math.min(b, h) * 0.12);
      c.beginPath();
      c.moveTo(x + b * 0.15, y + h * 0.95);
      c.lineTo(x + b * 0.55, y + h * 0.05);
      c.stroke();
      c.lineWidth = Math.max(1, Math.min(b, h) * 0.05);
      c.beginPath();
      c.moveTo(x + b * 0.45, y + h * 0.95);
      c.lineTo(x + b * 0.75, y + h * 0.1);
      c.stroke();
      c.restore();
      rundRechteck(c, x + 3, y + 3, b - 6, h - 6, Math.max(1, r - 2));
      c.strokeStyle = 'rgba(255,255,255,0.55)';
      c.lineWidth = 1.2;
      c.stroke();
      rundRechteck(c, x, y, b, h, r);
      c.strokeStyle = '#2b84b6';
      c.lineWidth = 2.5;
      c.stroke();
    } else if (mat === 'stein') {
      rundRechteck(c, x, y, b, h, r);
      var g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#b9c1cc');
      g.addColorStop(1, '#8e98a6');
      c.fillStyle = g;
      c.fill();
      c.save();
      c.clip();
      z = musterZufall(Math.round(b * 7 + h * 13));
      var sprenkel = Math.round(b * h / 90);
      for (i = 0; i < sprenkel; i++) {
        c.fillStyle = z() < 0.5 ? 'rgba(90,100,115,0.45)' : 'rgba(230,235,240,0.5)';
        c.beginPath();
        c.arc(x + z() * b, y + z() * h, 0.8 + z() * 1.8, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = 'rgba(60,66,78,0.55)';
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(x + b * 0.62, y);
      c.lineTo(x + b * 0.55, y + h * 0.35);
      c.lineTo(x + b * 0.7, y + h * 0.55);
      c.stroke();
      c.restore();
      rundRechteck(c, x, y, b, h, r);
      c.strokeStyle = '#424955';
      c.lineWidth = 2.5;
      c.stroke();
    } else if (mat === 'gold') {
      rundRechteck(c, x, y, b, h, r);
      var gg = c.createLinearGradient(x, y, x + b, y + h);
      gg.addColorStop(0, '#fff07a');
      gg.addColorStop(0.5, '#ffcc1a');
      gg.addColorStop(1, '#f0a000');
      c.fillStyle = gg;
      c.fill();
      // Kistenrahmen mit Kreuzlatte
      c.strokeStyle = '#c98400';
      c.lineWidth = 3;
      rundRechteck(c, x + 4, y + 4, b - 8, h - 8, 2);
      c.stroke();
      c.beginPath();
      c.moveTo(x + 6, y + h - 6);
      c.lineTo(x + b - 6, y + 6);
      c.stroke();
      // Münzzeichen in der Mitte
      c.fillStyle = '#fff6c2';
      c.beginPath();
      c.arc(0, 0, Math.min(b, h) * 0.2, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#b37400';
      c.lineWidth = 2;
      c.stroke();
      rundRechteck(c, x, y, b, h, r);
      c.strokeStyle = '#7a4f00';
      c.lineWidth = 2.5;
      c.stroke();
    }
  }

  function Darstellung(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.breite = 1;
    this.hoehe = 1;
    this.kam = { s: 1, ox: 0, oy: 0 };
    this.sprites = {};
    this.zeit = 0;
    this.wolken = [];
    for (var i = 0; i < 5; i++) {
      this.wolken.push({ x: Math.random(), y: 0.06 + Math.random() * 0.3, g: 0.6 + Math.random() * 0.8, v: 0.004 + Math.random() * 0.006 });
    }
    this.stadt = [];
    var x = 0;
    while (x < 1.2) {
      var b = 0.03 + Math.random() * 0.05;
      this.stadt.push({ x: x, b: b, h: 0.05 + Math.random() * 0.14, ebene: Math.random() < 0.5 ? 1 : 2 });
      x += b * (0.7 + Math.random() * 0.5);
    }
  }

  Darstellung.prototype.groesse = function (breite, hoehe, dpr) {
    this.breite = breite;
    this.hoehe = hoehe;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(breite * dpr));
    this.canvas.height = Math.max(1, Math.round(hoehe * dpr));
    this.sprites = {};
  };

  // Kamera so setzen, dass das Rechteck g ganz sichtbar ist (oben Platz für die Anzeige, Plattform unten)
  Darstellung.prototype.setzeKamera = function (g, obenFrei, untenFrei) {
    var alt = this.kam.s;
    this.kam = AbrissWelt.kamera(g, this.breite, this.hoehe, obenFrei, untenFrei);
    if (Math.abs(alt - this.kam.s) > 1e-6) this.sprites = {};
  };

  Darstellung.prototype.weltZuBild = function (x, y) {
    return { x: this.kam.ox + x * this.kam.s, y: this.kam.oy + y * this.kam.s };
  };

  Darstellung.prototype._sprite = function (mat, b, h) {
    var schluessel = mat + b + 'x' + h;
    var sp = this.sprites[schluessel];
    if (sp) return sp;
    var rand = 4;
    var f = this.kam.s * this.dpr;
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((b + rand * 2) * f));
    c.height = Math.max(1, Math.ceil((h + rand * 2) * f));
    var cx = c.getContext('2d');
    cx.scale(c.width / (b + rand * 2), c.height / (h + rand * 2));
    cx.translate(b / 2 + rand, h / 2 + rand);
    zeichneBlock(cx, mat, b, h);
    sp = { bild: c, rand: rand };
    this.sprites[schluessel] = sp;
    return sp;
  };

  // ---------------------------------------------------------------- Hintergrund (Bildschirm-Koordinaten)

  Darstellung.prototype._hintergrund = function (c, dt) {
    var B = this.breite, H = this.hoehe;
    var wasser = this.kam.oy + WASSER_Y * this.kam.s;
    var g = c.createLinearGradient(0, 0, 0, Math.max(1, wasser));
    g.addColorStop(0, FARBE.himmelOben);
    g.addColorStop(1, FARBE.himmelUnten);
    c.fillStyle = g;
    c.fillRect(0, 0, B, H);

    // Sonne mit drehenden Strahlen
    var m = Math.min(B, H);
    var sx = B * 0.86, sy = Math.max(70, H * 0.16), sr = m * 0.06;
    c.save();
    c.translate(sx, sy);
    c.rotate(this.zeit * 0.15);
    c.fillStyle = 'rgba(255,240,150,0.35)';
    for (var i = 0; i < 10; i++) {
      c.rotate(Math.PI / 5);
      c.beginPath();
      c.moveTo(sr * 1.1, -sr * 0.18);
      c.lineTo(sr * 2.1, 0);
      c.lineTo(sr * 1.1, sr * 0.18);
      c.closePath();
      c.fill();
    }
    c.restore();
    c.fillStyle = FARBE.sonne;
    c.beginPath();
    c.arc(sx, sy, sr, 0, Math.PI * 2);
    c.fill();

    // Wolken
    c.fillStyle = 'rgba(255,255,255,0.9)';
    for (var w = 0; w < this.wolken.length; w++) {
      var wo = this.wolken[w];
      wo.x += wo.v * dt;
      if (wo.x > 1.25) wo.x = -0.25;
      var wx = wo.x * B, wy = wo.y * Math.max(1, wasser), wg = m * 0.05 * wo.g;
      c.beginPath();
      c.arc(wx, wy, wg, 0, Math.PI * 2);
      c.arc(wx + wg * 1.1, wy - wg * 0.4, wg * 1.15, 0, Math.PI * 2);
      c.arc(wx + wg * 2.2, wy, wg * 0.9, 0, Math.PI * 2);
      c.rect(wx, wy, wg * 2.2, wg * 0.8);
      c.fill();
    }

    // Ferne Stadt (nur Gebäude, keine Figuren)
    for (var e = 2; e >= 1; e--) {
      c.fillStyle = e === 2 ? FARBE.stadt1 : FARBE.stadt2;
      for (var s = 0; s < this.stadt.length; s++) {
        var st = this.stadt[s];
        if (st.ebene !== e) continue;
        var hb = st.h * m * (e === 2 ? 1.3 : 1);
        c.fillRect(st.x * B - 10, wasser - hb, st.b * B, hb + 2);
      }
    }

    // Wasser hinten
    var gw = c.createLinearGradient(0, wasser, 0, H);
    gw.addColorStop(0, FARBE.wasserOben);
    gw.addColorStop(1, FARBE.wasserUnten);
    c.fillStyle = gw;
    c.fillRect(0, wasser, B, Math.max(0, H - wasser));
  };

  Darstellung.prototype._wasserVorne = function (c) {
    var B = this.breite, H = this.hoehe;
    var wasser = this.kam.oy + WASSER_Y * this.kam.s;
    if (wasser > H) return;
    c.fillStyle = 'rgba(30,120,190,0.72)';
    c.beginPath();
    c.moveTo(0, H);
    var welle = Math.max(3, 6 * this.kam.s);
    for (var x = 0; x <= B + 20; x += 20) {
      c.lineTo(x, wasser + Math.sin(x * 0.03 + this.zeit * 2.2) * welle);
    }
    c.lineTo(B, H);
    c.closePath();
    c.fill();
    c.strokeStyle = FARBE.welle;
    c.lineWidth = Math.max(2, 3 * this.kam.s);
    c.beginPath();
    for (var x2 = 0; x2 <= B + 20; x2 += 20) {
      var y2 = wasser + Math.sin(x2 * 0.03 + this.zeit * 2.2) * welle;
      if (x2 === 0) c.moveTo(x2, y2); else c.lineTo(x2, y2);
    }
    c.stroke();
  };

  // ---------------------------------------------------------------- Kran, Plattform (Welt-Koordinaten)

  function gitter(c, x1, y1, x2, y2, dicke, felder, senkrecht) {
    c.strokeStyle = FARBE.kontur;
    c.lineWidth = 2;
    c.fillStyle = FARBE.kran;
    if (senkrecht) {
      c.fillRect(x1 - dicke / 2, y1, dicke, y2 - y1);
      c.strokeRect(x1 - dicke / 2, y1, dicke, y2 - y1);
    } else {
      c.fillRect(x1, y1 - dicke / 2, x2 - x1, dicke);
      c.strokeRect(x1, y1 - dicke / 2, x2 - x1, dicke);
    }
    c.strokeStyle = FARBE.kranDunkel;
    c.lineWidth = 2.2;
    c.beginPath();
    for (var i = 0; i < felder; i++) {
      if (senkrecht) {
        var ya = y1 + (y2 - y1) * i / felder, yb = y1 + (y2 - y1) * (i + 1) / felder;
        c.moveTo(x1 - dicke / 2 + 3, ya + 2);
        c.lineTo(x1 + dicke / 2 - 3, yb - 2);
      } else {
        var xa = x1 + (x2 - x1) * i / felder, xb = x1 + (x2 - x1) * (i + 1) / felder;
        c.moveTo(xa + 2, y1 + dicke / 2 - 3);
        c.lineTo(xb - 2, y1 - dicke / 2 + 3);
      }
    }
    c.stroke();
  }

  Darstellung.prototype._kran = function (c, welt) {
    var k = welt.kran;
    var mastX = k.px - k.L * Math.sin(k.A) - k.r - 18;
    var auslegerY = k.py - 16;
    var bodenY = welt.plattform.links < mastX - 30 ? 0 : WASSER_Y + 40;
    // Betonsockel im Wasser, falls die Plattform nicht bis hierher reicht
    if (bodenY > 0) {
      c.fillStyle = FARBE.beton;
      c.strokeStyle = FARBE.kontur;
      c.lineWidth = 2.5;
      c.fillRect(mastX - 26, -6, 52, bodenY + 6);
      c.strokeRect(mastX - 26, -6, 52, bodenY + 6);
      c.fillStyle = FARBE.betonDunkel;
      c.fillRect(mastX - 26, 10, 52, 6);
    }
    // Mast
    gitter(c, mastX, auslegerY, mastX, Math.min(bodenY, 0) - 6, 24, Math.max(3, Math.round((-auslegerY) / 40)), true);
    // Ausleger und Gegenausleger
    gitter(c, mastX - 90, auslegerY, k.px + 34, auslegerY, 20, Math.max(4, Math.round((k.px + 124 - mastX) / 36)), false);
    c.fillStyle = FARBE.beton;
    c.strokeStyle = FARBE.kontur;
    c.lineWidth = 2.5;
    c.fillRect(mastX - 100, auslegerY + 10, 40, 30);
    c.strokeRect(mastX - 100, auslegerY + 10, 40, 30);
    // Spitze mit Abspannseilen
    c.strokeStyle = FARBE.kontur;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(mastX, auslegerY - 50);
    c.lineTo(k.px + 30, auslegerY - 8);
    c.moveTo(mastX, auslegerY - 50);
    c.lineTo(mastX - 95, auslegerY - 8);
    c.stroke();
    gitter(c, mastX, auslegerY - 52, mastX, auslegerY - 8, 14, 1, true);
    // Führerhaus (leer, nur Fenster)
    c.fillStyle = FARBE.kran;
    c.strokeStyle = FARBE.kontur;
    c.lineWidth = 2.5;
    rundRechteck(c, mastX + 10, auslegerY + 10, 34, 30, 4);
    c.fill();
    c.stroke();
    c.fillStyle = '#bfe9ff';
    c.fillRect(mastX + 22, auslegerY + 15, 17, 13);
    c.strokeRect(mastX + 22, auslegerY + 15, 17, 13);
    // Laufkatze am Drehpunkt
    c.fillStyle = FARBE.stahl;
    rundRechteck(c, k.px - 14, auslegerY + 6, 28, 12, 3);
    c.fill();
    c.stroke();
  };

  Darstellung.prototype._plattform = function (c, welt) {
    var p = welt.plattform;
    var b = p.rechts - p.links;
    // Stützen ins Wasser
    c.fillStyle = FARBE.stahl;
    c.strokeStyle = FARBE.kontur;
    c.lineWidth = 2.5;
    var stuetzen = Math.max(2, Math.round(b / 160));
    for (var i = 0; i <= stuetzen; i++) {
      var sx = p.links + 24 + (b - 48) * i / stuetzen;
      c.fillRect(sx - 9, p.dicke - 4, 18, WASSER_Y + 40);
      c.strokeRect(sx - 9, p.dicke - 4, 18, WASSER_Y + 40);
    }
    // Deck
    c.fillStyle = FARBE.stahlHell;
    c.fillRect(p.links, 0, b, p.dicke);
    c.fillStyle = FARBE.stahl;
    c.fillRect(p.links, p.dicke * 0.55, b, p.dicke * 0.45);
    // Warnstreifen an der Vorderkante
    c.save();
    c.beginPath();
    c.rect(p.links, 6, b, 12);
    c.clip();
    c.fillStyle = FARBE.warnGelb;
    c.fillRect(p.links, 6, b, 12);
    c.fillStyle = '#26262b';
    for (var x = p.links - 20; x < p.rechts + 20; x += 24) {
      c.beginPath();
      c.moveTo(x, 18);
      c.lineTo(x + 12, 6);
      c.lineTo(x + 22, 6);
      c.lineTo(x + 10, 18);
      c.closePath();
      c.fill();
    }
    c.restore();
    c.strokeRect(p.links, 0, b, p.dicke);
    // Pfeile zur rechten Kante: dorthin soll alles
    c.fillStyle = 'rgba(255,255,255,0.75)';
    for (var a = 0; a < 3; a++) {
      var ax = p.rechts - 14 - a * 14;
      c.beginPath();
      c.moveTo(ax, 26);
      c.lineTo(ax + 7, 31);
      c.lineTo(ax, 36);
      c.closePath();
      c.fill();
    }
  };

  // ---------------------------------------------------------------- Birne und Kette

  function zeichneKette(c, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    var n = Math.max(1, Math.floor(len / 11));
    var w = Math.atan2(dy, dx);
    c.strokeStyle = FARBE.kette;
    c.lineCap = 'round';
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n;
      var x = x1 + dx * t, y = y1 + dy * t;
      c.save();
      c.translate(x, y);
      c.rotate(w);
      if (i % 2 === 0) {
        c.lineWidth = 2.6;
        c.beginPath();
        c.ellipse(0, 0, 6.5, 3.4, 0, 0, Math.PI * 2);
        c.stroke();
      } else {
        c.lineWidth = 3.4;
        c.beginPath();
        c.moveTo(-5.5, 0);
        c.lineTo(5.5, 0);
        c.stroke();
      }
      c.restore();
    }
  }

  function zeichneBirne(c, x, y, r, winkel, spreng, zeit, alpha) {
    c.save();
    c.globalAlpha = alpha === undefined ? 1 : alpha;
    c.translate(x, y);
    c.rotate(winkel || 0);
    // Öse oben
    c.strokeStyle = FARBE.kontur;
    c.lineWidth = 3;
    c.fillStyle = spreng ? '#ffd23f' : '#7d8798';
    c.beginPath();
    c.arc(0, -r - 3, 5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    var g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    if (spreng) {
      g.addColorStop(0, '#ff8a8a');
      g.addColorStop(1, '#c1121f');
    } else {
      g.addColorStop(0, '#6f7890');
      g.addColorStop(1, '#22252e');
    }
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    if (spreng) {
      // gelber Ring und Stern: Sprengbirne gut erkennbar
      c.strokeStyle = '#ffd23f';
      c.lineWidth = r * 0.22;
      c.beginPath();
      c.arc(0, 0, r * 0.62, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#fff4c2';
      c.beginPath();
      for (var i = 0; i < 10; i++) {
        var rr = i % 2 === 0 ? r * 0.36 : r * 0.15;
        c.lineTo(Math.cos(i * Math.PI / 5 - Math.PI / 2) * rr, Math.sin(i * Math.PI / 5 - Math.PI / 2) * rr);
      }
      c.closePath();
      c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath();
    c.ellipse(-r * 0.38, -r * 0.42, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#11131a';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.stroke();
    if (spreng) {
      // Funke an der Öse
      var f = 4 + Math.sin(zeit * 40) * 2;
      c.fillStyle = '#ffef5a';
      c.beginPath();
      c.arc(0, -r - 10, f, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ff7b00';
      c.beginPath();
      c.arc(0, -r - 10, f * 0.5, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function lage(k, alpha) {
    if (k.vorX === undefined) return { x: k.position.x, y: k.position.y, a: k.angle };
    return { x: lerp(k.vorX, k.position.x, alpha), y: lerp(k.vorY, k.position.y, alpha), a: lerp(k.vorA, k.angle, alpha) };
  }

  // ---------------------------------------------------------------- Tutorial-Hand (Bildschirm-Koordinaten)

  function zeichneHand(c, x, y, groesse, druck, alpha) {
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, y + druck * groesse * 0.18);
    var s = groesse / 60 * (1 - druck * 0.12);
    c.scale(s, s);
    c.lineJoin = 'round';
    c.lineWidth = 4;
    c.strokeStyle = FARBE.kontur;
    c.fillStyle = '#ffffff';
    // Zeigefinger nach oben
    rundRechteck(c, -7, -38, 14, 40, 7);
    c.fill();
    c.stroke();
    // Handfläche mit eingeklappten Fingern
    rundRechteck(c, -12, -6, 36, 34, 10);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(4, 2); c.lineTo(4, 12);
    c.moveTo(14, 2); c.lineTo(14, 12);
    c.stroke();
    // Daumen
    rundRechteck(c, -22, 2, 16, 12, 6);
    c.fill();
    c.stroke();
    // Ärmelbund
    c.fillStyle = '#4d96ff';
    rundRechteck(c, -10, 26, 32, 12, 3);
    c.fill();
    c.stroke();
    c.restore();
  }

  // ---------------------------------------------------------------- Flugbahn-Vorschau

  /*
   * v: { punkte, kontakt, anteil (0..1, Teil der Bahn), farbe (Trefferfarbe zeigen) }
   */
  Darstellung.prototype._vorschau = function (c, v, r) {
    var pkt = v.punkte;
    if (!pkt || pkt.length < 3) return;
    var trifft = v.farbe && v.kontakt && v.kontakt.art === 'block';
    var ende = Math.min(pkt.length - 1, Math.max(4, Math.floor((pkt.length - 1) * v.anteil)));
    var farbe = trifft ? '#7cf0c8' : '#ffffff';
    var abstand = 2;
    for (var i = 2; i <= ende; i += abstand) {
      var f = i / ende;
      // Teilvorschau (Zielhilfe) läuft nach hinten aus
      c.globalAlpha = (trifft ? 0.95 : 0.6) * (v.anteil < 1 ? 1 - f * 0.8 : 1);
      c.fillStyle = farbe;
      c.beginPath();
      c.arc(pkt[i].x, pkt[i].y, trifft ? 4 : 3.2, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    if (v.anteil >= 1 && v.kontakt && v.farbe) {
      var k = v.kontakt;
      c.lineWidth = 3;
      if (trifft) {
        // Ring an der Stelle, an der die Birne einschlägt
        c.strokeStyle = '#7cf0c8';
        c.beginPath();
        c.arc(k.x, k.y, r, 0, Math.PI * 2);
        c.stroke();
      } else {
        c.strokeStyle = 'rgba(255,255,255,0.7)';
        c.beginPath();
        c.moveTo(k.x - 8, k.y - 8); c.lineTo(k.x + 8, k.y + 8);
        c.moveTo(k.x + 8, k.y - 8); c.lineTo(k.x - 8, k.y + 8);
        c.stroke();
      }
    }
  };

  // ---------------------------------------------------------------- Bild zeichnen

  /*
   * info: { dt (s), alpha (0..1 Zwischenbild), effekte, hand: {x, y, druck, alpha} | null,
   *         zeitlupe (0..1), schrittMs, vorschau: {punkte, kontakt, anteil, farbe} | null }
   */
  Darstellung.prototype.zeichne = function (welt, info) {
    var c = this.ctx;
    var dpr = this.dpr;
    var dt = info.dt || 0;
    this.zeit += dt;
    var eff = info.effekte;
    var wx = eff ? eff.wackelX : 0, wy = eff ? eff.wackelY : 0;

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._hintergrund(c, dt);
    if (!welt) return;

    var k = this.kam;
    c.setTransform(dpr * k.s, 0, 0, dpr * k.s, dpr * (k.ox + wx), dpr * (k.oy + wy));

    this._kran(c, welt);
    this._plattform(c, welt);

    var alpha = info.alpha || 0;
    var i;
    // Blöcke
    for (i = 0; i < welt.bloecke.length; i++) {
      var bl = welt.bloecke[i];
      if (bl.entfernt) continue;
      var l = lage(bl.koerper, alpha);
      var sp = this._sprite(bl.mat, bl.b, bl.h);
      c.save();
      c.translate(l.x, l.y);
      c.rotate(l.a);
      c.drawImage(sp.bild, -bl.b / 2 - sp.rand, -bl.h / 2 - sp.rand, bl.b + sp.rand * 2, bl.h + sp.rand * 2);
      if (bl.mat === 'gold') {
        // Funkeln auf der Goldkiste
        var f = (Math.sin(this.zeit * 4 + i) + 1) / 2;
        c.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.6 * f) + ')';
        c.beginPath();
        var r0 = 3 + 4 * f;
        c.moveTo(bl.b * 0.25, -bl.h * 0.25 - r0);
        c.lineTo(bl.b * 0.25 + r0 * 0.3, -bl.h * 0.25);
        c.lineTo(bl.b * 0.25, -bl.h * 0.25 + r0);
        c.lineTo(bl.b * 0.25 - r0 * 0.3, -bl.h * 0.25);
        c.closePath();
        c.fill();
      }
      c.restore();
    }

    // Splitter (Glas)
    for (i = 0; i < welt.splitter.length; i++) {
      var s = welt.splitter[i];
      var v = s.koerper.vertices;
      c.globalAlpha = Math.max(0, Math.min(1, (1500 - s.alter) / 400));
      c.fillStyle = 'rgba(190,240,255,0.85)';
      c.strokeStyle = '#2b84b6';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(v[0].x, v[0].y);
      for (var j = 1; j < v.length; j++) c.lineTo(v[j].x, v[j].y);
      c.closePath();
      c.fill();
      c.stroke();
    }
    c.globalAlpha = 1;

    // Fliegende Birnen
    for (i = 0; i < welt.birnen.length; i++) {
      var bi = welt.birnen[i];
      var lb = lage(bi.koerper, alpha);
      var rest = 6500 - bi.alter;
      zeichneBirne(c, lb.x, lb.y, bi.koerper.circleRadius, lb.a, bi.spreng && !bi.gezuendet, this.zeit, Math.max(0, Math.min(1, rest / 400)));
    }

    // Flugbahn-Vorschau (gepunktet bis zum ersten Kontakt; grün, wenn sie das Bauwerk trifft)
    if (info.vorschau) this._vorschau(c, info.vorschau, welt.kran.r);

    // Hängende Birne mit Kette
    var kr = welt.kran;
    var spreng = welt.naechsteIstSpreng();
    if (welt.zustand === 'schwingt') {
      var p = welt.pendel(alpha * (info.schrittMs || 16.67));
      // Bewegungsschweif: zeigt Richtung und Tempo
      for (var t = 5; t >= 1; t--) {
        var q = welt.pendel(alpha * (info.schrittMs || 16.67) - t * 22);
        c.globalAlpha = 0.07 * (6 - t);
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(q.x, q.y, kr.r * (1 - t * 0.06), 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      zeichneKette(c, kr.px, kr.py, p.x - Math.sin(p.theta) * (kr.r + 6), p.y - Math.cos(p.theta) * (kr.r + 6));
      zeichneBirne(c, p.x, p.y, kr.r, -p.theta, spreng, this.zeit, 1);
    } else if (welt.zustand === 'nachladen') {
      // Neue Birne wird herabgelassen
      var abwaerts = Math.max(0, Math.min(1, 1 - welt.timer / 450));
      var e = 1 - Math.pow(1 - abwaerts, 3);
      var th = -kr.A;
      if (abwaerts > 0) {
        var bx = kr.px + Math.sin(th) * kr.L * e, by = kr.py + Math.cos(th) * kr.L * e;
        zeichneKette(c, kr.px, kr.py, bx - Math.sin(th) * (kr.r + 6) * e, by - Math.cos(th) * (kr.r + 6) * e);
        zeichneBirne(c, bx, by, kr.r, -th, spreng, this.zeit, Math.min(1, abwaerts * 3));
      } else {
        zeichneKette(c, kr.px, kr.py, kr.px, kr.py + 24);
      }
    } else {
      zeichneKette(c, kr.px, kr.py, kr.px, kr.py + 24);
    }
    // Haken am Drehpunkt
    c.strokeStyle = FARBE.kontur;
    c.fillStyle = FARBE.stahl;
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(kr.px, kr.py, 6, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    if (eff) eff.zeichne(c, k.s);

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._wasserVorne(c);

    // Zeitlupe: dunkler Rand
    if (info.zeitlupe > 0) {
      var B = this.breite, H = this.hoehe;
      var gv = c.createRadialGradient(B / 2, H / 2, Math.min(B, H) * 0.35, B / 2, H / 2, Math.max(B, H) * 0.75);
      gv.addColorStop(0, 'rgba(10,20,50,0)');
      gv.addColorStop(1, 'rgba(10,20,50,' + (0.45 * info.zeitlupe) + ')');
      c.fillStyle = gv;
      c.fillRect(0, 0, B, H);
    }

    if (info.hand) {
      var hd = info.hand;
      if (hd.druck > 0.6) {
        c.globalAlpha = hd.alpha * (hd.druck - 0.6) * 2.5;
        c.strokeStyle = '#ffffff';
        c.lineWidth = 4;
        c.beginPath();
        c.arc(hd.x, hd.y - hd.groesse * 0.62, hd.groesse * (0.25 + (hd.druck - 0.6)), 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 1;
      }
      zeichneHand(c, hd.x, hd.y, hd.groesse, hd.druck, hd.alpha);
    }
  };

  return {
    erzeuge: function (canvas) { return new Darstellung(canvas); },
    WASSER_Y: WASSER_Y,
    SCHRIFT: SCHRIFT,
    zeichneBlock: zeichneBlock
  };
})();
