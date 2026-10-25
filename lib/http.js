import { NextResponse } from 'next/server';

// Wraps a route handler: maps HttpError and Postgres errors to clean JSON responses.
export const handle = (fn) => async (req, ctx) => {
  try { return await fn(req, ctx); }
  catch (e) {
    let status = e.status, msg = e.message;
    if (!status) {
      if (e.code === '23505') { status = 409; msg = 'Already exists'; }
      else if (e.code === '23503') { status = 400; msg = 'Referenced row does not exist'; }
      else if (e.code === '23514') { status = 400; msg = e.message; }   // CHECK / trigger rules
      else if (e.code === '22P02') { status = 400; msg = 'Invalid input'; }
      else if (e instanceof SyntaxError) { status = 400; msg = 'Invalid JSON'; }
      else { status = 500; msg = 'Server error'; console.error(e); }
    }
    return NextResponse.json({ error: msg }, { status });
  }
};

export const bad = (m) => Object.assign(new Error(m), { status: 400 });
