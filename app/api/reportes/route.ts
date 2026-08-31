import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') || 'general'

    if (tipo === 'clientes') {
      const clientes = await query<any[]>(`
        SELECT c.nombre, c.empresa, c.estado, COUNT(f.id) as facturas
        FROM clientes c
        LEFT JOIN facturas f ON f.cliente_id = c.id
        GROUP BY c.id
        ORDER BY facturas DESC
      `)
      return NextResponse.json({ ok: true, report: { title: 'Clientes', rows: clientes } })
    }

    if (tipo === 'vencidas') {
      const vencidas = await query<any[]>(`
        SELECT f.numero_factura, c.nombre, f.monto, f.fecha_vencimiento
        FROM facturas f
        JOIN clientes c ON c.id = f.cliente_id
        WHERE f.estado = 'vencida'
        ORDER BY f.fecha_vencimiento ASC
      `)
      return NextResponse.json({ ok: true, report: { title: 'Facturas vencidas', rows: vencidas } })
    }

    if (tipo === 'pagos') {
      const pagos = await query<any[]>(`
        SELECT DATE_FORMAT(fecha_pago, '%Y-%m') as periodo, SUM(monto) as total
        FROM pagos
        GROUP BY periodo
        ORDER BY periodo ASC
      `)
      return NextResponse.json({ ok: true, report: { title: 'Pagos por mes', rows: pagos } })
    }

    if (tipo === 'riesgo') {
      const riesgo = await query<any[]>(`
        SELECT c.nombre, c.estado, COUNT(f.id) as facturas, COALESCE(SUM(f.monto), 0) as total
        FROM clientes c
        LEFT JOIN facturas f ON f.cliente_id = c.id
        GROUP BY c.id
        HAVING c.estado = 'riesgo' OR COUNT(f.id) > 1
        ORDER BY total DESC
      `)
      return NextResponse.json({ ok: true, report: { title: 'Riesgo de cartera', rows: riesgo } })
    }

    const general = await query<any[]>(`
      SELECT
        (SELECT COUNT(*) FROM clientes) as clientes,
        (SELECT COUNT(*) FROM facturas) as facturas,
        (SELECT COALESCE(SUM(monto), 0) FROM pagos) as pagos,
        (SELECT COUNT(*) FROM facturas WHERE estado = 'vencida') as vencidas
    `)

    return NextResponse.json({ ok: true, report: { title: 'Resumen general', rows: general } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
