export const FEE_RATE_DEFAULT = 0.0825;

export const CLIENTE_OFERTA_DEFAULT = 'Dirección de sustitución de cultivos ilícitos';

export const DOCUMENT_TYPES = ['CC', 'NIT', 'CE', 'PASSPORT'] as const;

export const ROLES = {
  TECHNICAL_ADMIN: 'technical_admin',
  FUNCTIONAL_ADMIN: 'functional_admin',
  APPROVER: 'approver',
  OPERATOR: 'operator',
  SOLICITANTE: 'solicitante',
  ANALISTA: 'analista',
  SUPERVISOR: 'supervisor',
  AUDITOR: 'auditor',
  CONSULTA: 'consulta',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  technical_admin: 'Administrador Técnico',
  functional_admin: 'Administrador Funcional',
  approver: 'Aprobador',
  operator: 'Operador',
  solicitante: 'Solicitante',
  analista: 'Analista',
  supervisor: 'Supervisor',
  auditor: 'Auditor',
  consulta: 'Consulta',
};

export const EVENT_STATUS = {
  ABIERTO: 'Abierto',
  EN_EJECUCION: 'En ejecución',
  EJECUTADO: 'Ejecutado',
  CERRADO: 'Cerrado',
  LEGALIZADO: 'Legalizado',
  DEVUELTO: 'Devuelto',
  RECHAZADO: 'Rechazado',
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

export const TARIFF_TYPES = {
  TARIFADO: 'TARIFADO',
  NO_TARIFADO: 'NO_TARIFADO',
} as const;

export const TARIFF_PRICE_GROUPS = {
  ESPECIAL_PRIMERA: 'ESPECIAL_PRIMERA',
  SEGUNDA_CUARTA: 'SEGUNDA_CUARTA',
  QUINTA_SEXTA: 'QUINTA_SEXTA',
} as const;

export const TARIFF_PRICE_COLUMNS = {
  ESPECIAL_PRIMERA: 'priceEspecialPrimera',
  SEGUNDA_CUARTA: 'priceSegundaCuarta',
  QUINTA_SEXTA: 'priceQuintaSexta',
} as const;

export const MUNICIPALITY_CATEGORY_TO_TARIFF_GROUP: Record<string, string> = {
  Especial: TARIFF_PRICE_GROUPS.ESPECIAL_PRIMERA,
  Primera: TARIFF_PRICE_GROUPS.ESPECIAL_PRIMERA,
  Segunda: TARIFF_PRICE_GROUPS.SEGUNDA_CUARTA,
  Tercera: TARIFF_PRICE_GROUPS.SEGUNDA_CUARTA,
  Cuarta: TARIFF_PRICE_GROUPS.SEGUNDA_CUARTA,
  Quinta: TARIFF_PRICE_GROUPS.QUINTA_SEXTA,
  Sexta: TARIFF_PRICE_GROUPS.QUINTA_SEXTA,
};

export const DEFAULT_VIGENCY_YEAR = 2026;

export const COLOMBIA_CURRENCY = {
  locale: 'es-CO',
  currency: 'COP',
  timeZone: 'America/Bogota',
};
