# Banca La Placeta

Banca online de La Placeta sobre la **API v1 de Placeta One** (`https://placetaone.vercel.app/openapi.json`), con acceso mediante **PlacetaID**. Next.js 14 (App Router), sin base de datos.

## Cómo funciona (modelo de la API v1)

1. El cliente entra con **PlacetaID**. El perfil trae su **DIP**.
2. El servidor llama a `POST /sessions` con la **clave `plk_…` + firma HMAC** y recibe un token `pus_…` (dura minutos).
3. El token se guarda **cifrado (AES-256-GCM) en una cookie httpOnly**: el navegador nunca lo ve.
4. Todo lo demás son llamadas `/me/*` con ese token a través del proxy `/api/bank/*`. **Es el banco quien decide qué cuentas son del cliente**; ya no hay que «vincular» IBAN.
5. Al caducar el token, la app vuelve a entrar con PlacetaID de forma transparente (con freno anti-bucle).

## Qué incluye

| Pantalla | Endpoints | Permiso de sesión |
|---|---|---|
| Inicio: saldo total, cuentas, ficha (saldo/disponible/reservado/límite), gráfico 14 días, próximos movimientos, avisos | `GET /me/accounts`, `/me/accounts/{iban}`, `…/transactions`, `/me/previsiones` | `me:read` |
| Movimientos (paginación por cursor), **Extracto** (saldo inicial/final, imprimir, CSV), **Previsiones** | `…/transactions`, `…/statement`, `/me/previsiones` | `me:read` |
| Transferencias: comprobar IBAN, enviar, **programar (única/periódica)**, cancelar, **destinatarios** | `/me/lookup`, `POST /me/transfers`, `/me/transfers/scheduled[/{id}]`, `/me/beneficiaries[/{id}]` | `me:read`, `me:transfer` |
| Tarjetas: ver, **suspender/reactivar**, aplicar diseño. **Tienda de diseños**: catálogo, comprar, mis diseños | `…/cards`, `POST /me/cards/{ref}`, `/me/cards/{ref}/diseno`, `/me/designs`, `/me/designs/comprados`, `/me/designs/{codigo}/buy` | `me:read`, `me:seguridad`, `me:transfer` |
| Recibos fiscales + **certificado de cálculo** | `…/receipts`, `/me/receipts/{ref}/certificate` | `me:read` |
| Planes y ayudas: planes/suscripciones, **bonos RBU** (reclamar), **solicitudes** de préstamo o cuenta | `/me/plans`, `/me/rbu`, `/me/rbu/{id}/claim`, `/me/requests` | `me:read`, `me:transfer`, `me:contratar` |
| Avisos (ingresos y cargos, marcar leídos) | `/me/notifications`, `/me/notifications/read` | `me:read` |
| Seguridad: entidad y permisos, sesiones abiertas, cerrar las demás | `/me`, `/me/sessions` | `me:read`, `me:seguridad` |
| Abrir cuenta personal propia (máx. 3) | `POST /me/accounts` | `me:contratar` |

Además: modo oscuro, modo privacidad, diseño móvil con barra inferior y PWA instalable.

### Lo que NO se expone al navegador (a propósito)

Los endpoints `/bk/*` y los de clave de servidor (`link-account`, `personas`, `checkouts`, `tarjetas/cargos`, `nominas`, `planes`, `origenes`, `transfers` entre cuentas de la entidad, `accounts/{iban}/membership`…) son operaciones **del banco/comercio**, no del cliente. Exponerlos desde una web de clientes permitiría mover dinero de cualquiera. El proxy tiene lista blanca y solo reenvía `/me/*`.

## Seguridad

- **La clave `plk_…` y el secreto HMAC solo se usan en el servidor** y solo para `POST /sessions`.
- Lista blanca de rutas (`lib/routes.js`), cuerpos saneados campo a campo (`lib/body.js`), segmentos de ruta validados, anti-CSRF por origen, límite de peticiones por usuario y CSP.
- **Idempotencia real**: el navegador genera la `Idempotency-Key` y el proxy la reenvía tal cual; reintentar nunca duplica un pago, una compra o un bono. Tras un rechazo definitivo (4xx) se genera una clave nueva.
- Si el banco responde `401` (token caducado/revocado) se borra la sesión y se vuelve a entrar; `429` respeta `Retry-After`.
- `SESSION_SECRET` obligatorio en producción.

## ⚠️ Dos cosas que debes confirmar con tu entidad

1. **Formato de la firma HMAC.** El OpenAPI solo dice «requiere además firma HMAC». Por defecto se firma `{ts}.{método}.{ruta}.{cuerpo}` con HMAC-SHA256 en hex y se envía en `x-timestamp` / `x-signature`. Si tu entidad usa otro formato, cámbialo **solo con variables de entorno** (ver `.env.example`; la lógica está en `lib/sign.js`). Si recibes `401 Firma no válida` al entrar, es esto.
2. **De dónde sale el DIP.** Se lee del perfil de PlacetaID (`dip`, `dni`, `nif`, `document`…). Si tu PlacetaID lo devuelve con otro nombre, pon `PLACETAID_DIP_FIELD`.

> Los nombres de campos de movimientos, recibos, avisos, bonos, planes y solicitudes no vienen en el OpenAPI (solo `[]`). La app los lee de forma tolerante (`lib/shape.js`) y muestra el resto en un detalle genérico; si algún campo no sale donde esperas, es una línea en `shape.js`.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # rellena los valores
npm run dev
```

### Probar sin tocar el banco real

```bash
npm run mock        # simulador de la API en :4010 (clave plk_demo, secreto demo_secret, DIP 12345678Z)
npm run dev:mock    # app con DEV_LOGIN=1 apuntando al simulador
npm run smoke       # ~65 comprobaciones: sesión firmada, lista blanca, permisos, idempotencia…
```

## Estructura

```
app/api/bank/[...path]/   proxy seguro → /api/v1/me/*  (GET, POST, DELETE)
app/api/auth/*, placetaid/ login con PlacetaID → sesión Placeta; logout revoca el token
app/Dashboard.js          contenedor: navegación, cuentas, permisos, modales
app/components/           Inicio, Movimientos, Transferencias, Tarjetas, Recibos, Planes, Avisos, Seguridad
lib/                      sign (HMAC), upstream, session (AES-GCM), login, routes, body, validate, shape, client
scripts/                  mock-api.mjs, smoke.mjs
```
