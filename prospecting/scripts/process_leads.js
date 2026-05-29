const fs = require("fs");
const path = require("path");

const PAISES_LATAM = new Set(["CO", "MX", "AR"]);

const FILES = [
  String.raw`C:\Users\Jeronimo\Downloads\dataset_crawler-google-places_2026-05-23_03-05-51-680.json`,
  String.raw`C:\Users\Jeronimo\Downloads\dataset_crawler-google-places_2026-05-23_03-04-55-975.json`,
  String.raw`C:\Users\Jeronimo\Downloads\dataset_crawler-google-places_2026-05-23_03-01-17-053.json`,
  String.raw`C:\Users\Jeronimo\Downloads\dataset_crawler-google-places_2026-05-23_03-07-38-057.json`,
];

function calcularPrioridad(lugar) {
  const tieneTel = Boolean(lugar.phone);
  const tieneWeb = Boolean(lugar.website);
  if (tieneTel && !tieneWeb) return "ALTA";
  if (tieneTel && tieneWeb) return "MEDIA";
  return "BAJA";
}

function extraerDireccion(lugar) {
  return [lugar.street, lugar.city, lugar.state].filter(Boolean).join(", ");
}

function escapeCsv(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Cargar y mergear
let raw = [];
for (const f of FILES) {
  const data = JSON.parse(fs.readFileSync(f, "utf-8"));
  raw = raw.concat(data);
}
console.log(`\n📥 Total registros cargados: ${raw.length}`);

// Procesar
const vistos = new Set();
const leads = [];
let descartadosPais = 0;
let descartadosFiltro = 0;
let descartadosDuplicado = 0;

for (const lugar of raw) {
  const pais = lugar.countryCode || "";

  if (!PAISES_LATAM.has(pais)) {
    descartadosPais++;
    continue;
  }

  const url = lugar.url || "";
  if (vistos.has(url)) {
    descartadosDuplicado++;
    continue;
  }
  vistos.add(url);

  const rating = lugar.totalScore || 0;
  const reviews = lugar.reviewsCount || 0;

  if (rating < 3.0 || reviews < 2 || reviews > 500) {
    descartadosFiltro++;
    continue;
  }

  leads.push({
    nombre: lugar.title || "",
    categoria: lugar.categoryName || "",
    direccion: extraerDireccion(lugar),
    ciudad: lugar.city || "",
    pais,
    telefono: lugar.phone || "",
    sitio_web: lugar.website || "",
    email: lugar.email || "",
    rating,
    total_reviews: reviews,
    google_maps_url: url,
    tiene_web: lugar.website ? "Sí" : "No",
    tiene_telefono: lugar.phone ? "Sí" : "No",
    prioridad: calcularPrioridad(lugar),
  });
}

// Ordenar: ALTA primero, luego por reviews desc
leads.sort((a, b) => {
  const orden = { ALTA: 0, MEDIA: 1, BAJA: 2 };
  if (orden[a.prioridad] !== orden[b.prioridad]) return orden[a.prioridad] - orden[b.prioridad];
  return b.total_reviews - a.total_reviews;
});

// Resumen
const altas = leads.filter(l => l.prioridad === "ALTA").length;
const medias = leads.filter(l => l.prioridad === "MEDIA").length;
const bajas = leads.filter(l => l.prioridad === "BAJA").length;
const porPais = leads.reduce((acc, l) => { acc[l.pais] = (acc[l.pais] || 0) + 1; return acc; }, {});

console.log(`   Descartados (no LATAM): ${descartadosPais}`);
console.log(`   Descartados (duplicados): ${descartadosDuplicado}`);
console.log(`   Descartados (filtro rating/reviews): ${descartadosFiltro}`);
console.log(`\n📊 Leads finales: ${leads.length}`);
console.log(`   🔴 Alta prioridad (sin web): ${altas}`);
console.log(`   🟡 Media prioridad (con web): ${medias}`);
console.log(`   ⚪ Baja prioridad (sin tel): ${bajas}`);
console.log(`\n🌎 Por país:`);
for (const [p, n] of Object.entries(porPais)) console.log(`   ${p}: ${n}`);

// Exportar CSV
const COLS = ["nombre","categoria","direccion","ciudad","pais","telefono","sitio_web","email","rating","total_reviews","google_maps_url","tiene_web","tiene_telefono","prioridad"];
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16).replace("T", "_");
const outFile = path.join(__dirname, `leads_nexora_${timestamp}.csv`);

const rows = [COLS.join(",")];
for (const lead of leads) {
  rows.push(COLS.map(c => escapeCsv(lead[c])).join(","));
}

fs.writeFileSync(outFile, "﻿" + rows.join("\n"), "utf-8");
console.log(`\n✅ CSV exportado: ${outFile}`);
