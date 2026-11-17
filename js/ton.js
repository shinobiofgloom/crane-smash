/*
 * Töne per WebAudio erzeugt (keine Tondateien). Startet erst nach der ersten Berührung.
 * Jede Funktion ist harmlos, wenn WebAudio fehlt oder stumm geschaltet ist.
 */
var Ton = (function () {
  'use strict';

  var ctx = null;
  var haupt = null;
  var rauschen = null;
  var stumm = false;
  var angehalten = false;
  var zuletzt = {};
  var LAUTSTAERKE = 0.55;

  function jetzt() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }

  // Erste Berührung: AudioContext anlegen bzw. fortsetzen
  function start() {
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        haupt = ctx.createGain();
        haupt.gain.value = stumm ? 0 : LAUTSTAERKE;
        haupt.connect(ctx.destination);
        var laenge = Math.floor(ctx.sampleRate * 0.6);
        rauschen = ctx.createBuffer(1, laenge, ctx.sampleRate);
        var d = rauschen.getChannelData(0);
        for (var i = 0; i < laenge; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended' && !angehalten) ctx.resume();
    } catch (e) { ctx = null; }
  }

  function bereit() { return ctx && !stumm && !angehalten && ctx.state === 'running'; }

  // Nicht zu viele gleiche Töne auf einmal
  function gedrosselt(name, ms) {
    var t = jetzt();
    if (zuletzt[name] && t - zuletzt[name] < ms) return true;
    zuletzt[name] = t;
    return false;
  }

  function huellkurve(gain, t0, laut, anschlag, dauer) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, laut), t0 + anschlag);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dauer);
  }

  function klang(freq, dauer, typ, laut, freqEnde, verzoegerung) {
    if (!bereit()) return;
    try {
      var t0 = ctx.currentTime + (verzoegerung || 0);
      var osz = ctx.createOscillator();
      var g = ctx.createGain();
      osz.type = typ || 'sine';
      osz.frequency.setValueAtTime(freq, t0);
      if (freqEnde) osz.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnde), t0 + dauer);
      huellkurve(g, t0, laut, 0.005, dauer);
      osz.connect(g);
      g.connect(haupt);
      osz.start(t0);
      osz.stop(t0 + dauer + 0.05);
    } catch (e) { /* Ton ist Beiwerk */ }
  }

  function geraeusch(dauer, laut, filterTyp, freq, q, freqEnde, verzoegerung) {
    if (!bereit()) return;
    try {
      var t0 = ctx.currentTime + (verzoegerung || 0);
      var quelle = ctx.createBufferSource();
      quelle.buffer = rauschen;
      var f = ctx.createBiquadFilter();
      f.type = filterTyp || 'lowpass';
      f.frequency.setValueAtTime(freq || 1000, t0);
      if (freqEnde) f.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnde), t0 + dauer);
      f.Q.value = q || 1;
      var g = ctx.createGain();
      huellkurve(g, t0, laut, 0.004, dauer);
      quelle.connect(f);
      f.connect(g);
      g.connect(haupt);
      quelle.start(t0, Math.random() * 0.3);
      quelle.stop(t0 + dauer + 0.05);
    } catch (e) { /* Ton ist Beiwerk */ }
  }

  function staerkeZuLaut(staerke, grund) { return Math.min(1, grund * (0.35 + staerke / 10)); }

  return {
    start: start,

    holz: function (staerke) {
      if (gedrosselt('holz', 55)) return;
      var l = staerkeZuLaut(staerke, 0.5);
      klang(260 + Math.random() * 80, 0.09, 'triangle', l, 130);
      geraeusch(0.06, l * 0.6, 'bandpass', 900, 2);
    },
    stein: function (staerke) {
      if (gedrosselt('stein', 70)) return;
      var l = staerkeZuLaut(staerke, 0.6);
      klang(110 + Math.random() * 30, 0.18, 'sine', l, 55);
      geraeusch(0.16, l * 0.7, 'lowpass', 600, 1, 150);
    },
    glasKling: function (staerke) {
      if (gedrosselt('glasKling', 60)) return;
      klang(1800 + Math.random() * 600, 0.12, 'sine', staerkeZuLaut(staerke, 0.25));
    },
    glas: function () {
      if (gedrosselt('glas', 70)) return;
      geraeusch(0.35, 0.35, 'highpass', 3500, 1);
      for (var i = 0; i < 4; i++) klang(1600 + Math.random() * 2200, 0.15 + Math.random() * 0.15, 'sine', 0.12, null, i * 0.035);
    },
    stahl: function (staerke) {
      if (gedrosselt('stahl', 80)) return;
      var l = staerkeZuLaut(staerke, 0.4);
      klang(180, 0.25, 'square', l * 0.25, 90);
      geraeusch(0.12, l * 0.5, 'lowpass', 400, 1);
    },
    loesen: function () {
      geraeusch(0.35, 0.25, 'bandpass', 400, 1.5, 1800);
      klang(500, 0.06, 'square', 0.08, 300);
    },
    kette: function () {
      if (gedrosselt('kette', 200)) return;
      for (var i = 0; i < 3; i++) klang(900 + i * 120, 0.05, 'square', 0.04, 700, i * 0.06);
    },
    muenze: function (hoch) {
      if (gedrosselt('muenze', 45)) return;
      var f = 880 * (hoch ? 1.5 : 1);
      klang(f, 0.08, 'square', 0.07);
      klang(f * 1.5, 0.14, 'square', 0.07, null, 0.06);
    },
    gold: function () {
      [0, 0.07, 0.14, 0.21].forEach(function (v, i) { klang(660 * Math.pow(1.26, i), 0.18, 'triangle', 0.18, null, v); });
    },
    boom: function () {
      geraeusch(0.8, 0.9, 'lowpass', 1200, 0.8, 60);
      klang(90, 0.6, 'sine', 0.8, 30);
    },
    platsch: function () {
      if (gedrosselt('platsch', 90)) return;
      geraeusch(0.3, 0.25, 'bandpass', 800, 0.8, 250);
    },
    stern: function (nr) {
      klang(660 * Math.pow(1.335, nr), 0.25, 'triangle', 0.22);
      klang(1320 * Math.pow(1.335, nr), 0.2, 'sine', 0.08, null, 0.03);
    },
    sieg: function () {
      [523, 659, 784, 1046].forEach(function (f, i) { klang(f, 0.22, 'triangle', 0.2, null, i * 0.09); });
    },
    pech: function () {
      klang(392, 0.2, 'triangle', 0.18, 370);
      klang(311, 0.35, 'triangle', 0.18, 280, 0.18);
    },
    kauf: function () {
      klang(523, 0.1, 'square', 0.08);
      klang(784, 0.18, 'square', 0.08, null, 0.08);
    },
    klick: function () { klang(700, 0.04, 'square', 0.05); },

    setzeStumm: function (wert) {
      stumm = !!wert;
      try { if (haupt) haupt.gain.value = stumm ? 0 : LAUTSTAERKE; } catch (e) { /* egal */ }
    },
    istStumm: function () { return stumm; },
    // Werbepause oder verstecktes Fenster: Ton anhalten
    anhalten: function () {
      angehalten = true;
      try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch (e) { /* egal */ }
    },
    fortsetzen: function () {
      angehalten = false;
      try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) { /* egal */ }
    }
  };
})();
