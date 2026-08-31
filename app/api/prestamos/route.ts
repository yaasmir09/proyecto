import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const clienteId = url.searchParams.get('cliente_id')

    await db.query(`
      UPDATE prestamos p
      SET saldo_pendiente = 0,
          cuotas_pagadas = cuotas_totales,
          estado = 'pagado',
          actualizado_en = NOW()
      WHERE p.estado = 'activo'
        AND NOT EXISTS (
          SELECT 1 FROM facturas f WHERE f.cliente_id = p.cliente_id
        )
    `)

    let query = `
      SELECT 
        p.id,
        p.cliente_id,
        p.contrato_id,
        p.monto_original,
        p.saldo_pendiente,
        p.cuotas_totales,
        p.cuotas_pagadas,
        p.frecuencia,
        p.tasa,
        p.fecha_inicio,
        p.fecha_proximo_pago,
        p.estado,
        c.nombre as cliente_nombre,
        c.identificacion,
        c.telefono
      FROM prestamos p
      LEFT JOIN clientes c ON p.cliente_id = c.id
    `

    const params: unknown[] = []

    if (clienteId) {
      query += ' WHERE p.cliente_id = $1'
      params.push(Number(clienteId))
    }

    query += ' ORDER BY p.fecha_inicio DESC'

    const result = await db.query(query, params)

    return NextResponse.json({ prestamos: result.rows })
  } catch (error) {
    console.error('Error al obtener préstamos:', error)
    return NextResponse.json(
      { error: 'Error al obtener préstamos' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      cliente_id,
      contrato_id,
      monto_original,
      cuotas_totales,
      frecuencia,
      tasa,
      fecha_inicio,
      cuotas_data,
    } = body

    if (!cliente_id || !monto_original || !cuotas_totales) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
    }

    // Iniciar transacción
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      // Crear préstamo
      const prestamoResult = await client.query(
        `INSERT INTO prestamos 
         (cliente_id, contrato_id, monto_original, saldo_pendiente, cuotas_totales, cuotas_pagadas, frecuencia, tasa, fecha_inicio, fecha_proximo_pago, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [cliente_id, contrato_id || null, monto_original, monto_original, cuotas_totales, 0, frecuencia, tasa, fecha_inicio, fecha_inicio, 'activo']
      )

      const prestamo_id = prestamoResult.rows[0].id

      // Insertar cuotas
      if (Array.isArray(cuotas_data)) {
        for (const cuota of cuotas_data) {
          await client.query(
            `INSERT INTO cuotas 
             (prestamo_id, numero_cuota, fecha_vencimiento, capital, interes, monto_cuota, saldo_pendiente, estado)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              prestamo_id,
              cuota.num,
              cuota.fecha,
              cuota.principal,
              cuota.interes,
              cuota.monto,
              cuota.saldoPendiente,
              'pendiente',
            ]
          )
        }
      }

      await client.query('COMMIT')

      return NextResponse.json(
        { ok: true, prestamo_id, message: 'Préstamo creado exitosamente' },
        { status: 201 }
      )
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error al crear préstamo:', error)
    return NextResponse.json(
      { error: 'Error al crear préstamo' },
      { status: 500 }
    )
  }
}
