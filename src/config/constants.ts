export const FEE_RATE_DEFAULT = 0.0825;

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
  POSTULADO: 'Postulado',
  EN_PREPARACION: 'En preparación',
  EN_REVISION: 'En revisión',
  DEVUELTO: 'Devuelto',
  EN_EJECUCION: 'En ejecución',
  CERRADO: 'Cerrado',
  LEGALIZADO: 'Legalizado',
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

export const REQUIRED_QUOTATIONS_COUNT = 4;

export const COLOMBIA_CURRENCY = {
  locale: 'es-CO',
  currency: 'COP',
  timeZone: 'America/Bogota',
};
