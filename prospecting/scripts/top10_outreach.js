const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const TOP10 = [
  { nombre: "Centinelas Futbol Americano",              tipo: "Academia deportiva",     pais: "México",    zona: "Polanco",       telefono: "+52 55 5162 7157",    web: "",                                         prioridad: "ALTA",  score: 10, rating: 4.6, resenas: 683 },
  { nombre: "Academia de seguridad Ceesp Medellín",     tipo: "Academia de seguridad",  pais: "Colombia",  zona: "Laureles",      telefono: "+57 310 5904709",     web: "academiadeseguridadprivada.com",           prioridad: "MEDIA", score: 10, rating: 5.0, resenas: 681 },
  { nombre: "BICICLETAS COLBIC",                        tipo: "Tienda de bicicletas",   pais: "Colombia",  zona: "Laureles",      telefono: "+57 301 6137293",     web: "",                                         prioridad: "ALTA",  score: 10, rating: 4.3, resenas: 484 },
  { nombre: "Gimnasio XXL",                             tipo: "Gimnasio",               pais: "Argentina", zona: "Palermo",       telefono: "+54 11 4833-4666",    web: "",                                         prioridad: "ALTA",  score: 10, rating: 4.5, resenas: 398 },
  { nombre: "Fitcore Hipopresivos",                     tipo: "Studio fitness",         pais: "Colombia",  zona: "El Poblado",    telefono: "+57 324 4585529",     web: "fitcorehipopresivos.com",                  prioridad: "MEDIA", score: 10, rating: 5.0, resenas: 263 },
  { nombre: "Total Fit Gym",                            tipo: "Gimnasio",               pais: "Colombia",  zona: "Laureles",      telefono: "+57 604 5017736",     web: "",                                         prioridad: "ALTA",  score: 10, rating: 4.4, resenas: 241 },
  { nombre: "Gimnasio Sport Club",                      tipo: "Gimnasio",               pais: "Colombia",  zona: "Laureles",      telefono: "+57 44183626",        web: "",                                         prioridad: "ALTA",  score: 10, rating: 4.6, resenas: 236 },
  { nombre: "Cygnus Pilates",                           tipo: "Studio Pilates",         pais: "Colombia",  zona: "Laureles",      telefono: "+57 324 7454412",     web: "cygnuspilates.com",                        prioridad: "MEDIA", score: 10, rating: 5.0, resenas: 224 },
  { nombre: "NUTRICIÓN ÍNTEGRA – Lic. Tábatha Pagador", tipo: "Consultorio nutrición",  pais: "Argentina", zona: "Nueva Córdoba", telefono: "+54 9 3548 63-0917", web: "wa.me (solo WhatsApp)",                    prioridad: "MEDIA", score: 10, rating: 5.0, resenas: 218 },
  { nombre: "Distrito Fitness Center",                  tipo: "Gimnasio",               pais: "Colombia",  zona: "Laureles",      telefono: "+57 305 3460800",     web: "linktr.ee/distritofitcenter (Linktree)",   prioridad: "MEDIA", score: 10, rating: 5.0, resenas: 201 },
];

// ── Mensajes personalizados ────────────────────────────────────────────────────

const MENSAJES = [

  // 1 — Centinelas Futbol Americano (MX, ALTA, academia deportiva)
  `Hola 👋 Vi *Centinelas Futbol Americano* en Google Maps — 683 reseñas, excelente reputación.

Una pregunta rápida: ¿cómo gestionan actualmente las inscripciones y preguntas de padres y jugadores? Por experiencia con academias deportivas, ese proceso por WhatsApp manual consume mucho tiempo del cuerpo técnico.

En Nexora IA automatizamos esa atención — inscripciones, horarios, pagos de mensualidad y seguimiento, sin que usted tenga que estar pendiente del celular.

¿Le interesa ver cómo funcionaría para Centinelas?`,

  // 2 — Academia de seguridad Ceesp (CO, MEDIA, academia)
  `Hola 👋 Vi la *Academia de Seguridad Ceesp* en Google — 681 reseñas y calificación perfecta, impresionante.

¿Están gestionando las inscripciones y consultas de aspirantes de forma automatizada, o todavía hay mucho proceso manual por WhatsApp o teléfono?

En Nexora IA conectamos un asistente IA al WhatsApp del negocio que califica interesados, resuelve dudas del proceso de admisión y los guía hasta la inscripción — sin intervención manual.

¿Quiere que le muestre un caso concreto de cómo funciona?`,

  // 3 — BICICLETAS COLBIC (CO, ALTA, tienda)
  `Hola 👋 Vi *Bicicletas Colbic* en Google Maps — una de las tiendas mejor calificadas de Laureles.

¿Cuántos mensajes reciben al día preguntando por disponibilidad de referencias, precios y servicio técnico? Ese volumen por WhatsApp sin un sistema se vuelve caótico muy rápido.

En Nexora IA automatizamos esa atención: el cliente pregunta, el sistema responde con inventario real, agenda servicios técnicos y hace seguimiento de pedidos.

¿Quiere ver cómo lo implementaríamos para Colbic?`,

  // 4 — Gimnasio XXL (AR, ALTA, sin web)
  `Hola 👋 Vi *Gimnasio XXL* en Google Maps — 398 reseñas en Palermo, uno de los más activos de la zona.

¿Cómo manejan actualmente las consultas de precios, planes y horarios que llegan por WhatsApp? Sin un sistema, responder todo manualmente quita tiempo valioso.

En Nexora IA configuramos un asistente que atiende esas consultas 24/7, gestiona vencimientos de membresías y avisa automáticamente a los socios antes de que se venzan — sin que nadie tenga que hacer seguimiento manual.

¿Te interesa verlo en acción?`,

  // 5 — Fitcore Hipopresivos (CO, MEDIA, studio)
  `Hola 👋 Vi *Fitcore Hipopresivos* en Google — 5 estrellas y 263 reseñas en El Poblado, excelente trabajo.

¿Están usando alguna herramienta para automatizar el agendamiento de clases y los recordatorios a los pacientes? En studios especializados como el suyo, las cancelaciones de último minuto y el no-show son el mayor dolor de cabeza.

En Nexora IA integramos un sistema que confirma clases automáticamente, envía recordatorios por WhatsApp y gestiona reprogramaciones — reduciendo los no-shows hasta un 40%.

¿Le interesa una demo rápida?`,

  // 6 — Total Fit Gym (CO, ALTA, sin web)
  `Hola 👋 Vi *Total Fit Gym* en Google Maps — bien calificado en Laureles y con buen volumen de reseñas.

Una pregunta directa: ¿tienen sistema para recordarle a los socios cuando se les vence la membresía, o eso lo hacen manualmente?

En Nexora IA automatizamos eso completo — recordatorios de vencimiento, respuestas a consultas de horarios y planes, y seguimiento de leads que preguntaron pero no se inscribieron. Todo por WhatsApp, sin trabajo manual.

¿Quiere que le cuente cómo funciona en 5 minutos?`,

  // 7 — Gimnasio Sport Club (CO, ALTA, sin web)
  `Hola 👋 Vi *Gimnasio Sport Club* en Google Maps — 236 reseñas y muy bien calificado en Laureles.

¿Cuántos mensajes de WhatsApp reciben al día con preguntas de tarifas, horarios y disponibilidad? Para un gimnasio con ese volumen de clientes, responder todo manualmente es tiempo que podría usarse en atender mejor a los socios.

En Nexora IA ponemos un asistente IA en el WhatsApp del gimnasio que responde eso automáticamente — y además avisa a los socios antes de que venza su membresía para reducir la deserción.

¿Quiere ver una demo?`,

  // 8 — Cygnus Pilates (CO, MEDIA, studio pilates)
  `Hola 👋 Vi *Cygnus Pilates* — 5 estrellas y 224 reseñas en Laureles, claramente un studio de referencia en Medellín.

¿Cómo manejan el agendamiento de clases actualmente? En studios de pilates con listas de espera y cupos limitados, coordinar eso por WhatsApp manualmente suele ser el mayor desgaste del equipo.

En Nexora IA automatizamos el agendamiento, las confirmaciones y los recordatorios — los clientes reservan solos y el studio solo recibe la notificación. También generamos un informe mensual de ocupación por instructor y por horario.

¿Le interesa que lo revisemos juntos?`,

  // 9 — NUTRICIÓN ÍNTEGRA (AR, MEDIA, nutrición)
  `Hola 👋 Vi el perfil de *Nutrición Íntegra* en Google — 5 estrellas y 218 reseñas, excelente reputación en Córdoba.

¿Cómo gestionás actualmente las consultas nuevas y el seguimiento de pacientes? Con ese volumen de reseñas, la demanda debe ser alta y coordinar todo por WhatsApp personalmente toma mucho tiempo.

En Nexora IA automatizamos la agenda de consultas, los recordatorios de turnos y el seguimiento post-consulta — así te enfocás en atender pacientes y no en administración.

¿Te interesa ver cómo lo haríamos para tu consulta?`,

  // 10 — Distrito Fitness Center (CO, MEDIA, linktree)
  `Hola 👋 Vi *Distrito Fitness Center* en Google Maps — 5 estrellas y 201 reseñas en Laureles, uno de los mejor calificados de la zona.

Noté que tienen Linktree como web principal. ¿Están buscando una solución más robusta para gestionar membresías, clases y comunicación con los socios, o están bien con el flujo actual?

En Nexora IA construimos sistemas que van más allá del Linktree — gestión de membresías, recordatorios automáticos, agendamiento de clases y reportes mensuales de retención. Todo integrado con WhatsApp.

¿Quiere que le mostremos cómo se vería para Distrito?`,
];

// ── Generar Excel ──────────────────────────────────────────────────────────────

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nexora IA";

  const ws = wb.addWorksheet("Top 10 Outreach", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
    properties: { tabColor: { argb: "FFA8FF3E" } },
  });

  function fill(argb) { return { type: "pattern", pattern: "solid", fgColor: { argb } }; }
  function bdr() { const s={style:"thin",color:{argb:"FFD0D0D0"}}; return {top:s,left:s,bottom:s,right:s}; }

  ws.columns = [
    { key: "n",          header: "#",                   width: 5  },
    { key: "nombre",     header: "Nombre",              width: 38 },
    { key: "tipo",       header: "Tipo",                width: 22 },
    { key: "pais",       header: "País",                width: 14 },
    { key: "zona",       header: "Zona",                width: 18 },
    { key: "telefono",   header: "Teléfono",            width: 22 },
    { key: "web",        header: "Web actual",          width: 32 },
    { key: "prioridad",  header: "Prioridad",           width: 12 },
    { key: "rating",     header: "Rating",              width: 10 },
    { key: "resenas",    header: "Reseñas",             width: 10 },
    { key: "nota",       header: "Nota estratégica",    width: 38 },
    { key: "estado",     header: "Estado contacto",     width: 20 },
    { key: "respuesta",  header: "Respuesta / Notas",   width: 40 },
    { key: "mensaje",    header: "Mensaje WhatsApp",    width: 80 },
  ];

  // Header row
  const hRow = ws.getRow(1);
  hRow.height = 22;
  ws.columns.forEach((_, i) => {
    const cell = hRow.getCell(i + 1);
    cell.fill = fill("FF1A3C2E");
    cell.font = { bold: true, color: { argb: "FFA8FF3E" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = bdr();
  });

  const NOTAS = [
    "⚠️ Es academia de fútbol americano, no gym tradicional — pitch enfocado en inscripciones y comunicación con padres",
    "⚠️ Academia de seguridad — no fitness. Pitch: automatizar admisiones y consultas de aspirantes",
    "⚠️ Tienda de bicicletas — no gym. Pitch: atención al cliente e inventario por WhatsApp",
    "✅ Gimnasio real sin web — oportunidad clara. Pitch: automatización completa + presencia digital",
    "✅ Studio especializado con web — pitch: reducir no-shows con recordatorios automáticos",
    "✅ Gimnasio real sin web — prioridad alta. Pitch: renovación de membresías + atención automática",
    "✅ Gimnasio real sin web — prioridad alta. Pitch: atención WhatsApp 24/7 + control de membresías",
    "✅ Studio Pilates con web — pitch: automatizar agendamiento + reportes de ocupación",
    "⚠️ Consultorio de nutrición — pitch distinto: agenda de consultas + seguimiento de pacientes",
    "✅ Fitness Center con solo Linktree — pitch: evolucionar a solución completa de gestión",
  ];

  const ESTADOS = ["Pendiente","Pendiente","Pendiente","Pendiente","Pendiente","Pendiente","Pendiente","Pendiente","Pendiente","Pendiente"];

  TOP10.forEach((lead, i) => {
    const row = ws.addRow({
      n:         i + 1,
      nombre:    lead.nombre,
      tipo:      lead.tipo,
      pais:      lead.pais,
      zona:      lead.zona,
      telefono:  lead.telefono,
      web:       lead.web || "Sin web",
      prioridad: lead.prioridad,
      rating:    lead.rating,
      resenas:   lead.resenas,
      nota:      NOTAS[i],
      estado:    ESTADOS[i],
      respuesta: "",
      mensaje:   MENSAJES[i],
    });

    row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell, colN) => {
      cell.border = bdr();
      cell.alignment = { vertical: "middle", wrapText: false };

      const isAlt = i % 2 === 1;

      if (colN === 8) { // prioridad
        if (lead.prioridad === "ALTA")  { cell.fill = fill("FFFFE0B2"); cell.font = { bold: true, color: { argb: "FFE65100" } }; }
        if (lead.prioridad === "MEDIA") { cell.fill = fill("FFFFF9C4"); cell.font = { bold: true, color: { argb: "FFF57F17" } }; }
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (colN === 12) { // estado
        cell.fill = fill("FFE3F2FD");
        cell.font = { color: { argb: "FF1565C0" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (colN === 14) { // mensaje — wrap text
        cell.alignment = { vertical: "top", wrapText: true };
        cell.font = { size: 10 };
        if (isAlt) cell.fill = fill("FFF7FFF0");
      } else if (colN === 11) { // nota
        cell.font = { size: 10, italic: true };
        const nota = NOTAS[i] || "";
        if (nota.startsWith("⚠️")) cell.font = { size: 10, italic: true, color: { argb: "FF795548" } };
        if (nota.startsWith("✅")) cell.font = { size: 10, italic: true, color: { argb: "FF1B5E20" } };
        if (isAlt) cell.fill = fill("FFF7FFF0");
      } else {
        if (isAlt) cell.fill = fill("FFF7FFF0");
      }
    });

    // Altura automática para la columna de mensaje
    row.height = 100;
  });

  // Dropdown para Estado (validación)
  for (let r = 2; r <= 11; r++) {
    ws.getCell(`L${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Pendiente,Enviado,Respondió,Reunión agendada,No interesado,Sin respuesta"'],
    };
  }

  ws.autoFilter = { from: "A1", to: "N1" };

  // Hoja 2 — instrucciones de uso
  const ws2 = wb.addWorksheet("Cómo usar", { properties: { tabColor: { argb: "FF0D0F0E" } } });
  ws2.views = [{ showGridLines: false }];
  ws2.getColumn(1).width = 70;
  ws2.getRow(1).height = 30;

  const instrucciones = [
    ["NEXORA IA — GUÍA DE USO: TOP 10 OUTREACH"],
    [""],
    ["CÓMO USAR ESTE ARCHIVO:"],
    ["1. Abre la hoja 'Top 10 Outreach'"],
    ["2. Revisa la columna 'Nota estratégica' — los marcados con ⚠️ no son gimnasios puros, pero igual son leads válidos"],
    ["3. Copia el 'Mensaje WhatsApp' y envíalo al número en 'Teléfono'"],
    ["4. Actualiza 'Estado contacto' con el dropdown: Enviado / Respondió / Reunión agendada / etc."],
    ["5. Anota cualquier detalle en 'Respuesta / Notas'"],
    [""],
    ["ORDEN RECOMENDADO DE CONTACTO:"],
    ["  Prioridad ALTA primero (sin web) — mayor oportunidad, mensaje más directo"],
    ["  Prioridad MEDIA después — ya tienen algo digital, pitch de automatización"],
    [""],
    ["TOP PICKS REALES (gimnasios/studios confirmados):"],
    ["  🥇 Gimnasio XXL — Buenos Aires, ALTA, 398 reseñas, sin web"],
    ["  🥇 Total Fit Gym — Laureles Medellín, ALTA, 241 reseñas, sin web"],
    ["  🥇 Gimnasio Sport Club — Laureles Medellín, ALTA, 236 reseñas, sin web"],
    ["  🥈 Fitcore Hipopresivos — El Poblado, MEDIA, 263 reseñas, studio especializado"],
    ["  🥈 Cygnus Pilates — Laureles, MEDIA, 224 reseñas, studio pilates"],
    ["  🥈 Distrito Fitness Center — Laureles, MEDIA, 201 reseñas, solo Linktree como web"],
  ];

  instrucciones.forEach((row, i) => {
    const c = ws2.getCell(i + 1, 1);
    c.value = row[0];
    if (i === 0) { c.font = { bold: true, size: 14, color: { argb: "FFA8FF3E" } }; c.fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FF0D0F0E"} }; }
    else if (row[0].endsWith(":") && row[0].length < 40) { c.font = { bold: true, size: 11 }; }
    else { c.font = { size: 11 }; }
    ws2.getRow(i + 1).height = 20;
  });

  // Guardar
  const OUT_DIR = "C:/Users/Jeronimo/Desktop/Agentes_Agencia/prospecting/campaigns/gyms_latam/output";
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16).replace("T", "_");
  const outPath = path.join(OUT_DIR, `Nexora_IA_Top10_Outreach_${ts}.xlsx`);
  await wb.xlsx.writeFile(outPath);

  console.log(`\n✅ Excel generado: Nexora_IA_Top10_Outreach_${ts}.xlsx`);
  console.log("   → 10 leads con mensaje personalizado");
  console.log("   → Columna 'Estado contacto' con dropdown");
  console.log("   → Notas estratégicas por lead");
  console.log("   → Hoja 'Cómo usar' con instrucciones\n");

  // Preview en consola
  console.log("─".repeat(60));
  console.log("PREVIEW — MENSAJES GENERADOS");
  console.log("─".repeat(60));
  TOP10.forEach((l, i) => {
    console.log(`\n[${i+1}] ${l.nombre} | ${l.pais} | ${l.prioridad} | ${l.telefono}`);
    console.log("─".repeat(50));
    console.log(MENSAJES[i]);
  });
}

main().catch(console.error);
