// Coloured verdict text (AC, WA, TLE, ...). The colour comes from the v-XX class in globals.css.
export default function Verdict({ v }) {
  return <span className={'verdict-tag v-' + v}>{v}</span>;
}
