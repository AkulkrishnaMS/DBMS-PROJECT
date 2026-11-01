// Contest state tag: upcoming, running, ended (finished running, ratings not applied yet) or finished.
export default function Phase({ p }) {
  return <span className={'phase phase-' + p}>{p}</span>;
}
