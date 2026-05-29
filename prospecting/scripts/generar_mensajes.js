/**
 * Lee el CSV de leads y agrega una columna "mensaje_whatsapp"
 * personalizada por categoría, prioridad y país.
 * Genera un nuevo CSV listo para usar.
 */

const fs = require("fs");
const path = require("path");

// ── Helpers CSV ────────────────────────────────────────────────────────────────

function parseCsv(text) {
  const lines = text.replace(/^﻿/, "").split("\n").filter(Boolean);
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

function splitCsvLine(line) {
  const result = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
    else if (c === '"') { inQ = !inQ; }
    else if (c === "," && !inQ) { result.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  result.push(cur.trim());
  return result;
}

function escapeCsv(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ── Clasificador de categoría ──────────────────────────────────────────────────

function nombreCorto(nombre) {
  // Si tiene guion largo o coma, tomar solo la primera parte
  const corte = nombre.split(/\s[-–,]\s/)[0].trim();
  // Limitar a 35 caracteres
  return corte.length > 35 ? corte.slice(0, 32) + "..." : corte;
}

function tipoNegocio(categoria) {
  const c = categoria.toLowerCase();
  if (c.includes("joyer") || c.includes("reloj") || c.includes("platino") || c.includes("oro") || c.includes("plata")) return "joyeria";
  if (c.includes("accesorio")) return "accesorios";
  if (c.includes("calzado") || c.includes("bota") || c.includes("zapater")) return "calzado";
  if (c.includes("ropa") || c.includes("moda") || c.includes("boutique") || c.includes("smoking") || c.includes("hogar y moda")) return "ropa";
  return "retail";
}

// ── Pronombres por país ────────────────────────────────────────────────────────
//  CO → usted/su/le   |   AR → vos/tu/te   |   MX → usted/su/le

function pronombres(pais) {
  if (pais === "AR") return { usted: "vos", su: "tu", le: "te", tiene: "tenés", quiere: "querés", interesa: "interesa" };
  return { usted: "usted", su: "su", le: "le", tiene: "tiene", quiere: "quiere", interesa: "le interesa" };
}

// ── Templates ──────────────────────────────────────────────────────────────────

function mensajeAltaJoyeria(nombre, p) {
  return `Hola 👋 Vi *${nombre}* en Google Maps.

¿Cuántas consultas de precios y disponibilidad reciben por WhatsApp al día? Muchas joyerías pierden ventas fuera de horario porque no tienen respuestas automáticas.

En Nexora IA automatizamos la atención al cliente de ${p.su} negocio — responde 24/7, gestiona el catálogo y registra cada consulta.

¿${p.quiere} ver cómo funcionaría para *${nombre}*?`;
}

function mensajeAltaRopa(nombre, p) {
  return `Hola 👋 Vi *${nombre}* en Google Maps.

¿Cuánto tiempo ${p.tiene} ${p.su} equipo respondiendo mensajes de "¿tienen talla X?" o "¿les queda ese color?"?

En Nexora IA automatizamos eso — WhatsApp responde solo, con inventario en tiempo real y sin perder una venta.

¿${p.quiere} que ${p.le} muestre cómo lo haríamos para *${nombre}*?`;
}

function mensajeAltaAccesorios(nombre, p) {
  return `Hola 👋 Vi *${nombre}* en Google Maps.

Las tiendas de accesorios suelen perder clientes que preguntan por WhatsApp fuera del horario y no reciben respuesta a tiempo.

En Nexora IA configuramos un asistente que atiende 24/7, muestra el catálogo y agenda visitas — sin que ${p.usted} ${p.tiene} que estar pendiente del celular.

¿${p.interesa} verlo en acción?`;
}

function mensajeAltaCalzado(nombre, p) {
  return `Hola 👋 Vi *${nombre}* en Google Maps.

¿Reciben muchas consultas de tallas y modelos por WhatsApp? Sé que responder uno por uno toma mucho tiempo.

En Nexora IA automatizamos esa atención — el cliente pregunta, el sistema responde con disponibilidad real, y ${p.usted} ${p.tiene} más tiempo para vender.

¿${p.quiere} ver cómo lo implementaríamos para *${nombre}*?`;
}

function mensajeAltaRetail(nombre, p) {
  return `Hola 👋 Vi *${nombre}* en Google Maps.

¿${p.tiene} sistema para responder consultas de clientes por WhatsApp automáticamente?

En Nexora IA ayudamos a negocios como ${p.su} tienda a automatizar la atención al cliente — respuestas al instante, seguimiento de pedidos y menos trabajo manual.

¿${p.interesa} una llamada corta para ver si ${p.le} sirve?`;
}

function mensajeMediaJoyeria(nombre, p) {
  return `Hola 👋 Vi *${nombre}* en Google y en su sitio web.

Una pregunta rápida — ¿${p.tiene} automatizado el seguimiento de clientes que consultan por WhatsApp o redes sociales?

En Nexora IA conectamos el WhatsApp de joyerías con un asistente IA que responde, califica interesados y los pasa a ${p.su} equipo listos para cerrar.

¿${p.quiere} que ${p.le} comparta un caso real de cómo funciona?`;
}

function mensajeMediaRopa(nombre, p) {
  return `Hola 👋 Vi *${nombre}* — tienen buen trabajo en web y redes.

¿Están usando alguna herramienta para automatizar respuestas en WhatsApp o gestionar el inventario en tiempo real?

En Nexora IA integramos eso directamente con ${p.su} tienda — menos tiempo en mensajes, más ventas cerradas.

¿${p.interesa} una demo rápida?`;
}

function mensajeMediaRetail(nombre, p) {
  return `Hola 👋 Vi *${nombre}* en Google.

¿${p.tiene} automatizado algún proceso en ${p.su} negocio — atención al cliente, inventario, seguimiento de ventas?

En Nexora IA construimos sistemas de automatización para tiendas como la ${p.su} — sin complicaciones técnicas y con resultados medibles desde el primer mes.

¿${p.quiere} contarme en qué parte del negocio ${p.le} gustaría ahorrar más tiempo?`;
}

// ── Selector principal ─────────────────────────────────────────────────────────

function generarMensaje(lead) {
  const p = pronombres(lead.pais);
  const tipo = tipoNegocio(lead.categoria);
  const nombre = nombreCorto(lead.nombre);

  if (lead.prioridad === "ALTA") {
    if (tipo === "joyeria") return mensajeAltaJoyeria(nombre, p);
    if (tipo === "ropa") return mensajeAltaRopa(nombre, p);
    if (tipo === "accesorios") return mensajeAltaAccesorios(nombre, p);
    if (tipo === "calzado") return mensajeAltaCalzado(nombre, p);
    return mensajeAltaRetail(nombre, p);
  }

  // MEDIA
  if (tipo === "joyeria") return mensajeMediaJoyeria(nombre, p);
  if (tipo === "ropa" || tipo === "accesorios" || tipo === "calzado") return mensajeMediaRopa(nombre, p);
  return mensajeMediaRetail(nombre, p);
}

// ── Main ───────────────────────────────────────────────────────────────────────

const CSV_DIR = __dirname;
const csvFiles = fs.readdirSync(CSV_DIR).filter(f => f.startsWith("leads_nexora_") && f.endsWith(".csv"));
if (!csvFiles.length) { console.error("No se encontró CSV de leads en la carpeta."); process.exit(1); }

const csvPath = path.join(CSV_DIR, csvFiles.sort().at(-1));
console.log(`\n📂 Leyendo: ${csvFiles.sort().at(-1)}`);

const raw = fs.readFileSync(csvPath, "utf-8");
const leads = parseCsv(raw);

// Solo ALTA y MEDIA (BAJA no tiene teléfono = no se puede contactar por WhatsApp)
const activos = leads.filter(l => l.prioridad !== "BAJA" && l.telefono);

const enriched = activos.map(lead => ({
  ...lead,
  mensaje_whatsapp: generarMensaje(lead),
}));

// Stats
const porTipo = {};
for (const l of enriched) {
  const t = tipoNegocio(l.categoria);
  porTipo[t] = (porTipo[t] || 0) + 1;
}

console.log(`\n✉️  Mensajes generados: ${enriched.length}`);
console.log(`   Por tipo de negocio:`);
for (const [t, n] of Object.entries(porTipo)) console.log(`   - ${t}: ${n}`);

// Exportar
const cols = [...Object.keys(enriched[0])];
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16).replace("T", "_");
const outPath = path.join(CSV_DIR, `leads_con_mensajes_${timestamp}.csv`);

const rows = [cols.join(",")];
for (const lead of enriched) {
  rows.push(cols.map(c => escapeCsv(lead[c])).join(","));
}
fs.writeFileSync(outPath, "﻿" + rows.join("\n"), "utf-8");
console.log(`\n✅ Exportado: leads_con_mensajes_${timestamp}.csv`);
console.log(`\n🔍 Ejemplo — primer mensaje (${enriched[0]?.nombre}):\n`);
console.log(enriched[0]?.mensaje_whatsapp);
