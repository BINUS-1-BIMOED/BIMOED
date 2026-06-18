import React, {useState} from 'react'

export default function SOSButton(){
  const [open,setOpen]=useState(false)
  const [form,setForm]=useState({age:'',is_disabled:false,urgency:'medium',lat:'',lon:'',notes:''})
  async function submit(){
    const payload = {...form,user_id:'anonymous'}
    const res = await fetch('/sos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    const j = await res.json()
    alert(j.accepted ? 'SOS submitted' : 'SOS rejected: '+(j.detail||''))
    setOpen(false)
  }
  return (
    <>
      <button style={{position:'fixed',right:16,bottom:16,zIndex:999}} onClick={()=>setOpen(true)} aria-label="SOS">SOS</button>
      {open && (
        <div className="sos-modal">
          <h3>SOS</h3>
          <label>Age<input value={form.age} onChange={e=>setForm({...form,age:e.target.value})}/></label>
          <label>Disabled<input type='checkbox' checked={form.is_disabled} onChange={e=>setForm({...form,is_disabled:e.target.checked})}/></label>
          <label>Urgency<select value={form.urgency} onChange={e=>setForm({...form,urgency:e.target.value})}><option>low</option><option>medium</option><option>high</option></select></label>
          <label>Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}></textarea></label>
          <button onClick={submit}>Submit SOS</button>
          <button onClick={()=>setOpen(false)}>Cancel</button>
        </div>
      )}
    </>
  )
}
