/**
 * Colores del sistema de diseño de Marta (oct-2026) como hex planos.
 *
 * @react-pdf/renderer no puede leer variables CSS (no hay DOM ni cascada),
 * así que los templates de PDF (lib/pdf/templates/*, lote aparte) deben
 * importar de aquí en vez de tener hex hardcodeado disperso por archivo.
 *
 * Mantener en sync con docs/design-system/tokens.json y app/app/tokens.css
 * -- si Marta cambia un valor, se actualizan los tres.
 */

// ---- Paleta base ----
export const ULTRAMAR = '#162373'
export const ULTRAMAR_INK = '#000E67'
export const INDIGO = '#5A57D8'
export const INDIGO_DEEP = '#3F41B6'
export const CUARZO = '#D2CFF7'
export const CUARZO_SOFT = '#ECEBFC'
export const MARMOL = '#F8F8F8'
export const GRIS_MANUAL = '#E8E8E8'

export const NEUTRAL_0 = '#FFFFFF'
export const NEUTRAL_100 = '#F0F0F4'
export const NEUTRAL_200 = '#E4E4EC'
export const NEUTRAL_300 = '#CFD0DC'
export const NEUTRAL_400 = '#8F92A8'
export const NEUTRAL_500 = '#6E7189'
export const NEUTRAL_600 = '#555872'
export const NEUTRAL_900 = '#151729'

export const NOCHE_900 = '#0B0F2E'
export const NOCHE_800 = '#141A45'
export const NOCHE_700 = '#1C2357'
export const NOCHE_600 = '#262B6E'

export const INDIGO_LIGHT = '#8B88E6'
export const INDIGO_PALE = '#AEACF3'

// ---- Semánticos (tema claro -- los PDFs no tienen modo oscuro) ----
export const BG_PAGE = MARMOL
export const BG_SURFACE = NEUTRAL_0
export const BG_SUBTLE = NEUTRAL_100
export const BG_BRAND = ULTRAMAR
export const BG_ACCENT = CUARZO
export const BG_SELECTED = CUARZO_SOFT

export const TEXT = NEUTRAL_900
export const TEXT_HEADING = ULTRAMAR
export const TEXT_MUTED = NEUTRAL_600
export const TEXT_SUBTLE = NEUTRAL_500
export const TEXT_LINK = INDIGO_DEEP
export const TEXT_ON_BRAND = '#FFFFFF'
export const TEXT_ON_ACCENT = ULTRAMAR

export const BORDER = NEUTRAL_200
export const BORDER_STRONG = NEUTRAL_300
export const BORDER_CONTROL = NEUTRAL_400

export const ACTION_PRIMARY = INDIGO
export const ACTION_PRIMARY_HOVER = INDIGO_DEEP
export const ON_ACTION_PRIMARY = '#FFFFFF'

// Estados -- mismo par que reemplaza los 8 colores ad-hoc de la tabla de
// proformas (ese reemplazo específico es trabajo de otro lote, no de este).
export const SUCCESS = '#17663F'
export const SUCCESS_BG = '#E3F4EA'
export const WARNING = '#7A4F00'
export const WARNING_BG = '#FDF0D5'
export const DANGER = '#B42318'
export const DANGER_BG = '#FDE8E6'
export const ON_DANGER = '#FFFFFF'
export const INFO = INDIGO_DEEP
export const INFO_BG = CUARZO_SOFT
