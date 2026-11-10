# Banco de La Placeta

## Nueva interfaz (v4)

La interfaz se ha rediseñado por completo para que parezca una banca oficial en el bolsillo. El backend (sesión cifrada, proxy `/api/bank`, firma, idempotencia y lista blanca) se mantiene igual.

- **Diseño**: colores planos (azul marino corporativo, verde para ingresos, terracota para cuentas junior), sin sombras ni degradados, tipografía del sistema.
- **Móvil**: barra inferior con Inicio, Movimientos, Transferir (botón central), Tarjetas y Más.
- **Escritorio**: barra lateral con las mismas secciones.
- **Transferir**: tres pasos (destinatario con comprobación del IBAN, importe y programación, confirmación). Un reintento nunca duplica el envío.
- **Más**: recibos fiscales, avisos, seguridad (sesiones abiertas) y ajustes (tema y ocultar importes).
- **Fuera de la app de cliente**: organigrama, presupuestos, consola de entidad y pasarela de pago. Sus rutas API siguen en `app/api` por si se quieren reactivar.

Las pantallas viven en `app/bp/` (`Inicio`, `Movimientos`, `Transferir`, `Tarjetas`, `Mas`, `Detalle`) con componentes comunes en `app/bp/kit.js`. Los colores y tamaños están en `app/globals.css`, en variables `:root`.

---

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
| Abrir cuenta personal propia (máx. 3) y alta con contrato | `POST /me/accounts`, `/me/requests`, `GET /products` | `me:contratar` |

Además: modo oscuro, modo privacidad, diseño móvil con barra inferior y PWA instalable.

### Secciones y botones según el tipo de cuenta

El tipo (`personal`, `junior`, `ahorro`, `empresa`, `institucional`) se deduce de `tipo`/`nombre` de la cuenta activa (`lib/kinds.js`). Ahí mismo la entidad decide, por tipo, **qué secciones se ocultan** (`HIDE`), **qué pestañas de Planes** salen (`HIDE_PLAN_TABS`) y **qué botones rápidos** tiene Inicio (`QUICK`/`ACTIONS`). Por defecto: «Pasarela de pago» en cuentas de empresa e institucionales; la RBU no sale en empresa; los botones de una empresa incluyen Pasarela, Transferir, Extracto, Recibos y Documentos.
Si tu API usa otra palabra para empresa en `tipo`, cámbiala en la expresión `BUSINESS` de ese fichero.

### Pasarela de pago integrada en tu web

No genera enlaces de cobro para que el pagador meta su DIP: sirve para **integrar la pasarela en tu propia web** con tu marca. La pantalla *Pasarela de pago* (empresas e institucional) tiene:

- **Tu web**: pasos para dejarla lista (marca, dominios, claves, avisos, código, prueba).
- **Marca**: nombre, **logo** (subida PNG/JPG/WebP/SVG hasta 512 KB, o URL https), color y texto legal, con **vista previa** de la ventana de pago.
- **Dominios**: orígenes autorizados desde los que tu web puede abrir la pasarela (pedir / retirar).
- **Claves y avisos** (solo institucional): claves de API y webhooks.
- **Código**: plantillas Node, PHP, cURL, receptor de webhook y HTML listo para copiar (sin claves reales).
- **Pagos**: pago de prueba y seguimiento; **Tasas y reglas** (solo institucional).

Todo pasa por el servidor con clave firmada; solo titular/cotitular de la cuenta activa, y la cuenta del comercio la fija el servidor.

### Documentos

La API no tiene endpoint de documentos, así que se generan con los datos: **extractos mensuales** (últimos 12, imprimir/PDF y CSV), **recibos fiscales con certificado de cálculo** y **contratos firmados** (copia reimprimible).

### Alta con contrato

«Contratar» / «Solicitar préstamo» abre un asistente: elegir producto (catálogo `GET /products`) → datos → **contrato con los datos reales del producto y del cliente** (hay que leerlo hasta el final, marcar la aceptación y escribir el nombre completo) → envío. La «Cuenta personal estándar» se abre al instante (`POST /me/accounts`); los productos del catálogo y los préstamos se envían como **solicitud pendiente** (`POST /me/requests`) con la huella SHA-256 del contrato y la fecha de aceptación en el campo `motivo`.
⚠️ El texto de las cláusulas (`lib/contract.js`) es una **plantilla**: sustitúyela por la aprobada por la asesoría jurídica de tu entidad antes de producción. La API no recibe un campo propio para el producto en la solicitud: se incluye en `motivo`.

### Lo que NO se expone al navegador (a propósito)

`link-account`, `personas`, `nominas`, `planes` de entidad, `tarjetas/cargos`, `transfers` entre cuentas de la entidad, `membership` y el resto de `/bk/*` son operaciones **del banco**, no del cliente. Nunca se exponen tal cual: solo salen por la lista blanca de `lib/ops.js`, desde el servidor, para el titular o cotitular de una cuenta cuyo tipo las admite (ver «Gestión de la entidad»).

## Seguridad

- **La clave `plk_…` y el secreto HMAC solo se usan en el servidor** y solo para `POST /sessions`.
- Lista blanca de rutas (`lib/routes.js`), cuerpos saneados campo a campo (`lib/body.js`), segmentos de ruta validados, anti-CSRF por origen, límite de peticiones por usuario y CSP.
- **Idempotencia real**: el navegador genera la `Idempotency-Key` y el proxy la reenvía tal cual; reintentar nunca duplica un pago, una compra o un bono. Tras un rechazo definitivo (4xx) se genera una clave nueva.
- Si el banco responde `401` (token caducado/revocado) se borra la sesión y se vuelve a entrar; `429` respeta `Retry-After`.
- `SESSION_SECRET` obligatorio en producción.

## ⚠️ Dos cosas que debes confirmar con tu entidad

1. **Firma HMAC (confirmada).** Según el SDK oficial del banco (`sdk/placeta-servidor.ts`): se firma `${ts}.${cuerpo}` con HMAC-SHA256 en hex, `ts` = milisegundos, y se envían `x-timestamp`, `x-nonce` (único por petición) y `x-signature`. Ventana de ±5 minutos. Está en `lib/sign.js`. Si tu entidad cambiara el formato, se ajusta solo con variables de entorno (ver `.env.example`).
2. **De dónde sale el DIP.** Se lee del perfil de PlacetaID (`dip`, `dni`, `nif`, `document`…; otro nombre con `PLACETAID_DIP_FIELD`). **Si no viene, la app se lo pide al usuario** en `/dip` (una sola vez, atado a su PlacetaID).
   ⚠️ Un DIP escrito a mano no demuestra que sea suyo: sin más, alguien con PlacetaID podría probar el DIP de otra persona. Hay freno (5 intentos/10 min). Activa `VERIFY_HOLDER=1` para exigir además que el titular enmascarado del banco («Ma***») encaje con el nombre de PlacetaID; lo ideal es que PlacetaID devuelva el DIP verificado.

> Los campos de las respuestas están alineados con la documentación de la API (movimientos con `sentido` debit/credit, previsiones, planes con `capital`, programadas con `destino`/`proxima`, sesiones con `cliente`…). `lib/shape.js` los lee de forma tolerante y muestra el resto en un detalle genérico.

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

## Gestión de la entidad (titular y cotitular)

La sección de gestión aparece para quien es **titular o cotitular de la cuenta activa** (el banco lo dice en `GET /me/accounts` → `rol: holder | coholder`; los *autorizados* y *lectores* no la ven). **No hay listas de administradores**: cambia de cuenta con el selector y las funciones cambian con ella. El servidor lo vuelve a comprobar en cada operación (`lib/titular.js`).

Qué ve cada tipo de cuenta (se edita en `lib/ops.js`, propiedad `k` de cada operación):

| Tipo de cuenta | Sección | Funciones |
|---|---|---|
| **Institucional** (la entidad) | **Entidad** | Todas: organigrama (unidades, puestos, nombramientos, permisos), presupuestos (anual, mensual, plurianual, reasignaciones, fondos), gastos y recurrentes, solicitudes y convocatorias, doble firma, tareas y retribuciones, nóminas y planes, **subvenciones y bonos** (programas, concesiones, justificaciones), **reglas de uso** de RBU y programas, tarjetas (NFC y cargos), pasarela, pagos, comisiones, **tasas**, interbancario y reclamaciones, **empresas**, **claves de API**, webhooks, personas y cuentas de la entidad |
| **Empresa** | Gestión de empresa, Organigrama, Presupuestos | Organigrama y presupuestos de **su** organización (gastos, recurrentes, solicitudes, nóminas, tareas, retribuciones, fondos y planes), cargos de tarjeta en su comercio y la pantalla *Pasarela de pago*. El CIP es el de la entidad a la que está vinculada (`GET /me/accounts` → `cip`, `cip_origen: empresa`); si no tiene entidad vinculada, la entidad debe vincularla (`POST /bk/empresas/{id}/entidad`) |
| **Junior** | Membresía | Ver y renovar la membresía de su propia cuenta |
| Personal / Ahorro | — | Sin gestión: usan Inicio, Transferencias, Tarjetas… |

El catálogo y la validación están en `lib/ops.js`. Cada operación declara sus campos; cualquier otro campo se descarta, y `extra` (JSON) no puede pisar los campos que pone el servidor.

- `ENTIDAD_CIP` y `accion` los pone el servidor; `dip_actor` sale siempre de la sesión del usuario, nunca del navegador: la separación de funciones la aplica el banco con ese DIP.
- Las acciones que mueven dinero o cambian permisos piden confirmación; la nómina exige escribir `PAGAR`; las que mueven dinero exigen `Idempotency-Key`.
- Los nombres de campo de las operaciones nuevas están **inferidos** de la documentación (solo trae rutas y permisos). Todas tienen «Campos adicionales (JSON)» para enviar el campo exacto si el banco pide otro. **No están probadas contra el banco real**: en el simulador responden con lo que recibieron.
- Logos: se suben por `/api/ops/logo` (multipart firmado sobre los bytes). **La firma multipart no está verificada con el banco real**; si lo rechaza, usa la URL del logo.
- Límites por usuario: lecturas 300/min, escrituras 60/min.
- Las operaciones que afectan a otros clientes del banco (cargos de otros, nóminas ajenas, personas…) son solo de la cuenta institucional.

## Estructura

```
app/api/bank/[...path]/   proxy seguro → /api/v1/me/*
app/api/ops/              operaciones de entidad (catálogo, validación, permisos) y subida de logos
app/api/auth/, catalog/   login PlacetaID/sesión y catálogo
app/Dashboard.js          navegación, cuentas, permisos por tipo de cuenta
app/components/           Integration (pasarela), Org (organigrama), Budgets (presupuestos), Console (todas las funciones),
                          OpModal, Data, Overview, Movements, Transfers, Cards, Plans, Receipts, Documents, Alta, Security…
lib/                      ops (catálogo de ~100 operaciones), kinds, titular, org, snippets, sign, upstream, session, validate…
scripts/                  mock-api.mjs, smoke.mjs
```

## Pantallas de gestión (cuenta institucional)

- **Organigrama**: árbol de unidades y puestos con búsqueda; crear unidades/puestos, nombrar, cesar, permisos, cerrar.
- **Presupuestos**: presupuesto, comprometido, pagado y disponible por unidad y ejercicio; reparto mensual; fijar, repartir en 12 meses, reasignar; pestañas de gastos, recurrentes, solicitudes, nóminas y tareas, fondos y planes, subvenciones y bonos.
- **Consola** (sección Entidad): todas las demás operaciones del API agrupadas por área.

## Avisos

- `npm run build` y `npm run smoke` no se han podido ejecutar en el entorno de desarrollo (sin acceso a npm): ejecútalos tras `npm install`.
- Los campos de las peticiones y las formas de respuesta del organigrama/presupuestos están inferidos de la documentación.
