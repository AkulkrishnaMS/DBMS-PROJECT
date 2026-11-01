// Difficulty tag. Bands follow the usual convention: easy up to 1000, medium up to 1400, hard above.
export default function DiffBadge({ d }) {
  const cls = d <= 1000 ? 'diff-easy' : d <= 1400 ? 'diff-medium' : 'diff-hard';
  return <span className={'diff ' + cls}>{d}</span>;
}
