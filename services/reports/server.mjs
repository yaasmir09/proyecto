import http from 'node:http'
import { Pool } from 'pg'

const port = Number(process.env.PORT || 4002)
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

async function handler(request, response) {
  if (request.url === '/health') return send(response, 200, { ok: true, service: 'reports' })
  if (request.method !== 'GET' || !request.url.startsWith('/reports')) return send(response, 404, { ok: false, error: 'Ruta no encontrada' })
  const type = new URL(request.url, `http://${request.headers.host}`).searchParams.get('type') || 'general'
  let rows
  if (type === 'clientes') rows = (await pool.query('SELECT c.nombre, c.empresa, c.estado, COUNT(f.id) AS facturas FROM clientes c LEFT JOIN facturas f ON f.cliente_id = c.id GROUP BY c.id ORDER BY facturas DESC')).rows
  else if (type === 'vencidas') rows = (await pool.query('SELECT f.numero_factura, c.nombre, f.monto, f.fecha_vencimiento FROM facturas f JOIN clientes c ON c.id = f.cliente_id WHERE f.estado = \'vencida\' ORDER BY f.fecha_vencimiento ASC')).rows
  else if (type === 'pagos') rows = (await pool.query("SELECT TO_CHAR(fecha_pago, 'YYYY-MM') AS periodo, SUM(monto) AS total FROM pagos GROUP BY periodo ORDER BY periodo ASC")).rows
  else if (type === 'riesgo') rows = (await pool.query("SELECT c.nombre, c.estado, COUNT(f.id) AS facturas, COALESCE(SUM(f.monto), 0) AS total FROM clientes c LEFT JOIN facturas f ON f.cliente_id = c.id GROUP BY c.id HAVING c.estado = 'riesgo' OR COUNT(f.id) > 1 ORDER BY total DESC")).rows
  else rows = (await pool.query('SELECT (SELECT COUNT(*) FROM clientes) AS clientes, (SELECT COUNT(*) FROM facturas) AS facturas, (SELECT COALESCE(SUM(monto), 0) FROM pagos) AS pagos, (SELECT COUNT(*) FROM facturas WHERE estado = \'vencida\') AS vencidas')).rows
  return send(response, 200, { ok: true, report: { title: type, rows } })
}

http.createServer((request, response) => handler(request, response).catch((error) => send(response, 500, { ok: false, error: error.message }))).listen(port, '0.0.0.0')
