import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS seguimientos (
        id SERIAL PRIMARY KEY,
        cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
        tipo VARCHAR(80) NOT NULL,
        comentario TEXT NOT NULL,
        estado VARCHAR(40) DEFAULT 'pendiente',
        fecha DATE NOT NULL,
        creado_en TIMESTAMP DEFAULT now()
      )
    `)

    const seguimientos = await query<any[]>(`
      SELECT s.id, s.tipo, s.comentario, s.estado, s.fecha, c.nombre as cliente
      FROM seguimientos s
      JOIN clientes c ON c.id = s.cliente_id
      ORDER BY s.fecha DESC
    `)

    return NextResponse.json({ ok: true, seguimientos })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS seguimientos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id INT NOT NULL,
        tipo VARCHAR(80) NOT NULL,
        comentario TEXT NOT NULL,
        estado VARCHAR(40) DEFAULT 'pendiente',
        fecha DATE NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
      )
    `)

    const body = await request.json()
    const { cliente_id, tipo, comentario, estado, fecha } = body

    const result = await query<any[]>(
      `INSERT INTO seguimientos (cliente_id, tipo, comentario, estado, fecha) VALUES (?, ?, ?, ?, ?) RETURNING id`,
      [cliente_id, tipo, comentario, estado || 'pendiente', fecha]
    )

    const insertedId = Number(result[0]?.id)
    return NextResponse.json({ ok: true, id: insertedId })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
