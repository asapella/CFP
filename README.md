# Sala Giochi CFP — avvio rapido

Questa cartella è pronta per GitHub Pages.

## Per pubblicarla oggi

1. Crea (o usa) un repository GitHub, per esempio `cfp`.
2. Carica **tutto il contenuto** di questa cartella nella root del repository.
3. In GitHub vai su **Settings → Pages**.
4. In "Build and deployment" scegli:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/(root)**
5. Dopo la pubblicazione, il portale sarà raggiungibile a un indirizzo del tipo:
   `https://TUO-USERNAME.github.io/cfp/`

## Come aggiungere le webapp

Esempio per la webapp "Colazione":

- crea la cartella `1-legno/colazione/`
- copia dentro il file `index.html` della webapp e tutti i suoi file
- il portale la aprirà da `1-legno/colazione/`

Per la webapp "Trave & vincoli":

- crea la cartella `3-legno/trave-vincoli/`
- copia dentro la webapp

## Come modificare le schede

Apri `games.js`.

Ogni scheda ha questa forma:

```js
{
  title: "Nome attività",
  className: "1 Legno",
  subject: "Matematica",
  description: "Descrizione breve.",
  icon: "➗",
  url: "1-legno/nome-attivita/"
}
```

Se `url` è vuoto (`url: ""`), la scheda appare come "IN ARRIVO".

## Struttura consigliata

```text
/
├── index.html
├── styles.css
├── games.js
├── 1-legno/
│   └── colazione/
│       └── index.html
├── 2-legno/
├── 3-legno/
│   └── trave-vincoli/
│       └── index.html
└── 1-disegno/
```

## Offline — più avanti

Per usare lo stesso portale senza Internet non serve una linea Internet, ma serve che i computer siano sulla **stessa rete locale**.
La soluzione più affidabile per una classe è un piccolo router/access point dedicato, anche senza SIM o collegamento Internet.
