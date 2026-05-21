# PymeBoost Backend (MVP)

API REST simple con SQLite y datos demo. Sin autenticación.

## Arrancar en local

```bash
cd backend
npm install
npm run dev
```

Abre **http://localhost:5000** — el servidor sirve el frontend HTML y la API en `/api`.

## Datos demo (seed v2)

- **8 PYMEs**, **8 asesores**, **13 postulaciones**, **9 contratos**, **7 conversaciones** con historial
- PYME demo: **Retail Fashion MX** (id 1) — 3 postulaciones, 2 contratos activos/pendientes, 2 chats
- Asesor demo: **María González** (id 1)

Al reiniciar el backend se actualiza el seed si cambió la versión. Forzar recarga: `POST /api/dev/reset` o borrar `backend/data/pymeboost.sqlite`.

La sesión se guarda en `localStorage` (`pymeboost_role`, `pymeboost_user_id`).

## Endpoints principales

- `POST /api/pymes` — registro PYME
- `POST /api/advisors` — registro asesor
- `GET /api/pymes/:id/dashboard` — dashboard PYME
- `GET /api/advisors/:id/dashboard` — dashboard asesor
- `GET /api/pymes/:id/advisors` — listado con match %
- `POST /api/applications` — asesor aplica
- `PATCH /api/applications/:id` — aceptar/rechazar
- `GET /api/contracts?role=pyme&userId=1` — contratos
- `POST /api/contracts/:id/sign` — firmar
- `GET /api/conversations?role=pyme&userId=1` — mensajes
- `POST /api/dev/reset` — reiniciar BD demo

## Matching

40% especialización + 30% industria + 15% ubicación + 15% tamaño empresa.
