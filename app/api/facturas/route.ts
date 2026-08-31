import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const facturas = await query<any[]>(`
      SELECT 
        f.id,
        f.cliente_id,
        f.numero_factura,
        f.monto,
        COALESCE(SUM(p.monto), 0) AS total_pagado,
        ROUND(f.monto - COALESCE(SUM(p.monto), 0), 2) AS saldo_pendiente,
        f.fecha_vencimiento,
        f.estado,
        c.nombre AS cliente
      FROM facturas f
      JOIN clientes c ON c.id = f.cliente_id
      LEFT JOIN pagos p ON p.factura_id = f.id
      GROUP BY f.id, f.cliente_id, f.numero_factura, f.monto, f.fecha_vencimiento, f.estado, c.nombre
      ORDER BY f.fecha_vencimiento ASC
    `)
    return NextResponse.json({ ok: true, facturas })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cliente_id, monto, fecha_emision, fecha_vencimiento, estado } = body
    const clientRows = await query<any[]>(`SELECT id FROM clientes WHERE id = ? LIMIT 1`, [cliente_id])
    if (clientRows.length === 0) {
      return NextResponse.json({ ok: false, error: 'El cliente seleccionado ya no existe. Actualiza la lista de clientes.' }, { status: 400 })
    }
    const today = new Date().toISOString().slice(0, 16)
    const safeFechaEmision = fecha_emision === '' || fecha_emision == null ? today : fecha_emision
    const safeFechaVencimiento = fecha_vencimiento === '' || fecha_vencimiento == null ? today : fecha_vencimiento

    const countResult = await query<any[]>(`
      SELECT COALESCE(MAX((substring(numero_factura from 5))::int), 0) + 1 AS siguiente
      FROM facturas
      WHERE numero_factura ~ '^FAC-[0-9]+$'
    `)
    const nextNumber = `FAC-${String(Number(countResult[0]?.siguiente || 1)).padStart(4, '0')}`
    const finalNumber = nextNumber

    const result = await query<any[]>(
      `INSERT INTO facturas (cliente_id, numero_factura, monto, fecha_emision, fecha_vencimiento, estado, creado_en) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
      [cliente_id, finalNumber, monto, safeFechaEmision, safeFechaVencimiento, estado || 'activa']
    )

    const insertId = Number(result[0]?.id)

    return NextResponse.json({ ok: true, id: insertId, numero_factura: finalNumber })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
