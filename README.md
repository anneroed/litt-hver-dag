# Litt hver dag

Personlig PWA for calisthenics 10–30 minutter hver dag, med pull-up-stang, hoppetau og gulv.
All data ligger lokalt på enheten i IndexedDB.

```bash
npm start
```

Åpne http://localhost:4173. Testene kjøres med `npm test`.

- Ved publisering: øk `VERSION` i `sw.js`, ellers får ikke installerte apper den nye koden.
- Nye filer må legges i `PRECACHE` i `sw.js`. Testene feiler hvis listen ikke stemmer.
- Lokalt bruker service workeren nettverket først, med cache som reserve. Publisert bruker den cachen først.
- Ikonene lages med `python3 tools/make_icons.py`.
