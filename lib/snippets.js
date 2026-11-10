// Plantillas de código para integrar la pasarela en una web propia. Sin claves reales: leen variables de entorno.
// Son plantillas: el nombre exacto de las cabeceras del webhook y de los campos del evento debe confirmarse con la entidad.
const q = (s) => JSON.stringify(String(s ?? ''))

export function snippets({ api, origin, iban, ret, cancel, prefix = 'Pedido ', webhook = 'https://tu-web.com/webhooks/placeta', color = '#5B2FD9', brand = 'Placeta' }) {
  const body = { origen: origin, client_ref: '{pedido}', iban_destino: iban, importe: '{total}', concepto: prefix + '{pedido}', minutos: 15, url_retorno: ret, url_cancelacion: cancel }

  const node = `// server.js — tu servidor crea el pago y manda al cliente a la ventana de pago con tu marca
import crypto from 'node:crypto'
import express from 'express'

const API = ${q(api)}
const KEY = process.env.PLACETA_API_KEY        // plk_… de tu pasarela (nunca en el navegador)
const SECRET = process.env.PLACETA_API_SECRET  // secreto de firma de esa clave

async function placeta(path, body) {
  const raw = JSON.stringify(body)
  const ts = String(Date.now())
  const sig = crypto.createHmac('sha256', SECRET).update(\`\${ts}.\${raw}\`).digest('hex')
  const r = await fetch(\`\${API}/\${path}\`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'x-timestamp': ts, 'x-nonce': crypto.randomBytes(12).toString('base64url'), 'x-signature': sig, 'Idempotency-Key': crypto.randomUUID() },
    body: raw,
  })
  const json = await r.json()
  if (!r.ok) throw new Error(json?.error?.message || 'Error ' + r.status)
  return json
}

const app = express()
app.use(express.urlencoded({ extended: false }))

app.post('/pagar', async (req, res) => {
  const pedido = await cargarPedido(req.body.pedido)           // tu lógica: importe real, desde tu base de datos
  const pago = await placeta('bk/checkouts', {
    origen: ${q(origin)},
    client_ref: String(pedido.id),
    iban_destino: ${q(iban)},
    importe: pedido.total,
    concepto: ${q(prefix)} + pedido.id,
    minutos: 15,
    url_retorno: ${q(ret)},
    url_cancelacion: ${q(cancel)},
  })
  res.redirect(303, pago.url)                                   // ventana de pago con tu logo y tu color
})
`
  const php = `<?php
// pagar.php — tu servidor crea el pago y redirige a la ventana de pago con tu marca
$api = ${q(api)};
$key = getenv('PLACETA_API_KEY');
$secret = getenv('PLACETA_API_SECRET');

$pedido = cargar_pedido($_POST['pedido']);   // tu lógica: importe real, desde tu base de datos
$raw = json_encode([
  'origen' => ${q(origin)},
  'client_ref' => (string)$pedido['id'],
  'iban_destino' => ${q(iban)},
  'importe' => $pedido['total'],
  'concepto' => ${q(prefix)} . $pedido['id'],
  'minutos' => 15,
  'url_retorno' => ${q(ret)},
  'url_cancelacion' => ${q(cancel)},
]);
$ts = (string)round(microtime(true) * 1000);
$sig = hash_hmac('sha256', $ts . '.' . $raw, $secret);
$ch = curl_init($api . '/bk/checkouts');
curl_setopt_array($ch, [
  CURLOPT_POST => true, CURLOPT_POSTFIELDS => $raw, CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    'content-type: application/json', 'x-api-key: ' . $key, 'x-timestamp: ' . $ts,
    'x-nonce: ' . bin2hex(random_bytes(12)), 'x-signature: ' . $sig, 'Idempotency-Key: ' . bin2hex(random_bytes(16)),
  ],
]);
$pago = json_decode(curl_exec($ch), true);
header('Location: ' . $pago['url'], true, 303);
`
  const curl = `# Crear un pago desde la terminal (para probar tu clave)
API=${api}
BODY='${JSON.stringify(Object.fromEntries(Object.entries(body).map(([k, v]) => [k, v === '{total}' ? 25 : v === '{pedido}' ? 'PRUEBA-1' : typeof v === 'string' ? v.replace('{pedido}', 'PRUEBA-1') : v])))}'
TS=$(($(date +%s) * 1000))
SIG=$(printf '%s' "$TS.$BODY" | openssl dgst -sha256 -hmac "$PLACETA_API_SECRET" -hex | sed 's/^.* //')
curl -sS -X POST "$API/bk/checkouts" \\
  -H "content-type: application/json" -H "x-api-key: $PLACETA_API_KEY" \\
  -H "x-timestamp: $TS" -H "x-nonce: $(openssl rand -hex 12)" -H "x-signature: $SIG" \\
  -H "Idempotency-Key: $(uuidgen)" -d "$BODY"
# → { "id": "…", "url": "https://…/pagar/…", "expira": "…" }   Abre «url» para ver tu ventana de pago.`
  const hook = `// Recibe los avisos del banco en ${webhook}
// Plantilla: confirma con tu entidad el nombre de la cabecera de firma y los campos del evento.
app.post('/webhooks/placeta', express.raw({ type: '*/*' }), (req, res) => {
  const esperado = crypto.createHmac('sha256', process.env.PLACETA_WEBHOOK_SECRET).update(req.body).digest('hex')
  const recibido = String(req.get('x-signature') || '')
  const ok = recibido.length === esperado.length && crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado))
  if (!ok) return res.status(401).end()

  const ev = JSON.parse(req.body)
  if (ev.evento === 'checkout.pagado') marcarPedidoPagado(ev.client_ref)   // el pago se confirmó: entrega el pedido
  res.status(200).end()                                                     // responde 2xx o el banco reintentará
})
`
  const html = `<!-- Botón de pago con tu marca. El formulario llama a TU servidor (/pagar), nunca al banco directamente. -->
<form method="post" action="/pagar">
  <input type="hidden" name="pedido" value="1001">
  <button type="submit" style="background:${color};color:#fff;border:0;border-radius:12px;padding:14px 22px;font:600 16px system-ui;cursor:pointer">
    Pagar con ${brand}
  </button>
</form>`
  return { node, php, curl, hook, html }
}
