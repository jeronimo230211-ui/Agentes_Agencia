export type TicketStatus = "nuevo" | "asignado" | "en_progreso" | "resuelto";
export type TicketType = "falla" | "cambio_plan" | "instalacion" | "cancelacion" | "otro";
export type AppointmentStatus = "confirmado" | "pendiente" | "sin_confirmar" | "cancelado";
export type LeadState = "nuevo" | "interesado" | "en_proceso" | "activo" | "inactivo";
export type BotStatus = "activo" | "humano";

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  cedula: string;
  address: string;
  plan: string;
  since: string;
  botStatus: BotStatus;
  leadState: LeadState;
}

export interface Technician {
  id: string;
  name: string;
  avatar: string;
  status: "disponible" | "en_cita" | "inactivo";
  ticketsHoy: number;
}

export interface Ticket {
  id: string;
  clientId: string;
  clientName: string;
  type: TicketType;
  description: string;
  status: TicketStatus;
  technicianId?: string;
  technicianName?: string;
  createdAt: string;
  updatedAt: string;
  priority: "alta" | "media" | "baja";
}

export interface Appointment {
  id: string;
  ticketId: string;
  clientName: string;
  clientPhone: string;
  address: string;
  technicianName: string;
  date: string;
  time: string;
  type: TicketType;
  status: AppointmentStatus;
  duration: number;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: "general" | "precios" | "faq" | "politicas" | "cobertura";
  status: "sincronizado" | "pendiente";
  summary: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  name: string;
  category: "soporte" | "facturacion" | "recordatorio" | "marketing";
  message: string;
  usedCount: number;
  lastUsed?: string;
}

export const clients: Client[] = [
  {
    id: "c1", name: "María López", phone: "+57 310 123 4567",
    email: "maria.lopez@gmail.com", cedula: "1.023.456.789",
    address: "Calle 45 #12-34, Barrio El Centro", plan: "Fibra 100 Mbps",
    since: "2022-03-15", botStatus: "activo", leadState: "en_proceso",
  },
  {
    id: "c2", name: "Carlos Pérez", phone: "+57 315 234 5678",
    email: "cperez@hotmail.com", cedula: "1.045.678.901",
    address: "Carrera 8 #23-45, Barrio La Esperanza", plan: "Fibra 50 Mbps",
    since: "2021-07-20", botStatus: "humano", leadState: "interesado",
  },
  {
    id: "c3", name: "Ana Rodríguez", phone: "+57 320 345 6789",
    email: "ana.rodriguez@gmail.com", cedula: "1.067.890.123",
    address: "Transversal 15 #67-89, Barrio San José", plan: "Fibra 200 Mbps",
    since: "2023-01-10", botStatus: "activo", leadState: "activo",
  },
  {
    id: "c4", name: "Luis Gómez", phone: "+57 318 456 7890",
    email: "lgomez@empresa.com", cedula: "1.089.012.345",
    address: "Calle 23 #45-67, Barrio El Prado", plan: "Fibra 100 Mbps + TV",
    since: "2020-11-05", botStatus: "activo", leadState: "activo",
  },
  {
    id: "c5", name: "Sandra Castro", phone: "+57 312 567 8901",
    email: "sandra.c@gmail.com", cedula: "1.012.345.678",
    address: "Carrera 12 #34-56, Barrio La Victoria", plan: "Fibra 50 Mbps",
    since: "2022-08-22", botStatus: "humano", leadState: "inactivo",
  },
  {
    id: "c6", name: "Manuel Herrera", phone: "+57 317 678 9012",
    email: "mherrera@gmail.com", cedula: "1.034.567.890",
    address: "Calle 67 #89-12, Barrio San Francisco", plan: "Radio Enlace 20 Mbps",
    since: "2023-05-14", botStatus: "activo", leadState: "en_proceso",
  },
  {
    id: "c7", name: "Patricia Díaz", phone: "+57 311 789 0123",
    email: "patricia.diaz@outlook.com", cedula: "1.056.789.012",
    address: "Carrera 25 #12-34, Barrio El Bosque", plan: "Fibra 100 Mbps",
    since: "2021-02-28", botStatus: "activo", leadState: "activo",
  },
  {
    id: "c8", name: "Jorge Martínez", phone: "+57 316 890 1234",
    email: "jorge.m@gmail.com", cedula: "1.078.901.234",
    address: "Calle 12 #56-78, Barrio El Nogal", plan: "Fibra 50 Mbps",
    since: "2024-01-08", botStatus: "activo", leadState: "nuevo",
  },
];

export const technicians: Technician[] = [
  { id: "t1", name: "Andrés Morales", avatar: "AM", status: "en_cita", ticketsHoy: 3 },
  { id: "t2", name: "Diego Ramírez", avatar: "DR", status: "disponible", ticketsHoy: 2 },
  { id: "t3", name: "Valentina Torres", avatar: "VT", status: "disponible", ticketsHoy: 1 },
];

export const tickets: Ticket[] = [
  {
    id: "TK-001", clientId: "c1", clientName: "María López",
    type: "falla", description: "Internet caído desde ayer en la tarde, no enciende la luz del router",
    status: "nuevo", createdAt: "2026-04-21T07:30:00", updatedAt: "2026-04-21T07:30:00",
    priority: "alta",
  },
  {
    id: "TK-002", clientId: "c2", clientName: "Carlos Pérez",
    type: "cambio_plan", description: "Solicita bajar plan de Fibra 100 Mbps a Fibra 50 Mbps",
    status: "asignado", technicianId: "t1", technicianName: "Andrés Morales",
    createdAt: "2026-04-21T08:00:00", updatedAt: "2026-04-21T09:15:00",
    priority: "media",
  },
  {
    id: "TK-003", clientId: "c3", clientName: "Ana Rodríguez",
    type: "instalacion", description: "Nueva instalación de fibra óptica 200 Mbps",
    status: "resuelto", technicianId: "t2", technicianName: "Diego Ramírez",
    createdAt: "2026-04-20T10:00:00", updatedAt: "2026-04-20T14:30:00",
    priority: "media",
  },
  {
    id: "TK-004", clientId: "c4", clientName: "Luis Gómez",
    type: "falla", description: "Sin señal en los canales de televisión, el internet funciona bien",
    status: "nuevo", createdAt: "2026-04-21T09:45:00", updatedAt: "2026-04-21T09:45:00",
    priority: "media",
  },
  {
    id: "TK-005", clientId: "c5", clientName: "Sandra Castro",
    type: "cancelacion", description: "Solicita cancelar el servicio, se muda de ciudad",
    status: "en_progreso", technicianId: "t3", technicianName: "Valentina Torres",
    createdAt: "2026-04-20T14:00:00", updatedAt: "2026-04-21T08:30:00",
    priority: "baja",
  },
  {
    id: "TK-006", clientId: "c6", clientName: "Manuel Herrera",
    type: "falla", description: "Internet muy lento desde hace 3 días, velocidad menor a 2 Mbps",
    status: "asignado", technicianId: "t2", technicianName: "Diego Ramírez",
    createdAt: "2026-04-21T06:00:00", updatedAt: "2026-04-21T10:00:00",
    priority: "alta",
  },
  {
    id: "TK-007", clientId: "c7", clientName: "Patricia Díaz",
    type: "falla", description: "Router dañado, no enciende después de una tormenta eléctrica",
    status: "asignado", technicianId: "t1", technicianName: "Andrés Morales",
    createdAt: "2026-04-21T07:00:00", updatedAt: "2026-04-21T09:00:00",
    priority: "alta",
  },
];

export const appointments: Appointment[] = [
  {
    id: "AP-001", ticketId: "TK-002", clientName: "Carlos Pérez",
    clientPhone: "+57 315 234 5678", address: "Carrera 8 #23-45, Barrio La Esperanza",
    technicianName: "Andrés Morales", date: "2026-04-21", time: "09:00",
    type: "cambio_plan", status: "confirmado", duration: 30,
  },
  {
    id: "AP-002", ticketId: "TK-007", clientName: "Patricia Díaz",
    clientPhone: "+57 311 789 0123", address: "Carrera 25 #12-34, Barrio El Bosque",
    technicianName: "Andrés Morales", date: "2026-04-21", time: "15:00",
    type: "falla", status: "pendiente", duration: 60,
  },
  {
    id: "AP-003", ticketId: "TK-006", clientName: "Manuel Herrera",
    clientPhone: "+57 317 678 9012", address: "Calle 67 #89-12, Barrio San Francisco",
    technicianName: "Diego Ramírez", date: "2026-04-22", time: "10:00",
    type: "falla", status: "confirmado", duration: 60,
  },
  {
    id: "AP-004", ticketId: "TK-005", clientName: "Sandra Castro",
    clientPhone: "+57 312 567 8901", address: "Carrera 12 #34-56, Barrio La Victoria",
    technicianName: "Valentina Torres", date: "2026-04-23", time: "14:00",
    type: "cancelacion", status: "sin_confirmar", duration: 30,
  },
  {
    id: "AP-005", ticketId: "TK-001", clientName: "María López",
    clientPhone: "+57 310 123 4567", address: "Calle 45 #12-34, Barrio El Centro",
    technicianName: "Diego Ramírez", date: "2026-04-22", time: "08:00",
    type: "falla", status: "confirmado", duration: 60,
  },
  {
    id: "AP-006", ticketId: "TK-004", clientName: "Luis Gómez",
    clientPhone: "+57 318 456 7890", address: "Calle 23 #45-67, Barrio El Prado",
    technicianName: "Valentina Torres", date: "2026-04-21", time: "11:00",
    type: "falla", status: "confirmado", duration: 60,
  },
  {
    id: "AP-007", ticketId: "TK-003", clientName: "Ana Rodríguez",
    clientPhone: "+57 320 345 6789", address: "Transversal 15 #67-89, Barrio San José",
    technicianName: "Diego Ramírez", date: "2026-04-23", time: "09:00",
    type: "instalacion", status: "confirmado", duration: 120,
  },
  {
    id: "AP-008", ticketId: "TK-008", clientName: "Jorge Martínez",
    clientPhone: "+57 316 890 1234", address: "Calle 12 #56-78, Barrio El Nogal",
    technicianName: "Andrés Morales", date: "2026-04-24", time: "10:00",
    type: "instalacion", status: "confirmado", duration: 90,
  },
];

export const knowledgeDocs: KnowledgeDocument[] = [
  {
    id: "k1", title: "Información General de RedLine",
    category: "general", status: "sincronizado",
    summary: "Nombre, horarios de atención, dirección, canales de contacto y política de soporte técnico.",
    updatedAt: "2026-04-20",
  },
  {
    id: "k2", title: "Planes y Precios",
    category: "precios", status: "pendiente",
    summary: "Fibra 50/100/200 Mbps, Radio Enlace 20 Mbps, paquetes con TV. Precios y condiciones actualizados.",
    updatedAt: "2026-04-15",
  },
  {
    id: "k3", title: "Preguntas Frecuentes — Soporte",
    category: "faq", status: "sincronizado",
    summary: "¿Qué hago si no tengo internet? ¿Cuánto tarda la visita? ¿Cómo reporto una falla? y 12 preguntas más.",
    updatedAt: "2026-04-21",
  },
  {
    id: "k4", title: "Zonas de Cobertura",
    category: "cobertura", status: "pendiente",
    summary: "Barrios y municipios con servicio de fibra óptica y radio enlace. Mapa de expansión 2026.",
    updatedAt: "2026-04-10",
  },
  {
    id: "k5", title: "Políticas de Servicio",
    category: "politicas", status: "sincronizado",
    summary: "SLA de respuesta (máx. 24h hábiles), garantía de velocidad, política de cancelación y reembolsos.",
    updatedAt: "2026-04-18",
  },
  {
    id: "k6", title: "Preguntas Frecuentes — Facturación",
    category: "faq", status: "pendiente",
    summary: "¿Cómo pago? ¿Qué métodos aceptan? ¿Qué pasa si me atraso? Fechas de corte y reconexión.",
    updatedAt: "2026-04-05",
  },
];

export const templates: Template[] = [
  {
    id: "t1", name: "Recordatorio de visita técnica",
    category: "recordatorio",
    message: "Hola {{nombre}} 👋 Te recordamos que mañana {{fecha}} a las {{hora}} el técnico {{tecnico}} visitará tu domicilio en {{direccion}}. ¿Confirmas tu disponibilidad? Responde SI o NO.",
    usedCount: 142, lastUsed: "2026-04-21",
  },
  {
    id: "t2", name: "Aviso de mantenimiento programado",
    category: "soporte",
    message: "📢 RedLine informa: el día {{fecha}} entre las {{hora_inicio}} y {{hora_fin}} realizaremos mantenimiento en tu zona ({{zona}}). El servicio puede presentar interrupciones breves. Disculpa los inconvenientes.",
    usedCount: 87, lastUsed: "2026-04-18",
  },
  {
    id: "t3", name: "Aviso de factura disponible",
    category: "facturacion",
    message: "Hola {{nombre}} 💳 Tu factura de RedLine por ${{valor}} ya está disponible. Fecha límite de pago: {{fecha_limite}}. Para pagar responde PAGAR o visita {{link_pago}}.",
    usedCount: 203, lastUsed: "2026-04-20",
  },
  {
    id: "t4", name: "Bienvenida a nuevo cliente",
    category: "marketing",
    message: "¡Bienvenido a RedLine, {{nombre}}! 🎉 Tu servicio de {{plan}} ya está activo. Recuerda que puedes reportar fallas o solicitar soporte aquí mismo. ¡Gracias por elegirnos!",
    usedCount: 34, lastUsed: "2026-04-19",
  },
  {
    id: "t5", name: "Encuesta post-visita",
    category: "soporte",
    message: "Hola {{nombre}}, ¿cómo calificarías la visita de nuestro técnico hoy? Responde del 1 al 5 ⭐. Tu opinión nos ayuda a mejorar. ¡Gracias!",
    usedCount: 98, lastUsed: "2026-04-21",
  },
  {
    id: "t6", name: "Promoción plan superior",
    category: "marketing",
    message: "🚀 {{nombre}}, tienes Fibra {{plan_actual}}. Por solo ${{diferencia}} más al mes puedes subir a Fibra {{plan_nuevo}} y doblar tu velocidad. ¿Te interesa? Responde SI y te llamamos hoy.",
    usedCount: 51, lastUsed: "2026-04-17",
  },
];

export const typeLabels: Record<TicketType, string> = {
  falla: "Falla técnica",
  cambio_plan: "Cambio de plan",
  instalacion: "Instalación",
  cancelacion: "Cancelación",
  otro: "Otro",
};

export const statusLabels: Record<TicketStatus, string> = {
  nuevo: "Nuevo",
  asignado: "Asignado",
  en_progreso: "En progreso",
  resuelto: "Resuelto",
};

export const leadStateLabels: Record<LeadState, string> = {
  nuevo: "Nuevo",
  interesado: "Interesado",
  en_proceso: "En proceso",
  activo: "Activo",
  inactivo: "Inactivo",
};

export const categoryLabels: Record<KnowledgeDocument["category"], string> = {
  general: "General",
  precios: "Precios",
  faq: "FAQ",
  politicas: "Políticas",
  cobertura: "Cobertura",
};

export const templateCategoryLabels: Record<Template["category"], string> = {
  soporte: "Soporte",
  facturacion: "Facturación",
  recordatorio: "Recordatorio",
  marketing: "Marketing",
};
