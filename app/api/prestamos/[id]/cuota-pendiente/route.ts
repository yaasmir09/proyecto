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

    // Obtener la siguiente cuota pendiente
    const cuotaResult = await db.query(
      `SELECT * FROM cuotas 
       WHERE prestamo_id = $1 AND estado = $2
       ORDER BY numero_cuota ASC
       LIMIT 1`,
      [prestamoId, 'pendiente']
    )

    if (cuotaResult.rows.length === 0) {
      return NextResponse.json({
        cuota: null,
        message: 'No hay cuotas pendientes',
      })
    }

    return NextResponse.json({
      cuota: cuotaResult.rows[0],
    })
  } catch (error) {
    console.error('Error al obtener cuota pendiente:', error)
    return NextResponse.json(
      { error: 'Error al obtener cuota pendiente' },
      { status: 500 }
    )
  }
}
