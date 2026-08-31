import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

async function syncInvoiceStatus(facturaId: number) {
  const invoiceRows = await query<any[]>(`SELECT monto, fecha_vencimiento FROM facturas WHERE id = ?`, [facturaId])
  const invoice = invoiceRows[0]
  if (!invoice) return

  const paymentRows = await query<any[]>(`SELECT COALESCE(SUM(monto), 0) AS total_pagado FROM pagos WHERE factura_id = ?`, [facturaId])
  const totalPagado = Number(paymentRows[0]?.total_pagado || 0)
  const monto = Number(invoice.monto || 0)
  const fechaVencimiento = invoice.fecha_vencimiento
  const today = new Date().toISOString().slice(0, 10)

  let estado = 'activa'
  if (monto > 0 && totalPagado >= monto) {
    estado = 'pagada'
  } else if (totalPagado > 0) {
    estado = 'revision'
  } else if (fechaVencimiento && fechaVencimiento < today) {
    estado = 'vencida'
  }

  await query(`UPDATE facturas SET estado = ? WHERE id = ?`, [estado, facturaId])
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { factura_id, monto, metodo, fecha_pago } = body
    const { id } = await params

    const existing = await query<any[]>(`SELECT fecha_pago, factura_id FROM pagos WHERE id = ?`, [id])
    const existingRow = existing[0] || {}

    const safeFacturaId = factura_id ?? existingRow.factura_id ?? null
    const safeMonto = monto ?? 0
    const safeMetodo = metodo ?? 'transferencia'
    const today = new Date().toISOString().slice(0, 10)
    const safeFechaPago = (fecha_pago === '' || fecha_pago == null) ? (existingRow.fecha_pago ?? today) : fecha_pago

    await query(
      `UPDATE pagos SET factura_id = ?, monto = ?, metodo = ?, fecha_pago = ? WHERE id = ?`,
      [safeFacturaId, safeMonto, safeMetodo, safeFechaPago, id]
    )

    const pagoRows = await query<any[]>(`SELECT factura_id FROM pagos WHERE id = ?`, [id])
    if (pagoRows[0]?.factura_id) {
      await syncInvoiceStatus(Number(pagoRows[0].factura_id))
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const pagoRows = await query<any[]>(`SELECT factura_id FROM pagos WHERE id = ?`, [id])
    await query(`DELETE FROM pagos WHERE id = ?`, [id])

    if (pagoRows[0]?.factura_id) {
      await syncInvoiceStatus(Number(pagoRows[0].factura_id))
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
