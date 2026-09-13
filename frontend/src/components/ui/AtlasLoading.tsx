/** Indeterminate data-loading state. No fabricated percentage or artificial wait. */
export function AtlasLoading({error}:{error:string|null}) {
  return <div className="atlas-loading" role="status">
    <div className="atlas-loading-mark" aria-hidden="true"><span/><svg viewBox="0 0 100 60"><path pathLength="1" d="M4 32 H26 L39 12 L52 49 L67 25 H96"/></svg></div>
    <span className="eyebrow">NEUROPULSE / MALECNS</span>
    <h2>{error?'The atlas is unavailable.':'A world within.'}</h2>
    <p>{error??'Loading the source anatomy and neuron catalogue…'}</p>
    {!error&&<div className="atlas-loading-track" aria-hidden="true"><i/></div>}
    <small>{error?'Reload to try again.':'Real anatomy. A new perspective.'}</small>
  </div>
}
