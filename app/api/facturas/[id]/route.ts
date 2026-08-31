import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { cliente_id, numero_factura, monto, fecha_emision, fecha_vencimiento, estado } = body
    const { id } = await params

    const existing = await query<any[]>(`SELECT cliente_id, numero_factura, monto, fecha_emision, fecha_vencimiento, estado FROM facturas WHERE id = ?`, [id])
    const existingRow = existing[0] || {}
    const safeClienteId = cliente_id ?? existingRow.cliente_id ?? null
    const safeNumeroFactura = numero_factura ?? existingRow.numero_factura ?? ''
    const safeMonto = monto ?? existingRow.monto ?? 0
    const safeFechaEmision = (fecha_emision === '' || fecha_emision == null) ? (existingRow.fecha_emision ?? new Date().toISOString().slice(0, 10)) : fecha_emision
    const safeFechaVencimiento = (fecha_vencimiento === '' || fecha_vencimiento == null) ? (existingRow.fecha_vencimiento ?? new Date().toISOString().slice(0, 10)) : fecha_vencimiento
    const safeEstado = estado ?? existingRow.estado ?? 'activa'

    await query(
      `UPDATE facturas SET cliente_id = ?, numero_factura = ?, monto = ?, fecha_emision = ?, fecha_vencimiento = ?, estado = ? WHERE id = ?`,
      [safeClienteId, safeNumeroFactura, safeMonto, safeFechaEmision, safeFechaVencimiento, safeEstado, id]
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const invoiceRows = await query<any[]>(`SELECT cliente_id FROM facturas WHERE id = ? LIMIT 1`, [id])
    const clienteId = Number(invoiceRows[0]?.cliente_id || 0)

    if (!clienteId) {
      return NextResponse.json({ ok: false, error: 'Factura no encontrada' }, { status: 404 })
    }

    await query(`DELETE FROM facturas WHERE id = ?`, [id])

    const remainingInvoices = await query<any[]>(`SELECT 1 FROM facturas WHERE cliente_id = ? LIMIT 1`, [clienteId])
    if (remainingInvoices.length === 0) {
      await query(`
        UPDATE cuotas
        SET monto_pagado = monto_cuota,
            estado = 'pagada',
            fecha_pago = CURRENT_DATE,
            actualizado_en = NOW()
        WHERE prestamo_id IN (SELECT id FROM prestamos WHERE cliente_id = ?)
      `, [clienteId])

      await query(`
        UPDATE prestamos
        SET saldo_pendiente = 0,
            cuotas_pagadas = cuotas_totales,
            estado = 'pagado',
            actualizado_en = NOW()
        WHERE cliente_id = ?
      `, [clienteId])
    }

    return NextResponse.json({ ok: true, deuda_limpiada: remainingInvoices.length === 0 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
