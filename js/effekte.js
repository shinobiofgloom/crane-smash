/*
 * Rückmeldung: Partikel (Staub, Splitter, Scherben, Münzglanz), aufsteigende Zahlen,
 * Druckwellen-Ringe und Bildschirmwackeln. Alles in Welt-Koordinaten, nur Darstellung.
 */
var Effekte = (function () {
  'use strict';

  var MAX_TEILE = 320;

  function Effekte() {
    this.teile = [];
    this.texte = [];
    this.ringe = [];
    this.hinweise = [];
    this.wackeln = 0;
    this.wackelX = 0;
    this.wackelY = 0;
  }

  Effekte.prototype.leeren = function () {
    this.teile.length = 0;
    this.texte.length = 0;
    this.ringe.length = 0;
    this.hinweise.length = 0;
    this.wackeln = 0;
  };

  /*
   * Hinweis nach einem Fehlwurf: gestrichelter Pfeil entlang der Pendelbahn vom Lösepunkt (von)
   * zum richtigen Moment (bis), dazu ein kurzer Text. Winkel wie in der Welt (0 = senkrecht nach unten).
   * h: { text, px, py, R, von, bis, farbe }
   */
  Effekte.prototype.hinweis = function (h) {
    if (Math.abs(h.bis - h.von) < 0.14) h.bis = h.von + (h.bis >= h.von ? 0.14 : -0.14);
    h.alter = 0;
    h.leben = 2.0;
    this.hinweise.length = 0;
    this.hinweise.push(h);
  };

  Effekte.prototype._teil = function (t) {
    if (this.teile.length >= MAX_TEILE) this.teile.shift();
    t.alter = 0;
    t.winkel = t.winkel || 0;
    t.dreh = t.dreh || 0;
    this.teile.push(t);
  };

  function zufall(a, b) { return a + Math.random() * (b - a); }

  // Staubwolke (runde, wachsende, verblassende Kreise)
  Effekte.prototype.staub = function (x, y, anzahl, farbe) {
    for (var i = 0; i < anzahl; i++) {
      this._teil({
        form: 'kreis', x: x + zufall(-8, 8), y: y + zufall(-8, 8),
        vx: zufall(-60, 60), vy: zufall(-70, 10), schwer: -20,
        groesse: zufall(6, 12), wachsen: zufall(14, 26), leben: zufall(0.5, 0.9),
        farbe: farbe || '#e9dcc4', alpha: 0.7
      });
    }
  };

  // Kleine eckige Splitter (Holz, Stein)
  Effekte.prototype.splitter = function (x, y, anzahl, farben, kraft) {
    var k = kraft || 1;
    for (var i = 0; i < anzahl; i++) {
      this._teil({
        form: 'eckig', x: x, y: y,
        vx: zufall(-220, 220) * k, vy: zufall(-320, -40) * k, schwer: 900,
        groesse: zufall(3, 7), seiten: zufall(0.4, 1), leben: zufall(0.5, 1.0),
        farbe: farben[i % farben.length], alpha: 1, winkel: zufall(0, 6), dreh: zufall(-12, 12)
      });
    }
  };

  // Glasscherben: Dreiecke mit Glanz
  Effekte.prototype.scherben = function (x, y, vx, vy, b, h) {
    var anzahl = Math.min(16, 6 + Math.round((b * h) / 300));
    for (var i = 0; i < anzahl; i++) {
      this._teil({
        form: 'dreieck', x: x + zufall(-b / 2, b / 2), y: y + zufall(-h / 2, h / 2),
        vx: vx * 40 + zufall(-260, 260), vy: vy * 40 + zufall(-380, -60), schwer: 1000,
        groesse: zufall(4, 10), leben: zufall(0.6, 1.1),
        farbe: i % 3 === 0 ? '#ffffff' : (i % 3 === 1 ? '#bfefff' : '#7fd3f5'), alpha: 0.9,
        winkel: zufall(0, 6), dreh: zufall(-14, 14)
      });
    }
  };

  // Glitzer (Gold, Münzen)
  Effekte.prototype.glanz = function (x, y, anzahl, farbe) {
    for (var i = 0; i < anzahl; i++) {
      var w = zufall(0, Math.PI * 2), v = zufall(80, 260);
      this._teil({
        form: 'stern', x: x, y: y, vx: Math.cos(w) * v, vy: Math.sin(w) * v - 80, schwer: 300,
        groesse: zufall(4, 8), leben: zufall(0.5, 0.9), farbe: farbe || '#fff3a0', alpha: 1,
        winkel: zufall(0, 6), dreh: zufall(-6, 6)
      });
    }
  };

  // Konfetti (Sprengbirne, großer Erfolg)
  Effekte.prototype.konfetti = function (x, y, anzahl) {
    var farben = ['#ff5d73', '#ffd23f', '#3bceac', '#4d96ff', '#ff9f1c', '#c77dff'];
    for (var i = 0; i < anzahl; i++) {
      var w = zufall(0, Math.PI * 2), v = zufall(150, 480);
      this._teil({
        form: 'eckig', x: x, y: y, vx: Math.cos(w) * v, vy: Math.sin(w) * v - 150, schwer: 600,
        groesse: zufall(4, 8), seiten: 0.5, leben: zufall(0.8, 1.4), farbe: farben[i % farben.length],
        alpha: 1, winkel: zufall(0, 6), dreh: zufall(-10, 10)
      });
    }
  };

  // Wasserspritzer
  Effekte.prototype.spritzer = function (x, y, anzahl) {
    for (var i = 0; i < anzahl; i++) {
      this._teil({
        form: 'kreis', x: x + zufall(-14, 14), y: y,
        vx: zufall(-120, 120), vy: zufall(-380, -160), schwer: 1100,
        groesse: zufall(3, 6), wachsen: 0, leben: zufall(0.4, 0.7), farbe: '#d8f3ff', alpha: 0.95
      });
    }
  };

  Effekte.prototype.ring = function (x, y, radius, farbe, dauer) {
    this.ringe.push({ x: x, y: y, r: radius, farbe: farbe || '#fff', alter: 0, leben: dauer || 0.45 });
  };

  // Aufsteigende Zahl oder kurzer Ruf ("Chain x4!")
  Effekte.prototype.text = function (x, y, inhalt, farbe, groesse) {
    this.texte.push({ x: x, y: y, inhalt: inhalt, farbe: farbe || '#ffd23f', groesse: groesse || 22, alter: 0, leben: 1.1 });
  };

  Effekte.prototype.wackle = function (staerke) {
    this.wackeln = Math.min(22, Math.max(this.wackeln, staerke));
  };

  Effekte.prototype.update = function (dt) {
    var i;
    for (i = this.teile.length - 1; i >= 0; i--) {
      var t = this.teile[i];
      t.alter += dt;
      if (t.alter >= t.leben) { this.teile.splice(i, 1); continue; }
      t.vy += (t.schwer || 0) * dt;
      t.vx *= (1 - 1.5 * dt);
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.winkel += t.dreh * dt;
      if (t.wachsen) t.groesse += t.wachsen * dt;
    }
    for (i = this.texte.length - 1; i >= 0; i--) {
      var s = this.texte[i];
      s.alter += dt;
      s.y -= 55 * dt;
      if (s.alter >= s.leben) this.texte.splice(i, 1);
    }
    for (i = this.ringe.length - 1; i >= 0; i--) {
      this.ringe[i].alter += dt;
      if (this.ringe[i].alter >= this.ringe[i].leben) this.ringe.splice(i, 1);
    }
    for (i = this.hinweise.length - 1; i >= 0; i--) {
      this.hinweise[i].alter += dt;
      if (this.hinweise[i].alter >= this.hinweise[i].leben) this.hinweise.splice(i, 1);
    }
    // Wackeln klingt schnell ab
    this.wackeln = Math.max(0, this.wackeln - dt * 45);
    var w = this.wackeln;
    this.wackelX = w > 0.2 ? (Math.random() * 2 - 1) * w : 0;
    this.wackelY = w > 0.2 ? (Math.random() * 2 - 1) * w : 0;
  };

  function stern(ctx, r) {
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var rr = i % 2 === 0 ? r : r * 0.4;
      var w = i * Math.PI / 4;
      ctx.lineTo(Math.cos(w) * rr, Math.sin(w) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Zeichnen in Welt-Koordinaten (Kamera ist schon gesetzt)
  Effekte.prototype.zeichne = function (ctx, massstab) {
    var i;
    for (i = 0; i < this.ringe.length; i++) {
      var r = this.ringe[i];
      var f = r.alter / r.leben;
      ctx.globalAlpha = 1 - f;
      ctx.strokeStyle = r.farbe;
      ctx.lineWidth = Math.max(2, 14 * (1 - f));
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * (0.2 + 0.8 * Math.sqrt(f)), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (i = 0; i < this.teile.length; i++) {
      var t = this.teile[i];
      var rest = 1 - t.alter / t.leben;
      ctx.globalAlpha = Math.max(0, t.alpha * Math.min(1, rest * 2));
      ctx.fillStyle = t.farbe;
      if (t.form === 'kreis') {
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.groesse, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.winkel);
        if (t.form === 'eckig') {
          ctx.fillRect(-t.groesse / 2, -t.groesse * t.seiten / 2, t.groesse, t.groesse * t.seiten);
        } else if (t.form === 'dreieck') {
          ctx.beginPath();
          ctx.moveTo(0, -t.groesse);
          ctx.lineTo(t.groesse * 0.8, t.groesse * 0.6);
          ctx.lineTo(-t.groesse * 0.6, t.groesse * 0.5);
          ctx.closePath();
          ctx.fill();
        } else if (t.form === 'stern') {
          stern(ctx, t.groesse);
        }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    // Texte mit dicker Kontur, Größe unabhängig vom Kamera-Maßstab gut lesbar
    var k = 1 / Math.max(0.35, massstab);
    for (i = 0; i < this.hinweise.length; i++) this._zeichneHinweis(ctx, this.hinweise[i], k);
    for (i = 0; i < this.texte.length; i++) {
      var s = this.texte[i];
      var a = s.alter / s.leben;
      var pop = a < 0.15 ? 0.6 + a / 0.15 * 0.5 : (a < 0.25 ? 1.1 - (a - 0.15) : 1);
      ctx.globalAlpha = a > 0.7 ? (1 - a) / 0.3 : 1;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(pop * k, pop * k);
      ctx.font = '900 ' + s.groesse + 'px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(4, s.groesse / 4);
      ctx.strokeStyle = '#1d2b53';
      ctx.strokeText(s.inhalt, 0, 0);
      ctx.fillStyle = s.farbe;
      ctx.fillText(s.inhalt, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  Effekte.prototype._zeichneHinweis = function (ctx, h, k) {
    var a = h.alter / h.leben;
    var alpha = a < 0.08 ? a / 0.08 : (a > 0.75 ? (1 - a) / 0.25 : 1);
    var vorwaerts = h.bis > h.von;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    // Bogen entlang der Pendelbahn (Canvas-Winkel = 90° - Pendelwinkel)
    ctx.strokeStyle = h.farbe;
    ctx.lineWidth = 6 * k;
    ctx.lineCap = 'round';
    ctx.setLineDash([12 * k, 9 * k]);
    ctx.beginPath();
    ctx.arc(h.px, h.py, h.R, Math.PI / 2 - h.von, Math.PI / 2 - h.bis, vorwaerts);
    ctx.stroke();
    ctx.setLineDash([]);
    // Pfeilspitze am richtigen Moment
    var ex = h.px + h.R * Math.sin(h.bis), ey = h.py + h.R * Math.cos(h.bis);
    var tx = Math.cos(h.bis), ty = -Math.sin(h.bis);
    if (!vorwaerts) { tx = -tx; ty = -ty; }
    var nx = -ty, ny = tx, l = 16 * k, b = 11 * k;
    ctx.fillStyle = h.farbe;
    ctx.beginPath();
    ctx.moveTo(ex + tx * l, ey + ty * l);
    ctx.lineTo(ex + nx * b, ey + ny * b);
    ctx.lineTo(ex - nx * b, ey - ny * b);
    ctx.closePath();
    ctx.fill();
    // Text unter der Bogenmitte
    var m = (h.von + h.bis) / 2, R2 = h.R + 34 * k;
    var x = h.px + R2 * Math.sin(m), y = h.py + R2 * Math.cos(m);
    ctx.font = '900 ' + (26 * k) + 'px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6 * k;
    ctx.strokeStyle = '#1d2b53';
    ctx.strokeText(h.text, x, y);
    ctx.fillStyle = h.farbe;
    ctx.fillText(h.text, x, y);
    ctx.restore();
  };

  return Effekte;
})();
