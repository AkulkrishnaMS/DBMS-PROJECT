// usage: npm run create-admin -- <username> <email> <password>
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
(async () => {
  const [username, email, password] = process.argv.slice(2);
  if (!password) { console.error('usage: npm run create-admin -- <username> <email> <password>'); process.exit(1); }
  const pool = new Pool({ host: process.env.PG_HOST || 'localhost', port: +(process.env.PG_PORT || 5433),
    user: process.env.PG_USER, password: process.env.PG_PASSWORD, database: process.env.PG_DB });
  const hash = await bcrypt.hash(password, 10);
  const r = await pool.query(
    "INSERT INTO users(username,email,password_hash,role) VALUES($1,$2,$3,'admin') RETURNING user_id", [username, email, hash]);
  console.log('admin created, user_id =', r.rows[0].user_id);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
