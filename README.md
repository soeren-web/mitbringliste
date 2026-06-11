# Sommerfest Mitbringliste

Eine einfache offene Liste fuer ein Sommerfest. Alle mit dem Link koennen Eintraege hinzufuegen, bearbeiten und loeschen.

## Starten

```bash
npm start
```

Danach die angezeigte lokale Adresse im Browser oeffnen. Wenn Port 3000 schon belegt ist, nimmt die App automatisch den naechsten freien Port.

## Daten

Die Eintraege werden in `data/items.json` gespeichert. Fuer eine gemeinsam nutzbare Internet-Adresse muss der Ordner auf einem kleinen Node.js-Host laufen, zum Beispiel Render, Railway, Fly.io oder einem eigenen Server. Es gibt bewusst kein Login und keine Rechteverwaltung.
