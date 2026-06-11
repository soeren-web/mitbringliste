# Sommerfest Mitbringliste

Eine einfache offene Liste fuer ein Sommerfest. Alle mit dem Link koennen Eintraege hinzufuegen, bearbeiten und loeschen. Laeuft auf Cloudflare Pages (Functions + D1).

## Einmalige Einrichtung

1. D1-Datenbank anlegen und die ausgegebene `database_id` in `wrangler.toml` eintragen:

   ```bash
   npx wrangler d1 create mitbringliste
   ```

2. Schema anwenden (einmal remote, einmal fuer die lokale Entwicklung):

   ```bash
   npx wrangler d1 execute mitbringliste --remote --file=schema.sql
   npx wrangler d1 execute mitbringliste --local --file=schema.sql
   ```

3. Repo in Cloudflare Pages verbinden. Build-Einstellungen: kein Build-Befehl, Output-Verzeichnis `public` (wird aus `wrangler.toml` uebernommen). Das D1-Binding `DB` kommt ebenfalls aus `wrangler.toml`.

## Lokal entwickeln

```bash
npm run dev
```

## Daten

Die Eintraege liegen in der D1-Tabelle `items`. Aenderungen anderer Gaeste werden alle 5 Sekunden per Polling abgeholt. Es gibt bewusst kein Login und keine Rechteverwaltung.
