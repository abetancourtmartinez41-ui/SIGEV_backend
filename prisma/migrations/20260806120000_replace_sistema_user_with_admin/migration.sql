-- Reemplazar el usuario placeholder "Sistema" por el "Administrador" por defecto
-- (responsable de la gestión de usuarios) y eliminar el usuario sistema sin contraseña.

-- 1) Asegurar que exista el usuario Administrador (document único).
--    En bases nuevas aún no hay usuarios reales; en bases existentes ya lo creó el seed.
INSERT INTO "users" ("id","document","fullName","email","password","isActive","createdAt","updatedAt")
VALUES ('00000000-0000-0000-0000-000000000002', 'Administrador', 'Administrador Técnico', 'admin@sigev.com', '$2b$10$657YaHDCyvNnVxnUJsb2ueZXKD4pvtufDK1ZLeRb2igK2jQY.1QWi', true, NOW(), NOW())
ON CONFLICT ("document") DO UPDATE SET
  "fullName" = EXCLUDED."fullName",
  "email" = EXCLUDED."email",
  "password" = EXCLUDED."password",
  "isActive" = true;

-- 2) Reasignar al Administrador las versiones de parámetros creadas por "Sistema".
--    Se resuelve el id por documento porque en una base existente conserva su id real.
UPDATE "parameter_versions" AS pv
SET "createdById" = admin.id,
    "aprobadoPor" = admin."fullName"
FROM "users" AS admin
WHERE admin."document" = 'Administrador'
  AND pv."createdById" = '00000000-0000-0000-0000-000000000001';

-- 3) Eliminar el usuario "Sistema" (ya no queda ninguna referencia a él).
DELETE FROM "users" WHERE "id" = '00000000-0000-0000-0000-000000000001';
