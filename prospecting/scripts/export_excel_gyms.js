const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

// ── Misma lógica de procesamiento que process_gyms.js ─────────────────────────

const SOURCES = [
  { file: "C:/Users/Jeronimo/Downloads/dataset_crawler-google-places_2026-05-23_19-25-00-061.json", zona: "El Poblado",    ciudad: "Medellín",         pais: "Colombia"  },
  { file: "C:/Users/Jeronimo/Downloads/dataset_crawler-google-places_2026-05-23_19-33-00-555.json", zona: "Laureles",      ciudad: "Medellín",         pais: "Colombia"  },
  { file: "C:/Users/Jeronimo/Downloads/dataset_crawler-google-places_2026-05-23_19-34-00-316.json", zona: "Envigado",      ciudad: "Envigado",         pais: "Colombia"  },
  { file: "C:/Users/Jeronimo/Downloads/dataset_crawler-google-places_2026-05-23_19-34-50-000.json", zona: "Chapinero",     ciudad: "Bogotá",           pais: "Colombia"  },
  { file: "C:/Users/Jeronimo/Downloads/dataset_crawler-google-places_2026-05-23_19-36-06-341.json", zona: "Palermo",       ciudad: "Buenos Aires",     pais: "Argentina" },
  { file: "C:/Users/Jeronimo/Downloads/dataset_crawler-google-places_2026-05-23_19-37-05-750.json", zona: "Polanco",       ciudad: "Ciudad de México", pais: "México"    },
  { file: "C:/Users/Jeronimo/Downloads/dataset_crawler-google-places_2026-05-23_19-37-54-444.json", zona: "Nueva Córdoba", ciudad: "Córdoba",          pais: "Argentina" },
];

function tipoFitness(cat) {
  const c = (cat || "").toLowerCase();
  if (c.includes("crossfit"))                                                   return "CrossFit";
  if (c.includes("pilates"))                                                    return "Pilates";
  if (c.includes("yoga"))                                                       return "Yoga";
  if (c.includes("spinning") || c.includes("ciclo"))                           return "Spinning / Ciclo";
  if (c.includes("funcional"))                                                  return "Funcional";
  if (c.includes("entrenamiento personal") || c.includes("personal trainer"))  return "Entrenamiento Personal";
  if (c.includes("natación") || c.includes("natacion"))                        return "Natación";
  if (c.includes("boxeo") || c.includes("artes marciales") || c.includes("mma") || c.includes("karate")) return "Artes Marciales";
  if (c.includes("baile") || c.includes("danza") || c.includes("zumba"))       return "Baile / Danza";
  if (c.includes("fitness") || c.includes("gimnasio") || c.includes("gym") || c.includes("deport")) return "Gimnasio";
  return "Otro";
}

function prioridad(l) {
  if (l.phone && !l.website) return "ALTA";
  if (l.phone && l.website)  return "MEDIA";
  return "BAJA";
}

function score(l, p) {
  let s = (l.totalScore || 0) * 1.5;
  if (p === "ALTA") s += 2; else if (p === "MEDIA") s += 1;
  const r = l.reviewsCount || 0;
  if (r >= 50) s += 1.5; else if (r >= 20) s += 1; else if (r >= 10) s += 0.5;
  return Math.min(10, Math.round(s * 10) / 10);
}

function tamano(r) {
  if (r >= 200) return "Grande";
  if (r >= 50)  return "Mediano";
  if (r >= 15)  return "Pequeño-mediano";
  return "Pequeño";
}

// Cargar y procesar
let leads = [];
const vistos = new Set();

for (const src of SOURCES) {
  const data = JSON.parse(fs.readFileSync(src.file, "utf-8"));
  for (const l of data) {
    const key = l.url || (l.title + src.ciudad);
    if (vistos.has(key)) continue;
    vistos.add(key);
    const r = l.reviewsCount || 0;
    const rt = l.totalScore || 0;
    if (rt < 3.0 || r < 3 || r > 800) continue;
    const p = prioridad(l);
    leads.push({
      nombre:        l.title || "",
      tipo:          tipoFitness(l.categoryName),
      categoria:     l.categoryName || "",
      pais:          src.pais,
      ciudad:        src.ciudad,
      zona:          src.zona,
      direccion:     [l.street, l.city, l.state].filter(Boolean).join(", "),
      telefono:      l.phone || "",
      web:           l.website || "",
      email:         l.email || "",
      rating:        rt,
      resenas:       r,
      tamano:        tamano(r),
      prioridad:     p,
      scoreNexora:   score(l, p),
      tieneWeb:      l.website ? "Sí" : "No",
      tieneTel:      l.phone   ? "Sí" : "No",
      mapsUrl:       l.url || "",
    });
  }
}

leads.sort((a, b) => b.scoreNexora - a.scoreNexora || b.resenas - a.resenas);

// ── Colores ────────────────────────────────────────────────────────────────────

const COLOR = {
  headerBg:   "FF1A3C2E",   // esmeralda Nexora
  headerFg:   "FFA8FF3E",   // lima eléctrico Nexora
  alta:       "FFFFE0B2",   // naranja suave
  altaFont:   "FFE65100",
  media:      "FFFFF9C4",   // amarillo suave
  mediaFont:  "FFF57F17",
  baja:       "FFF5F5F5",   // gris
  bajaFont:   "FF9E9E9E",
  colBand:    "FFF7FFF0",   // verde muy suave para filas pares
  sumBg:      "FF0D0F0E",   // obsidiana Nexora
  sumFg:      "FFF2F0EB",
  accentBg:   "FFA8FF3E",
  accentFg:   "FF0D0F0E",
};

function fill(argb) { return { type: "pattern", pattern: "solid", fgColor: { argb } }; }
function font(argb, bold = false, sz = 11) { return { color: { argb }, bold, size: sz }; }
function border() {
  const s = { style: "thin", color: { argb: "FFD0D0D0" } };
  return { top: s, left: s, bottom: s, right: s };
}

// ── Workbook ───────────────────────────────────────────────────────────────────

const wb = new ExcelJS.Workbook();
wb.creator = "Nexora IA";
wb.created = new Date();

// ════════════════════════════════════════════════════════
// HOJA 1 — LEADS
// ════════════════════════════════════════════════════════

const ws = wb.addWorksheet("Leads Gimnasios", {
  views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  properties: { tabColor: { argb: "FFA8FF3E" } },
});

const COLS = [
  { key: "nombre",      header: "Nombre",              width: 38 },
  { key: "tipo",        header: "Tipo Fitness",         width: 22 },
  { key: "categoria",   header: "Categoría Google",     width: 28 },
  { key: "pais",        header: "País",                 width: 14 },
  { key: "ciudad",      header: "Ciudad",               width: 18 },
  { key: "zona",        header: "Zona Premium",         width: 20 },
  { key: "prioridad",   header: "Prioridad",            width: 12 },
  { key: "scoreNexora", header: "Score Nexora",         width: 14 },
  { key: "rating",      header: "Rating Google",        width: 14 },
  { key: "resenas",     header: "Nº Reseñas",           width: 13 },
  { key: "tamano",      header: "Tamaño Estimado",      width: 18 },
  { key: "tieneWeb",    header: "Tiene Web",            width: 12 },
  { key: "tieneTel",    header: "Tiene Teléfono",       width: 16 },
  { key: "telefono",    header: "Teléfono",             width: 20 },
  { key: "web",         header: "Sitio Web",            width: 35 },
  { key: "email",       header: "Email",                width: 28 },
  { key: "direccion",   header: "Dirección",            width: 42 },
  { key: "mapsUrl",     header: "Google Maps URL",      width: 20 },
];

ws.columns = COLS;

// Encabezado
const hRow = ws.getRow(1);
hRow.height = 22;
COLS.forEach((col, i) => {
  const cell = hRow.getCell(i + 1);
  cell.fill = fill(COLOR.headerBg);
  cell.font = font(COLOR.headerFg, true, 11);
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
  cell.border = border();
});

// Datos
leads.forEach((lead, idx) => {
  const row = ws.addRow(lead);
  row.height = 18;

  const isAlt = idx % 2 === 1;
  const p = lead.prioridad;

  row.eachCell({ includeEmpty: true }, (cell, colN) => {
    cell.border = border();
    cell.alignment = { vertical: "middle", wrapText: false };

    const colKey = COLS[colN - 1]?.key;

    // Columna prioridad — color fuerte
    if (colKey === "prioridad") {
      if (p === "ALTA")  { cell.fill = fill(COLOR.alta);  cell.font = font(COLOR.altaFont,  true); }
      if (p === "MEDIA") { cell.fill = fill(COLOR.media); cell.font = font(COLOR.mediaFont, true); }
      if (p === "BAJA")  { cell.fill = fill(COLOR.baja);  cell.font = font(COLOR.bajaFont,  false); }
      cell.alignment = { horizontal: "center", vertical: "middle" };
      return;
    }

    // Score — negrita si alto
    if (colKey === "scoreNexora") {
      cell.alignment = { horizontal: "center", vertical: "middle" };
      if (lead.scoreNexora >= 8) cell.font = { bold: true, color: { argb: "FF1B5E20" } };
    }

    // Rating — alineado al centro
    if (colKey === "rating" || colKey === "resenas") {
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }

    // URL — hipervínculo
    if (colKey === "mapsUrl" && lead.mapsUrl) {
      cell.value = { text: "Ver mapa", hyperlink: lead.mapsUrl };
      cell.font = { color: { argb: "FF1565C0" }, underline: true };
      return;
    }

    // Fondo alternado en filas normales
    if (!["prioridad"].includes(colKey)) {
      if (isAlt) cell.fill = fill(COLOR.colBand);
    }
  });
});

// Auto-filter en toda la tabla
ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: leads.length + 1, column: COLS.length } };

// ════════════════════════════════════════════════════════
// HOJA 2 — RESUMEN
// ════════════════════════════════════════════════════════

const ws2 = wb.addWorksheet("Resumen", {
  properties: { tabColor: { argb: "FF0D0F0E" } },
});
ws2.views = [{ showGridLines: false }];

function addTitle(ws, text, row, col, span) {
  const c = ws.getCell(row, col);
  c.value = text;
  c.font = { bold: true, size: 13, color: { argb: COLOR.sumFg } };
  c.fill = fill(COLOR.sumBg);
  c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  c.border = border();
  if (span > 1) ws.mergeCells(row, col, row, col + span - 1);
  ws.getRow(row).height = 24;
}

function addHeader(ws, texts, row, startCol) {
  texts.forEach((t, i) => {
    const c = ws.getCell(row, startCol + i);
    c.value = t;
    c.font = font(COLOR.accentFg, true, 11);
    c.fill = fill(COLOR.accentBg);
    c.border = border();
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  ws.getRow(row).height = 20;
}

function addDataRow(ws, vals, row, startCol, highlight = false) {
  vals.forEach((v, i) => {
    const c = ws.getCell(row, startCol + i);
    c.value = v;
    c.border = border();
    c.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center", indent: i === 0 ? 1 : 0 };
    if (highlight) { c.fill = fill("FFFFF9C4"); c.font = { bold: true }; }
  });
  ws.getRow(row).height = 18;
}

ws2.getColumn(1).width = 28;
ws2.getColumn(2).width = 14;
ws2.getColumn(3).width = 14;
ws2.getColumn(4).width = 16;
ws2.getColumn(5).width = 16;

// Bloque: Resumen general
let r = 1;
addTitle(ws2, "  NEXORA IA — CAMPAÑA GIMNASIOS LATAM  |  Mayo 2026", r++, 1, 4);
r++;

addTitle(ws2, "  RESUMEN GENERAL", r++, 1, 4);
addHeader(ws2, ["Métrica", "Valor"], r++, 1);
const porPais2 = {}; const porZona2 = {}; const porTipo2 = {}; const porP2 = { ALTA: 0, MEDIA: 0, BAJA: 0 };
for (const l of leads) {
  porPais2[l.pais] = (porPais2[l.pais] || 0) + 1;
  porZona2[l.zona] = (porZona2[l.zona] || 0) + 1;
  porTipo2[l.tipo] = (porTipo2[l.tipo] || 0) + 1;
  porP2[l.prioridad]++;
}
const conTel2 = leads.filter(l => l.tieneTel === "Sí").length;
const conWeb2 = leads.filter(l => l.tieneWeb === "Sí").length;
const avgR2 = (leads.reduce((s, l) => s + l.rating, 0) / leads.length).toFixed(2);
[
  ["Total leads válidos", leads.length],
  ["Con teléfono", `${conTel2} (${Math.round(conTel2/leads.length*100)}%)`],
  ["Con sitio web", `${conWeb2} (${Math.round(conWeb2/leads.length*100)}%)`],
  ["Rating promedio", `${avgR2} / 5.0`],
].forEach(row => addDataRow(ws2, row, r++, 1));
r++;

// Bloque: por prioridad
addTitle(ws2, "  POR PRIORIDAD", r++, 1, 4);
addHeader(ws2, ["Prioridad", "Leads", "% del total", "Acción"], r++, 1);
ws2.getColumn(4).width = 38;
[
  ["🔴 ALTA",  porP2.ALTA,  `${Math.round(porP2.ALTA/leads.length*100)}%`,  "Pitch directo — sin web, con teléfono"],
  ["🟡 MEDIA", porP2.MEDIA, `${Math.round(porP2.MEDIA/leads.length*100)}%`, "Pitch automatización — ya tienen web"],
  ["⚪ BAJA",  porP2.BAJA,  `${Math.round(porP2.BAJA/leads.length*100)}%`,  "Contacto frío difícil — sin teléfono"],
].forEach(row => addDataRow(ws2, row, r++, 1));
r++;

// Bloque: por país
addTitle(ws2, "  POR PAÍS", r++, 1, 3);
addHeader(ws2, ["País", "Leads", "% del total"], r++, 1);
Object.entries(porPais2).sort((a,b)=>b[1]-a[1]).forEach(([p, n]) =>
  addDataRow(ws2, [p, n, `${Math.round(n/leads.length*100)}%`], r++, 1));
r++;

// Bloque: por zona
addTitle(ws2, "  POR ZONA PREMIUM", r++, 1, 3);
addHeader(ws2, ["Zona", "Leads", "% del total"], r++, 1);
Object.entries(porZona2).sort((a,b)=>b[1]-a[1]).forEach(([z, n]) =>
  addDataRow(ws2, [z, n, `${Math.round(n/leads.length*100)}%`], r++, 1));
r++;

// Bloque: por tipo
addTitle(ws2, "  POR TIPO DE NEGOCIO", r++, 1, 3);
addHeader(ws2, ["Tipo", "Leads", "% del total"], r++, 1);
Object.entries(porTipo2).sort((a,b)=>b[1]-a[1]).forEach(([t, n]) =>
  addDataRow(ws2, [t, n, `${Math.round(n/leads.length*100)}%`], r++, 1));
r++;

// Bloque: top 10
addTitle(ws2, "  TOP 10 LEADS (Score Nexora más alto)", r++, 1, 5);
addHeader(ws2, ["Nombre", "País", "Zona", "Prioridad", "Score"], r++, 1);
leads.filter(l => l.prioridad !== "BAJA").slice(0, 10).forEach(l => {
  addDataRow(ws2, [l.nombre, l.pais, l.zona, l.prioridad, l.scoreNexora], r++, 1, l.scoreNexora >= 9);
});

// ── Guardar ────────────────────────────────────────────────────────────────────

const OUT_DIR = "C:/Users/Jeronimo/Desktop/Agentes_Agencia/prospecting/campaigns/gyms_latam/output";
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16).replace("T", "_");
const outPath = path.join(OUT_DIR, `Nexora_IA_Leads_Gimnasios_LATAM_${ts}.xlsx`);

wb.xlsx.writeFile(outPath).then(() => {
  console.log(`\n✅ Excel generado: ${outPath}`);
  console.log(`   ${leads.length} leads | 2 hojas (Leads + Resumen) | Auto-filtro activo\n`);
});
