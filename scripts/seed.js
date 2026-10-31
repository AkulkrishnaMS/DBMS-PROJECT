// usage: npm run seed      (needs an admin user first: npm run create-admin -- <user> <email> <password>)
// Adds the sample problems from scripts/seed_problems.json to PostgreSQL and their test cases to MongoDB.
// Safe to run again: problems whose title already exists are skipped.
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');

(async () => {
  const problems = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed_problems.json'), 'utf8'));
  const pool = new Pool({ host: process.env.PG_HOST || 'localhost', port: +(process.env.PG_PORT || 5433),
    user: process.env.PG_USER, password: process.env.PG_PASSWORD, database: process.env.PG_DB });
  const client = await new MongoClient(
    `mongodb://${encodeURIComponent(process.env.MONGO_USER)}:${encodeURIComponent(process.env.MONGO_PASSWORD)}` +
    `@${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || 27017}/?authSource=admin`).connect();
  const testCases = client.db(process.env.MONGO_DB).collection('test_cases');

  const { rows: [admin] } = await pool.query("SELECT user_id FROM users WHERE role='admin' ORDER BY user_id LIMIT 1");
  if (!admin) throw new Error('No admin user found. Run: npm run create-admin -- <username> <email> <password>');

  let added = 0, skipped = 0;
  for (const p of problems) {
    const { rows: [row] } = await pool.query(
      `INSERT INTO problems(author_id, title, statement, difficulty) VALUES($1,$2,$3,$4)
       ON CONFLICT (title) DO NOTHING RETURNING problem_id`,
      [admin.user_id, p.title, p.statement, p.difficulty]);
    if (!row) { skipped++; continue; }                       // title already exists
    try {
      await testCases.insertOne({ problem_id: row.problem_id, cases: p.cases.map((c) => ({
        input: c.input, expected_output: c.expected_output, is_sample: !!c.is_sample, weight: 1 })) });
      added++;
    } catch (e) {                                            // no shared transaction: undo the Postgres row by hand
      await pool.query('DELETE FROM problems WHERE problem_id=$1', [row.problem_id]);
      throw e;
    }
  }
  console.log(`seed done: ${added} problems added, ${skipped} already existed`);
  await pool.end();
  await client.close();
})().catch((e) => { console.error('seed failed:', e.message); process.exit(1); });
