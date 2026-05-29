/**
 * Procesador especializado — Campaña Gimnasios LATAM
 * Genera CSV pivot-ready + informe en consola
 */

const fs = require("fs");
const path = require("path");

// ── Archivos de entrada con metadata de zona ───────────────────────────────────

const SOURCES = [
  { file: "C:/Users/Jeronimo/Downloads/dataset_crawler-google-places_2026-05-23_19-25-00-061.json", zona: "El Poblado",  ciudad: "Medellín",          pais: "Colombia" },
  { file: "C:/Users/Jeronimo/Downloads/dataset_crawler-google-places_2026-05-23_19-33-00-555.json", zona: "Laureles",   ciudad: "Medellín",          pais: "Colombia" },
  { file: "C:/Users/Jeronimo/Downloads/dataset_crawler-google-places_2026-05-23_19-34-00-316.json", zona: "Envigado",   ciudad: "Envigado",          pais: "Colombia" },
  { file: "C:/Users/Jeronimo/Downloads/dataset_crawler-google-places_2026-05-23_19-34-50-000.json", zona: "Chapinero",  ciudad: "Bogotá",            pais: "Colombia" },
  { file: "C:/Users/Jeronimo/Downloads/dataset_crawler-google-places_2026-05-23_19-36-06-341.json", zona: "Palermo",    ciudad: "Buenos Aires",      pais: "Argentina" },
  { file: "C:/Users/Jeronimo/Downloads/dataset_crawler-google-places_2026-05-23_19-37-05-750.json", zona: "Polanco",    ciudad: "Ciudad de México",  pais: "México" },
  { file: "C:/Users/Jeronimo/Downloads/dataset_crawler-google-places_2026-05-23_19-37-54-444.json", zona: "Nueva Córdoba", ciudad: "Córdoba",         pais: "Argentina" },
];

// ── Clasificadores ─────────────────────────────────────────────────────────────

function tipoFitness(categoria) {
  const c = (categoria || "").toLowerCase();
  if (c.includes("crossfit") || c.includes("cross fit")) return "CrossFit";
  if (c.includes("pilates")) return "Pilates";
  if (c.includes("yoga")) return "Yoga";
  if (c.includes("spinning") || c.includes("ciclo indoor") || c.includes("bicicleta")) return "Spinning / Ciclo";
  if (c.includes("funcional") || c.includes("functional")) return "Funcional";
  if (c.includes("entrenamiento personal") || c.includes("personal trainer")) return "Entrenamiento Personal";
  if (c.includes("natación") || c.includes("natacion") || c.includes("aqua")) return "Natación";
  if (c.includes("boxeo") || c.includes("artes marciales") || c.includes("karate") || c.includes("mma") || c.includes("judo") || c.includes("taekwondo")) return "Artes Marciales";
  if (c.includes("baile") || c.includes("danza") || c.includes("zumba")) return "Baile / Danza";
  if (c.includes("fitness") || c.includes("gimnasio") || c.includes("gym") || c.includes("deport")) return "Gimnasio";
  return "Otro";
}

function calcularPrioridad(lugar) {
  const tieneTel = Boolean(lugar.phone);
  const tieneWeb = Boolean(lugar.website);
  if (tieneTel && !tieneWeb) return "ALTA";
  if (tieneTel && tieneWeb) return "MEDIA";
  return "BAJA";
}

function calcularScore(lugar, prioridad) {
  const rating = lugar.totalScore || 0;
  const reviews = lugar.reviewsCount || 0;
  let score = rating * 1.5;
  if (prioridad === "ALTA") score += 2;
  else if (prioridad === "MEDIA") score += 1;
  if (reviews >= 50) score += 1.5;
  else if (reviews >= 20) score += 1;
  else if (reviews >= 10) score += 0.5;
  return Math.min(10, Math.round(score * 10) / 10);
}

function tamanoEstimado(reviews) {
  if (reviews >= 200) return "Grande (cadena)";
  if (reviews >= 50)  return "Mediano";
  if (reviews >= 15)  return "Pequeño-mediano";
  return "Pequeño";
}

// ── CSV helpers ────────────────────────────────────────────────────────────────

function esc(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  return (s.includes(",") || s.includes('"') || s.includes("\n"))
    ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── Main ───────────────────────────────────────────────────────────────────────

let leads = [];
let totalBrutos = 0;
const vistos = new Set();

for (const src of SOURCES) {
  const data = JSON.parse(fs.readFileSync(src.file, "utf-8"));
  totalBrutos += data.length;

  for (const lugar of data) {
    const url = lugar.url || (lugar.title + src.ciudad);
    if (vistos.has(url)) continue;
    vistos.add(url);

    const rating   = lugar.totalScore || 0;
    const reviews  = lugar.reviewsCount || 0;

    // Filtros: mínimo calidad + excluir cadenas masivas
    if (rating < 3.0 || reviews < 3 || reviews > 800) continue;

    const prioridad = calcularPrioridad(lugar);
    const score     = calcularScore(lugar, prioridad);
    const tipo      = tipoFitness(lugar.categoryName || "");

    leads.push({
      // Identificación
      "Nombre":               lugar.title || "",
      "Tipo Fitness":         tipo,
      "Categoría Google":     lugar.categoryName || "",
      // Ubicación
      "País":                 src.pais,
      "Ciudad":               src.ciudad,
      "Zona Premium":         src.zona,
      "Dirección":            [lugar.street, lugar.city, lugar.state].filter(Boolean).join(", "),
      // Contacto
      "Teléfono":             lugar.phone || "",
      "Sitio Web":            lugar.website || "",
      "Email":                lugar.email || "",
      // Métricas Google
      "Rating":               rating,
      "Nº Reseñas":           reviews,
      "Tamaño Estimado":      tamanoEstimado(reviews),
      // Clasificación Nexora
      "Prioridad":            prioridad,
      "Score Nexora (0-10)":  score,
      "Tiene Web":            lugar.website ? "Sí" : "No",
      "Tiene Teléfono":       lugar.phone   ? "Sí" : "No",
      // Meta
      "Campaña":              "Gimnasios LATAM",
      "Mes Scraping":         "Mayo 2026",
      "Google Maps URL":      lugar.url || "",
    });
  }
}

// Ordenar por Score desc
leads.sort((a, b) => b["Score Nexora (0-10)"] - a["Score Nexora (0-10)"] || b["Nº Reseñas"] - a["Nº Reseñas"]);

// ── Stats para el informe ──────────────────────────────────────────────────────

const total = leads.length;
const porPais    = {};
const porZona    = {};
const porTipo    = {};
const porPrior   = { ALTA: 0, MEDIA: 0, BAJA: 0 };

for (const l of leads) {
  porPais[l["País"]]         = (porPais[l["País"]] || 0) + 1;
  porZona[l["Zona Premium"]] = (porZona[l["Zona Premium"]] || 0) + 1;
  porTipo[l["Tipo Fitness"]] = (porTipo[l["Tipo Fitness"]] || 0) + 1;
  porPrior[l["Prioridad"]]++;
}

const conTel = leads.filter(l => l["Tiene Teléfono"] === "Sí").length;
const conWeb = leads.filter(l => l["Tiene Web"] === "Sí").length;
const avgRating = (leads.reduce((s, l) => s + l["Rating"], 0) / total).toFixed(2);
const top5 = leads.filter(l => l["Prioridad"] !== "BAJA").slice(0, 5);

// ── Imprimir informe ───────────────────────────────────────────────────────────

console.log("\n" + "═".repeat(60));
console.log("  INFORME — CAMPAÑA GIMNASIOS LATAM   |   Mayo 2026");
console.log("═".repeat(60));

console.log(`\n📥 Registros brutos scrapeados:  ${totalBrutos}`);
console.log(`✅ Leads válidos (post-filtro):   ${total}`);
console.log(`   Descartados:                  ${totalBrutos - total}`);

console.log("\n─── POR PAÍS ───────────────────────────────────────");
for (const [p, n] of Object.entries(porPais).sort((a,b) => b[1]-a[1]))
  console.log(`   ${p.padEnd(20)} ${n} leads  (${Math.round(n/total*100)}%)`);

console.log("\n─── POR ZONA PREMIUM ───────────────────────────────");
for (const [z, n] of Object.entries(porZona).sort((a,b) => b[1]-a[1]))
  console.log(`   ${z.padEnd(22)} ${n} leads`);

console.log("\n─── POR TIPO DE NEGOCIO ────────────────────────────");
for (const [t, n] of Object.entries(porTipo).sort((a,b) => b[1]-a[1]))
  console.log(`   ${t.padEnd(26)} ${n}`);

console.log("\n─── PRIORIDAD (contactabilidad) ────────────────────");
console.log(`   🔴 ALTA  (sin web, con tel):  ${porPrior.ALTA}  → pitch directo de presencia digital`);
console.log(`   🟡 MEDIA (con web y tel):     ${porPrior.MEDIA}  → pitch de automatización`);
console.log(`   ⚪ BAJA  (sin teléfono):      ${porPrior.BAJA}  → contacto frío difícil`);

console.log("\n─── CALIDAD DE DATOS ───────────────────────────────");
console.log(`   Con teléfono:  ${conTel}/${total} (${Math.round(conTel/total*100)}%)`);
console.log(`   Con web:       ${conWeb}/${total} (${Math.round(conWeb/total*100)}%)`);
console.log(`   Rating prom:   ${avgRating} / 5.0`);

console.log("\n─── TOP 5 LEADS (Score más alto) ───────────────────");
for (const l of top5) {
  console.log(`   ★ ${l["Nombre"].slice(0,35).padEnd(35)} | ${l["País"]} - ${l["Zona Premium"]} | Score: ${l["Score Nexora (0-10)"]} | ${l["Prioridad"]} | Tel: ${l["Teléfono"]}`);
}

console.log("\n─── RECOMENDACIÓN ──────────────────────────────────");
const topZona = Object.entries(porZona).sort((a,b)=>b[1]-a[1])[0];
console.log(`   Zona con más leads:  ${topZona[0]} (${topZona[1]} leads)`);
console.log(`   Acción inmediata:    Empezar con los ${porPrior.ALTA} de ALTA prioridad`);
console.log(`                        en Colombia (${porPais["Colombia"]} leads, más fácil cerrar en persona)`);
console.log("═".repeat(60));

// ── Exportar CSV ───────────────────────────────────────────────────────────────

const OUT_DIR = path.join(
  "C:/Users/Jeronimo/Desktop/Agentes_Agencia/prospecting/campaigns/gyms_latam/output"
);
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const cols = Object.keys(leads[0]);
const ts   = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16).replace("T", "_");
const outPath = path.join(OUT_DIR, `leads_gyms_latam_${ts}.csv`);

const rows = [cols.join(",")];
for (const l of leads) rows.push(cols.map(c => esc(l[c])).join(","));
fs.writeFileSync(outPath, "﻿" + rows.join("\n"), "utf-8");

console.log(`\n✅ CSV exportado en:\n   campaigns/gyms_latam/output/leads_gyms_latam_${ts}.csv\n`);
