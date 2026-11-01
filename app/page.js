import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <h1>CP Judge</h1>
      <p className="muted">Solve problems, join contests, climb the leaderboard.</p>
      <p>
        <Link href="/problems" className="btn">Browse problems</Link>{' '}
        <Link href="/contests" className="btn btn-plain">See contests</Link>
      </p>
    </main>
  );
}
