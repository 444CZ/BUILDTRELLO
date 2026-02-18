# RealizaceBoard

Jednoduchá webová aplikace inspirovaná Trello pro evidenci firemních realizací.

## Co umí

- Zakládat účty pracovníků s jednotně pojmenovanými pozicemi (v češtině).
- Přihlášení pod vybraným účtem.
- Zakládat zakázky/realizace s údaji:
  - název,
  - popis,
  - klient,
  - odhadovaná cena,
  - adresa,
  - stav zakázky,
  - zapojení pracovníci.
- Přidávat úkoly k jednotlivým zakázkám.
- Zobrazit úkoly v nástěnce se sloupci ve stylu Trello.
- Data se ukládají do `localStorage`.

## Spuštění

Stačí otevřít `index.html` v prohlížeči.

Nebo lokální server:

```bash
python3 -m http.server 4173
```

Pak otevřít `http://localhost:4173`.
