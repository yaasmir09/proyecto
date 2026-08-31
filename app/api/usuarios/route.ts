import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

function md5(value: string) {
  return crypto.createHash('md5').update(value).digest('hex')
}

async function ensureUsersTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      rol VARCHAR(50) NOT NULL,
      creado_en TIMESTAMP DEFAULT now()
    )
  `)

  await query(`
    ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS password VARCHAR(255) NOT NULL DEFAULT '123456'
  `)

  await query(`
    UPDATE usuarios
    SET password = md5(password)
    WHERE password IS NOT NULL
      AND password <> ''
      AND password !~ '^[a-f0-9]{32}$'
  `)
}

export async function GET(request: Request) {
  try {
    await ensureUsersTable()

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const password = searchParams.get('password')

    if (email && password) {
      const users = await query<any[]>(
        `SELECT id, nombre, email, password, rol FROM usuarios WHERE email = ? AND password = MD5(?) LIMIT 1`,
        [email, password]
      )
      return NextResponse.json({ ok: true, user: users[0] || null })
    }

    const usuarios = await query<any[]>(`SELECT id, nombre, email, rol FROM usuarios ORDER BY id DESC`)
    return NextResponse.json({ ok: true, usuarios })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await ensureUsersTable()

    const body = await request.json()
    const action = body?.action

    if (action === 'login') {
      const email = String(body?.email || '').trim()
      const password = String(body?.password || '').trim()
      const users = await query<any[]>(
        `SELECT id, nombre, email, password, rol FROM usuarios WHERE email = ? AND password = MD5(?) LIMIT 1`,
        [email, password]
      )

      if (users[0]) {
        return NextResponse.json({ ok: true, user: users[0] })
      }

      return NextResponse.json({ ok: false, error: 'Credenciales inválidas' }, { status: 401 })
    }

    const { nombre, email, password, rol } = body || {}
    const safeName = String(nombre || '').trim()
    const safeEmail = String(email || '').trim()
    const safePassword = String(password || '123456').trim()
    const safeRol = String(rol || 'operador').trim()

    const result = await query<any[]>(
      `INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, md5(?), ?) RETURNING id`,
      [safeName, safeEmail, safePassword, safeRol]
    )

    const insertedId = Number(result[0]?.id)
    return NextResponse.json({ ok: true, id: insertedId })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
