import { spawn } from 'child_process'
import { once } from 'events'
import { promises as fs } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { proxyService, readJson } from '@/lib/service-client'

async function resolvePostgresCliPath(binaryName: 'pg_dump' | 'psql') {
  const configured = binaryName === 'pg_dump' ? process.env.PGDUMP_PATH : process.env.PSQL_PATH
  if (configured) return configured

  const candidates = [
    `C:/Program Files/PostgreSQL/18/bin/${binaryName}.exe`,
    `C:/Program Files/PostgreSQL/18/bin/${binaryName}`,
    `C:/Program Files/PostgreSQL/17/bin/${binaryName}.exe`,
    `C:/Program Files/PostgreSQL/17/bin/${binaryName}`,
    `C:/Program Files/PostgreSQL/16/bin/${binaryName}.exe`,
    `C:/Program Files/PostgreSQL/16/bin/${binaryName}`,
    `C:/Program Files/PostgreSQL/15/bin/${binaryName}.exe`,
    `C:/Program Files/PostgreSQL/15/bin/${binaryName}`,
    `C:/Program Files/PostgreSQL/14/bin/${binaryName}.exe`,
    `C:/Program Files/PostgreSQL/14/bin/${binaryName}`,
  ]

  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // falla; prueba la siguiente ruta
    }
  }

  return binaryName
}

export async function POST(request: Request) {
  const body = await readJson(request)
  return proxyService(request, process.env.BACKUP_SERVICE_URL || 'http://backup:4003', '/backups/restore', 'POST', body)
  /*
  try {
    const body = await request.json()
    const fileName = body?.fileName

    if (!fileName || typeof fileName !== 'string') {
      throw new Error('No se especificó un respaldo válido')
    }

    const backupDir = path.join(process.cwd(), 'backups')
    const safeFileName = path.basename(fileName)
    const filePath = path.join(backupDir, safeFileName)

    await fs.access(filePath)
    const rawSql = await fs.readFile(filePath, 'utf8')
    // PostgreSQL 17/18 puede incluir esta directiva, pero PostgreSQL 16 no la reconoce.
    const sql = rawSql
      .split(/\r?\n/)
      .filter((line) => !/^\s*SET\s+transaction_timeout\s*=\s*0\s*;\s*$/i.test(line))
      .join('\n')

    const isPostgresDump = sql.includes('PostgreSQL database dump') || sql.includes('SET statement_timeout') || sql.includes('CREATE TABLE public.')
    if (!isPostgresDump) {
      throw new Error('El archivo seleccionado no es un respaldo PostgreSQL válido. Elimina o ignora los backups antiguos de MySQL/MariaDB y vuelve a intentarlo.')
    }

    // If we have a Postgres DATABASE_URL, use psql to restore
    if (process.env.DATABASE_URL) {
      const psqlPath = await resolvePostgresCliPath('psql')
      const child = spawn(psqlPath, ['--dbname=' + process.env.DATABASE_URL, '--single-transaction', '--set=ON_ERROR_STOP=1'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stderr = ''
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })

      child.stdin.write(`DROP SCHEMA IF EXISTS public CASCADE;\nCREATE SCHEMA public;\nGRANT ALL ON SCHEMA public TO root;\n`)
      child.stdin.write(sql)
      child.stdin.end()

      await once(child, 'close')

      if (child.exitCode !== 0) {
        if (stderr.includes('No such file or directory') || stderr.includes('not found')) {
          throw new Error('psql no encontrado. Instale las herramientas cliente de PostgreSQL o configure PSQL_PATH con la ruta a psql. Original: ' + stderr)
        }
        throw new Error(stderr || 'No se pudo restaurar la base de datos')
      }

      return NextResponse.json({ ok: true, restored: safeFileName })
    }

    // Fallback to MySQL restore
    const mysqlPath = process.env.MYSQL_PATH || 'C:/xampp/mysql/bin/mysql.exe'
    const child = spawn(mysqlPath, ['--host=127.0.0.1', '--user=root', '--password=', 'cobranza_db'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.stdin.write(sql)
    child.stdin.end()

    await once(child, 'close')

    if (child.exitCode !== 0) {
      if (stderr.includes('No such file or directory') || stderr.includes('not found')) {
        throw new Error('mysql no encontrado. Instale MySQL o configure MYSQL_PATH con la ruta a mysql.exe. Original: ' + stderr)
      }
      throw new Error(stderr || 'No se pudo restaurar la base de datos')
    }

    return NextResponse.json({ ok: true, restored: safeFileName })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
  */
}
