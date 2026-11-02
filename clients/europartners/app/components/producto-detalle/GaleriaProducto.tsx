'use client'
import { useState } from 'react'
import { Package, ZoomIn } from 'lucide-react'
import InnerImageZoom from 'react-inner-image-zoom'
import 'react-inner-image-zoom/lib/styles.min.css'
import ImageLightbox from './ImageLightbox'

interface Props {
  // Ya deduplicada (imagen_url + imagenes_urls), [] si no hay ninguna.
  imagenes: string[]
  nombre: string
  // Solo el interno pide decir explícitamente que falta la foto — al
  // público nunca se le dice que algo falta (spec ui-ux-designer).
  placeholderTexto?: string
}

// Clases/estilos del "stage" (fondo, borde, sombra, radio por breakpoint) —
// se reusan igual en el estado con imagen y en el vacío, para que el layout
// no salte entre carga y resultado. Fondo blanco/neutro (no lila sólido):
// Jerónimo lo rechazó explícitamente como superficie grande — las
// referencias que mandó (Amazon, Homecenter, Carbone Store) usan blanco o
// gris clarísimo alrededor de la imagen de producto, nunca un color saturado.
const STAGE_BASE = 'rounded-[20px] md:rounded-3xl overflow-hidden'
const STAGE_ESTILO: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-sm)',
}

// Galería con hover-magnify tipo Amazon en desktop (≥1024px, mouse real) y
// swipe + dots en móvil. El zoom manual a pulso (dos rondas previas, nunca
// funcionó bien — breakpoints desalineados primero, sin zoom real después)
// se reemplaza por react-inner-image-zoom: a diferencia de react-image-magnify
// (la librería que se pidió originalmente) esta no exige conocer ancho/alto
// de la imagen de antemano -- los mide del <img> ya cargado en el navegador,
// algo clave porque las fotos de producto son de Supabase Storage y nunca
// sabemos su tamaño real de antemano -- y su peerDependency de React no tiene
// techo (react-image-magnify, react-magnifier y react-image-magnifiers
// quedan todos topados en React ^16, no sirven en este stack de React 18).
// Tap/click en la imagen principal abre el lightbox fullscreen con
// pinch-zoom real (ImageLightbox, sin librería) en cualquier tamaño de
// pantalla -- eso ya funcionaba bien y no se tocó.
export default function GaleriaProducto({ imagenes, nombre, placeholderTexto }: Props) {
  const [activa, setActiva] = useState(0)
  const [lightboxAbierto, setLightboxAbierto] = useState(false)

  if (imagenes.length === 0) {
    return (
      <div
        className={`${STAGE_BASE} flex flex-col items-center justify-center gap-2 h-80 md:h-[400px] lg:h-[440px]`}
        style={STAGE_ESTILO}
      >
        <Package size={56} className="text-text-subtle" />
        {placeholderTexto && (
          <p className="text-sm" style={{ color: 'var(--ep-muted)' }}>{placeholderTexto}</p>
        )}
      </div>
    )
  }

  const multiple = imagenes.length > 1

  return (
    <div>
      <div className="flex gap-3">
        {/* Riel de miniaturas — solo si hay más de 1 imagen */}
        {multiple && (
          <div className="hidden md:flex flex-col gap-2.5 w-20 flex-shrink-0">
            {imagenes.map((url, i) => (
              <button
                key={url + i}
                onClick={() => setActiva(i)}
                className={`ep-thumb w-[72px] h-[72px] rounded-lg overflow-hidden flex-shrink-0 transition-colors ${activa === i ? 'ep-thumb--activa' : ''}`}
                aria-label={`Imagen ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-contain p-1.5" />
              </button>
            ))}
          </div>
        )}

        {/* Imagen principal — desktop/tablet, con hover-magnify (solo mouse real ≥1024px, ver media query de .iiz en globals.css si se necesitara acotar más) */}
        <div
          className={`${STAGE_BASE} group relative hidden md:block flex-1 h-[400px] lg:h-[440px]`}
          style={STAGE_ESTILO}
        >
          {/* Padding propio (antes vivía en el <img object-contain>) — el
              stage completo queda disponible para que InnerImageZoom mida su
              "bounds" real contra esta caja, ver reglas .ep-galeria-zoom en
              globals.css que fuerzan al figure/img de la librería a llenarla.
              Reducido de p-9/p-10 a p-4/p-5 (feedback Jerónimo 2026-10-26: la
              foto se veía chica dentro del recuadro) -- la imagen debe
              ocupar la mayor parte posible del espacio disponible. */}
          <div className="absolute inset-0 p-4 lg:p-5">
            <InnerImageZoom
              src={imagenes[activa]}
              zoomType="hover"
              moveType="pan"
              hideHint
              className="ep-galeria-zoom"
            />
          </div>

          {/* Badge de conteo e ícono de zoom -- overlay sobre la foto, no son
              la acción primaria de la pantalla: usan bg-brand (ultramar),
              el mismo rol que la cabecera de ficha técnica. */}
          {multiple && (
            <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[12px] font-bold text-white pointer-events-none bg-bg-brand">
              {activa + 1}/{imagenes.length}
            </span>
          )}

          {/* Afordancia de zoom — ahora es un botón real que abre el
              lightbox fullscreen, independiente del hover-magnify de arriba
              (antes era un <span> decorativo que no hacía nada por sí solo). */}
          <button
            type="button"
            onClick={() => setLightboxAbierto(true)}
            aria-label="Ver imagen completa"
            className="absolute bottom-4 right-4 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-bg-brand"
          >
            <ZoomIn size={16} className="text-white" />
          </button>
        </div>

        {/* Imagen principal — móvil: swipe horizontal + dots (sin cambios:
            tap abre el lightbox, que ya tiene pinch-zoom real con los dos
            dedos — ver ImageLightbox.tsx) */}
        <div className="md:hidden w-full relative">
          <div
            className={`${STAGE_BASE} flex overflow-x-auto snap-x snap-mandatory h-80`}
            style={STAGE_ESTILO}
            onScroll={e => {
              const el = e.currentTarget
              const i = Math.round(el.scrollLeft / el.clientWidth)
              if (i !== activa) setActiva(i)
            }}
          >
            {imagenes.map((url, i) => (
              <div
                key={url + i}
                className="snap-center flex-shrink-0 w-full h-full flex items-center justify-center cursor-zoom-in"
                onClick={() => setLightboxAbierto(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={nombre} className="w-full h-full object-contain p-5" />
              </div>
            ))}
          </div>

          {multiple && (
            <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[12px] font-bold text-white bg-bg-brand">
              {activa + 1}/{imagenes.length}
            </span>
          )}

          {/* En móvil la afordancia de zoom se muestra siempre — no hay hover */}
          <span className="absolute bottom-4 right-4 w-7 h-7 rounded-full flex items-center justify-center bg-bg-brand">
            <ZoomIn size={16} className="text-white" />
          </span>

          {/* Dots de posición -- "toggle" de selección entre imágenes: cuarzo
              (bg-accent) para el activo, el token de borde para el resto. */}
          {multiple && (
            <div className="flex justify-center gap-1.5 mt-2">
              {imagenes.map((_, i) => (
                <span
                  key={i}
                  className={`rounded-full transition-all ${i === activa ? 'bg-bg-accent' : 'bg-border'}`}
                  style={{ width: i === activa ? 20 : 6, height: 6 }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {lightboxAbierto && (
        <ImageLightbox
          imagenes={imagenes}
          indiceInicial={activa}
          alt={nombre}
          onClose={() => setLightboxAbierto(false)}
        />
      )}
    </div>
  )
}
