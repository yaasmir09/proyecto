import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const prestamoId = Number(id)

    if (!prestamoId) {
      return NextResponse.json(
        { error: 'ID de préstamo inválido' },
        { status: 400 }
      )
    }

    // Obtener información del préstamo
    const prestamoResult = await db.query(
      `SELECT 
        p.*,
        c.nombre as cliente_nombre,
        c.identificacion,
        c.telefono,
        c.email
       FROM prestamos p
       LEFT JOIN clientes c ON p.cliente_id = c.id
       WHERE p.id = $1`,
      [prestamoId]
    )

    if (prestamoResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Préstamo no encontrado' },
        { status: 404 }
      )
    }

    // Obtener cuotas
    const cuotasResult = await db.query(
      `SELECT * FROM cuotas WHERE prestamo_id = $1 ORDER BY numero_cuota ASC`,
      [prestamoId]
    )

    return NextResponse.json({
      prestamo: prestamoResult.rows[0],
      cuotas: cuotasResult.rows,
    })
  } catch (error) {
    console.error('Error al obtener préstamo:', error)
    return NextResponse.json(
      { error: 'Error al obtener préstamo' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const prestamoId = Number(id)
    const body = await req.json()
    const {
      cuotas_totales: nuevasCuotas,
      frecuencia,
      tasa,
      cuotas_data,
    } = body

    if (!prestamoId) {
      return NextResponse.json(
        { error: 'ID de préstamo inválido' },
        { status: 400 }
      )
    }

    // Obtener préstamo actual
    const prestamoResult = await db.query(
      'SELECT * FROM prestamos WHERE id = $1',
      [prestamoId]
    )

    if (prestamoResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Préstamo no encontrado' },
        { status: 404 }
      )
    }

    const prestamo = prestamoResult.rows[0]

    // Obtener cuotas pagadas
    const cuotasPagadasResult = await db.query(
      'SELECT COUNT(*) as count FROM cuotas WHERE prestamo_id = $1 AND estado = $2',
      [prestamoId, 'pagada']
    )

    const cuotasPagadas = parseInt(cuotasPagadasResult.rows[0].count, 10)

    // Iniciar transacción
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      // Actualizar préstamo
      await client.query(
        `UPDATE prestamos 
         SET cuotas_totales = $1, frecuencia = $2, tasa = $3, actualizado_en = NOW()
         WHERE id = $4`,
        [nuevasCuotas, frecuencia, tasa, prestamoId]
      )

      // Eliminar cuotas pendientes/no pagadas
      await client.query(
        `DELETE FROM cuotas 
         WHERE prestamo_id = $1 AND estado != $2`,
        [prestamoId, 'pagada']
      )

      // Insertar nuevas cuotas (solo las pendientes)
      if (Array.isArray(cuotas_data)) {
        for (const cuota of cuotas_data) {
          await client.query(
            `INSERT INTO cuotas 
             (prestamo_id, numero_cuota, fecha_vencimiento, capital, interes, monto_cuota, saldo_pendiente, estado)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              prestamoId,
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

      return NextResponse.json({
        ok: true,
        message: 'Préstamo actualizado exitosamente',
        cuotas_pagadas: cuotasPagadas,
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error al actualizar préstamo:', error)
    return NextResponse.json(
      { error: 'Error al actualizar préstamo' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const prestamoId = Number(id)

    if (!prestamoId) {
      return NextResponse.json(
        { error: 'ID de préstamo inválido' },
        { status: 400 }
      )
    }

    await db.query('DELETE FROM prestamos WHERE id = $1', [prestamoId])

    return NextResponse.json({ ok: true, message: 'Préstamo eliminado' })
  } catch (error) {
    console.error('Error al eliminar préstamo:', error)
    return NextResponse.json(
      { error: 'Error al eliminar préstamo' },
      { status: 500 }
    )
  }
}
