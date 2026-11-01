# Banca La Placeta

Banca online de La Placeta sobre la **API v1 de Banca Placeta** (`https://placetaone.vercel.app/api/v1`), con acceso mediante **PlacetaID**. Next.js 14 (App Router), sin base de datos.

## Qué incluye

| Sección | Endpoint(s) de la API | Permiso |
|---|---|---|
| Inicio: saldo total, tarjetas de cuenta, gráfico 14 días, aviso de membresía | `GET /accounts/{iban}`, `/transactions`, `/membership` | `accounts:read`, `transactions:read`, `memberships:read` |
| Movimientos: búsqueda, filtros, periodo, exportar CSV | `GET /accounts/{iban}/transactions` | `transactions:read` |
| Transferencias: revisar → confirmar → seguimiento de estado | `POST /transfers`, `GET /transfers/{ref}` | `transfers:write`, `transfers:read` |
| Tarjetas | `GET /accounts/{iban}/cards` | `cards:read` |
| Recibos fiscales (imprimibles) | `GET /accounts/{iban}/receipts` | `receipts:read` |
| Membresía Junior: estado y renovación | `GET …/membership`, `POST …/membership/renew` | `memberships:read`, `memberships:write` |
| Productos y apertura de cuenta | `GET /products`, `POST /accounts` | `products:read`, `accounts:write` |

La clave de API debe tener **los 10 permisos** de la tabla. Se crea en *Bancos → Gestionar → Claves de API → «+ Nuevo»* y se muestra una sola vez.

Además: modo oscuro, modo privacidad (ocultar saldos), diseño móvil con barra inferior, destinatarios guardados y atajo para volver a consultar una transferencia.

## App instalable (PWA)

En el móvil se comporta como una app: se abre a pantalla completa, con icono propio y sin barra del navegador.

- **Android / Chrome:** aparece el aviso «Instala la app» (o menú ⋮ → *Instalar aplicación*).
- **iPhone / Safari:** Compartir → *Añadir a pantalla de inicio*.
- Incluye barra de navegación inferior, deslizar hacia abajo para actualizar, respeto del notch y la barra inferior, aviso sin conexión y pantalla `offline.html`.
- El service worker (`public/sw.js`) **solo guarda recursos estáticos**; nunca guarda `/api/*` ni páginas con datos bancarios. Solo se registra en producción.
- Requiere HTTPS (Vercel ya lo da). Tras desplegar, vuelve a «Añadir a pantalla de inicio» si ya la tenías instalada para coger el icono nuevo.

## Seguridad (cómo está pensado)

- **La clave `x-api-key` nunca llega al navegador.** Todo pasa por `/api/bank/*`, un proxy con **lista blanca** de endpoints (`lib/routes.js`).
- **Propiedad de cuentas.** El servidor solo opera sobre los IBAN que el usuario ha vinculado (cookie firmada con HMAC, atada a su PlacetaID). Una cuenta ajena → `403`. Las transferencias consultadas por referencia solo se devuelven si afectan a una cuenta propia.
- **Idempotencia real.** El navegador genera la `Idempotency-Key` y el proxy **la reenvía tal cual**: si se corta la red y se reintenta, el banco no duplica el pago. Si el banco rechaza la operación (422…), se genera una clave nueva para el siguiente intento.
- **Cuerpos saneados** (solo `from_iban`, `to_iban`, `amount` con ≤ 2 decimales, `memo`), segmentos de ruta validados, comprobación de origen anti-CSRF, límite de peticiones por usuario y cabeceras de seguridad/CSP.
- **Códigos del banco**: `401` de la clave se muestra como error de servidor (no cierra tu sesión); `429` respeta `Retry-After` y las lecturas se reintentan solas.
- `SESSION_SECRET` es obligatorio en producción (la app se niega a firmar sin él).

> **Limitación conocida:** PlacetaID identifica a la persona, pero la API no relaciona personas con cuentas. Por defecto, cualquier usuario que conozca un IBAN de la entidad puede vincularlo. Si la API devuelve el titular de la cuenta (`holder_name`, `holder`, `owner_name` u `owner`), activa `STRICT_HOLDER=1` para exigir que coincida con el nombre de PlacetaID.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # rellena los valores
npm run dev
```

Variables (en Vercel → Settings → Environment Variables): `PLACETA_API_KEY`, `PLACETAID_CLIENT_ID`, `PLACETAID_CLIENT_SECRET`, `SESSION_SECRET`, `APP_URL`. Opcionales: `PLACETA_API_URL`, `STRICT_HOLDER`, `DEV_LOGIN`.

### Probar sin tocar el banco real

```bash
npm run mock        # simulador de la API en :4010 (clave plk_demo)
npm run dev:mock    # app con DEV_LOGIN=1 apuntando al simulador
npm run smoke       # 29 comprobaciones: seguridad, propiedad e idempotencia
```

El simulador incluye transferencias `pending` (≥ 500 €, se completan a los 4 s) y límite de 120 peticiones/min para provocar el `429`.

## Estructura

```
app/api/bank/[...path]/  proxy seguro hacia la API v1
app/api/me/              cuentas vinculadas (comprobadas contra el banco)
app/api/auth/*, placetaid/  login con PlacetaID, logout
app/Dashboard.js         contenedor: navegación, estado, modales
app/components/          Inicio, Movimientos, Transferencias, Tarjetas, Recibos, Membresía, Productos
lib/                     session, upstream, routes, validate, ratelimit, client, shape
scripts/                 mock-api.mjs, smoke.mjs
```
