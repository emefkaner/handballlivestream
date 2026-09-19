// Persönliche Kalender: Jede und jeder aus dem Livestream-Team bekommt eine
// eigene Datei mit ausschließlich den Einsätzen, für die der eigene Name im
// Dienstplan steht.

// Wer einen eigenen Kalender bekommt. "schreibweisen" fängt ab, dass in der
// Tabelle mal ein Name abgekürzt oder anders geschrieben wird — verglichen
// wird ohne Rücksicht auf Groß- und Kleinschreibung.
export const PERSONEN = [
  { name: 'Oliver Amann', datei: 'oliver-amann.ics', schreibweisen: ['Oliver Amann', 'O. Amann', 'Amann'] },
  { name: 'Andreas Krieger', datei: 'andreas-krieger.ics', schreibweisen: ['Andreas Krieger', 'A. Krieger', 'AKrieger'] },
  { name: 'Markus Krieger', datei: 'markus-krieger.ics', schreibweisen: ['Markus Krieger', 'M. Krieger', 'MKrieger'] },
  { name: 'Tanja Krieger', datei: 'tanja-krieger.ics', schreibweisen: ['Tanja Krieger', 'T. Krieger', 'TKrieger'] },
];

function vereinfacht(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Welche Aufgabe hat die Person bei diesem Spiel? Gibt null zurück, wenn sie
// gar nicht eingeteilt ist. Steht jemand doppelt (etwa Regie und Kamera),
// werden beide Aufgaben genannt.
export function aufgabeIm(spiel, person) {
  if (!spiel.besetzung) return null;
  const gesuchte = person.schreibweisen.map(vereinfacht);
  const passt = (wert) => wert && gesuchte.includes(vereinfacht(wert));

  const aufgaben = [];
  if (passt(spiel.besetzung.regie)) aufgaben.push('Regie');
  if (passt(spiel.besetzung.kamera1)) aufgaben.push('Kamera 1');
  if (passt(spiel.besetzung.kamera2)) aufgaben.push('Kamera 2');

  return aufgaben.length > 0 ? aufgaben.join(' + ') : null;
}

// Die Spiele einer Person, jeweils um die eigene Aufgabe ergänzt.
export function spieleVon(spiele, person) {
  const eigene = [];
  for (const spiel of spiele) {
    const aufgabe = aufgabeIm(spiel, person);
    if (aufgabe) eigene.push({ ...spiel, rolle: aufgabe });
  }
  return eigene;
}
