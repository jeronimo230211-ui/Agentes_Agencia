// Detecta si una acción sobre una proforma es claramente una prueba de
// QA/desarrollo, para no generarle a Deisy/Marta una notificación real (ni
// el correo que suele acompañarla) en su bandeja -- encargo de Jero,
// 2026-11-10, tras encontrar en su panel varias notificaciones de pruebas
// de las últimas 2 semanas ("Proforma 3-0268 anulada: QA TEST...").
//
// Dos señales, cualquiera basta:
//   1. proforma.notas_internas contiene "qa test" / "qa-test" -- QA viene
//      marcando sus proformas de prueba así desde nov-2026 (ver 3-0264 a
//      3-0268 en el historial).
//   2. el texto de la propia acción (motivo de anulación/rechazo,
//      comentario) contiene el mismo patrón -- cubre el caso real de la
//      proforma 3-0258: su notas_internas NO tenía marca de prueba, solo el
//      motivo que le pasó QA al endpoint de anular la tenía.
//
// A propósito NO se basa en el nombre del cliente: los 3 casos reales que
// generaron notificaciones (3-0258, 3-0267, 3-0268) se crearon sobre
// clientes REALES (HJB Jamaica, Hardware & Lumber, Pro Hardware), no sobre
// un cliente "QA TEST" dedicado -- ese criterio no habría detectado nada.
const PATRON_QA_TEST = /qa[\s-]?test/i

export function esAccionDePrueba(...textos: Array<string | null | undefined>): boolean {
  return textos.some(t => !!t && PATRON_QA_TEST.test(t))
}
