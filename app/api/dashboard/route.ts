import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const clientes = await query<any[]>(`SELECT COUNT(*) as total_clientes FROM clientes`)
    const facturas = await query<any[]>(`SELECT COUNT(*) as total_facturas FROM facturas`)
    const pagos = await query<any[]>(`SELECT COALESCE(SUM(monto), 0) as total_pagos FROM pagos`)
    const vencidas = await query<any[]>(`SELECT COUNT(*) as total_vencidas FROM facturas WHERE estado = 'vencida'`)

    return NextResponse.json({
      ok: true,
      stats: {
        clientes: clientes[0]?.total_clientes || 0,
        facturas: facturas[0]?.total_facturas || 0,
        pagos: Number(pagos[0]?.total_pagos || 0),
        vencidas: vencidas[0]?.total_vencidas || 0,
      },
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
