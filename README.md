# Banca La Placeta

## Funciones nuevas
- **Cliente** (según tipo de cuenta): Movimientos, Tarjetas, Recibos, **Membresía Junior** (solo Junior), **Catálogo** (productos, diseños, estado de transferencias).
- **Gestión de la entidad** (solo titulares y cotitulares de una cuenta de la entidad; se comprueba con `bk/personas`): 14 módulos que cambian según el tipo de la cuenta seleccionada
  (Personal, Junior, Empresa, Institucional, Prepago/RBU) — cuentas, organigrama, presupuestos, gastos y recurrentes, solicitudes,
  nóminas, subvenciones y bonos, reglas de uso, tarjetas y cargos, pasarela, comisiones/tasas/restricciones, empresas,
  interbancario/disputas, integraciones (claves, CORS, webhooks).
- Catálogo en `lib/catalog.js`; política de acceso del proxy en `lib/policy.js`.
- Cada formulario trae «Opciones avanzadas (JSON)» que se fusiona con el cuerpo, por si la API pide algún campo distinto.
