# RealizaceBoard (v2)

Promyšlenější interní aplikace inspirovaná Trello pro realizační firmu.

## Co je nově

- **Přihlášení přes e-mail + heslo** (nejsou přístupná data bez loginu).
- **Databáze SQLite** (`data/realizaceboard.db`) místo `localStorage`.
- **Oddělené obrazovky**:
  - nejdřív login/registrace,
  - až po přihlášení nástěnka.
- **CRUD nad zakázkami**: přidat, upravit, smazat.
- **CRUD nad úkoly**: přidat, upravit, smazat.
- **Správa členů zakázky** (multi-select pracovníků).
- Přehled rolí a lidí v týmu (sidebar).

## Použité technologie

- Node.js + Express
- SQLite (`better-sqlite3`)
- Vanilla JS + HTML + CSS

## Spuštění

```bash
cd /workspace/BUILDTRELLO
npm install
npm start
```

Aplikace poběží na:

- `http://localhost:4173`

## První kroky pro test

1. Otevři `http://localhost:4173`.
2. Vytvoř první účet v záložce **Registrace** (heslo min. 8 znaků).
3. Po přihlášení vytvoř přes tlačítko **+ Nová zakázka** první realizaci.
4. Na kartě zakázky používej tlačítka **+ Úkol / Upravit / Smazat**.

## Poznámka k Trellu

Trello jako produkt není open-source projekt. Veřejně ale existují open-source alternativy (např. Focalboard, Wekan, Taiga), které mohou posloužit jako inspirace pro další UX i architekturu.
