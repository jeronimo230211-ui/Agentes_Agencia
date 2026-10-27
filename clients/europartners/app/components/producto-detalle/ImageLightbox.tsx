'use client'
import { useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  imagenes: string[]
  indiceInicial: number
  alt: string
  onClose: () => void
}

const ZOOM_MIN = 1
const ZOOM_MAX = 4
const ZOOM_DOBLE_TAP = 2.5

function distanciaEntreToques(t: React.TouchList): number {
  const [a, b] = [t[0], t[1]]
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

// Visor fullscreen con pinch-zoom + pan táctil y doble-tap para zoom — no
// depende de ninguna librería (la spec pide "pinch-zoom" en móvil sin
// agregar una dependencia nueva solo para esto). En desktop también permite
// zoom con doble click y arrastrar con el mouse cuando está ampliado.
export default function ImageLightbox({ imagenes, indiceInicial, alt, onClose }: Props) {
  const [indice, setIndice] = useState(indiceInicial)
  const [escala, setEscala] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const estado = useRef({
    distanciaInicial: 0,
    escalaInicial: 1,
    arrastrando: false,
    ultimoPunto: { x: 0, y: 0 },
    ultimoTap: 0,
  })

  function resetZoom() {
    setEscala(1)
    setOffset({ x: 0, y: 0 })
  }

  function irA(nuevoIndice: number) {
    resetZoom()
    setIndice(nuevoIndice)
  }

  function alternarZoomEn(clientX: number, clientY: number, target: HTMLElement) {
    if (escala > 1) {
      resetZoom()
      return
    }
    const rect = target.getBoundingClientRect()
    const px = (clientX - rect.left - rect.width / 2)
    const py = (clientY - rect.top - rect.height / 2)
    setEscala(ZOOM_DOBLE_TAP)
    setOffset({ x: -px * (ZOOM_DOBLE_TAP - 1) / ZOOM_DOBLE_TAP, y: -py * (ZOOM_DOBLE_TAP - 1) / ZOOM_DOBLE_TAP })
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2) {
      estado.current.distanciaInicial = distanciaEntreToques(e.touches)
      estado.current.escalaInicial = escala
    } else if (e.touches.length === 1) {
      const ahora = Date.now()
      if (ahora - estado.current.ultimoTap < 300) {
        alternarZoomEn(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget)
      }
      estado.current.ultimoTap = ahora
      estado.current.arrastrando = escala > 1
      estado.current.ultimoPunto = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2) {
      e.preventDefault()
      const nuevaDistancia = distanciaEntreToques(e.touches)
      const factor = nuevaDistancia / (estado.current.distanciaInicial || nuevaDistancia)
      const nuevaEscala = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, estado.current.escalaInicial * factor))
      setEscala(nuevaEscala)
    } else if (e.touches.length === 1 && estado.current.arrastrando && escala > 1) {
      e.preventDefault()
      const dx = e.touches[0].clientX - estado.current.ultimoPunto.x
      const dy = e.touches[0].clientY - estado.current.ultimoPunto.y
      estado.current.ultimoPunto = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
    }
  }

  function onTouchEnd() {
    estado.current.arrastrando = false
    if (escala < 1.05) resetZoom()
  }

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (escala <= 1) return
    estado.current.arrastrando = true
    estado.current.ultimoPunto = { x: e.clientX, y: e.clientY }
  }
  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!estado.current.arrastrando) return
    const dx = e.clientX - estado.current.ultimoPunto.x
    const dy = e.clientY - estado.current.ultimoPunto.y
    estado.current.ultimoPunto = { x: e.clientX, y: e.clientY }
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
  }
  function onMouseUp() {
    estado.current.arrastrando = false
  }

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center select-none"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 rounded-full p-2 z-10"
        style={{ minWidth: 44, minHeight: 44 }}
        aria-label="Cerrar"
      >
        <X size={22} />
      </button>

      {imagenes.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); irA((indice - 1 + imagenes.length) % imagenes.length) }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 rounded-full p-2 z-10"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="Anterior"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); irA((indice + 1) % imagenes.length) }}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-white/10 rounded-full p-2 z-10"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="Siguiente"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      <div
        className="w-full h-full flex items-center justify-center overflow-hidden touch-none"
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDoubleClick={e => alternarZoomEn(e.clientX, e.clientY, e.currentTarget)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagenes[indice]}
          alt={alt}
          draggable={false}
          className="max-w-[92vw] max-h-[85vh] object-contain"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${escala})`,
            transition: estado.current.arrastrando ? 'none' : 'transform 0.15s ease-out',
            cursor: escala > 1 ? 'grab' : 'zoom-in',
          }}
        />
      </div>

      {imagenes.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
          {imagenes.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); irA(i) }}
              className="w-2 h-2 rounded-full"
              style={{ background: i === indice ? '#fff' : 'rgba(255,255,255,0.35)' }}
              aria-label={`Imagen ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
