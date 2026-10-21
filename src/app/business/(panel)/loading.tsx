export default function Loading() {
  return <div className="bp-skeleton" role="status" aria-label="Loading">
    <span className="bp-skel bp-skel-title" />
    <div className="bp-skel-row"><span className="bp-skel" /><span className="bp-skel" /><span className="bp-skel" /><span className="bp-skel" /></div>
    <span className="bp-skel bp-skel-block" />
  </div>;
}
