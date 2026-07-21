import path from 'path'

const ONEDRIVE = process.env.ONEDRIVE_LOCAL_PATH ||
  'C:/Users/Jeronimo/OneDrive/EUROPARTNERS/CHINA/THANSHAN/JAMAICA'

export const CLIENTES_CONFIG = {
  designer: {
    nombre: 'Designer Solution',
    slug: 'designer',
    dir: path.join(ONEDRIVE, 'DESIGNER SOLUTION/PROFORMAS'),
    incoterm: 'FOB',
    modo_pricing: 'set',
  },
  er: {
    nombre: 'E&R Hardware',
    slug: 'er',
    dir: path.join(ONEDRIVE, 'E&R HARDWARE/PROFORMA'),
    incoterm: 'FOB',
    modo_pricing: 'set',
  },
  hl: {
    nombre: 'Hardware & Lumber',
    slug: 'hl',
    dir: path.join(ONEDRIVE, 'HARDWARE AND LUMBER/PROFORMAS'),
    incoterm: 'CIF',
    modo_pricing: 'componente',
  },
  hjb: {
    nombre: 'HJB Jamaica',
    slug: 'hjb',
    dir: path.join(ONEDRIVE, 'HJB/PROFORMA'),
    incoterm: 'CFR',
    modo_pricing: 'set',
  },
  prohardware: {
    nombre: 'Pro Hardware',
    slug: 'prohardware',
    dir: path.join(ONEDRIVE, 'PRO HARDWARE/PROFORMAS'),
    incoterm: 'FOB',
    modo_pricing: 'set',
  },
}

// Regex para detectar número de proforma en nombre de carpeta o archivo
export const PROFORMA_NUM_REGEX = /3-(\d{3,4})/

// Patterns de archivos PI (costo China)
export const PI_FILE_PATTERNS = [
  /^PI\s+FOR/i,
  /^PI\s+EMILY/i,
  /^PROFORMA\s+INVOICE.*EMILY/i,
  /price.*comparison/i,
  /verificar\s+precios/i,
]

// Patterns de archivos Proforma (precio cliente)
export const PROFORMA_FILE_PATTERNS = [
  /^PROFORMA\s+3-\d{3,4}/i,
  /^3-\d{3,4}\s+PROFORMA/i,
]
