/*
 * Alle sichtbaren Texte an einer Stelle (Englisch, Pflicht bei CrazyGames).
 * Für Deutsch später ein zweites Objekt mit denselben Schlüsseln anlegen und TEXTE austauschen.
 */
var TEXTE = {
  titel: 'Crane Smash',
  level: 'Level',
  ziel: 'Goal',
  weiter: 'Next',
  nochmal: 'Retry',
  upgrades: 'Upgrades',
  fertig: 'Done',
  geschafft: 'Cleared!',
  perfekt: 'Perfect!',
  knapp: 'So close!',
  nichtGeschafft: 'Try again!',
  kettenreaktion: 'Chain x{n}!',
  gold: 'Gold!',
  boom: 'BOOM!',
  zielErreicht: 'Goal!',
  zuFrueh: 'Too early!',
  zuSpaet: 'Too late!',
  max: 'MAX',
  abLevel: 'Level {n}',
  posten: {
    schaden: 'Damage',
    gold: 'Gold crates',
    kette: 'Chain reactions',
    sterne: 'Stars',
    birnen: 'Balls left'
  },
  upgrade: {
    schwer: { name: 'Heavier Ball', info: 'Hits harder' },
    kette: { name: 'Longer Chain', info: 'Throws farther' },
    birne: { name: 'Extra Ball', info: '+1 ball per level' },
    spreng: { name: 'Blast Ball', info: 'Last ball goes BOOM' },
    ziel: { name: 'Aim Help', info: 'Shows where it flies' }
  },
  ton: 'Sound'
};

// Platzhalter {n} ersetzen
function text(vorlage, werte) {
  return String(vorlage).replace(/\{(\w+)\}/g, function (_, k) { return werte && werte[k] !== undefined ? werte[k] : ''; });
}
