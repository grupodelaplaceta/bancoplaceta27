# APK de Banco La Placeta

La app Android es un contenedor nativo (WebView) que abre tu backend de Vercel (`APP_URL`).
Las claves del banco (`plk_…`, firma HMAC) siguen SOLO en el servidor: nunca van dentro del APK.

## Conseguir el APK (sin instalar nada)
1. Sube todo el proyecto a un repositorio de GitHub (puede ser privado).
2. Pestaña **Actions** → **Compilar APK** → **Run workflow**.
3. Cuando termine (3-5 min), abre la ejecución y descarga **BancoLaPlaceta-apk** → `app-debug.apk`.
4. Pásalo al móvil y ábrelo (permitir «instalar apps desconocidas»).

## Con Android Studio
Abre la carpeta `android/` → Build → Build APK(s).

## Ajustes
- Otro dominio: `android/app/build.gradle` → `APP_URL`.
- Dominio de login: `LOGIN_HOST` (PlacetaID).

## Qué hace
- Sin barra lateral de escritorio, sin instalar-PWA, sin service worker dentro de la app.
- Botón atrás nativo, pantalla «Sin conexión», capturas de pantalla bloqueadas (FLAG_SECURE).
- CSV/extractos se guardan en Descargas. Solo HTTPS; enlaces externos se abren fuera.
- «Imprimir/PDF» no existe en WebView: usa el CSV.

## Novedades v1.1
- **Sesión guardada:** en la app se recuerda tu identidad 30 días (cookie cifrada `rem`) y el banco se renueva solo cuando
  caduca su token (30-60 min), sin volver a PlacetaID. «Salir» la borra.
- **Bloqueo de app:** tras 1 min en segundo plano (o al abrirla) pide el PIN/patrón/huella del móvil. Si el móvil no tiene bloqueo, no se pide.
- **Interfaz nueva:** tarjeta de saldo con degradado, barra inferior flotante, acciones circulares, hojas que deslizan, animaciones y vibración suave.
- Requiere volver a desplegar la web en Vercel (hay cambios en el servidor) además de recompilar el APK.

## Novedades v1.2
- **Estilo Revolut con colores planos:** sin degradados ni sombras; fondo limpio, tarjetas grises, saldo grande centrado que "sube" al cargar,
  acciones en círculos, barra inferior plana, barras del sistema que cambian con el tema claro/oscuro.
- **Animaciones:** entrada de pantallas, hojas que suben, check que se dibuja al enviar dinero, esqueletos de carga, pulsación con rebote.
- **Sonidos y vibración** (sintetizados, sin archivos): toque, navegación, éxito, error, aviso nuevo, NFC. Se apagan en Más → Ajustes.
- **Empresa / Entidad** (Más → Empresa, o «Organigrama» en Inicio): organigrama plegable con conectores, buscador, expandir/contraer,
  vacantes, personas con avatar (toca para ver su ficha) y, en cuentas institucionales, lista de empresas con ficha completa.
  Solo lo ven titulares/cotitulares de cuentas de empresa o institucionales (lo decide el banco, como antes).
- **NFC con tarjetas virtuales:** Tarjetas → «Pagar con NFC». Ver abajo.

## NFC: cómo funciona (y sus límites)
1. La app pide a `POST /api/nfc/token` un token de un solo uso (60 s) de la tarjeta; el servidor comprueba con el banco que es tuya y está activa.
2. La app lo emite como tarjeta NFC (HCE, AID `F0504C414345544101`). Hace falta el móvil desbloqueado y la app abierta.
3. El terminal selecciona el AID y envía `80 CA 00 00 00`; recibe el token y lo valida con `POST /api/nfc/verify`
   (cabecera `x-nfc-key` = variable `NFC_VERIFY_KEY` de Vercel). Responde `{ ok, ref, iban }`.
- **No es un pago EMV de Visa/Mastercard:** los TPV normales del mundo real no lo entienden. Sirve para terminales/apps tuyas que hablen este protocolo.
- El «un solo uso» de `/verify` se guarda en memoria de la instancia; si lo necesitas estricto en Vercel, guarda los usados en una base de datos.
