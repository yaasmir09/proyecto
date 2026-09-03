import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || undefined,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  user: process.env.DB_USER || undefined,
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME || undefined,
  max: 10,
})

export async function query<T = unknown>(text: string, params: unknown[] = []) {
  // Convert MySQL-style `?` placeholders to Postgres `$1, $2, ...` for compatibility
  let idx = 0
  const textConverted = text.replace(/\?/g, () => {
    idx += 1
    return `$${idx}`
  })

  const res = await pool.query(textConverted, params as any)
  return res.rows as T
}

export async function ensureLoanTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS prestamos (
      id SERIAL PRIMARY KEY,
      cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      contrato_id INT REFERENCES contratos(id) ON DELETE SET NULL,
      monto_original NUMERIC(14,2) NOT NULL,
      saldo_pendiente NUMERIC(14,2) NOT NULL,
      cuotas_totales INT NOT NULL,
      cuotas_pagadas INT DEFAULT 0,
      frecuencia VARCHAR(20) NOT NULL,
      tasa NUMERIC(6,4) NOT NULL,
      fecha_inicio DATE NOT NULL,
      fecha_proximo_pago DATE,
      estado VARCHAR(20) DEFAULT 'activo',
      creado_en TIMESTAMP DEFAULT now(),
      actualizado_en TIMESTAMP DEFAULT now()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS cuotas (
      id SERIAL PRIMARY KEY,
      prestamo_id INT NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
      numero_cuota INT NOT NULL,
      fecha_vencimiento DATE NOT NULL,
      capital NUMERIC(14,2) NOT NULL,
      interes NUMERIC(14,2) NOT NULL,
      monto_cuota NUMERIC(14,2) NOT NULL,
      saldo_pendiente NUMERIC(14,2) NOT NULL,
      estado VARCHAR(20) DEFAULT 'pendiente',
      fecha_pago DATE,
      monto_pagado NUMERIC(14,2) DEFAULT 0,
      creado_en TIMESTAMP DEFAULT now(),
      actualizado_en TIMESTAMP DEFAULT now()
    )
  `)
}

export default pool
