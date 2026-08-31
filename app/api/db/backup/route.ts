import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

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

async function isPostgresBackup(filePath: string) {
  try {
    const header = await fs.readFile(filePath, 'utf8')
    return header.includes('PostgreSQL database dump') || header.includes('SET statement_timeout') || header.includes('CREATE TABLE public.')
  } catch {
    return false
  }
}

export async function GET() {
  try {
    const backupDir = path.join(process.cwd(), 'backups')
    await fs.mkdir(backupDir, { recursive: true })
    const files = await fs.readdir(backupDir)
    const backups: string[] = []

    for (const file of files.filter((item) => item.endsWith('.sql')).sort().reverse()) {
      const filePath = path.join(backupDir, file)
      if (await isPostgresBackup(filePath)) {
        backups.push(file)
      }
    }

    return NextResponse.json({ ok: true, backups })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const backupDir = path.join(process.cwd(), 'backups')
    await fs.mkdir(backupDir, { recursive: true })

    const fileName = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`
    const filePath = path.join(backupDir, fileName)
    // If we have a Postgres DATABASE_URL, use pg_dump
    if (process.env.DATABASE_URL) {
      const pgDumpPath = await resolvePostgresCliPath('pg_dump')
      await new Promise<void>((resolve, reject) => {
        execFile(
          pgDumpPath,
          ['--dbname=' + process.env.DATABASE_URL, '--clean', '--if-exists', '--no-owner', '--no-privileges', '--encoding=utf8'],
          { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
          (error, stdout, stderr) => {
            if (error) {
              if ((error as any).code === 'ENOENT') {
                reject(new Error('pg_dump no encontrado. Instale las herramientas cliente de PostgreSQL o configure PGDUMP_PATH con la ruta a pg_dump. Original: ' + (error.message || stderr)))
                return
              }
              reject(new Error(stderr || error.message))
              return
            }
            fs.writeFile(filePath, stdout, 'utf8')
              .then(() => resolve())
              .catch((err) => reject(err))
          }
        )
      })

      return NextResponse.json({ ok: true, file: fileName, path: filePath })
    }

    // Fallback to MySQL dump if DATABASE_URL not present
    const mysqldumpPath = process.env.MYSQL_DUMP_PATH || 'C:/xampp/mysql/bin/mysqldump.exe'

    const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile(
        mysqldumpPath,
        ['--host=127.0.0.1', '--user=root', '--password=', 'cobranza_db'],
        { encoding: 'utf8' },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message))
            return
          }
          resolve({ stdout, stderr })
        }
      )
    })

    await fs.writeFile(filePath, stdout, 'utf8')
    return NextResponse.json({ ok: true, file: fileName, path: filePath })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
