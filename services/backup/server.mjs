import http from 'node:http'
import { promises as fs } from 'node:fs'
import { execFile, spawn } from 'node:child_process'
import path from 'node:path'
import { Pool } from 'pg'

const port = Number(process.env.PORT || 4003)
const backupDir = '/data/backups'
const databaseUrl = process.env.DATABASE_URL
const pool = new Pool({ connectionString: databaseUrl })

async function ensureBackupTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS respaldos (
      id BIGSERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL UNIQUE,
      contenido BYTEA NOT NULL,
      tamano BIGINT NOT NULL,
      creado_en TIMESTAMP NOT NULL DEFAULT now()
    )
  `)
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    if (input) child.stdin.write(input)
    child.stdin.end()
    child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || `Proceso terminó con código ${code}`)))
    child.on('error', reject)
  })
}

async function handler(request, response) {
  await fs.mkdir(backupDir, { recursive: true })
  await ensureBackupTable()
  if (request.url === '/health') return send(response, 200, { ok: true, service: 'backup' })
  if (request.method === 'GET' && request.url === '/backups') {
    const localFiles = (await fs.readdir(backupDir)).filter((file) => file.endsWith('.sql'))
    const databaseFiles = (await pool.query('SELECT nombre FROM respaldos ORDER BY creado_en DESC')).rows.map((row) => row.nombre)
    const files = [...new Set([...localFiles, ...databaseFiles])].sort().reverse()
    return send(response, 200, { ok: true, backups: files })
  }
  if (request.method === 'POST' && request.url === '/backups') {
    const file = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`
    const content = await run('pg_dump', ['--dbname=' + databaseUrl, '--clean', '--if-exists', '--no-owner', '--no-privileges', '--encoding=utf8'])
    const buffer = Buffer.from(content, 'utf8')
    await fs.writeFile(path.join(backupDir, file), buffer)
    await pool.query('INSERT INTO respaldos (nombre, contenido, tamano) VALUES ($1, $2, $3) ON CONFLICT (nombre) DO UPDATE SET contenido = EXCLUDED.contenido, tamano = EXCLUDED.tamano', [file, buffer, buffer.length])
    return send(response, 200, { ok: true, file, stored: ['local', 'database'] })
  }
  if (request.method === 'POST' && request.url === '/backups/restore') {
    let raw = ''
    for await (const chunk of request) raw += chunk
    const fileName = path.basename(JSON.parse(raw).fileName || '')
    if (!fileName || !fileName.endsWith('.sql')) return send(response, 400, { ok: false, error: 'Respaldo inválido' })
    let sql
    try {
      sql = await fs.readFile(path.join(backupDir, fileName), 'utf8')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      const result = await pool.query('SELECT contenido FROM respaldos WHERE nombre = $1 LIMIT 1', [fileName])
      if (!result.rows[0]) return send(response, 404, { ok: false, error: 'No se encontró el respaldo local ni su copia en la base de datos' })
      sql = result.rows[0].contenido.toString('utf8')
      await fs.writeFile(path.join(backupDir, fileName), sql, 'utf8')
    }
    await run('psql', ['--dbname=' + databaseUrl, '--single-transaction', '--set=ON_ERROR_STOP=1'], `DROP SCHEMA IF EXISTS public CASCADE;\nCREATE SCHEMA public;\n${sql}`)
    return send(response, 200, { ok: true, restored: fileName })
  }
  return send(response, 404, { ok: false, error: 'Ruta no encontrada' })
}

http.createServer((request, response) => handler(request, response).catch((error) => send(response, 500, { ok: false, error: error.message }))).listen(port, '0.0.0.0')
