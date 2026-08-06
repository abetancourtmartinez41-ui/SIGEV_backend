-- Garantizar los roles RBAC y la asignación de technical_admin al usuario Administrador.
-- Permite que un reset o una base nueva quede con permisos completos sin depender del seed
-- (que solo se ejecuta al arrancar la aplicación).

-- 1) Crear los roles si no existen (idempotente).
INSERT INTO "roles" ("id", "name", "description", "createdAt")
SELECT gen_random_uuid(), r.name, r.description, NOW()
FROM (VALUES
  ('technical_admin',   'Administrador Técnico'),
  ('functional_admin',  'Administrador Funcional'),
  ('approver',          'Aprobador'),
  ('operator',          'Operador'),
  ('solicitante',       'Solicitante'),
  ('analista',          'Analista'),
  ('supervisor',        'Supervisor'),
  ('auditor',           'Auditor'),
  ('consulta',          'Consulta')
) AS r(name, description)
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "roles"."name" = r.name);

-- 2) Asignar technical_admin al usuario Administrador (document único).
INSERT INTO "_RoleToUser" ("A", "B")
SELECT ro.id, u.id
FROM "roles" ro
JOIN "users" u ON u."document" = 'Administrador'
WHERE ro."name" = 'technical_admin'
ON CONFLICT DO NOTHING;
