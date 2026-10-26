import { useState } from "react";
import { validateMetadata } from "./metadata.mjs";
import type { Scene } from "./types";

export default function SourceMetadata({scene, disabled, onSave}: {scene:Scene; disabled:boolean; onSave:(scene:Scene)=>void}) {
  const [dates,setDates]=useState(scene.dates), [organization,setOrganization]=useState(scene.sourceOrganization ?? ""),
    [attribution,setAttribution]=useState(scene.attribution === "User-supplied imagery" ? "" : scene.attribution),
    [urls,setURLs]=useState(scene.files.map(f=>f.sourceUrl ?? "")), [error,setError]=useState(""), [saved,setSaved]=useState(false);
  return <form onSubmit={e=>{e.preventDefault();try {
    const data=validateMetadata({dates,organization,attribution,urls});
    onSave({...scene, dates:data.dates, sourceOrganization:data.organization, attribution:data.attribution||"User-supplied imagery", metadataOrigin:"user",files:scene.files.map((f,i)=>({...f,sourceUrl:data.urls[i]||undefined}))});
    setError("");setSaved(true);
  }catch(e){setError(e instanceof Error?e.message:"Invalid metadata");}}}>
    <p className="fineprint">User-provided metadata; not independently verified. Editing dates or sources does not change the image pixels or detection settings.</p>
    <fieldset disabled={disabled} style={{border:0,padding:0,margin:0}} onChange={()=>setSaved(false)}>
      <div className="form-grid">{["Before acquisition date","After acquisition date"].map((label,i)=><label key={label}>{label}<input type="date" value={dates[i]??""} onChange={e=>setDates(d=>d.map((v,j)=>i===j?e.target.value:v))}/></label>)}</div>
      <div className="form-grid"><label>Source organization (optional)<input maxLength={200} value={organization} onChange={e=>setOrganization(e.target.value)}/></label><label>Source attribution (optional)<input maxLength={1000} value={attribution} onChange={e=>setAttribution(e.target.value)}/></label></div>
      <div className="form-grid">{["Before source URL","After source URL"].map((label,i)=><label key={label}>{label}<input type="url" value={urls[i]??""} onChange={e=>setURLs(u=>u.map((v,j)=>i===j?e.target.value:v))}/></label>)}</div>
      <button className="secondary" type="submit">Save source metadata</button>
      {saved&&<p role="status">Metadata updated. Wait for “Saved on this device” before closing.</p>}
      {error&&<p className="error-box" role="alert">{error}</p>}
    </fieldset>
  </form>;
}
