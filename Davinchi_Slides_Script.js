/**
 * DAVINCHI APP — Generador de Presentación Ejecutiva
 *
 * INSTRUCCIONES:
 * 1. Abre script.google.com
 * 2. Crea un proyecto nuevo ("Presentación Davinchi")
 * 3. Borra el código que trae por defecto
 * 4. Pega TODO este código
 * 5. Haz clic en "Ejecutar" (▶) — selecciona la función "crearPresentacion"
 * 6. Autoriza los permisos cuando Google los solicite
 * 7. La presentación aparece en tu Google Drive
 */

// ─── PALETA DAVINCHI ──────────────────────────────────────────────────────────
const INK    = '#1C1A14';
const GOLD   = '#C8A45A';
const GOLD2  = '#E2C07E';
const CREAM  = '#F9F5EE';
const CREAM2 = '#F0EAD8';
const TEXT   = '#2A2618';
const MUTED  = '#7A6A50';
const GREEN  = '#3D8A5A';
const RED    = '#C0442A';
const WHITE  = '#FFFFFF';

// ─── DIMENSIONES (16:9 estándar) ─────────────────────────────────────────────
const W = 720, H = 405;

function crearPresentacion() {
  const pres  = SlidesApp.create('Davinchi App — Propuesta de Entrega');
  const slide = pres.getSlides();

  // Eliminar diapositiva en blanco inicial
  slide[0].remove();

  diap01_portada(pres);
  diap02_problema(pres);
  diap03_solucion(pres);
  diap04_modulos(pres);
  diap05_asistente_ia(pres);
  diap06_panel_ceo(pres);
  diap07_tecnologia(pres);
  diap08_kpis(pres);
  diap09_costos(pres);
  diap10_propuesta(pres);
  diap11_roadmap(pres);
  diap12_cierre(pres);

  const url = pres.getUrl();
  Logger.log('✅ Presentación creada: ' + url);
  Browser.msgBox('✅ Presentación lista\n\nBusca "Davinchi App — Propuesta de Entrega" en tu Google Drive.\n\nURL: ' + url);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function newSlide(pres) {
  return pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
}

function bg(slide, color) {
  slide.getBackground().setSolidFill(color);
}

function rect(slide, x, y, w, h, color) {
  const s = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, pt(x), pt(y), pt(w), pt(h));
  s.getFill().setSolidFill(color);
  s.getBorder().setTransparent();
  return s;
}

function txt(slide, text, x, y, w, h, opts) {
  const s = slide.insertTextBox(text, pt(x), pt(y), pt(w), pt(h));
  const style = s.getText().getTextStyle();
  style.setFontFamily(opts.font || 'Montserrat');
  style.setFontSize(opts.size || 14);
  style.setBold(opts.bold || false);
  style.setForegroundColor(opts.color || TEXT);
  s.getText().getParagraphStyle().setParagraphAlignment(
    opts.align === 'center' ? SlidesApp.ParagraphAlignment.CENTER :
    opts.align === 'right'  ? SlidesApp.ParagraphAlignment.END :
                              SlidesApp.ParagraphAlignment.START
  );
  s.getFill().setTransparent();
  s.getBorder().setTransparent();
  return s;
}

function pt(n) { return n; } // Google Slides usa puntos directamente

function linea(slide, x1, y1, x2, y2, color, weight) {
  const l = slide.insertLine(SlidesApp.LineCategory.STRAIGHT,
    pt(x1), pt(y1), pt(x2), pt(y2));
  l.getLineFill().setSolidFill(color);
  l.setWeight(weight || 1);
  return l;
}

function chip(slide, label, x, y, bgColor, textColor) {
  const r = slide.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, pt(x), pt(y), pt(90), pt(22));
  r.getFill().setSolidFill(bgColor);
  r.getBorder().setTransparent();
  const t = r.getText();
  t.setText(label);
  t.getTextStyle().setFontFamily('Montserrat').setFontSize(9).setBold(true).setForegroundColor(textColor);
  t.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  return r;
}

// ─── DIAPOSITIVA 1 — PORTADA ──────────────────────────────────────────────────
function diap01_portada(pres) {
  const s = newSlide(pres);
  bg(s, INK);

  // Franja dorada lateral izquierda
  rect(s, 0, 0, 8, H, GOLD);

  // Acento dorado superior derecho
  rect(s, W - 120, 0, 120, 4, GOLD);

  // Logo / marca
  txt(s, 'DAVINCHI', 40, 60, 400, 80, {
    font: 'Playfair Display', size: 52, bold: true, color: GOLD2
  });
  txt(s, 'Estuches & Vitrinas para Joyerías', 40, 140, 400, 30, {
    font: 'Montserrat', size: 13, color: MUTED
  });

  // Separador
  linea(s, 40, 185, 340, 185, GOLD, 1.5);

  // Título de la presentación
  txt(s, 'Presentación de Entrega', 40, 200, 500, 35, {
    font: 'Montserrat', size: 20, bold: true, color: WHITE
  });
  txt(s, 'Davinchi App — Solución Digital Integral', 40, 238, 500, 25, {
    font: 'Montserrat', size: 13, color: CREAM2
  });

  // Fecha y autor
  txt(s, 'Abril 2026  ·  Jerónimo Álvarez  ·  Agencia de Automatización IA', 40, H - 50, 600, 22, {
    font: 'Montserrat', size: 10, color: MUTED
  });

  // Decoración derecha — círculo abstracto
  const c = s.insertShape(SlidesApp.ShapeType.ELLIPSE, pt(520), pt(60), pt(200), pt(200));
  c.getFill().setSolidFill('#2A2618');
  c.getBorder().setWeight(2);
  c.getBorder().getLineFill().setSolidFill(GOLD);

  txt(s, '✦', 568, 120, 100, 80, {
    font: 'Playfair Display', size: 56, color: GOLD, align: 'center'
  });
}

// ─── DIAPOSITIVA 2 — EL PROBLEMA ─────────────────────────────────────────────
function diap02_problema(pres) {
  const s = newSlide(pres);
  bg(s, CREAM);

  rect(s, 0, 0, W, 55, INK);
  txt(s, 'El desafío antes de la app', 30, 12, 500, 32, {
    font: 'Playfair Display', size: 20, bold: true, color: GOLD2
  });
  txt(s, '¿Cómo gestionaba Davinchi sus pedidos?', 30, 42, 500, 18, {
    font: 'Montserrat', size: 10, color: MUTED
  });

  const problemas = [
    ['📱', 'Pedidos por WhatsApp', 'Sin estructura ni registro. Riesgo de errores y pedidos perdidos.'],
    ['📋', 'Catálogo en PDF o físico', 'Difícil de actualizar. El cliente no ve stock ni precios en tiempo real.'],
    ['📊', 'Seguimiento manual', 'Sin visibilidad del estado de cada pedido ni métricas de desempeño.'],
    ['🔄', 'Procesos desconectados', 'Vendedores, CEO y clientes sin una plataforma común.'],
  ];

  problemas.forEach(([icon, titulo, desc], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 30 + col * 340;
    const y = 75 + row * 150;

    const card = s.insertShape(SlidesApp.ShapeType.RECTANGLE, pt(x), pt(y), pt(315), pt(130));
    card.getFill().setSolidFill(WHITE);
    card.getBorder().setWeight(1);
    card.getBorder().getLineFill().setSolidFill('#E8DDD0');

    txt(s, icon, x + 14, y + 14, 40, 36, { size: 24 });
    txt(s, titulo, x + 14, y + 52, 280, 22, {
      font: 'Montserrat', size: 13, bold: true, color: TEXT
    });
    txt(s, desc, x + 14, y + 76, 285, 42, {
      font: 'Montserrat', size: 10, color: MUTED
    });

    // Acento izquierdo
    rect(s, x, y, 4, 130, RED);
  });
}

// ─── DIAPOSITIVA 3 — LA SOLUCIÓN ─────────────────────────────────────────────
function diap03_solucion(pres) {
  const s = newSlide(pres);
  bg(s, INK);

  rect(s, 0, 0, W, 55, '#252318');
  txt(s, 'La solución: Davinchi App', 30, 12, 500, 32, {
    font: 'Playfair Display', size: 20, bold: true, color: GOLD2
  });

  // Frase central
  txt(s, '"Una plataforma web completa que conecta\ncatálogo, pedidos, clientes y KPIs del CEO\nen un solo lugar — desde cualquier dispositivo."', 30, 70, 660, 90, {
    font: 'Playfair Display', size: 16, color: CREAM, align: 'center'
  });

  linea(s, 200, 168, 520, 168, GOLD, 1);

  const items = [
    ['🛍', 'Catálogo en tiempo real'],
    ['🤖', 'Asistente IA de pedidos'],
    ['📦', 'Gestión y seguimiento'],
    ['👑', 'Panel CEO con KPIs'],
    ['🔒', 'Seguridad por roles'],
    ['📱', 'App móvil sin instalación'],
  ];

  items.forEach(([icon, label], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 55 + col * 210;
    const y = 188 + row * 80;

    const pill = s.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, pt(x), pt(y), pt(180), pt(60));
    pill.getFill().setSolidFill('#2A2618');
    pill.getBorder().setWeight(1);
    pill.getBorder().getLineFill().setSolidFill(GOLD);

    txt(s, icon + '  ' + label, x + 10, y + 18, 160, 28, {
      font: 'Montserrat', size: 11, bold: true, color: GOLD2, align: 'center'
    });
  });

  txt(s, 'URL de producción: davinchi-app.vercel.app', 30, H - 28, 660, 18, {
    font: 'Montserrat', size: 10, color: MUTED, align: 'center'
  });
}

// ─── DIAPOSITIVA 4 — MÓDULOS CLAVE ───────────────────────────────────────────
function diap04_modulos(pres) {
  const s = newSlide(pres);
  bg(s, CREAM);

  rect(s, 0, 0, W, 55, INK);
  txt(s, 'Módulos de la plataforma', 30, 12, 500, 32, {
    font: 'Playfair Display', size: 20, bold: true, color: GOLD2
  });

  const modulos = [
    { icon: '🛍', title: 'Catálogo Digital', items: ['70+ referencias activas', '249+ imágenes de producto', 'Buscador + filtro por categoría', 'Precio unitario o por paquete', 'Stock en tiempo real'] },
    { icon: '🛒', title: 'Carrito & Checkout', items: ['Agregar productos con un toque', 'Formulario de datos del cliente', 'Resumen antes de confirmar', 'Registro automático en Sheets', 'Pre-llenado en visitas siguientes'] },
    { icon: '📊', title: 'Panel Vendedor', items: ['Vista de todos los pedidos', 'Cambio de estado del pedido', 'Asignación de vendedor', 'KPIs: entregas, pendientes', 'Refresh automático c/30 seg'] },
  ];

  modulos.forEach((m, i) => {
    const x = 20 + i * 235;
    const card = s.insertShape(SlidesApp.ShapeType.RECTANGLE, pt(x), pt(68), pt(218), pt(320));
    card.getFill().setSolidFill(WHITE);
    card.getBorder().setWeight(1);
    card.getBorder().getLineFill().setSolidFill('#E8DDD0');

    rect(s, x, 68, 218, 6, GOLD);
    txt(s, m.icon, x + 10, 80, 40, 36, { size: 24 });
    txt(s, m.title, x + 10, 118, 200, 24, {
      font: 'Montserrat', size: 13, bold: true, color: TEXT
    });

    m.items.forEach((item, j) => {
      txt(s, '✓  ' + item, x + 12, 150 + j * 42, 200, 36, {
        font: 'Montserrat', size: 10, color: MUTED
      });
      if (j < m.items.length - 1) linea(s, x + 12, 188 + j * 42, x + 206, 188 + j * 42, CREAM2, 0.5);
    });
  });
}

// ─── DIAPOSITIVA 5 — ASISTENTE IA ────────────────────────────────────────────
function diap05_asistente_ia(pres) {
  const s = newSlide(pres);
  bg(s, INK);

  rect(s, 0, 0, W, 55, '#252318');
  txt(s, 'Asistente IA de pedidos', 30, 12, 400, 32, {
    font: 'Playfair Display', size: 20, bold: true, color: GOLD2
  });
  chip(s, 'Claude Sonnet 4.6', W - 180, 16, GOLD, INK);

  // Panel izquierdo — descripción
  txt(s, 'Un asistente conversacional entrenado con el catálogo real de Davinchi.', 30, 68, 300, 50, {
    font: 'Montserrat', size: 12, color: CREAM
  });

  const caps = [
    '🧠  Conoce precios, stock y presentaciones',
    '🔢  Calcula precio por unidad automáticamente',
    '📝  Genera resumen del pedido en JSON',
    '⚠️  Alerta si hay poco stock (≤ 3 uds)',
    '💡  Sugiere productos complementarios',
    '🔒  API key nunca expuesta al cliente',
  ];
  caps.forEach((c, i) => {
    txt(s, c, 30, 125 + i * 38, 310, 30, {
      font: 'Montserrat', size: 10, color: i % 2 === 0 ? CREAM2 : MUTED
    });
  });

  // Panel derecho — simulación de chat
  const cx = 360, cy = 60, cw = 340, ch = 330;
  const chatBg = s.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, pt(cx), pt(cy), pt(cw), pt(ch));
  chatBg.getFill().setSolidFill('#252318');
  chatBg.getBorder().setWeight(1);
  chatBg.getBorder().getLineFill().setSolidFill(GOLD);

  txt(s, 'Asistente de pedidos  ·  En línea', cx + 14, cy + 10, 300, 18, {
    font: 'Montserrat', size: 10, bold: true, color: GOLD
  });
  linea(s, cx, cy + 30, cx + cw, cy + 30, '#3A3828', 0.5);

  const mensajes = [
    { who: 'user', text: 'Hola, necesito 2 paquetes de N034_1' },
    { who: 'ai',   text: 'N034_1: $30.000 × 24 uds por paquete.\n2 paquetes = $60.000 (48 estuches en total).\n¿Para cuándo los necesitas?' },
    { who: 'user', text: 'Para el viernes, pago contraentrega' },
    { who: 'ai',   text: '✅ Pedido registrado.\nViernes · 2× N034_1 · $60.000\nContaentrega' },
  ];

  let yCursor = cy + 40;
  mensajes.forEach(m => {
    const isUser = m.who === 'user';
    const bx = isUser ? cx + cw - 180 : cx + 14;
    const bColor = isUser ? GOLD : '#3A3828';
    const tColor = isUser ? INK : CREAM;
    const lines = m.text.split('\n').length;
    const bh = 20 + lines * 16;

    const bubble = s.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE,
      pt(bx), pt(yCursor), pt(160), pt(bh));
    bubble.getFill().setSolidFill(bColor);
    bubble.getBorder().setTransparent();

    txt(s, m.text, bx + 8, yCursor + 5, 148, bh, {
      font: 'Montserrat', size: 9, color: tColor
    });
    yCursor += bh + 10;
  });
}

// ─── DIAPOSITIVA 6 — PANEL CEO ───────────────────────────────────────────────
function diap06_panel_ceo(pres) {
  const s = newSlide(pres);
  bg(s, CREAM);

  rect(s, 0, 0, W, 55, INK);
  txt(s, '👑  Panel CEO — Visibilidad total del negocio', 30, 12, 550, 32, {
    font: 'Playfair Display', size: 18, bold: true, color: GOLD2
  });

  const kpis = [
    { label: 'OTIF', value: '87%', sub: 'Entregas completas', color: '#BA7517', bg: '#FEF3DC' },
    { label: 'Entregados', value: '42', sub: 'de 56 pedidos', color: GREEN, bg: '#EBF5F0' },
    { label: 'Pendientes', value: '8', sub: 'por gestionar', color: RED, bg: '#FAEAE6' },
    { label: 'Valor total', value: '$4.2M', sub: 'COP vendido', color: TEXT, bg: WHITE },
  ];

  kpis.forEach((k, i) => {
    const x = 18 + i * 175;
    const card = s.insertShape(SlidesApp.ShapeType.RECTANGLE, pt(x), pt(65), pt(160), pt(100));
    card.getFill().setSolidFill(k.bg);
    card.getBorder().setWeight(1);
    card.getBorder().getLineFill().setSolidFill('#E8DDD0');

    txt(s, k.label, x + 10, 72, 140, 18, {
      font: 'Montserrat', size: 9, bold: true, color: MUTED, align: 'center'
    });
    txt(s, k.value, x + 10, 90, 140, 44, {
      font: 'Playfair Display', size: 28, bold: true, color: k.color, align: 'center'
    });
    txt(s, k.sub, x + 10, 138, 140, 18, {
      font: 'Montserrat', size: 9, color: MUTED, align: 'center'
    });
  });

  // Top productos
  rect(s, 18, 178, 330, 210, WHITE);
  txt(s, '🔥  Referencias que más rotan', 30, 186, 300, 20, {
    font: 'Montserrat', size: 11, bold: true, color: TEXT
  });

  const prods = [
    ['🥇', 'N034_1', '48 uds', 100],
    ['🥈', 'N006',   '32 uds', 67],
    ['🥉', 'N039',   '24 uds', 50],
    ['4', 'N027',   '20 uds', 42],
  ];

  prods.forEach(([medal, name, qty, pct], i) => {
    const py = 210 + i * 42;
    txt(s, medal + '  ' + name, 30, py, 120, 18, {
      font: 'Montserrat', size: 10, bold: true, color: TEXT
    });
    txt(s, qty, 230, py, 100, 18, {
      font: 'Montserrat', size: 10, color: MUTED, align: 'right'
    });
    const barBg = s.insertShape(SlidesApp.ShapeType.RECTANGLE, pt(30), pt(py + 20), pt(290), pt(6));
    barBg.getFill().setSolidFill(CREAM2);
    barBg.getBorder().setTransparent();
    const barFg = s.insertShape(SlidesApp.ShapeType.RECTANGLE, pt(30), pt(py + 20), pt(290 * pct / 100), pt(6));
    barFg.getFill().setSolidFill(GOLD);
    barFg.getBorder().setTransparent();
  });

  // Ranking vendedores
  const rv = s.insertShape(SlidesApp.ShapeType.RECTANGLE, pt(362), pt(178), pt(340), pt(210));
  rv.getFill().setSolidFill(WHITE);
  rv.getBorder().setWeight(1);
  rv.getBorder().getLineFill().setSolidFill('#E8DDD0');

  txt(s, '👨‍💼  Rendimiento por vendedor', 374, 186, 300, 20, {
    font: 'Montserrat', size: 11, bold: true, color: TEXT
  });

  const vends = [
    ['🥇', 'Jero',  '28 entregados', '$2.1M', GREEN],
    ['🥈', 'Yiyo',  '14 entregados', '$1.1M', MUTED],
  ];
  vends.forEach(([medal, name, ent, val, col], i) => {
    const vy = 215 + i * 80;
    const vc = s.insertShape(SlidesApp.ShapeType.RECTANGLE, pt(374), pt(vy), pt(316), pt(65));
    vc.getFill().setSolidFill(i === 0 ? '#FAFAF5' : CREAM);
    vc.getBorder().setTransparent();
    txt(s, medal + '  ' + name, 386, vy + 8, 200, 20, {
      font: 'Montserrat', size: 13, bold: true, color: TEXT
    });
    txt(s, val, 560, vy + 8, 120, 20, {
      font: 'Montserrat', size: 12, bold: true, color: col, align: 'right'
    });
    txt(s, ent, 386, vy + 36, 280, 18, {
      font: 'Montserrat', size: 10, color: MUTED
    });
  });
}

// ─── DIAPOSITIVA 7 — TECNOLOGÍA ──────────────────────────────────────────────
function diap07_tecnologia(pres) {
  const s = newSlide(pres);
  bg(s, INK);

  rect(s, 0, 0, W, 55, '#252318');
  txt(s, 'Arquitectura técnica', 30, 12, 500, 32, {
    font: 'Playfair Display', size: 20, bold: true, color: GOLD2
  });

  const capas = [
    { label: 'CLIENTE (Navegador)', items: ['HTML + CSS + JS — sin instalación', 'Responsive: móvil, tablet, escritorio', 'PWA-ready — funciona offline (catálogo)'], color: GOLD, bg: '#2A2618' },
    { label: 'SERVIDOR (Vercel)', items: ['3 endpoints serverless (Node.js)', 'Proxy seguro — API keys nunca al cliente', 'Deploy automático desde GitHub'], color: '#64B5F6', bg: '#1E2A38' },
    { label: 'DATOS (Google)', items: ['Google Sheets como base de datos', 'Apps Script como API REST', 'Actualizable sin tocar código'], color: '#81C784', bg: '#1E2E20' },
    { label: 'IA (Anthropic)', items: ['Claude Sonnet 4.6 — asistente pedidos', 'Contexto del catálogo en tiempo real', 'Generación de pedido estructurado (JSON)'], color: '#CE93D8', bg: '#28203A' },
  ];

  capas.forEach((c, i) => {
    const x = 18 + i * 175;
    const card = s.insertShape(SlidesApp.ShapeType.RECTANGLE, pt(x), pt(65), pt(162), pt(320));
    card.getFill().setSolidFill(c.bg);
    card.getBorder().setWeight(1);
    card.getBorder().getLineFill().setSolidFill(c.color);

    rect(s, x, 65, 162, 4, c.color);
    txt(s, c.label, x + 10, 78, 142, 36, {
      font: 'Montserrat', size: 9, bold: true, color: c.color, align: 'center'
    });
    linea(s, x + 20, 118, x + 142, 118, c.color, 0.5);
    c.items.forEach((item, j) => {
      txt(s, '· ' + item, x + 10, 130 + j * 56, 142, 48, {
        font: 'Montserrat', size: 9, color: CREAM2
      });
    });
  });

  txt(s, 'Infraestructura 100% en la nube · Sin servidores propios · Escalable', 30, H - 30, 660, 18, {
    font: 'Montserrat', size: 10, color: MUTED, align: 'center'
  });
}

// ─── DIAPOSITIVA 8 — KPIs DISPONIBLES ────────────────────────────────────────
function diap08_kpis(pres) {
  const s = newSlide(pres);
  bg(s, CREAM);

  rect(s, 0, 0, W, 55, INK);
  txt(s, 'Indicadores que ahora tiene el negocio', 30, 12, 550, 32, {
    font: 'Playfair Display', size: 18, bold: true, color: GOLD2
  });

  txt(s, 'Antes: ninguno.  Ahora: visibilidad total en tiempo real.', 30, 44, 500, 16, {
    font: 'Montserrat', size: 10, color: MUTED
  });

  const kpis = [
    ['📦', 'OTIF', 'Porcentaje de pedidos entregados completos y a tiempo. Semáforo verde/amarillo/rojo.'],
    ['💰', 'Valor vendido', 'Total histórico, ticket promedio y valor del día actual.'],
    ['🔥', 'Rotación de refs', 'Ranking de qué referencias se venden más. Barra de progreso comparativa.'],
    ['👨‍💼', 'Rendimiento vendedor', 'Entregas completas, parciales y valor gestionado por vendedor.'],
    ['🏆', 'Clientes activos', 'Top 5 joyerías con más pedidos. Detecta clientes en riesgo de abandono.'],
    ['⚠️', 'Entregas parciales', 'Lista de pedidos incompletos que requieren atención inmediata.'],
  ];

  kpis.forEach((k, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 18 + col * 352;
    const y = 72 + row * 108;

    const card = s.insertShape(SlidesApp.ShapeType.RECTANGLE, pt(x), pt(y), pt(336), pt(96));
    card.getFill().setSolidFill(WHITE);
    card.getBorder().setWeight(1);
    card.getBorder().getLineFill().setSolidFill('#E8DDD0');
    rect(s, x, y, 4, 96, GOLD);

    txt(s, k[0], x + 14, y + 12, 36, 36, { size: 22 });
    txt(s, k[1], x + 56, y + 12, 260, 22, {
      font: 'Montserrat', size: 12, bold: true, color: TEXT
    });
    txt(s, k[2], x + 56, y + 38, 268, 46, {
      font: 'Montserrat', size: 10, color: MUTED
    });
  });
}

// ─── DIAPOSITIVA 9 — COSTOS ───────────────────────────────────────────────────
function diap09_costos(pres) {
  const s = newSlide(pres);
  bg(s, INK);

  rect(s, 0, 0, W, 55, '#252318');
  txt(s, 'Transparencia total — Costos de operación', 30, 12, 550, 32, {
    font: 'Playfair Display', size: 18, bold: true, color: GOLD2
  });

  txt(s, 'No hay costos ocultos. Todo es predecible y escalable.', 30, 44, 500, 16, {
    font: 'Montserrat', size: 10, color: MUTED
  });

  // Tabla
  const headers = ['Servicio', 'Función', 'Costo/mes'];
  const rows = [
    ['Anthropic API', 'Asistente IA de pedidos', '$150K – $250K COP'],
    ['Vercel Hosting', 'Servidor + deploy automático', '$0 (plan Free)'],
    ['Google Sheets', 'Base de datos del catálogo', '$0'],
    ['GitHub', 'Repositorio + control de versiones', '$0'],
    ['Mantenimiento', 'Soporte, actualizaciones, ajustes', '$400K COP'],
  ];

  const tx = 30, ty = 68, tw = 660, rh = 40;

  // Header
  const hRow = s.insertShape(SlidesApp.ShapeType.RECTANGLE, pt(tx), pt(ty), pt(tw), pt(rh));
  hRow.getFill().setSolidFill(GOLD);
  hRow.getBorder().setTransparent();
  txt(s, 'Servicio', tx + 10, ty + 10, 180, 22, { font: 'Montserrat', size: 10, bold: true, color: INK });
  txt(s, 'Función', tx + 200, ty + 10, 300, 22, { font: 'Montserrat', size: 10, bold: true, color: INK });
  txt(s, 'Costo/mes', tx + 510, ty + 10, 140, 22, { font: 'Montserrat', size: 10, bold: true, color: INK, align: 'right' });

  rows.forEach((row, i) => {
    const ry = ty + rh + i * 38;
    const rowBg = s.insertShape(SlidesApp.ShapeType.RECTANGLE, pt(tx), pt(ry), pt(tw), pt(36));
    rowBg.getFill().setSolidFill(i % 2 === 0 ? '#252318' : '#2A2618');
    rowBg.getBorder().setTransparent();
    txt(s, row[0], tx + 10, ry + 8, 180, 22, { font: 'Montserrat', size: 10, bold: true, color: GOLD2 });
    txt(s, row[1], tx + 200, ry + 8, 300, 22, { font: 'Montserrat', size: 10, color: CREAM2 });
    txt(s, row[2], tx + 510, ry + 8, 140, 22, { font: 'Montserrat', size: 10, bold: true, color: GOLD, align: 'right' });
  });

  // Total
  const totalY = ty + rh + rows.length * 38 + 10;
  rect(s, tx, totalY, tw, 44, '#3A3020');
  txt(s, 'TOTAL ESTIMADO MENSUAL', tx + 10, totalY + 10, 400, 24, {
    font: 'Montserrat', size: 12, bold: true, color: GOLD2
  });
  txt(s, '$550K – $750K COP/mes', tx + 400, totalY + 10, 250, 24, {
    font: 'Montserrat', size: 14, bold: true, color: GOLD, align: 'right'
  });
}

// ─── DIAPOSITIVA 10 — PROPUESTA COMERCIAL ────────────────────────────────────
function diap10_propuesta(pres) {
  const s = newSlide(pres);
  bg(s, CREAM);

  rect(s, 0, 0, W, 55, INK);
  txt(s, 'Propuesta comercial', 30, 12, 500, 32, {
    font: 'Playfair Display', size: 20, bold: true, color: GOLD2
  });

  const planes = [
    {
      nombre: 'Plan Base',
      precio: '$12.000.000',
      sub: 'Pago único de desarrollo',
      mensual: '$500.000/mes',
      color: MUTED,
      items: ['App completa entregada', 'Catálogo + IA + Pedidos', 'Panel Vendedor y CEO', 'Deploy y capacitación', 'Soporte 30 días'],
    },
    {
      nombre: 'Plan Premium',
      precio: '$14.500.000',
      sub: 'Incluye WhatsApp Business',
      mensual: '$700.000/mes',
      color: GOLD,
      items: ['Todo el Plan Base', 'Notif. WhatsApp a vendedores', 'Confirmación automática cliente', 'Informe mensual de KPIs', 'Sesión mensual de revisión'],
      destacado: true,
    },
  ];

  planes.forEach((p, i) => {
    const x = 60 + i * 330;
    const card = s.insertShape(SlidesApp.ShapeType.RECTANGLE, pt(x), pt(65), pt(290), pt(320));
    card.getFill().setSolidFill(p.destacado ? INK : WHITE);
    card.getBorder().setWeight(p.destacado ? 2 : 1);
    card.getBorder().getLineFill().setSolidFill(p.color);

    if (p.destacado) {
      const badge = s.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, pt(x + 90), pt(55), pt(110), pt(22));
      badge.getFill().setSolidFill(GOLD);
      badge.getBorder().setTransparent();
      txt(s, '⭐ RECOMENDADO', x + 94, 58, 102, 16, {
        font: 'Montserrat', size: 8, bold: true, color: INK, align: 'center'
      });
    }

    txt(s, p.nombre, x + 20, 82, 250, 24, {
      font: 'Playfair Display', size: 15, bold: true, color: p.destacado ? GOLD2 : TEXT
    });
    txt(s, p.precio, x + 20, 108, 250, 40, {
      font: 'Playfair Display', size: 26, bold: true, color: p.color
    });
    txt(s, p.sub, x + 20, 148, 250, 18, {
      font: 'Montserrat', size: 9, color: p.destacado ? MUTED : MUTED
    });
    linea(s, x + 20, 170, x + 270, 170, p.destacado ? '#3A3828' : CREAM2, 1);
    txt(s, 'Mantenimiento: ' + p.mensual, x + 20, 178, 250, 18, {
      font: 'Montserrat', size: 10, bold: true, color: p.destacado ? GOLD : TEXT
    });
    linea(s, x + 20, 200, x + 270, 200, p.destacado ? '#3A3828' : CREAM2, 1);

    p.items.forEach((item, j) => {
      txt(s, '✓  ' + item, x + 20, 208 + j * 32, 250, 28, {
        font: 'Montserrat', size: 10, color: p.destacado ? CREAM2 : MUTED
      });
    });
  });
}

// ─── DIAPOSITIVA 11 — ROADMAP ─────────────────────────────────────────────────
function diap11_roadmap(pres) {
  const s = newSlide(pres);
  bg(s, INK);

  rect(s, 0, 0, W, 55, '#252318');
  txt(s, 'Próximos pasos y evolución', 30, 12, 500, 32, {
    font: 'Playfair Display', size: 20, bold: true, color: GOLD2
  });

  // Línea de tiempo
  linea(s, 60, 200, 660, 200, GOLD, 2);

  const hitos = [
    { label: 'HOY', titulo: 'App en producción', items: ['Catálogo completo', 'IA + pedidos', 'Panel CEO'], color: GOLD },
    { label: 'MES 1-2', titulo: 'Optimización', items: ['Dominio propio', 'WhatsApp Business', 'Más referencias'], color: GREEN },
    { label: 'MES 3-4', titulo: 'Inteligencia', items: ['Informe mensual', 'Alertas de stock', 'Historial avanzado'], color: '#64B5F6' },
    { label: 'MES 6+', titulo: 'Escala', items: ['PWA instalable', 'Facturación', 'Nuevos clientes'], color: '#CE93D8' },
  ];

  hitos.forEach((h, i) => {
    const x = 60 + i * 160;

    // Punto en la línea
    const dot = s.insertShape(SlidesApp.ShapeType.ELLIPSE, pt(x - 8), pt(192), pt(16), pt(16));
    dot.getFill().setSolidFill(h.color);
    dot.getBorder().setTransparent();

    txt(s, h.label, x - 40, 210, 100, 20, {
      font: 'Montserrat', size: 9, bold: true, color: h.color, align: 'center'
    });
    txt(s, h.titulo, x - 60, 236, 140, 22, {
      font: 'Montserrat', size: 11, bold: true, color: CREAM2, align: 'center'
    });
    h.items.forEach((item, j) => {
      txt(s, '· ' + item, x - 60, 262 + j * 28, 140, 24, {
        font: 'Montserrat', size: 9, color: MUTED, align: 'center'
      });
    });

    // Línea hacia arriba para los pares
    if (i % 2 === 0) {
      txt(s, h.titulo, x - 60, 100, 140, 22, {
        font: 'Montserrat', size: 11, bold: true, color: CREAM2, align: 'center'
      });
    }
  });

  txt(s, 'La plataforma crece con el negocio. Cada módulo es una inversión, no un gasto.', 30, H - 32, 660, 20, {
    font: 'Montserrat', size: 10, color: MUTED, align: 'center'
  });
}

// ─── DIAPOSITIVA 12 — CIERRE ──────────────────────────────────────────────────
function diap12_cierre(pres) {
  const s = newSlide(pres);
  bg(s, INK);

  rect(s, 0, 0, W, 8, GOLD);
  rect(s, 0, H - 8, W, 8, GOLD);

  txt(s, '✦', W/2 - 30, 30, 60, 60, {
    font: 'Playfair Display', size: 44, color: GOLD, align: 'center'
  });

  txt(s, 'Davinchi App está lista.', 30, 95, 660, 50, {
    font: 'Playfair Display', size: 28, bold: true, color: CREAM, align: 'center'
  });

  txt(s, 'Tu catálogo, tus pedidos y tus KPIs en una sola plataforma.\nDiseñada para tu negocio. Construida para crecer.', 30, 155, 660, 60, {
    font: 'Montserrat', size: 13, color: MUTED, align: 'center'
  });

  linea(s, 220, 228, 500, 228, GOLD, 1);

  txt(s, 'davinchi-app.vercel.app', 30, 244, 660, 32, {
    font: 'Montserrat', size: 18, bold: true, color: GOLD, align: 'center'
  });

  txt(s, 'Jerónimo Álvarez  ·  Agencia de Automatización IA\n+57 312 279 5696', 30, 295, 660, 44, {
    font: 'Montserrat', size: 11, color: CREAM2, align: 'center'
  });

  txt(s, '¿Comenzamos?', 30, H - 65, 660, 36, {
    font: 'Playfair Display', size: 20, bold: true, color: GOLD2, align: 'center'
  });
}
