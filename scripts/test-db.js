require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER||'root'}:${process.env.DB_PASSWORD||'123qwe'}@${process.env.DB_HOST||'localhost'}:${process.env.DB_PORT||5432}/${process.env.DB_NAME||'cobranza_db'}`;

const pool = new Pool({ connectionString });

pool.query('SELECT NOW() as now')
  .then(res => {
    console.log('OK — conexión establecida. Hora del servidor:', res.rows[0].now);
    return pool.end();
  })
  .catch(err => {
    console.error('Error de conexión:', err.message || err);
    return pool.end().then(() => process.exit(1));
  });
