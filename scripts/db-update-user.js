require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER||'root'}:${process.env.DB_PASSWORD||'123qwe'}@${process.env.DB_HOST||'localhost'}:${process.env.DB_PORT||5432}/${process.env.DB_NAME||'cobranza_db'}` });

(async ()=>{
  try{
    const upd = await pool.query(`UPDATE usuarios SET rol = $1 WHERE id = $2 RETURNING id,nombre,email,rol`, ['admin', 1]);
    console.log('UPDATED:', upd.rows);
    const res = await pool.query('SELECT id,nombre,email,rol FROM usuarios ORDER BY id');
    console.log('ALL:', res.rows);
  }catch(e){
    console.error(e.message);
  }finally{
    await pool.end();
  }
})();
