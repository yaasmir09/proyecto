import http from 'node:http'
import crypto from 'node:crypto'
import { Pool } from 'pg'

const port = Number(process.env.PORT || 4001)
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function md5(value) {
  return crypto.createHash('md5').update(value).digest('hex')
}

async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      rol VARCHAR(50) NOT NULL,
      creado_en TIMESTAMP DEFAULT now()
    )
  `)
  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password VARCHAR(255) NOT NULL DEFAULT '123456'`)
  await pool.query(`UPDATE usuarios SET password = md5(password) WHERE password <> '' AND password !~ '^[a-f0-9]{32}$'`)
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

async function readBody(request) {
  let raw = ''
  for await (const chunk of request) raw += chunk
  return raw ? JSON.parse(raw) : {}
}

async function handler(request, response) {
  if (request.url === '/health') return send(response, 200, { ok: true, service: 'auth' })
  await ensureUsersTable()
  const url = new URL(request.url, `http://${request.headers.host}`)

  if (request.method === 'GET' && url.pathname === '/users') {
    const result = await pool.query('SELECT id, nombre, email, rol FROM usuarios ORDER BY id DESC')
    return send(response, 200, { ok: true, usuarios: result.rows })
  }

  if (request.method === 'POST' && url.pathname === '/login') {
    const body = await readBody(request)
    const result = await pool.query('SELECT id, nombre, email, rol FROM usuarios WHERE email = $1 AND password = md5($2) LIMIT 1', [String(body.email || '').trim(), String(body.password || '').trim()])
    if (!result.rows[0]) return send(response, 401, { ok: false, error: 'Credenciales inválidas' })
    return send(response, 200, { ok: true, user: result.rows[0] })
  }

  if (request.method === 'POST' && url.pathname === '/users') {
    const body = await readBody(request)
    const result = await pool.query('INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, md5($3), $4) RETURNING id', [String(body.nombre || '').trim(), String(body.email || '').trim(), String(body.password || '123456').trim(), String(body.rol || 'operador').trim()])
    return send(response, 200, { ok: true, id: result.rows[0].id })
  }

  const match = url.pathname.match(/^\/users\/(\d+)$/)
  if (match && request.method === 'PATCH') {
    const body = await readBody(request)
    await pool.query('UPDATE usuarios SET nombre = $1, email = $2, rol = $3, password = CASE WHEN $4 = \'\' THEN password ELSE md5($4) END WHERE id = $5', [body.nombre, body.email, body.rol, body.password || '', match[1]])
    return send(response, 200, { ok: true })
  }
  if (match && request.method === 'DELETE') {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [match[1]])
    return send(response, 200, { ok: true })
  }
  return send(response, 404, { ok: false, error: 'Ruta no encontrada' })
}

http.createServer((request, response) => handler(request, response).catch((error) => send(response, 500, { ok: false, error: error.message }))).listen(port, '0.0.0.0')
