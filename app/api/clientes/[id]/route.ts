import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

async function ensureIdentificacionColumn() {
  const result = await query<any[]>(`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'identificacion' LIMIT 1`)
  if (result.length === 0) {
    await query(`ALTER TABLE clientes ADD COLUMN identificacion VARCHAR(25)`) 
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureIdentificacionColumn()
    const body = await request.json()
    const { nombre, email, identificacion, telefono, empresa, estado } = body
    const safeNombre = nombre ?? ''
    const safeEmail = email ?? ''
    const safeIdentificacion = identificacion ?? null
    const safeTelefono = telefono ?? null
    const safeEmpresa = empresa ?? null
    const safeEstado = estado || 'activo'
    const pattern = /^[0-9]{3}-[0-9]{6}-[0-9]{4}[A-Za-z]$/

    if (safeIdentificacion && !pattern.test(String(safeIdentificacion))) {
      return NextResponse.json({ ok: false, error: 'La identificación debe tener formato 000-000000-0000X' }, { status: 400 })
    }

    const { id } = await params
    await query(
      `UPDATE clientes SET nombre = ?, email = ?, identificacion = ?, telefono = ?, empresa = ?, estado = ? WHERE id = ?`,
      [safeNombre, safeEmail, safeIdentificacion, safeTelefono, safeEmpresa, safeEstado, id]
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await query(`DELETE FROM clientes WHERE id = ?`, [id])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
