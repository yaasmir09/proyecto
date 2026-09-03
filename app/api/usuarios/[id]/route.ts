import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { proxyService, readJson } from '@/lib/service-client'

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
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyService(request, process.env.AUTH_SERVICE_URL || 'http://auth:4001', `/users/${id}`, 'PATCH', await readJson(request))
  /*
  try {
    await ensureUsersTable()
    const { id } = await params

    const body = await request.json()
    const { nombre, email, password, rol } = body || {}
    const safeName = String(nombre || '').trim()
    const safeEmail = String(email || '').trim()
    const safeRol = String(rol || 'operador').trim()

    if (password && String(password).trim()) {
      await query(
        `UPDATE usuarios SET nombre = ?, email = ?, password = MD5(?), rol = ? WHERE id = ?`,
        [safeName, safeEmail, String(password).trim(), safeRol, id]
      )
    } else {
      await query(
        `UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?`,
        [safeName, safeEmail, safeRol, id]
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
  */
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyService(request, process.env.AUTH_SERVICE_URL || 'http://auth:4001', `/users/${id}`, 'DELETE')
  /*
  try {
    await ensureUsersTable()
    const { id } = await params
    await query(`DELETE FROM usuarios WHERE id = ?`, [id])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
  */
}
