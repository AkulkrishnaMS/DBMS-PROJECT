// usage: npm run embed      (run after `npm run seed`; safe to repeat, it only fills problems that have no embedding yet)
// Turns each problem's title + statement into 384 numbers (an "embedding") with a small model that runs
// on this computer (no account, no API key), and stores them in problems.embedding (pgvector).
const { Pool } = require('pg');

const MODEL = 'Xenova/all-MiniLM-L6-v2';   // outputs 384 numbers per text, matching vector(384) in the schema

(async () => {
  const { pipeline } = await import('@huggingface/transformers');   // ESM-only package, loaded from CommonJS
  console.log('loading model (the first run downloads it, this can take a minute)...');
  const extractor = await pipeline('feature-extraction', MODEL);

  const pool = new Pool({ host: process.env.PG_HOST || 'localhost', port: +(process.env.PG_PORT || 5433),
    user: process.env.PG_USER, password: process.env.PG_PASSWORD, database: process.env.PG_DB });

  const { rows } = await pool.query(
    'SELECT problem_id, title, statement FROM problems WHERE embedding IS NULL ORDER BY problem_id');
  for (const p of rows) {
    const out = await extractor(`${p.title}. ${p.statement}`, { pooling: 'mean', normalize: true });
    const vec = Array.from(out.data);
    if (vec.length !== 384) throw new Error(`expected 384 numbers, got ${vec.length}`);
    // pgvector reads the text form '[0.1,0.2,...]'
    await pool.query('UPDATE problems SET embedding = $1::vector WHERE problem_id = $2',
      ['[' + vec.join(',') + ']', p.problem_id]);
    console.log(`embedded #${p.problem_id} ${p.title}`);
  }
  console.log(`done: ${rows.length} problems embedded`);

  // show it working: the 3 nearest neighbours of the first embedded problem
  const { rows: [first] } = await pool.query('SELECT problem_id, title FROM problems WHERE embedding IS NOT NULL ORDER BY problem_id LIMIT 1');
  if (first) {
    const { rows: near } = await pool.query('SELECT title, similarity FROM find_similar_problems($1::int, 3)', [first.problem_id]);
    console.log(`\nmost similar to "${first.title}":`);
    for (const n of near) console.log(`  ${n.similarity.toFixed(3)}  ${n.title}`);
  }
  await pool.end();
})().catch((e) => { console.error('embed failed:', e.message); process.exit(1); });
