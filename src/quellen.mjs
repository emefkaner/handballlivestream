// Datenbeschaffung für die beiden Mannschaften.
//
// Beide Quellen sind die öffentlichen Schnittstellen, aus denen sich auch die
// jeweilige Vereins- bzw. Liga-Website selbst bedient.

const ZEITUEBERSCHREITUNG = 30_000;

async function holeText(adresse, optionen = {}) {
  const antwort = await fetch(adresse, { ...optionen, signal: AbortSignal.timeout(ZEITUEBERSCHREITUNG) });
  if (!antwort.ok) throw new Error(`${antwort.status} ${antwort.statusText} bei ${adresse}`);
  return antwort.text();
}

async function holeJson(adresse, optionen = {}) {
  const antwort = await fetch(adresse, { ...optionen, signal: AbortSignal.timeout(ZEITUEBERSCHREITUNG) });
  if (!antwort.ok) throw new Error(`${antwort.status} ${antwort.statusText} bei ${adresse}`);
  return antwort.json();
}

function saeubere(wert) {
  return String(wert ?? '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// TSB Heilbronn-Horkheim "Hunters" (1. Männer, 3. Liga Süd)
// ---------------------------------------------------------------------------
//
// tsb-horkheim-hunters.de lädt seinen Spielplan im Browser aus einem eigenen
// Strapi. Den dafür nötigen Lese-Schlüssel liefert die Seite in ihrem
// JavaScript mit aus. Er wird hier bei jedem Lauf frisch von dort geholt,
// statt ihn im Repo abzulegen: so steht kein Zugangswert in der Versionsver-
// waltung, und ein Wechsel auf Vereinsseite bricht den Kalender nicht.

const TSB_SEITE = 'https://tsb-horkheim-hunters.de';
const TSB_KALENDERSEITE = `${TSB_SEITE}/calendar`;

async function holeTsbZugang() {
  const seite = await holeText(TSB_KALENDERSEITE);
  const bausteine = [...seite.matchAll(/(?:src|href)="(\/_next\/static\/chunks\/[^"]+\.js)"/g)]
    .map((treffer) => treffer[1]);

  if (bausteine.length === 0) {
    throw new Error('Auf der TSB-Kalenderseite wurde kein JavaScript gefunden — hat die Seite ihren Aufbau geändert?');
  }

  for (const pfad of bausteine) {
    let code;
    try {
      code = await holeText(`${TSB_SEITE}${pfad}`);
    } catch {
      continue; // Einzelne Bausteine dürfen fehlen.
    }
    if (!code.includes('webapi.')) continue;

    const basis = code.match(/https:\/\/webapi\.[a-z0-9.-]+/i)?.[0];
    const schluessel = code.match(/Authorization:\s*"Bearer ([^"]+)"/)?.[1];
    if (basis && schluessel) return { basis: `${basis}/api`, schluessel };
  }

  throw new Error('In den Skripten der TSB-Seite steckt kein Zugang zur Spielplan-Schnittstelle mehr.');
}

export async function holeHuntersHeimspiele(protokoll = []) {
  const zugang = await holeTsbZugang();
  const spiele = await holeJson(
    `${zugang.basis}/handball-matches?sort=matchDate:asc&pagination[limit]=500`,
    { headers: { Authorization: `Bearer ${zugang.schluessel}` } },
  );
  if (!Array.isArray(spiele)) throw new Error('Unerwartete Antwort der TSB-Schnittstelle (kein Array)');

  const heimspiele = spiele
    .filter((s) => s.isHomeMatch === true && s.matchDate)
    .map((s) => ({
      quelle: 'tsb',
      kennung: s.externalId || `id-${s.id}`,
      beginn: new Date(s.matchDate),
      heim: saeubere(s.homeTeam),
      gast: saeubere(s.awayTeam),
      liga: saeubere(s.league),
      ligaLang: saeubere(s.league),
      spieltag: null,
      ort: hallenName(s.venue),
      abgesagt: s.matchStatus === 'cancelled',
      gespielt: s.matchStatus === 'finished',
      toreHeim: s.homeScore,
      toreGast: s.awayScore,
      web: TSB_KALENDERSEITE,
    }));

  protokoll.push(`TSB Hunters: ${spiele.length} Spiele geladen, davon ${heimspiele.length} Heimspiele`);
  return heimspiele;
}

// "STAUWEHRHALLE" -> "Stauwehrhalle". Die Quelle schreibt Hallen in Versalien.
function hallenName(roh) {
  const name = saeubere(roh);
  if (!name || name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/(^|[\s\-/])([a-zäöü])/g, (_, davor, buchstabe) => davor + buchstabe.toUpperCase());
}

// ---------------------------------------------------------------------------
// Sport-Union Neckarsulm (Damen, 1. Bundesliga + DHB-Pokal)
// ---------------------------------------------------------------------------
//
// alsco-hbf.de (früher hbf-info.de) legt die kompletten Spielpläne als
// statische JSON-Dateien ab: /data/leagues/league_<Saison-ID>.json.
// Jede dieser Dateien führt unter "seasons" auch alle übrigen Saisons auf —
// daraus sucht sich der Bau die laufende Saison selbst, damit der Kalender
// im nächsten Sommer nicht stillschweigend leer bleibt.

const HBF_BASIS = 'https://hbf-cms.deinsportplatz.de/data/leagues';

const HBF_WETTBEWERBE = [
  { schluessel: 'bundesliga', kurz: '1. BL', bezeichnung: '1. Bundesliga Frauen', einstieg: 1738, namensteil: 'Bundesliga Frauen' },
  { schluessel: 'pokal', kurz: 'DHB-Pokal', bezeichnung: 'DHB-Pokal Frauen', einstieg: 1741, namensteil: 'DHB-Pokal Frauen' },
];

// Eine Handball-Saison läuft von Sommer bis Frühjahr. Ab Juli zählt das neue
// Saisonjahr: im September 2026 ist das die Saison 2026/2027.
export function saisonBezeichnung(jetzt = new Date()) {
  const jahr = jetzt.getUTCFullYear();
  const start = jetzt.getUTCMonth() + 1 >= 7 ? jahr : jahr - 1;
  return `${start}/${start + 1}`;
}

function findeSaison(saisons, namensteil, bezeichnung) {
  if (!Array.isArray(saisons)) return null;
  // Bevorzugt der Hauptwettbewerb dieser Saison, keine Play-off-Runde.
  const genau = saisons.find(
    (s) => s.year === bezeichnung && saeubere(s.name) === `${namensteil} ${bezeichnung}`,
  );
  if (genau) return Number(genau.fmpSeasonId);
  const locker = saisons.find((s) => s.year === bezeichnung && saeubere(s.name).includes(namensteil));
  return locker ? Number(locker.fmpSeasonId) : null;
}

async function holeWettbewerb(wettbewerb, saison, protokoll) {
  const einstieg = await holeJson(`${HBF_BASIS}/league_${wettbewerb.einstieg}.json`);
  const gefunden = findeSaison(einstieg.seasons, wettbewerb.namensteil, saison);

  let daten = einstieg;
  let benutzteId = wettbewerb.einstieg;

  if (gefunden && gefunden !== wettbewerb.einstieg) {
    daten = await holeJson(`${HBF_BASIS}/league_${gefunden}.json`);
    benutzteId = gefunden;
  } else if (!gefunden) {
    protokoll.push(
      `WARNUNG: Für ${wettbewerb.bezeichnung} gibt es keine Saison ${saison}. ` +
      `Verwendet wird die hinterlegte Saison ${wettbewerb.einstieg}.`,
    );
  }

  protokoll.push(`${wettbewerb.bezeichnung}: Saison-ID ${benutzteId}, ${daten.schedule?.length ?? 0} Spiele im Wettbewerb`);
  return daten;
}

const NSU_ERKENNUNG = /neckarsulm/i;

export async function holeNeckarsulmSpiele(protokoll = [], jetzt = new Date()) {
  const saison = saisonBezeichnung(jetzt);
  const spiele = [];

  for (const wettbewerb of HBF_WETTBEWERBE) {
    const daten = await holeWettbewerb(wettbewerb, saison, protokoll);
    const plan = Array.isArray(daten.schedule) ? daten.schedule : [];
    let gefunden = 0;

    for (const s of plan) {
      const heim = saeubere(s.webseitennameHome);
      const gast = saeubere(s.webseitennameAway);
      if (!NSU_ERKENNUNG.test(heim) && !NSU_ERKENNUNG.test(gast)) continue;
      if (!s.matchDate) continue;
      gefunden += 1;

      spiele.push({
        quelle: `hbf-${wettbewerb.schluessel}`,
        kennung: String(s.fmpMatchId || s.matchId),
        beginn: new Date(s.matchDate),
        heim,
        gast,
        liga: wettbewerb.kurz,
        ligaLang: wettbewerb.bezeichnung,
        spieltag: s.matchDay || null,
        ort: saeubere(s.venue?.name),
        abgesagt: false,
        gespielt: s.resultCode === 'confirmed_result',
        toreHeim: s.goalsHome,
        toreGast: s.goalsAway,
        web: 'https://www.alsco-hbf.de/',
      });
    }
    protokoll.push(`  davon mit Neckarsulm: ${gefunden}`);
  }

  spiele.sort((a, b) => a.beginn - b.beginn);
  return { spiele, saison };
}
