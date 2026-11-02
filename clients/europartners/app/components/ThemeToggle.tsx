'use client'

import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

const THEME_STORAGE_KEY = 'ep_theme'

/**
 * Alterna <html data-theme="light|dark"> y lo persiste en localStorage.
 * El script inline de app/layout.tsx ya deja el atributo correcto puesto
 * antes del primer paint (evita el flash); este componente solo refleja
 * ese estado inicial y permite cambiarlo.
 *
 * Decisión de Jerónimo (oct-2026): este toggle vive en el Topbar, junto a
 * las notificaciones -- no en el Sidebar. Las pantallas públicas sin login
 * (solicitud, aprobacion-cliente, aprobacion-token, pago, emily) no usan
 * Topbar, así que nunca lo renderizan; solo siguen prefers-color-scheme
 * de forma pasiva vía el mismo script.
 */
export default function ThemeToggle() {
  const [tema, setTema] = useState<'light' | 'dark'>('light')
  const [listo, setListo] = useState(false)

  useEffect(() => {
    const actual = document.documentElement.getAttribute('data-theme')
    setTema(actual === 'dark' ? 'dark' : 'light')
    setListo(true)
  }, [])

  function alternarTema() {
    const siguiente = tema === 'dark' ? 'light' : 'dark'
    setTema(siguiente)
    document.documentElement.setAttribute('data-theme', siguiente)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, siguiente)
    } catch {
      // Storage bloqueado (modo incógnito estricto, etc.) -- el tema
      // sigue funcionando para esta sesión, solo no se recuerda.
    }
  }

  // Antes de leer el DOM en el efecto, no sabemos el tema real: mostramos
  // un espacio reservado del mismo tamaño en vez de un ícono que podría
  // ser el incorrecto por una fracción de segundo.
  if (!listo) {
    return <span className="inline-block w-9 h-9" aria-hidden="true" />
  }

  return (
    <button
      type="button"
      onClick={alternarTema}
      aria-label={tema === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={tema === 'dark' ? 'Tema claro' : 'Tema oscuro'}
      // Nombres de clase reales del preset (verificados compilando tailwind.preset.js):
      // el token "bg-subtle" genera la clase "bg-bg-subtle", el token "text" genera
      // "text-text" -- NO "bg-subtle"/"text-text-muted" a secas como sugiere
      // implementacion-web.md. Ver nota en tailwind.config.ts.
      className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-bg-subtle transition-colors"
    >
      {tema === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}
