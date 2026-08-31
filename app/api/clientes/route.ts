import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

async function ensureIdentificacionColumn() {
  const result = await query<any[]>(`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'identificacion' LIMIT 1`)
  if (result.length === 0) {
    await query(`ALTER TABLE clientes ADD COLUMN identificacion VARCHAR(25)`) 
  }
}

export async function GET() {
  try {
    await ensureIdentificacionColumn()
    const clientes = await query<any[]>(`SELECT id, nombre, email, identificacion, telefono, empresa, estado FROM clientes ORDER BY id DESC`)
    return NextResponse.json({ ok: true, clientes })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await ensureIdentificacionColumn()
    const body = await request.json()
    const { nombre, email, identificacion, telefono, empresa, estado } = body

    if (!nombre || !email) {
      return NextResponse.json({ ok: false, error: 'Nombre y email son requeridos' }, { status: 400 })
    }

    const pattern = /^[0-9]{3}-[0-9]{6}-[0-9]{4}[A-Za-z]$/
    if (identificacion && !pattern.test(String(identificacion))) {
      return NextResponse.json({ ok: false, error: 'La identificación debe tener formato 000-000000-0000X' }, { status: 400 })
    }

    const result = await query<any[]>(
      `INSERT INTO clientes (nombre, email, identificacion, telefono, empresa, estado) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [nombre, email, identificacion || null, telefono || null, empresa || null, estado || 'activo']
    )

    const insertedId = Number(result[0]?.id)
    return NextResponse.json({ ok: true, id: insertedId })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
