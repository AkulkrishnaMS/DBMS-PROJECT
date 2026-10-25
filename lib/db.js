import { Pool } from 'pg';
import { MongoClient } from 'mongodb';

const g = globalThis; // survive Next dev hot-reloads

export const pool = (g._pgPool ??= new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT || 5433),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DB,
}));

export async function mongo() {
  g._mongoP ??= new MongoClient(
    `mongodb://${encodeURIComponent(process.env.MONGO_USER)}:${encodeURIComponent(process.env.MONGO_PASSWORD)}` +
    `@${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || 27017}/?authSource=admin`
  ).connect();
  return (await g._mongoP).db(process.env.MONGO_DB);
}
