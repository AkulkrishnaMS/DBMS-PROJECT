import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const LANGS = {
  python: { image: 'python:3.12-slim', file: 'main.py', run: ['python', '/code/main.py'] },
  cpp: { image: 'gcc:13', file: 'main.cpp', run: ['/work/main'],
         compile: ['g++', '-O2', '-o', '/work/main', '/code/main.cpp'] },
};

// One throwaway container per run: no network, capped RAM/CPU/pids, read-only root, no capabilities.
function dockerRun({ image, mounts, cmd, stdin, timeoutMs, memMb }) {
  const name = 'judge_' + crypto.randomBytes(6).toString('hex');
  const args = ['run', '--rm', '-i', '--name', name,
    '--network', 'none', '--memory', `${memMb}m`, '--memory-swap', `${memMb}m`,
    '--cpus', '0.5', '--pids-limit', '64', '--read-only', '--tmpfs', '/tmp:rw,size=64m',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', '65534:65534',
    ...mounts.flatMap((m) => ['-v', m]), image, ...cmd];
  return new Promise((resolve) => {
    const t0 = Date.now();
    let stdout = '', stderr = '', timedOut = false;
    const p = spawn('docker', args);
    const timer = setTimeout(() => { timedOut = true; spawn('docker', ['kill', name]); }, timeoutMs);
    p.stdout.on('data', (d) => { if (stdout.length < 1e6) stdout += d; });
    p.stderr.on('data', (d) => { if (stderr.length < 1e4) stderr += d; });
    p.stdin.on('error', () => {});
    p.stdin.end(stdin);
    p.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, stdout, stderr: String(e), timedOut, ms: 0, spawnFailed: true }); });
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr: stderr.slice(0, 2000), timedOut, ms: Date.now() - t0 }); });
  });
}

const norm = (s) => s.replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).join('\n').trim();

// cases: [{input, expected_output}] -> { verdict, runtimeMs, compileOutput, perCase }
export async function judge({ code, language, cases, timeLimitMs, memoryKb }) {
  const L = LANGS[language];
  if (!L) throw new Error(`Unsupported language: ${language}`);
  const dir = await mkdtemp(path.join(tmpdir(), 'judge-'));
  try {
    for (const d of ['code', 'work']) { await mkdir(path.join(dir, d)); await chmod(path.join(dir, d), 0o777); }
    await writeFile(path.join(dir, 'code', L.file), code, { mode: 0o644 });
    const codeMnt = `${dir}/code:/code:ro`;
    const memMb = Math.max(32, Math.ceil(memoryKb / 1024));

    if (L.compile) {
      const c = await dockerRun({ image: L.image, mounts: [codeMnt, `${dir}/work:/work:rw`],
        cmd: L.compile, stdin: '', timeoutMs: 30000, memMb: 512 });
      if (c.spawnFailed) throw new Error('Docker not available: ' + c.stderr);
      if (c.code !== 0) return { verdict: 'CE', runtimeMs: 0, compileOutput: c.stderr, perCase: [] };
    }

    const perCase = []; let verdict = 'AC', maxMs = 0;
    for (const [i, c] of cases.entries()) {
      const r = await dockerRun({ image: L.image, mounts: [codeMnt, `${dir}/work:/work:ro`],
        cmd: L.run, stdin: c.input, timeoutMs: timeLimitMs + 1500, memMb }); // +1.5s = container start overhead
      if (r.spawnFailed) throw new Error('Docker not available: ' + r.stderr);
      let v;
      if (r.timedOut) v = 'TLE';
      else if (r.code === 137) v = 'MLE';            // killed by OOM
      else if (r.code !== 0) v = 'RE';
      else v = norm(r.stdout) === norm(c.expected_output) ? 'AC' : 'WA';
      perCase.push({ case_idx: i, verdict: v, time_ms: r.ms, stdout: r.stdout.slice(0, 500), stderr: r.stderr });
      maxMs = Math.max(maxMs, r.ms);
      if (v !== 'AC') { verdict = v; break; }          // stop at first failing case
    }
    return { verdict, runtimeMs: maxMs, compileOutput: null, perCase };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
