const GAMES = [
  {
    "title": "Detective dell’energia",
    "classes": [
      "1 Legno",
      "1 Disegno"
    ],
    "subject": "Scienze · Colazione & energia",
    "description": "Otto livelli per costruire una colazione rispettando massa, volume ed energia.",
    "icon": "⚡",
    "url": "attivita/detective-energia/"
  },
  {
    "title": "Colazione & proteine",
    "classes": [
      "1 Legno",
      "1 Disegno"
    ],
    "subject": "Scienze · Proteine",
    "description": "Scegli gli alimenti, controlla i dati e scopri il ruolo delle proteine nella costruzione.",
    "icon": "🥚",
    "url": "attivita/colazione-proteine/"
  },
  {
    "title": "Colazione & fibre",
    "classes": [
      "1 Legno",
      "1 Disegno"
    ],
    "subject": "Scienze · Fibre",
    "description": "Scegli gli alimenti, controlla i dati e scopri il ruolo delle fibre nell'alimentazione.",
    "icon": "🥬",
    "url": "attivita/fibre/"
  },
  {
    "title": "Missioni numeriche",
    "classes": [
      "1 Legno"
    ],
    "subject": "Matematica",
    "description": "Pietre, gruppi, frazioni, area e riflessione finale. Il percorso salva anche gli esiti.",
    "icon": "123",
    "url": "attivita/missioni-numeriche/"
  },
  {
    "title": "MCM · salti e fattori",
    "classes": [
      "1 Legno"
    ],
    "subject": "Matematica · MCM",
    "description": "Visualizza multipli, primo incontro e scomposizione in fattori primi.",
    "icon": "×",
    "url": "attivita/mcm/"
  },
{
  "title": "Missione Acqua FPV",
  "classes": [
    "1 Legno",
    "1 Disegno"
  ],
  "subject": "Scienze · Acqua",
  "description": "Esplora in prima persona, raggiungi le stazioni d'acqua e supera 8 livelli su idratazione, volumi ed equivalenze.",
  "icon": "💧",
  "url": "attivita/acqua/"
},
{
  "title": "Hotel di Hilbert",
  "classes": [
    "2 Legno"
  ],
  "subject": "Matematica · Infinito",
  "description": "Sette missioni per capire l'infinito spostando gli ospiti di un hotel con infinite camere.",
  "icon": "∞",
  "url": "attivita/hotel_hilbert/"
},
{
  "title": "Corsa dentro il legno",
  "classes": ["2 Disegno","2 Disegno"],
  "subject": "Scienze applicate",
  "description": "Gara a checkpoint su fibra, cellula, cellulosa, lignina, molecole, atomi e scale della materia.",
  "icon": "🏎️",
  "url": "attivita/corsa-dentro-il-legno/"
},
{
  "title": "CAD Lab · Pixel → CAD",
  "classes": ["1 Informatica"],
  "subject": "CAD · Fondamenti",
  "description": "24 quesiti a difficoltà crescente su raster e vettoriale, coordinate, dimensioni e controllo degli errori. Entra con il codice classe per salvare i risultati.",
  "icon": "📐",
  "url": "attivita/cad/"
},
  {
    "title": "Trave Lab",
    "classes": [
      "3 Legno"
    ],
    "subject": "Scienze · Costruzioni",
    "description": "Vincoli, gradi di libertà, reazioni, sforzi interni e sei sfide sulla trave.",
    "icon": "▰",
    "url": "attivita/trave-lab/"
  }
];

const FILTERS = ["Tutte","1 Legno","1 Disegno","2 Legno","3 Legno"];
let active="Tutte", query="";
const filters=document.getElementById("filters"), grid=document.getElementById("grid"),
      empty=document.getElementById("empty"), q=document.getElementById("q");

FILTERS.forEach((name,i)=>{
  const b=document.createElement("button");
  b.className="filter"+(i===0?" active":"");
  b.textContent=name;
  b.onclick=()=>{
    active=name;
    document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    render();
  };
  filters.appendChild(b);
});

q.oninput=e=>{query=e.target.value.trim().toLowerCase();render()};

function render(){
  const items=GAMES.filter(g=>{
    const classOK=active==="Tutte"||g.classes.includes(active);
    const text=[g.title,g.subject,g.description,...g.classes].join(" ").toLowerCase();
    return classOK && text.includes(query);
  });
  grid.innerHTML="";
  empty.hidden=items.length>0;
  items.forEach((g,i)=>{
    const a=document.createElement("a");
    a.className="card"; a.href=g.url;
    a.innerHTML=`
      <div class="top"><span class="num">${String(i+1).padStart(2,"0")}</span><span class="classes">${g.classes.join(" · ")}</span></div>
      <div class="icon" aria-hidden="true">${g.icon}</div>
      <div class="body"><span class="subject">${g.subject}</span><h3>${g.title}</h3><p>${g.description}</p></div>
      <div class="launch"><span>APRI ATTIVITÀ</span><span>↗</span></div>`;
    grid.appendChild(a);
  });
}
render();
