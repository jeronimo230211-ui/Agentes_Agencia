// Favoritos simples, solo visual -- confirmado por Jerónimo (26-oct-2026):
// guardado en localStorage del navegador, SIN backend ni conexión a
// cotizador/solicitud por ahora. Un array de ids de producto en una sola
// key. Si en el futuro se necesita que sobreviva entre dispositivos o se
// use para algo funcional (ej. armar una solicitud desde favoritos), ahí sí
// pasa a Supabase -- hoy no hace falta.
const CLAVE = 'ep_favoritos'

function leerIds(): string[] {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    // localStorage puede no existir (SSR) o estar bloqueado (modo privado,
    // storage lleno) -- un favorito que no se guarda no debe romper la página.
    return []
  }
}

function guardarIds(ids: string[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(ids))
  } catch {
    // Ignorado a propósito -- ver comentario de leerIds().
  }
}

export function obtenerFavoritos(): string[] {
  return leerIds()
}

export function esFavorito(productoId: string): boolean {
  return leerIds().includes(productoId)
}

// Alterna el estado y devuelve el nuevo valor (true = quedó guardado).
export function alternarFavorito(productoId: string): boolean {
  const ids = leerIds()
  const idx = ids.indexOf(productoId)
  if (idx >= 0) {
    ids.splice(idx, 1)
    guardarIds(ids)
    return false
  }
  ids.push(productoId)
  guardarIds(ids)
  return true
}
