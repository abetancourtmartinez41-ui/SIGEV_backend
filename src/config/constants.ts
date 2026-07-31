export const FEE_RATE_DEFAULT = 0.0825;

export const DOCUMENT_TYPES = ['CC', 'NIT', 'CE', 'PASSPORT'] as const;

export const EVENT_STATUS = {
  OPEN: 'Abierto',
  IN_EXECUTION: 'En ejecución',
  CLOSED: 'Cerrado',
  LEGALIZED: 'Legalizado',
} as const;

export const MUNICIPALITY_CATEGORIES = [
  'Especial',
  'Primera',
  'Segunda',
  'Tercera',
  'Cuarta',
  'Quinta',
  'Sexta',
] as const;

export const REQUIRED_ATTACHMENTS_COUNT = 7;

export const COLOMBIA_CURRENCY = {
  locale: 'es-CO',
  currency: 'COP',
  timeZone: 'America/Bogota',
};
