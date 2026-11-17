/*
 * Spielwelt ohne Darstellung: Physik (matter-js), Kran mit Abrissbirne, Bauwerk, Glasbruch,
 * Sprengbirne, Zählen der heruntergefallenen Blöcke und Ablauf eines Levels.
 * Wird vom Spiel im Browser und von den Tests in Node gleich benutzt.
 *
 * Ablauf eines Levels (welt.zustand):
 *   'nachladen' -> nächste Birne wird eingehängt
 *   'schwingt'  -> Birne pendelt, loesen() wirft sie
 *   'ausrollen' -> letzte Birne ist unterwegs, warten bis alles ruht (oder Zeitgrenze)
 *   'fertig'    -> auswerten
 */
(function (wurzel) {
  'use strict';

  var istNode = typeof module === 'object' && module.exports;
  var Matter = istNode ? require('../lib/matter.min.js') : wurzel.Matter;
  var Zufall = istNode ? require('./zufall.js') : wurzel.Zufall;

  var Engine = Matter.Engine;
  var Bodies = Matter.Bodies;
  var Body = Matter.Body;
  var Composite = Matter.Composite;
  var Events = Matter.Events;
  var Sleeping = Matter.Sleeping;

  // Feste Werte der Spielwelt (Längen in Welt-Einheiten, Zeiten in ms)
  var K = {
    SCHRITT_MS: 1000 / 60,
    BIRNE_RADIUS: 26,
    BIRNE_DICHTE: 0.03,
    KETTE_BASIS: 150,
    AMPLITUDE: 0.9,           // größter Ausschlag des Pendels (rad)
    PERIODE_MS: 2200,         // Pendeldauer (für jede Kettenlänge gleich); ein Level kann eine eigene haben
    FLUG_SCHWERKRAFT: 0.5,    // Anteil der Schwerkraft für die fliegende Birne bis zum ersten Kontakt
    DREHPUNKT_FAKTOR: 0.5,    // Drehpunkt liegt 0,5 * Bogenhalbbreite links der Bauwerkskante (Level kann abweichen)
    BOGEN_LUFT: -30,          // tiefster Punkt der Birnen-Unterkante: 30 unter der höchsten Blockkante
    ZIEL_HOEHE: 0.7,          // Zielführung zielt auf die linke Bauwerksflanke, 70 % der Höhe (räumt oben ab)
    VORSCHAU_SCHRITTE: 160,   // höchstens so viele Schritte (2,7 s) rechnet die Vorschau voraus
    FEHLWURF_MS: 2500,        // ohne Blockkontakt nach dieser Zeit: Fehlwurf melden
    WASSER_Y: 80,             // Wasserlinie (Darstellung und Vorschau)
    NACHLADE_MS: 1300,
    AUSROLL_MIN_MS: 1500,
    AUSROLL_MAX_MS: 7000,
    RUHE_SCHRITTE: 30,
    LEER_WARTEN_MS: 900,      // alles geräumt: kurz warten, dann fertig
    RUNTER_Y: 30,             // Mitte tiefer als Plattform + 30 = von der Plattform
    ENTFERNEN_Y: 520,         // ab hier wird ein Körper aus der Welt genommen
    PLATTFORM_RAND_LINKS: 50,
    PLATTFORM_DICKE: 40,
    GLAS_BRUCH: 3.2,          // Aufprallgeschwindigkeit (Einheiten je Schritt), ab der Glas bricht
    GLAS_BRUCH_BIRNE: 1.0,
    SPLITTER_LEBEN_MS: 1500,
    SPLITTER_JE_GLAS: 3,
    MAX_KOERPER: 80,
    BIRNE_LEBEN_MS: 6500,
    SPRENG_RADIUS: 190,
    SPRENG_STAERKE: 13
  };

  var MATERIAL = {
    holz: { dichte: 0.0012, reibung: 0.75 },
    glas: { dichte: 0.0016, reibung: 0.45 },
    stein: { dichte: 0.0045, reibung: 0.9 },
    gold: { dichte: 0.0012, reibung: 0.75 }
  };

  var KAT = { PLATTFORM: 0x1, BLOCK: 0x2, BIRNE: 0x4, SPLITTER: 0x8 };

  // Grundwerte der Birne; Upgrades ändern diese Werte (siehe fortschritt.js)
  function optionenMitStandard(o) {
    o = o || {};
    return {
      kettenLaenge: o.kettenLaenge || K.KETTE_BASIS,
      birnenRadius: o.birnenRadius || K.BIRNE_RADIUS,
      birnenDichte: o.birnenDichte || K.BIRNE_DICHTE,
      birnen: o.birnen || 3,
      sprengStufe: o.sprengStufe || 0
    };
  }

  function kranMasse(o, bauwerkHoehe, periode, drehpunkt) {
    var L = o.kettenLaenge;
    var r = o.birnenRadius;
    var A = K.AMPLITUDE;
    return {
      // Der Bogen beginnt links vom Bauwerk und reicht mit seinem rechten Teil darüber (die hängende Birne
      // ist kein Körper). Das hält die Szene schmal, damit die Blöcke im Hochformat groß genug sind.
      px: -(drehpunkt || K.DREHPUNKT_FAKTOR) * L * Math.sin(A),
      py: -(bauwerkHoehe + K.BOGEN_LUFT + r) - L,
      L: L,
      r: r,
      A: A,
      // Feste Pendeldauer unabhängig von der Kettenlänge: Der gelernte Rhythmus bleibt gleich,
      // eine längere Kette wirft dafür schneller und flacher (mehr Reichweite)
      periode: periode || K.PERIODE_MS
    };
  }

  function laenge(x, y) { return Math.sqrt(x * x + y * y); }

  function Welt(level, optionen) {
    var self = this;
    var o = this.optionen = optionenMitStandard(optionen);
    this.level = level;
    this.rng = Zufall.erzeuge(((level.seed || 0) + (level.nr || 1) * 13 + 5) >>> 0);

    // Mehr Löser-Durchgänge als üblich: hohe Türme bleiben ruhig stehen (geprüft im Stabilitätstest)
    this.engine = Engine.create({ enableSleeping: true, positionIterations: 16, velocityIterations: 12 });
    this.engine.gravity.y = 1;
    this.welt = this.engine.world;

    // Ausdehnung des Bauwerks
    var maxX = 0, minY = 0;
    level.bloecke.forEach(function (b) {
      maxX = Math.max(maxX, b.x + b.b / 2);
      minY = Math.min(minY, b.y - b.h / 2);
    });
    this.bauwerk = { links: 0, rechts: maxX, oben: minY };

    var links = -(level.randLinks || K.PLATTFORM_RAND_LINKS);
    var rechts = maxX + (level.randRechts || 40);
    this.plattform = { links: links, rechts: rechts, oben: 0, dicke: K.PLATTFORM_DICKE };
    var platte = Bodies.rectangle((links + rechts) / 2, K.PLATTFORM_DICKE / 2, rechts - links, K.PLATTFORM_DICKE, {
      isStatic: true, friction: 0.9, label: 'plattform',
      collisionFilter: { category: KAT.PLATTFORM, mask: 0xFFFF }
    });
    Composite.add(this.welt, platte);
    this.platte = platte;

    this.daten = {};             // Körper-ID -> Spieldaten
    this.daten[platte.id] = { art: 'plattform' };

    this.bloecke = level.bloecke.map(function (b, i) {
      var m = MATERIAL[b.mat] || MATERIAL.holz;
      var k = Bodies.rectangle(b.x, b.y, b.b, b.h, {
        density: m.dichte, friction: m.reibung, frictionStatic: 1, restitution: 0.02, label: 'block',
        collisionFilter: { category: KAT.BLOCK, mask: 0xFFFF }
      });
      var block = {
        art: 'block', nr: i, mat: b.mat, b: b.b, h: b.h, koerper: k,
        geraeumt: false, entfernt: false, zerbrochen: false, beruehrt: false
      };
      self.daten[k.id] = block;
      return block;
    });
    Composite.add(this.welt, this.bloecke.map(function (b) { return b.koerper; }));

    this.kran = kranMasse(o, -minY, level.periode, level.drehpunkt);
    this.birnen = [];
    this.splitter = [];
    this.birnenUebrig = o.birnen;
    this.zustand = 'nachladen';
    this.timer = K.NACHLADE_MS;
    this.schwingZeit = 0;
    this.ausrollZeit = 0;
    this.ruheSchritte = 0;
    this.leerZeit = 0;
    this.zeit = 0;
    this.schrittNr = 0;
    this.anzahlGeraeumt = 0;
    this.kette = 0;
    this.proMaterial = { holz: 0, glas: 0, stein: 0, gold: 0 };
    this.ereignisse = [];
    this._glasBruch = [];
    this._explosionen = [];

    Events.on(this.engine, 'collisionStart', function (e) { self._beiKontakt(e.pairs); });
    Events.on(this.engine, 'collisionEnd', function (e) { self._beiTrennung(e.pairs); });
  }

  // ---------------------------------------------------------------- Kontakte

  Welt.prototype._beiKontakt = function (paare) {
    for (var i = 0; i < paare.length; i++) {
      var p = paare[i];
      var a = p.bodyA, b = p.bodyB;
      var da = this.daten[a.id], db = this.daten[b.id];
      if (!da || !db) continue;
      if (da.art === 'splitter' || db.art === 'splitter') continue;
      var rel = laenge(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      var birne = da.art === 'birne' ? da : (db.art === 'birne' ? db : null);
      var anderer = birne === da ? db : da;

      // Treffer der Birne merken: was sie direkt berührt, zählt nicht als Kettenreaktion
      if (birne && anderer.art === 'block') anderer.beruehrt = true;
      // Erster Kontakt beendet den Flug (ab dann volle Schwerkraft)
      if (da.art === 'birne' && !da.kontakt) this._flugEnde(da, db);
      if (db.art === 'birne' && !db.kontakt) this._flugEnde(db, da);
      if (birne && anderer.art === 'block') birne.blockKontakt = true;

      // Sprengbirne zündet beim ersten Kontakt mit Bauwerk oder Plattform
      if (birne && birne.spreng && !birne.gezuendet && (anderer.art === 'block' || anderer.art === 'plattform')) {
        birne.gezuendet = true;
        this._explosionen.push({ x: birne.koerper.position.x, y: birne.koerper.position.y });
      }

      // Glas bricht bei hartem Aufprall
      var grenze = birne ? K.GLAS_BRUCH_BIRNE : K.GLAS_BRUCH;
      if (da.art === 'block' && da.mat === 'glas' && rel > grenze) this._glasBruch.push(da);
      if (db.art === 'block' && db.mat === 'glas' && rel > grenze) this._glasBruch.push(db);

      if (rel > 1.2) {
        var punkt = (p.collision && p.collision.supports && p.collision.supports[0]) ||
          { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 };
        var mat = da.art === 'block' ? da.mat : (db.art === 'block' ? db.mat : 'stahl');
        if (birne && anderer.art === 'block') mat = anderer.mat;
        this.ereignisse.push({ art: 'treffer', mat: mat, x: punkt.x, y: punkt.y, staerke: rel, birne: !!birne });
      }
    }
  };

  Welt.prototype._flugEnde = function (birne, anderer) {
    birne.kontakt = true;
    birne.kontaktSchritt = this.schrittNr;
    birne.kontaktMit = anderer.art;
    birne.kontaktPunkt = { x: birne.koerper.position.x, y: birne.koerper.position.y };
    birne.koerper.frictionAir = 0.003;
  };

  // Liegt ein schlafender Block auf etwas, das wegrutscht, muss er aufwachen (sonst schwebt er)
  Welt.prototype._beiTrennung = function (paare) {
    for (var i = 0; i < paare.length; i++) {
      var a = paare[i].bodyA, b = paare[i].bodyB;
      if (a.isSleeping && !b.isStatic && b.speed > 0.3) Sleeping.set(a, false);
      if (b.isSleeping && !a.isStatic && a.speed > 0.3) Sleeping.set(b, false);
    }
  };

  Welt.prototype._weckeUmkreis = function (x, y, radius) {
    for (var i = 0; i < this.bloecke.length; i++) {
      var k = this.bloecke[i].koerper;
      if (this.bloecke[i].entfernt || !k.isSleeping) continue;
      if (laenge(k.position.x - x, k.position.y - y) < radius) Sleeping.set(k, false);
    }
  };

  Welt.prototype.koerperAnzahl = function () {
    var n = this.birnen.length + this.splitter.length;
    for (var i = 0; i < this.bloecke.length; i++) if (!this.bloecke[i].entfernt) n++;
    return n;
  };

  Welt.prototype._raeume = function (block, wie) {
    if (block.geraeumt) return;
    block.geraeumt = true;
    this.anzahlGeraeumt++;
    var kette = !block.beruehrt;
    if (kette) this.kette++;
    this.proMaterial[block.mat] = (this.proMaterial[block.mat] || 0) + 1;
    this.ereignisse.push({
      art: 'geraeumt', mat: block.mat, gold: block.mat === 'gold', kette: kette, wie: wie,
      x: block.koerper.position.x, y: block.koerper.position.y,
      geraeumt: this.anzahlGeraeumt, gesamt: this.bloecke.length
    });
  };

  Welt.prototype._entferneBlock = function (block) {
    if (block.entfernt) return;
    block.entfernt = true;
    Composite.remove(this.welt, block.koerper);
  };

  Welt.prototype._zerbrich = function (block) {
    if (block.entfernt) return;
    var k = block.koerper;
    var x = k.position.x, y = k.position.y, vx = k.velocity.x, vy = k.velocity.y;
    this._entferneBlock(block);
    block.zerbrochen = true;
    this._raeume(block, 'zerbrochen');
    this.ereignisse.push({ art: 'glas', x: x, y: y, vx: vx, vy: vy, b: block.b, h: block.h, winkel: k.angle });
    var frei = K.MAX_KOERPER - this.koerperAnzahl();
    var anzahl = Math.max(0, Math.min(K.SPLITTER_JE_GLAS, frei));
    for (var i = 0; i < anzahl; i++) {
      var r = this.rng;
      var s = Bodies.polygon(x + r.bereich(-block.b / 3, block.b / 3), y + r.bereich(-block.h / 3, block.h / 3), 3,
        r.bereich(6, 10), {
          density: 0.001, friction: 0.3, restitution: 0.2, label: 'splitter',
          collisionFilter: { category: KAT.SPLITTER, mask: KAT.PLATTFORM | KAT.BLOCK }
        });
      Body.setAngle(s, r.bereich(0, Math.PI * 2));
      Composite.add(this.welt, s);
      Body.setVelocity(s, { x: vx * 0.6 + r.bereich(-3, 3), y: vy * 0.6 + r.bereich(-4.5, 0.5) });
      Body.setAngularVelocity(s, r.bereich(-0.3, 0.3));
      var splitter = { art: 'splitter', koerper: s, alter: 0 };
      this.daten[s.id] = splitter;
      this.splitter.push(splitter);
    }
    this._weckeUmkreis(x, y, 110);
  };

  Welt.prototype._explodiere = function (x, y) {
    var stufe = Math.max(1, this.optionen.sprengStufe);
    var R = K.SPRENG_RADIUS * (1 + 0.25 * (stufe - 1));
    for (var i = 0; i < this.bloecke.length; i++) {
      var block = this.bloecke[i];
      if (block.entfernt) continue;
      var k = block.koerper;
      var dx = k.position.x - x, dy = k.position.y - y;
      var d = laenge(dx, dy);
      if (d >= R) continue;
      var f = 1 - d / R;
      // Richtung vom Mittelpunkt weg, etwas nach oben (comichaftes Hochwirbeln)
      var nx = d > 0.001 ? dx / d : 0, ny = d > 0.001 ? dy / d : -1;
      ny -= 0.35;
      var n = laenge(nx, ny) || 1;
      nx /= n; ny /= n;
      var dichte = (MATERIAL[block.mat] || MATERIAL.holz).dichte;
      var staerke = K.SPRENG_STAERKE * f / Math.sqrt(dichte / MATERIAL.holz.dichte);
      Sleeping.set(k, false);
      Body.setVelocity(k, { x: k.velocity.x + nx * staerke, y: k.velocity.y + ny * staerke });
      Body.setAngularVelocity(k, k.angularVelocity + this.rng.bereich(-0.15, 0.15) * f);
      block.beruehrt = true;
      if (block.mat === 'glas' && d < R * 0.7) this._glasBruch.push(block);
    }
    this.ereignisse.push({ art: 'boom', x: x, y: y, r: R });
  };

  // ---------------------------------------------------------------- Pendel und Birnen

  // Lage der hängenden Birne; zusatzMs erlaubt weiches Zwischenbild in der Darstellung
  Welt.prototype.pendel = function (zusatzMs) { return this.pendelBei(this.schwingZeit + (zusatzMs || 0)); };

  // Lage zu einer Schwingzeit t (ms); das Pendel wiederholt sich jede Periode
  Welt.prototype.pendelBei = function (t) {
    var k = this.kran;
    var w = 2 * Math.PI / k.periode;
    var theta = -k.A * Math.cos(w * t);
    var dtheta = k.A * w * Math.sin(w * t);                 // rad je ms
    return {
      x: k.px + k.L * Math.sin(theta),
      y: k.py + k.L * Math.cos(theta),
      theta: theta,
      vx: k.L * dtheta * Math.cos(theta),                     // Einheiten je ms
      vy: -k.L * dtheta * Math.sin(theta),
      phase: (t % k.periode) / k.periode
    };
  };

  // Phase 0 = ganz links (vom Bauwerk weg), 0.25 = unten nach rechts, 0.5 = ganz rechts
  Welt.prototype.phase = function () { return this.pendel(0).phase; };

  // Zielpunkt der Zielführung: linke Flanke der noch stehenden Blöcke, auf ZIEL_HOEHE ihrer Höhe.
  // Schutt vor dem Bauwerk (links vom ursprünglichen Grundriss) zählt nicht, sonst zielt die Birne darauf.
  Welt.prototype.zielPunkt = function () {
    var links = Infinity, rechts = -Infinity, oben = 0, n = 0;
    for (var i = 0; i < this.bloecke.length; i++) {
      var b = this.bloecke[i];
      if (b.geraeumt || b.entfernt) continue;
      if (b.koerper.position.x < this.bauwerk.links - 5) continue;
      var bd = b.koerper.bounds;
      links = Math.min(links, bd.min.x);
      rechts = Math.max(rechts, bd.max.x);
      oben = Math.min(oben, bd.min.y);
      n++;
    }
    if (!n) return null;
    return { x: links, y: Math.min(-12, oben * K.ZIEL_HOEHE), rechts: rechts, oben: oben };
  };

  function winkelDiff(a, b) {
    var d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }

  /*
   * Abwurf zur Schwingzeit t: Lage und Geschwindigkeit (Einheiten je Schritt) der gelösten Birne.
   * Zielführung (level.lenkung): Fliegt die Birne zum Bauwerk hin, bekommt sie eine feste waagerechte
   * Geschwindigkeit lenkung.tempo und genau die senkrechte, mit der sie den Zielpunkt an der Bauwerksflanke
   * trifft (gleiche Schrittformel wie matter-js). So schiebt jeder Wurf im Fenster gleich stark.
   * Grenzen: Die Richtung darf höchstens lenkung.winkel von der natürlichen abweichen, das Tempo höchstens
   * das lenkung.schub-fache des natürlichen sein. Sonst dreht die Lenkung nur ein Stück, das Tempo bleibt.
   */
  Welt.prototype.abwurfBei = function (t) {
    var p = this.pendelBei(t);
    var S = K.SCHRITT_MS;
    var vx = p.vx * S, vy = p.vy * S;
    var erg = { x: p.x, y: p.y, vx: vx, vy: vy, phase: p.phase, theta: p.theta, gelenkt: false };
    var l = this.level.lenkung;
    if (!l || !l.winkel || vx <= 0.05) return erg;
    var ziel = this.zielPunkt();
    if (!ziel) return erg;
    var r = this.kran.r;
    if (ziel.x - p.x <= r) {
      // Birne schwingt schon über dem Bauwerk: auf die Oberseite zielen (Mitte des Rests)
      var mitte = (Math.max(ziel.x, p.x) + ziel.rechts) / 2;
      ziel = { x: mitte, y: ziel.oben - r };
      if (ziel.x - p.x <= r || ziel.y <= p.y) return erg;
    }
    var dx = ziel.x - p.x;
    var a = 0.001 * K.FLUG_SCHWERKRAFT * S * S;          // Beschleunigung je Schritt²
    var s = laenge(vx, vy);
    var phiN = Math.atan2(vy, vx);
    var u = l.tempo;
    var n = dx / u;                                        // Schritte bis zum Ziel
    var w = (ziel.y - p.y - a * n * (n + 1) / 2) / n;      // y nach n Schritten: y0 + n*w + a*n(n+1)/2
    var sZ = laenge(u, w);
    var phiZ = Math.atan2(w, u);
    var d = winkelDiff(phiZ, phiN);
    if (Math.abs(d) <= l.winkel && sZ <= s * l.schub) {
      erg.vx = u;
      erg.vy = w;
      erg.gelenkt = true;
      return erg;
    }
    // Außerhalb der Grenzen: nur ein Stück zum Ziel drehen, Tempo bleibt natürlich
    var dreh = Math.max(-l.winkel, Math.min(l.winkel, d));
    erg.vx = Math.cos(phiN + dreh) * s;
    erg.vy = Math.sin(phiN + dreh) * s;
    return erg;
  };

  Welt.prototype._probeKoerper = function () {
    if (!this._probe) {
      this._probe = Bodies.circle(0, 0, this.optionen.birnenRadius, {
        collisionFilter: { category: KAT.BIRNE, mask: KAT.PLATTFORM | KAT.BLOCK | KAT.BIRNE }
      });
    }
    return this._probe;
  };

  /*
   * Flugbahn-Vorschau für einen Abwurf zur Schwingzeit t. Rechnet Schritt für Schritt wie matter-js
   * (v = v * (1 - Luftreibung) + Beschleunigung * dt², dann Ort += v; die Birne hat im Flug keine
   * Luftreibung) und prüft mit der Kollisionsprüfung von matter-js gegen Plattform, Blöcke und Birnen.
   * Ergebnis: { punkte: [{x, y}], abwurf, kontakt: {art: 'block'|'plattform'|'birne'|'wasser'|'rand', schritt, x, y} }
   */
  Welt.prototype.vorschauBei = function (t, maxSchritte) {
    var a = this.abwurfBei(t);
    var max = maxSchritte || K.VORSCHAU_SCHRITTE;
    var S = K.SCHRITT_MS;
    var beschl = 0.001 * K.FLUG_SCHWERKRAFT * S * S;
    var probe = this._probeKoerper();
    Body.setPosition(probe, { x: a.x, y: a.y });
    var kandidaten = [this.platte];
    var i;
    for (i = 0; i < this.bloecke.length; i++) if (!this.bloecke[i].entfernt) kandidaten.push(this.bloecke[i].koerper);
    for (i = 0; i < this.birnen.length; i++) kandidaten.push(this.birnen[i].koerper);
    var x = a.x, y = a.y, vx = a.vx, vy = a.vy;
    var punkte = [{ x: x, y: y }];
    var pl = this.plattform;
    var n;
    for (n = 1; n <= max; n++) {
      vy = vy + beschl;
      x += vx;
      y += vy;
      punkte.push({ x: x, y: y });
      Body.setPosition(probe, { x: x, y: y });
      for (i = 0; i < kandidaten.length; i++) {
        var k = kandidaten[i];
        if (!Matter.Bounds.overlaps(probe.bounds, k.bounds)) continue;
        if (!Matter.Detector.canCollide(probe.collisionFilter, k.collisionFilter)) continue;
        if (Matter.Collision.collides(probe, k)) {
          var d = this.daten[k.id];
          return { punkte: punkte, abwurf: a, kontakt: { art: d ? d.art : 'block', schritt: n, x: x, y: y } };
        }
      }
      if (y > K.WASSER_Y) return { punkte: punkte, abwurf: a, kontakt: { art: 'wasser', schritt: n, x: x, y: y } };
      if (x < pl.links - 900 || x > pl.rechts + 900) break;
    }
    return { punkte: punkte, abwurf: a, kontakt: { art: 'rand', schritt: n, x: x, y: y } };
  };

  // Fenster der Tutorial-Hand: der frühe Teil des Trefferfensters (Reaktionszeit eingerechnet)
  Welt.prototype.handFenster = function () {
    var f = this.trefferFenster(0.01);
    if (!f) return null;
    return { von: (f.von + 0.1 * f.breite) % 1, bis: (f.von + 0.6 * f.breite) % 1, mitte: f.mitte };
  };

  Welt.prototype.vorschau = function (zusatzMs, maxSchritte) {
    if (this.zustand !== 'schwingt') return null;
    return this.vorschauBei(this.schwingZeit + (zusatzMs || 0), maxSchritte);
  };

  /*
   * Größter zusammenhängender Bereich der Pendelphase, in dem ein gelenkter Abwurf zuerst das Bauwerk
   * trifft (ohne Lenkung zählt jeder Treffer). Für Tutorial-Hand, Idealmoment und die Meldung
   * "zu früh / zu spät". Ergebnis { von, bis, mitte, breite } in Phasen oder null.
   */
  Welt.prototype.trefferFenster = function (schritt) {
    var st = schritt || 0.01;
    var anzahl = Math.round(1 / st);
    var treffer = [];
    var mitLenkung = !!(this.level.lenkung && this.level.lenkung.winkel);
    for (var i = 0; i < anzahl; i++) {
      var v = this.vorschauBei(i * st * this.kran.periode, 120);
      treffer.push(v.kontakt.art === 'block' && (!mitLenkung || v.abwurf.gelenkt));
    }
    var best = 0, bestStart = -1, lauf = 0, start = 0;
    for (var j = 0; j < anzahl * 2; j++) {
      if (treffer[j % anzahl]) {
        if (lauf === 0) start = j;
        lauf++;
        if (lauf > best && lauf <= anzahl) { best = lauf; bestStart = start; }
      } else {
        lauf = 0;
      }
    }
    if (best === 0) return null;
    var von = (bestStart * st) % 1;
    var breite = (best - 1) * st;
    return { von: von, bis: (von + breite) % 1, mitte: (von + breite / 2) % 1, breite: breite };
  };

  Welt.prototype.naechsteIstSpreng = function () {
    return this.optionen.sprengStufe > 0 && this.birnenUebrig === 1;
  };

  // Tipp: Birne lösen. Gibt true zurück, wenn wirklich geworfen wurde.
  Welt.prototype.loesen = function () {
    if (this.zustand !== 'schwingt') return false;
    var fenster = this.trefferFenster(0.02);              // für die Meldung "zu früh / zu spät"
    var p = this.abwurfBei(this.schwingZeit);
    var o = this.optionen;
    var spreng = this.naechsteIstSpreng();
    var k = Bodies.circle(p.x, p.y, o.birnenRadius, {
      density: o.birnenDichte, friction: 0.4, frictionAir: 0, restitution: 0.1, label: 'birne',
      collisionFilter: { category: KAT.BIRNE, mask: KAT.PLATTFORM | KAT.BLOCK | KAT.BIRNE }
    });
    Composite.add(this.welt, k);
    Body.setVelocity(k, { x: p.vx, y: p.vy });
    var birne = {
      art: 'birne', koerper: k, spreng: spreng, gezuendet: false, alter: 0,
      phase: p.phase, theta: p.theta, fenster: fenster, loesSchritt: this.schrittNr, gelenkt: p.gelenkt
    };
    this.daten[k.id] = birne;
    this.birnen.push(birne);
    this.birnenUebrig--;
    this.ereignisse.push({ art: 'geloest', x: p.x, y: p.y, spreng: spreng, phase: p.phase });
    if (this.birnenUebrig > 0) {
      this.zustand = 'nachladen';
      this.timer = K.NACHLADE_MS;
    } else {
      this.zustand = 'ausrollen';
      this.ausrollZeit = 0;
      this.ruheSchritte = 0;
    }
    return true;
  };

  // ---------------------------------------------------------------- Zeitschritt

  Welt.prototype._merkeVorher = function () {
    function merke(k) { k.vorX = k.position.x; k.vorY = k.position.y; k.vorA = k.angle; }
    for (var i = 0; i < this.bloecke.length; i++) if (!this.bloecke[i].entfernt) merke(this.bloecke[i].koerper);
    for (var j = 0; j < this.birnen.length; j++) merke(this.birnen[j].koerper);
    for (var s = 0; s < this.splitter.length; s++) merke(this.splitter[s].koerper);
  };

  // Nur Physik und Aufräumen, ohne Levelablauf
  Welt.prototype._physik = function (dt) {
    this._merkeVorher();
    this.schrittNr++;
    // Fliegende Birne: Teil der Schwerkraft aufheben (flache, gut lesbare Flugbahn wie eine Kanonenkugel)
    var g = this.engine.gravity;
    for (var f = 0; f < this.birnen.length; f++) {
      var fb = this.birnen[f];
      if (!fb.kontakt) fb.koerper.force.y -= fb.koerper.mass * g.y * g.scale * (1 - K.FLUG_SCHWERKRAFT);
    }
    Engine.update(this.engine, dt);

    var i;
    for (i = 0; i < this._explosionen.length; i++) this._explodiere(this._explosionen[i].x, this._explosionen[i].y);
    this._explosionen.length = 0;
    for (i = 0; i < this._glasBruch.length; i++) this._zerbrich(this._glasBruch[i]);
    this._glasBruch.length = 0;

    var pl = this.plattform;
    for (i = 0; i < this.bloecke.length; i++) {
      var block = this.bloecke[i];
      if (block.entfernt) continue;
      var pos = block.koerper.position;
      if (!block.geraeumt && pos.y > K.RUNTER_Y) this._raeume(block, 'gefallen');
      if (pos.y > K.ENTFERNEN_Y || pos.x < pl.links - 900 || pos.x > pl.rechts + 900) this._entferneBlock(block);
    }

    for (i = this.birnen.length - 1; i >= 0; i--) {
      var birne = this.birnen[i];
      birne.alter += dt;
      var bp = birne.koerper.position;
      // Fehlwurf: kein Block berührt, aber schon unter der Plattform oder zu lange unterwegs
      if (!birne.blockKontakt && !birne.fehlwurf &&
          (bp.y > K.RUNTER_Y + birne.koerper.circleRadius || birne.alter > K.FEHLWURF_MS)) {
        birne.fehlwurf = true;
        var f = birne.fenster;
        if (f) {
          var dph = birne.phase - f.mitte;
          while (dph > 0.5) dph -= 1;
          while (dph <= -0.5) dph += 1;
          this.ereignisse.push({
            art: 'fehlwurf', richtung: dph < 0 ? 'frueh' : 'spaet', x: bp.x, y: bp.y,
            thetaLoes: birne.theta, thetaIdeal: -this.kran.A * Math.cos(2 * Math.PI * f.mitte)
          });
        }
      }
      if (bp.y > K.ENTFERNEN_Y || birne.alter > K.BIRNE_LEBEN_MS || bp.x > pl.rechts + 900) {
        Composite.remove(this.welt, birne.koerper);
        this.birnen.splice(i, 1);
        this._weckeUmkreis(bp.x, bp.y, birne.koerper.circleRadius + 60);
      }
    }

    for (i = this.splitter.length - 1; i >= 0; i--) {
      var s = this.splitter[i];
      s.alter += dt;
      if (s.alter > K.SPLITTER_LEBEN_MS || s.koerper.position.y > K.ENTFERNEN_Y) {
        Composite.remove(this.welt, s.koerper);
        this.splitter.splice(i, 1);
      }
    }
  };

  // Vor dem ersten Treffer: Physik ruhen lassen und das Bauwerk schlafen legen
  Welt.prototype.vorlauf = function (schritte) {
    var n = schritte === undefined ? 60 : schritte;
    for (var i = 0; i < n; i++) this._physik(K.SCHRITT_MS);
    for (var j = 0; j < this.bloecke.length; j++) {
      var k = this.bloecke[j].koerper;
      if (!this.bloecke[j].entfernt && k.speed < 0.2 && Math.abs(k.angularVelocity) < 0.01) Sleeping.set(k, true);
    }
    this.ereignisse.length = 0;
  };

  Welt.prototype.istRuhig = function () {
    for (var i = 0; i < this.bloecke.length; i++) {
      var b = this.bloecke[i];
      if (b.entfernt || b.geraeumt) continue;
      var k = b.koerper;
      if (!k.isSleeping && (k.speed > 0.25 || Math.abs(k.angularVelocity) > 0.02)) return false;
    }
    for (var j = 0; j < this.birnen.length; j++) {
      if (this.birnen[j].koerper.speed > 0.35) return false;
    }
    return true;
  };

  // Ein fester Zeitschritt (1/60 s): Ablauf + Physik
  Welt.prototype.schritt = function () {
    var dt = K.SCHRITT_MS;
    this.zeit += dt;

    if (this.zustand === 'nachladen') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.zustand = 'schwingt';
        this.schwingZeit = 0;
        this.ereignisse.push({ art: 'bereit', spreng: this.naechsteIstSpreng() });
      }
    } else if (this.zustand === 'schwingt') {
      this.schwingZeit += dt;
    } else if (this.zustand === 'ausrollen') {
      this.ausrollZeit += dt;
    }

    this._physik(dt);

    if (this.zustand === 'fertig') return;
    if (this.anzahlGeraeumt >= this.bloecke.length) {
      this.leerZeit += dt;
      if (this.leerZeit >= K.LEER_WARTEN_MS) this._fertig();
      return;
    }
    if (this.zustand === 'ausrollen') {
      this.ruheSchritte = this.istRuhig() ? this.ruheSchritte + 1 : 0;
      if ((this.ausrollZeit >= K.AUSROLL_MIN_MS && this.ruheSchritte >= K.RUHE_SCHRITTE) ||
          this.ausrollZeit >= K.AUSROLL_MAX_MS) this._fertig();
    }
  };

  Welt.prototype._fertig = function () {
    this.zustand = 'fertig';
    this.ereignisse.push({ art: 'fertig' });
  };

  Welt.prototype.statistik = function () {
    var gesamt = this.bloecke.length;
    return {
      gesamt: gesamt,
      geraeumt: this.anzahlGeraeumt,
      anteil: gesamt ? this.anzahlGeraeumt / gesamt : 0,
      proMaterial: { holz: this.proMaterial.holz, glas: this.proMaterial.glas, stein: this.proMaterial.stein, gold: this.proMaterial.gold },
      kette: this.kette,
      birnenGesamt: this.optionen.birnen,
      birnenUebrig: Math.max(0, this.birnenUebrig)
    };
  };

  // Rechteck, das die Kamera zeigen soll (Welt-Einheiten)
  Welt.prototype.grenzen = function () {
    var k = this.kran;
    var reich = k.L * Math.sin(k.A) + k.r;
    return {
      minX: Math.min(k.px - reich - 26, this.plattform.links - 10),
      maxX: Math.max(this.plattform.rechts + 15, k.px + reich + 15),
      minY: k.py - 72,
      maxY: K.WASSER_Y + 28       // unten nur ein schmaler Wasserstreifen
    };
  };

  // Ereignisse seit dem letzten Abholen
  Welt.prototype.holeEreignisse = function () {
    var e = this.ereignisse;
    this.ereignisse = [];
    return e;
  };

  /*
   * Kamera: Maßstab und Verschiebung, damit das Rechteck g (Welt) in breite x hoehe (Bildpunkte) passt.
   * Oben bleibt Platz für die Anzeige. Übrige Höhe kommt nach oben (Himmel), die Plattform sitzt unten.
   */
  function kamera(g, breite, hoehe, obenFrei, untenFrei) {
    var w = g.maxX - g.minX, h = g.maxY - g.minY;
    var verfuegbar = Math.max(50, hoehe - obenFrei - untenFrei);
    var s = Math.min(breite / w, verfuegbar / h);
    return {
      s: s,
      ox: (breite - w * s) / 2 - g.minX * s,
      oy: obenFrei + (verfuegbar - h * s) - g.minY * s
    };
  }

  var AbrissWelt = {
    kamera: kamera,
    erzeuge: function (level, optionen) { return new Welt(level, optionen); },
    K: K,
    MATERIAL: MATERIAL,
    Matter: Matter
  };

  if (istNode) module.exports = AbrissWelt;
  else wurzel.AbrissWelt = AbrissWelt;
})(this);
