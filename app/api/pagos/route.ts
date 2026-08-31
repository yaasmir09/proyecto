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

export async function GET() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS pagos (
        id SERIAL PRIMARY KEY,
        factura_id INT NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
        monto NUMERIC(10,2) NOT NULL,
        metodo VARCHAR(50) NOT NULL,
        fecha_pago DATE NOT NULL,
        creado_en TIMESTAMP DEFAULT now()
      )
    `)

    const pagos = await query<any[]>(`
      SELECT p.id, p.monto, p.metodo, p.fecha_pago, f.numero_factura
      FROM pagos p
      JOIN facturas f ON f.id = p.factura_id
      ORDER BY p.fecha_pago DESC
    `)

    return NextResponse.json({ ok: true, pagos })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS pagos (
        id SERIAL PRIMARY KEY,
        factura_id INT NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
        monto NUMERIC(10,2) NOT NULL,
        metodo VARCHAR(50) NOT NULL,
        fecha_pago DATE NOT NULL,
        creado_en TIMESTAMP DEFAULT now()
      )
    `)

    const body = await request.json()
    const { factura_id, prestamo_id, cuota_id, monto, metodo, fecha_pago } = body

    const prestamoId = Number(prestamo_id || 0)
    const cuotaId = Number(cuota_id || 0)
    let safeFacturaId = Number(factura_id || 0)
    const safeMonto = Number(monto || 0)
    const safeMetodo = metodo ?? 'transferencia'
    const today = new Date().toISOString().slice(0, 10)
    const safeFechaPago = (fecha_pago === '' || fecha_pago == null) ? today : fecha_pago

    if (safeMonto <= 0) {
      return NextResponse.json({ ok: false, error: 'El monto del pago debe ser mayor que cero' }, { status: 400 })
    }

    if (!safeFacturaId && prestamoId) {
      const loanRows = await query<any[]>(`SELECT cliente_id FROM prestamos WHERE id = ? LIMIT 1`, [prestamoId])
      const clienteId = Number(loanRows[0]?.cliente_id || 0)
      if (clienteId) {
        const invoiceRows = await query<any[]>(`
          SELECT f.id
          FROM facturas f
          WHERE f.cliente_id = $1
            AND f.monto > COALESCE((SELECT SUM(p.monto) FROM pagos p WHERE p.factura_id = f.id), 0)
          ORDER BY f.id ASC
          LIMIT 1
        `, [clienteId])
        safeFacturaId = Number(invoiceRows[0]?.id || 0)
      }
    }

    if (!safeFacturaId) {
      return NextResponse.json({ ok: false, error: 'Selecciona una factura o un préstamo válido' }, { status: 400 })
    }

    const result = await query<any[]>(
      `INSERT INTO pagos (factura_id, monto, metodo, fecha_pago) VALUES (?, ?, ?, ?) RETURNING id`,
      [safeFacturaId, safeMonto, safeMetodo, safeFechaPago]
    )

    let loanToSync = prestamoId
    let installmentToSync = cuotaId

    if (!loanToSync) {
      const invoiceRows = await query<any[]>(`SELECT cliente_id, monto FROM facturas WHERE id = ? LIMIT 1`, [safeFacturaId])
      const invoice = invoiceRows[0]
      if (invoice) {
        const loanRows = await query<any[]>(`
          SELECT id
          FROM prestamos
          WHERE cliente_id = $1 AND estado = 'activo' AND monto_original = $2
          ORDER BY id ASC
          LIMIT 1
        `, [invoice.cliente_id, invoice.monto])
        loanToSync = Number(loanRows[0]?.id || 0)
      }
    }

    if (loanToSync && !installmentToSync) {
      const installmentRows = await query<any[]>(`
        SELECT id FROM cuotas
        WHERE prestamo_id = $1 AND estado IN ('pendiente', 'parcial')
        ORDER BY numero_cuota ASC
        LIMIT 1
      `, [loanToSync])
      installmentToSync = Number(installmentRows[0]?.id || 0)
    }

    if (loanToSync && installmentToSync) {
      await query(`
        UPDATE cuotas
        SET monto_pagado = LEAST(monto_cuota, COALESCE(monto_pagado, 0) + $1),
            estado = CASE WHEN COALESCE(monto_pagado, 0) + $1 >= monto_cuota THEN 'pagada' ELSE 'parcial' END,
            fecha_pago = $2,
            actualizado_en = NOW()
        WHERE id = $3 AND prestamo_id = $4
      `, [safeMonto, safeFechaPago, installmentToSync, loanToSync])

      await query(`
        UPDATE prestamos
        SET saldo_pendiente = GREATEST(0, saldo_pendiente - $1),
            cuotas_pagadas = (SELECT COUNT(*) FROM cuotas WHERE prestamo_id = $2 AND estado = 'pagada'),
            estado = CASE WHEN GREATEST(0, saldo_pendiente - $1) = 0 THEN 'pagado' ELSE estado END,
            actualizado_en = NOW()
        WHERE id = $2
      `, [safeMonto, loanToSync])
    }

    await syncInvoiceStatus(safeFacturaId)

    const insertedId = Number(result[0]?.id)
    return NextResponse.json({ ok: true, id: insertedId })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
