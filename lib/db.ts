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

export default pool
