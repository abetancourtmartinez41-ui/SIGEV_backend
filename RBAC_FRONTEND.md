# SIGEV — Guía de comportamiento del frontend (RBAC + flujo de eventos)

## 1. Roles (9 perfiles)

| Rol | `name` en API | Qué puede hacer en el frontend |
|---|---|---|
| Administrador Técnico | `technical_admin` | Módulo Usuarios completo (CRUD + asignación de roles). Monitoreo. **No** gestiona aliados/recursos disponibles/tasas. |
| Administrador Funcional | `functional_admin` | Aliados, Recursos disponibles, Parámetros (Tasas/FEE), creación/edición de Eventos e Ítems, Auditoría (consulta). **No** ve usuarios. |
| Aprobador | `approver` | Aprobar/rechazar eventos, aprobar ejecución, cerrar y legalizar, autorizar excepciones (<4 cotizaciones). Auditoría (consulta). |
| Operador | `operator` | Crear/editar eventos e ítems, preparar ofertas, avanzar el flujo hasta "En revisión". |
| Solicitante | `solicitante` | Postular eventos **sin valores económicos**. Solo editar un evento devuelto (datos generales, no ítems). |
| Analista | `analista` | Ajustar eventos **solo en estado "Devuelto"** según observaciones. Consulta. |
| Supervisor | `supervisor` | Revisar consistencia, **devolver** registros, editar eventos, consultar auditoría. No legaliza. |
| Auditor | `auditor` | **Solo lectura**: eventos, ítems, catálogos, reportes y trazabilidad completa (`/audit`). |
| Consulta | `consulta` | **Solo lectura**: paneles, indicadores y reportes exportables. |

## 2. Sesión y roles

- En `POST /auth/login` el backend devuelve `accessToken` y `user` que **incluye el array `roles`** con `[{ id, name, description }]`.
- Los roles se recargan de la BD en cada petición (el token NO contiene roles embebidos). Un cambio de rol aplica de inmediato sin reloguear.
- Guardar los `name` de roles del usuario logueado y derivar toda la UI (menús, botones, secciones) a partir de ellos.

## 3. Permisos por endpoint (qué botón mostrar)

Los `GET` de lectura están abiertos a **cualquier usuario autenticado** (eventos, ítems, aliados, desembolsos, reportes, mapa, parámetros).

| Endpoint | Método | Roles permitidos |
|---|---|---|
| `/users` (todos) | POST/GET/PATCH/DELETE | `technical_admin` |
| `/events` | POST | `solicitante`, `functional_admin`, `operator` |
| `/events/:id` | PATCH | `functional_admin`, `operator`, `supervisor`, `analista`, `solicitante` |
| `/events/:id/status` | PATCH | `functional_admin`, `operator`, `supervisor`, `approver`, `analista` |
| `/events/:id` | DELETE | `functional_admin` |
| `/items` | POST/PATCH/DELETE | `functional_admin`, `operator` |
| `/allies` | POST | `functional_admin`, `solicitante`, `analista`, `supervisor` |
| `/allies` | PATCH/DELETE | `functional_admin` |
| `/disbursements` | POST/PATCH/DELETE | `functional_admin` |
| `/parameters/:key` | PATCH | `functional_admin` |
| `/audit` | GET | `functional_admin`, `supervisor`, `approver`, `auditor` |

**Regla**: mostrar el botón si el rol lo permite, pero **siempre manejar `403`** como autoridad final (el backend valida de nuevo).

## 4. Flujo de estados del evento

Estados: `Postulado` → `En preparación` → `En revisión` → `En ejecución` → `Cerrado` → `Legalizado` (terminales: `Devuelto`, `Rechazado`).

Botones que el frontend debe mostrar según estado + rol:

| Transición | Roles que pueden ejecutarla |
|---|---|
| Postulado → En preparación | `operator`, `functional_admin` |
| Postulado → Devuelto / Rechazado | Devuelto: `approver`, `supervisor` · Rechazado: `approver` |
| En preparación → En revisión | `operator`, `functional_admin` |
| En preparación → Devuelto | `approver`, `supervisor` |
| En revisión → En ejecución | `approver` (**requiere 4 cotizaciones** salvo excepción) |
| En revisión → Devuelto / Rechazado | Devuelto: `approver`, `supervisor` · Rechazado: `approver` |
| Devuelto → En preparación | `operator`, `analista`, `functional_admin` |
| Devuelto → En revisión | `operator`, `functional_admin` |
| En ejecución → Cerrado | `approver` |
| En ejecución → Devuelto | `supervisor` |
| Cerrado → Legalizado | `approver` |

### Comportamientos especiales por estado
- **`Devuelto`**: mostrar la `observation` del evento (última devolución) en un banner. Si el usuario es `analista` o `solicitante`, **solo este estado habilita la edición**; el `solicitante` no puede tocar ítems.
- **`En revisión` → aprobar (aprobador)**: mostrar el contador de cotizaciones (`attachments.length`). Si es < 4, ofrecer checkbox **"Autorizar excepción (menos de 4 cotizaciones)"** que envía `authorizeException: true`.
- **Devolución**: enviar `{ status: 'Devuelto', observation: '<texto>' }`.
- **Crear como `solicitante`**: el formulario no debe incluir ítems (el backend rechaza valores económicos con 403). Si es `operator`/`functional_admin`, puede incluir ítems.

## 5. Manejo de errores HTTP (obligatorio en el frontend)

| Código | Significado | Qué hacer |
|---|---|---|
| `401` | Token inválido/vencido o usuario inactivo | Cerrar sesión → redirigir a login. |
| `403` | `"Forbidden resource"` (guard) o mensaje de perfil | Ocultar la acción y notificar "No tiene permisos". Nunca mostrarlo como error fatal. |
| `400` | Validación, transición no permitida o faltan cotizaciones | Mostrar el `message` (el backend devuelve texto en español). |
| `404` | Recurso no existe | Mensaje "No encontrado". |

El backend responde errores en `{ statusCode, timestamp, path, message }` (y `forbidNonWhitelisted` devuelve 400 si se envían campos no contemplados en el DTO).

## 6. Recomendaciones de UX

1. **No duplicar la lógica del backend**: usar roles para *ocultar* acciones, pero confiar en la respuesta HTTP para *verificar*.
2. Crear una utilidad `can(roles: string[], ...required: string[])` y un hook/composable por rol para ocultar menús y botones.
3. Al recibir el evento, derivar los botones de acción de la tabla del punto 4 (estado + rol del usuario). Si la petición devuelve 403, quitar el botón de esa sesión.
4. En el detalle del evento mostrar: estado actual (badge), `observation` si es `Devuelto`, y el número de cotizaciones cargadas (requisito 4 para aprobar).
5. Reportes (`/reports/generate`) y panel (`consulta`): botón de exportación visible para todos los roles; `auditor`/`consulta` no verán ningún botón de modificar.
