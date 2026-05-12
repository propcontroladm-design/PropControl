'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── UTILS ────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const NOW = new Date()
function mk(y:number,m:number){return y+'-'+(m+1<10?'0':'')+(m+1)}
function mlbl(y:number,m:number){return MESES[m]+' '+y}
function fmtN(n:number,c?:string){if(n==null||isNaN(n))return '—';const r=Math.round(n).toLocaleString('es-AR');return c==='dolar'?'U$D '+r:c==='nafta'?r+' L':'$'+r}
function uid(){return Math.random().toString(36).slice(2,9)}
function toP(mo:any,vm:any){if(!mo)return 0;const m=mo.monto||0;if(mo.moneda==='pesos')return m;if(mo.moneda==='dolar')return m*((vm&&vm.dolar)||0);return m*((vm&&vm.nafta)||0)}
function waURL(t:string,m:string){return 'https://wa.me/'+t.replace(/\D/g,'')+'?text='+encodeURIComponent(m)}

function calcM(alq:any,y:number,m:number,vars:any,idx:any[]){
  if(!alq?.contrato)return null
  const c=alq.contrato,mesK=mk(y,m),vm=(vars&&vars[mesK])||{}
  const ini=new Date((alq.fecha_inicio||'2025-01-01')+'T00:00:00')
  const mr=(y-ini.getFullYear())*12+(m-ini.getMonth())+1
  function debeAj(fr:string){if(!fr||fr==='mensual')return true;if(fr==='trimestral')return (mr-1)%3===0;if(fr==='semestral')return (mr-1)%6===0;if(fr==='anual')return (mr-1)%12===0;return true}
  function calcEscalonado(tramos:any[]){
    if(!tramos||tramos.length===0)return null
    // Soporta ambos formatos: por mes (legacy) o por fecha (nuevo)
    const mesDelCalc=new Date(y,m,15).getTime()
    const t=tramos.find((tr:any)=>{
      // Si tiene fechas, usar fechas
      if(tr.fechaDesde&&tr.fechaHasta){
        const d1=new Date(tr.fechaDesde+'T00:00:00').getTime()
        const d2=new Date(tr.fechaHasta+'T23:59:59').getTime()
        return mesDelCalc>=d1&&mesDelCalc<=d2
      }
      // Legacy: por número de mes desde inicio de contrato
      return mr>=tr.mesDesde&&mr<=tr.mesHasta
    })
    return t||null
  }
  function cb(base:number,mon:string,aj:string,iid:string,fr:string,iva:boolean){
    let v=parseFloat(String(base))||0
    if(debeAj(fr)){
      if(aj==='ipc'&&vm.ipc)v=v*(1+vm.ipc/100)
      else if(aj==='custom'&&iid&&idx){const x=idx.find((i:any)=>i.id===iid);if(x?.valores?.[mesK])v=v*(1+x.valores[mesK]/100)}
    }
    return{monto:v*(iva?1.21:1),moneda:mon||'pesos',iva:!!iva}
  }
  // NEW: multi-conceptos (puede ser fijo o escalonado por concepto)
  if(c.conceptos && c.conceptos.length>0){
    const items=c.conceptos.map((cp:any)=>{
      // Si el concepto es escalonado y tiene tramos
      if(cp.tipo==='escalonado'&&cp.tramos&&cp.tramos.length>0){
        const t=calcEscalonado(cp.tramos)
        if(!t)return{monto:0,moneda:cp.moneda||'pesos',iva:!!cp.iva,nombre:cp.nombre,fueraDeRango:true}
        const r=cb(t.montoBase,t.moneda||cp.moneda,t.ajuste||'ninguno',t.indiceId,t.frecAjuste||'mensual',cp.iva)
        return{...r,nombre:cp.nombre||'Concepto'}
      }
      // Concepto fijo
      const r=cb(cp.monto,cp.moneda,cp.ajuste,cp.indice_id,cp.frec_ajuste,cp.iva)
      return{...r,nombre:cp.nombre||'Concepto'}
    })
    const totP=items.reduce((s:number,it:any)=>{
      if(it.moneda==='pesos')return s+it.monto
      if(it.moneda==='dolar')return s+it.monto*((vm&&vm.dolar)||0)
      return s+it.monto*((vm&&vm.nafta)||0)
    },0)
    return{monto:totP,moneda:'pesos',iva:false,items,multi:true}
  }
  const iva=c.iva?true:false
  if(c.tipo==='fijo')return cb(c.monto_base,c.moneda,c.ajuste,c.indice_id,c.frec_ajuste,iva)
  if(c.tipo==='escalonado'){const t=calcEscalonado(c.tramos);if(!t)return null;return cb(t.montoBase,t.moneda||c.moneda,t.ajuste,t.indiceId,t.frecAjuste,iva)}
  return null
}

function estP(cid:string,mesK:string,pagos:any[]){
  const lista=pagos.filter(p=>p.contrato_id===cid&&p.periodo===mesK)
  const tot=lista.reduce((s:number,p:any)=>s+(p.monto_pesos||0),0)
  return{lista,total:tot}
}

// ─── STORE LOCAL ──────────────────────────────
function useAppData(workspaceId:string, userId:string){
  const [props,setProps]=useState<any[]>([])
  const [inqs,setInqs]=useState<any[]>([])
  const [contratos,setContratos]=useState<any[]>([])
  const [pagos,setPagos]=useState<any[]>([])
  const [vars,setVars]=useState<any>({})
  const [gastos,setGastos]=useState<any[]>([])
  const [grupos,setGrupos]=useState<any[]>([])
  const [owners,setOwners]=useState<any[]>([])
  const [indices,setIndices]=useState<any[]>([])
  const [varsCustom,setVarsCustom]=useState<any[]>([])
  const [expensas,setExpensas]=useState<any[]>([])
  const [loading,setLoading]=useState(true)

  useEffect(()=>{if(workspaceId)loadAll()},[workspaceId])

  async function loadAll(){
    if(!workspaceId)return
    setLoading(true)
    const [p,i,c,pg,g,gr,ow,ix,ex,vc]=await Promise.all([
      sb.from('propiedades').select('*').eq('workspace_id',workspaceId),
      sb.from('inquilinos').select('*').eq('workspace_id',workspaceId),
      sb.from('contratos').select('*').eq('workspace_id',workspaceId),
      sb.from('pagos').select('*').eq('workspace_id',workspaceId),
      sb.from('gastos').select('*').eq('workspace_id',workspaceId),
      sb.from('grupos').select('*').eq('workspace_id',workspaceId),
      sb.from('propietarios').select('*').eq('workspace_id',workspaceId),
      sb.from('indices').select('*').eq('workspace_id',workspaceId),
      sb.from('expensas').select('*').eq('workspace_id',workspaceId),
      sb.from('variables_custom').select('*').eq('workspace_id',workspaceId),
    ])
    setProps(p.data||[]);setInqs(i.data||[]);setContratos(c.data||[])
    setPagos(pg.data||[]);setGastos(g.data||[]);setGrupos(gr.data||[])
    setOwners(ow.data||[]);setIndices(ix.data||[]);setExpensas(ex.data||[])
    setVarsCustom(vc.data||[])
    const vRes=await sb.from('variables').select('*').eq('workspace_id',workspaceId)
    const vMap:any={}
    ;(vRes.data||[]).forEach((v:any)=>{vMap[v.periodo]={dolar:v.dolar,nafta:v.nafta,ipc:v.ipc,valores_custom:v.valores_custom||{}}})
    setVars(vMap)
    setLoading(false)
  }

  const ws={workspace_id:workspaceId, usuario_id:userId}

  async function addProp(d:any){const{data}=await sb.from('propiedades').insert({...d,...ws}).select().single();if(data)setProps(p=>[...p,data]);return data}
  async function updProp(id:string,d:any){await sb.from('propiedades').update(d).eq('id',id);setProps(p=>p.map(x=>x.id===id?{...x,...d}:x))}
  async function delProp(id:string){await sb.from('propiedades').delete().eq('id',id);setProps(p=>p.filter(x=>x.id!==id))}
  async function addInq(d:any){const{data}=await sb.from('inquilinos').insert({...d,...ws}).select().single();if(data)setInqs(p=>[...p,data]);return data}
  async function updInq(id:string,d:any){await sb.from('inquilinos').update(d).eq('id',id);setInqs(p=>p.map(x=>x.id===id?{...x,...d}:x))}
  async function delInq(id:string){await sb.from('inquilinos').delete().eq('id',id);setInqs(p=>p.filter(x=>x.id!==id))}
  async function addContrato(d:any){const{data}=await sb.from('contratos').insert({...d,...ws}).select().single();if(data)setContratos(p=>[...p,data]);return data}
  async function updContrato(id:string,d:any){await sb.from('contratos').update(d).eq('id',id);setContratos(p=>p.map(x=>x.id===id?{...x,...d}:x))}
  async function delContrato(id:string){await sb.from('contratos').delete().eq('id',id);setContratos(p=>p.filter(x=>x.id!==id))}
  async function addPago(d:any){const{data}=await sb.from('pagos').insert({...d,...ws}).select().single();if(data)setPagos(p=>[...p,data]);return data}
  async function delPago(id:string){await sb.from('pagos').delete().eq('id',id);setPagos(p=>p.filter(x=>x.id!==id))}
  async function setVar(periodo:string,field:string,val:number){
    await sb.from('variables').upsert({...ws,periodo,[field]:val},{onConflict:'workspace_id,periodo'})
    setVars((v:any)=>({...v,[periodo]:{...(v[periodo]||{}),[field]:val}}))
  }
  async function setVarCustom(periodo:string,customId:string,val:number){
    const current=vars[periodo]?.valores_custom||{}
    const nuevo={...current,[customId]:val}
    await sb.from('variables').upsert({...ws,periodo,valores_custom:nuevo},{onConflict:'workspace_id,periodo'})
    setVars((v:any)=>({...v,[periodo]:{...(v[periodo]||{}),valores_custom:nuevo}}))
  }
  async function addVarCustom(d:any){
    const{data,error}=await sb.from('variables_custom').insert({...d,...ws}).select().single()
    if(!error&&data)setVarsCustom(p=>[...p,data])
    return data
  }
  async function delVarCustom(id:string){
    await sb.from('variables_custom').delete().eq('id',id)
    setVarsCustom(p=>p.filter(x=>x.id!==id))
  }
  async function updVarCustom(id:string,d:any){
    await sb.from('variables_custom').update(d).eq('id',id)
    setVarsCustom(p=>p.map(x=>x.id===id?{...x,...d}:x))
  }
  async function addGasto(d:any){const{data}=await sb.from('gastos').insert({...d,...ws}).select().single();if(data)setGastos(p=>[...p,data]);return data}
  async function delGasto(id:string){await sb.from('gastos').delete().eq('id',id);setGastos(p=>p.filter(x=>x.id!==id))}
  async function addGrupo(d:any){const{data}=await sb.from('grupos').insert({...d,...ws}).select().single();if(data)setGrupos(p=>[...p,data]);return data}
  async function delGrupo(id:string){await sb.from('grupos').delete().eq('id',id);setGrupos(p=>p.filter(x=>x.id!==id))}
  async function addOwner(d:any){const{data}=await sb.from('propietarios').insert({...d,...ws}).select().single();if(data)setOwners(p=>[...p,data]);return data}
  async function updOwner(id:string,d:any){await sb.from('propietarios').update(d).eq('id',id);setOwners(p=>p.map(x=>x.id===id?{...x,...d}:x))}
  async function delOwner(id:string){await sb.from('propietarios').delete().eq('id',id);setOwners(p=>p.filter(x=>x.id!==id))}

  // Bulk import
  async function bulkImport(items:any[], tabla:string){
    const records=items.map((it:any)=>({...it,...ws}))
    const{data,error}=await sb.from(tabla).insert(records).select()
    if(!error)await loadAll()
    return{count:data?.length||0,error}
  }

  // Grupos extra
  async function updGrupo(id:string,d:any){await sb.from('grupos').update(d).eq('id',id);setGrupos(p=>p.map(x=>x.id===id?{...x,...d}:x))}

  // Expensas
  async function addExpensa(d:any){const{data}=await sb.from('expensas').insert({...d,...ws}).select().single();if(data)setExpensas(p=>[...p,data]);return data}
  async function updExpensa(id:string,d:any){await sb.from('expensas').update(d).eq('id',id);setExpensas(p=>p.map(x=>x.id===id?{...x,...d}:x))}
  async function delExpensa(id:string){await sb.from('expensas').delete().eq('id',id);setExpensas(p=>p.filter(x=>x.id!==id))}

  // Indices
  async function addIndice(d:any){const{data}=await sb.from('indices').insert({...d,...ws}).select().single();if(data)setIndices(p=>[...p,data]);return data}
  async function updIndice(id:string,d:any){await sb.from('indices').update(d).eq('id',id);setIndices(p=>p.map(x=>x.id===id?{...x,...d}:x))}
  async function delIndice(id:string){await sb.from('indices').delete().eq('id',id);setIndices(p=>p.filter(x=>x.id!==id))}

  return{props,inqs,contratos,pagos,vars,gastos,grupos,owners,indices,varsCustom,expensas,loading,
    addProp,updProp,delProp,addInq,updInq,delInq,addContrato,updContrato,delContrato,
    addPago,delPago,setVar,setVarCustom,addVarCustom,updVarCustom,delVarCustom,
    addGasto,delGasto,addGrupo,updGrupo,delGrupo,
    addOwner,updOwner,delOwner,addExpensa,updExpensa,delExpensa,
    addIndice,updIndice,delIndice,bulkImport,reload:loadAll}
}

// ─── STYLES ───────────────────────────────────
const S:any={
  card:{background:'white',borderRadius:12,border:'1px solid #e5e7eb',padding:13,marginBottom:9,boxShadow:'0 1px 3px rgba(0,0,0,.07)'},
  inp:{width:'100%',padding:'9px 11px',border:'1.5px solid #e5e7eb',borderRadius:10,fontSize:15,background:'white',outline:'none',boxSizing:'border-box' as const},
  sel:{width:'100%',padding:'9px 11px',border:'1.5px solid #e5e7eb',borderRadius:10,fontSize:15,background:'white',outline:'none',appearance:'none' as const,boxSizing:'border-box' as const},
  lbl:{display:'block',fontSize:11,fontWeight:700,color:'#6b7280',marginBottom:4,textTransform:'uppercase' as const,letterSpacing:.4},
  fg:{marginBottom:11},
  btnP:{width:'100%',background:'#2563eb',color:'white',padding:12,borderRadius:11,fontSize:15,fontWeight:700,marginTop:5,cursor:'pointer',border:'none'},
  btnS:{width:'100%',background:'none',border:'1.5px solid #e5e7eb',color:'#111827',padding:10,borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'},
  btnD:{width:'100%',background:'#fee2e2',color:'#7f1d1d',padding:10,borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',border:'none',marginTop:5},
  modal:{position:'fixed' as const,inset:0,background:'rgba(0,0,0,.5)',zIndex:200,display:'flex',alignItems:'flex-end'},
  modalBox:{background:'white',borderRadius:'20px 20px 0 0',width:'100%',maxHeight:'93vh',overflowY:'auto' as const,padding:'15px 14px 46px'},
  handle:{width:36,height:4,background:'#e5e7eb',borderRadius:2,margin:'0 auto 13px'},
  stab:{padding:'5px 12px',borderRadius:20,border:'1.5px solid #e5e7eb',background:'white',fontSize:12,fontWeight:600,color:'#6b7280',cursor:'pointer',whiteSpace:'nowrap' as const,flexShrink:0},
  stabOn:{padding:'5px 12px',borderRadius:20,border:'1.5px solid #2563eb',background:'#dbeafe',fontSize:12,fontWeight:600,color:'#2563eb',cursor:'pointer',whiteSpace:'nowrap' as const,flexShrink:0},
}

function Badge({e}:{e:string}){
  const cfg:any={pagado:{bg:'#dcfce7',c:'#14532d',t:'✓ Pagado'},parcial:{bg:'#fef3c7',c:'#78350f',t:'~ Parcial'},pendiente:{bg:'#fee2e2',c:'#7f1d1d',t:'✗ Pendiente'}}
  const x=cfg[e]||cfg.pendiente
  return <span style={{display:'inline-flex',alignItems:'center',padding:'3px 9px',borderRadius:20,fontSize:12,fontWeight:600,background:x.bg,color:x.c}}>{x.t}</span>
}

// ─── MODAL PAGO ───────────────────────────────
function ModalPago({contrato,mes,mObj,vm,lista,inqNombre,onClose,onAdd,onDel}:any){
  const [monto,setMonto]=useState('')
  const [moneda,setMoneda]=useState(mObj?.moneda||'pesos')
  const [tipo,setTipo]=useState('transferencia')
  const [det,setDet]=useState('')
  const espP=toP(mObj,vm)
  const totP=lista.reduce((s:number,p:any)=>s+(p.monto_pesos||0),0)
  const n=parseFloat(monto)||0
  const mp=moneda==='pesos'?n:moneda==='dolar'?n*(vm?.dolar||0):n*(vm?.nafta||0)

  return(
    <div style={S.modal} onClick={(e:any)=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={S.modalBox}>
        <div style={S.handle}/>
        <div style={{fontSize:17,fontWeight:800,marginBottom:13}}>Registrar Pago</div>
        <div style={{marginBottom:9}}>
          <span style={{display:'inline-block',background:'#f3f4f6',color:'#6b7280',padding:'2px 7px',borderRadius:20,fontSize:12,marginRight:4}}>{mlbl(mes.year,mes.month)}</span>
          <span style={{display:'inline-block',background:'#f3f4f6',color:'#6b7280',padding:'2px 7px',borderRadius:20,fontSize:12,marginRight:4}}>{contrato.nombre_propiedad||''}</span>
          {inqNombre&&<span style={{display:'inline-block',background:'#f3f4f6',color:'#6b7280',padding:'2px 7px',borderRadius:20,fontSize:12}}>{inqNombre}</span>}
        </div>
        {lista.length>0&&<div>
          <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'14px 0 7px'}}>Pagos del período</p>
          {lista.map((pg:any)=>(
            <div key={pg.id} style={{background:'#f3f4f6',borderRadius:8,padding:'8px 10px',marginBottom:5,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:14,fontWeight:700}}>{fmtN(pg.monto,pg.moneda)}{pg.moneda!=='pesos'&&` ≈ ${fmtN(pg.monto_pesos,'pesos')}`}</div>
                <div style={{fontSize:11,color:'#6b7280',marginTop:1}}>{pg.tipo_pago==='efectivo'?'💵':pg.tipo_pago==='cheque'?'📋':'🏦'} {pg.tipo_pago||''}{pg.detalle?' · '+pg.detalle:''} · {pg.fecha}</div>
              </div>
              <button onClick={()=>onDel(pg.id)} style={{background:'none',border:'none',color:'#dc2626',fontSize:18,padding:'2px 6px',cursor:'pointer',lineHeight:1}}>×</button>
            </div>
          ))}
          <div style={{padding:'9px 11px',borderRadius:9,fontSize:13,marginBottom:9,background:totP>=espP?'#dcfce7':'#fef3c7',color:totP>=espP?'#14532d':'#78350f'}}>
            {totP>=espP?`✓ Cubierto: ${fmtN(totP,'pesos')}`:`Pagado: ${fmtN(totP,'pesos')} | Falta: ${fmtN(Math.max(0,espP-totP),'pesos')}`}
          </div>
        </div>}
        <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'14px 0 7px'}}>Agregar pago</p>
        {mObj&&<div style={{padding:'9px 11px',borderRadius:9,fontSize:13,marginBottom:9,background:'#dbeafe',color:'#1e3a8a'}}>Esperado: {fmtN(mObj.monto,mObj.moneda)}{mObj.iva?' (IVA 21%)':''}</div>}
        <div style={S.fg}>
          <label style={S.lbl}>Monto</label>
          <div style={{display:'flex',border:'1.5px solid #e5e7eb',borderRadius:10,overflow:'hidden'}}>
            <select style={{border:'none',background:'#f3f4f6',padding:'9px 8px',fontSize:13,fontWeight:700,outline:'none',borderRight:'1px solid #e5e7eb',minWidth:72,color:'#111827'}} value={moneda} onChange={e=>setMoneda(e.target.value)}>
              <option value="pesos">$ Pesos</option><option value="dolar">U$D</option><option value="nafta">L Nafta</option>
            </select>
            <input style={{flex:1,border:'none',padding:'9px 11px',fontSize:15,outline:'none',background:'white',minWidth:0}} type="number" placeholder="0" value={monto} onChange={e=>setMonto(e.target.value)} autoFocus/>
          </div>
        </div>
        {moneda!=='pesos'&&mp>0&&<div style={{padding:'9px 11px',borderRadius:9,fontSize:13,marginBottom:9,background:'#dbeafe',color:'#1e3a8a'}}>≈ {fmtN(mp,'pesos')}</div>}
        <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'14px 0 7px'}}>Forma de pago</p>
        <div style={{display:'flex',gap:6,marginBottom:9}}>
          {['transferencia','cheque','efectivo'].map(t=>(
            <button key={t} onClick={()=>setTipo(t)} style={{flex:1,padding:'8px 4px',borderRadius:9,border:`1.5px solid ${tipo===t?'#2563eb':'#e5e7eb'}`,background:tipo===t?'#dbeafe':'white',fontSize:12,fontWeight:700,color:tipo===t?'#2563eb':'#6b7280',cursor:'pointer'}}>
              {t==='transferencia'?'🏦 Transf.':t==='cheque'?'📋 Cheque':'💵 Efectivo'}
            </button>
          ))}
        </div>
        {(tipo==='transferencia'||tipo==='cheque')&&<div style={S.fg}><label style={S.lbl}>{tipo==='cheque'?'N° cheque y banco':'Destinatario'}</label><input style={S.inp} value={det} onChange={e=>setDet(e.target.value)}/></div>}
        <button style={S.btnP} onClick={()=>{if(n>0){onAdd({monto:n,moneda,monto_pesos:mp,tipo_pago:tipo,detalle:det,fecha:new Date().toISOString().slice(0,10)});setMonto('');setDet('')}}}>+ Agregar pago</button>
        <button style={{...S.btnS,marginTop:7}} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  )
}

// ─── FORM PROPIEDAD ───────────────────────────
function FormProp({ini,grupos,owners,propsList,onSave,onDelete,onClose}:any){
  const [d,setD]=useState(ini||{codigo:'',nombre:'',direccion:'',ciudad:'Yerba Buena',tipo:'local',superficie:'',observaciones:'',activo:true,grupo_id:'',valor_compra:0,pct_expensas:0,propietarios:[]})
  const up=(f:string,v:any)=>setD((p:any)=>({...p,[f]:v}))
  const ok=d.nombre.trim()
  return(
    <div style={S.modal} onClick={(e:any)=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={S.modalBox}>
        <div style={S.handle}/>
        <div style={{fontSize:17,fontWeight:800,marginBottom:13}}>{ini?'Editar propiedad':'Nueva propiedad'}</div>
        <div style={{display:'flex',gap:9,marginBottom:11}}>
          <div style={{flex:1}}><label style={S.lbl}>Código</label><input style={S.inp} value={d.codigo} onChange={e=>up('codigo',e.target.value)} placeholder="HL01"/></div>
          <div style={{flex:1}}><label style={S.lbl}>Tipo</label>
            <select style={S.sel} value={d.tipo} onChange={e=>up('tipo',e.target.value)}>
              <option value="local">Local</option><option value="depto">Depto</option><option value="terreno">Terreno</option><option value="otro">Otro</option>
            </select>
          </div>
        </div>
        <div style={S.fg}><label style={S.lbl}>Nombre</label><input style={S.inp} value={d.nombre} onChange={e=>up('nombre',e.target.value)} placeholder="Ej: Punto Heller L1"/></div>
        <div style={S.fg}><label style={S.lbl}>Dirección</label><input style={S.inp} value={d.direccion} onChange={e=>up('direccion',e.target.value)}/></div>
        <div style={{display:'flex',gap:9,marginBottom:11}}>
          <div style={{flex:1}}><label style={S.lbl}>Ciudad</label><input style={S.inp} value={d.ciudad} onChange={e=>up('ciudad',e.target.value)}/></div>
          <div style={{flex:1}}><label style={S.lbl}>m²</label><input style={S.inp} type="number" value={d.superficie} onChange={e=>up('superficie',e.target.value)}/></div>
        </div>
        {/* GRUPO con UX mejorado */}
        <div style={{...S.fg,background:'#f8fafc',padding:12,borderRadius:11,border:'1px solid #e5e7eb',marginBottom:12}}>
          <label style={{...S.lbl,marginBottom:6}}>🏘️ Grupo / Edificio</label>
          {grupos.length===0?<div style={{padding:'10px 12px',borderRadius:9,fontSize:12,background:'#fef3c7',color:'#78350f',marginBottom:6}}>
            Todavía no creaste grupos. Andá a la pestaña <strong>Grupos</strong> para crear uno (ej: "Edificio Belgrano") y volvé acá.
          </div>:<>
            <select style={{...S.sel,marginBottom:d.grupo_id?10:0}} value={d.grupo_id||''} onChange={e=>up('grupo_id',e.target.value)}>
              <option value="">— Esta propiedad NO pertenece a un grupo —</option>
              {grupos.map((g:any)=><option key={g.id} value={g.id}>📍 {g.nombre}{g.direccion?' · '+g.direccion:''}</option>)}
            </select>
            {d.grupo_id&&(()=>{
              const grupoElegido=grupos.find((g:any)=>g.id===d.grupo_id)
              const otrasProps=(propsList||[]).filter((p:any)=>p.grupo_id===d.grupo_id&&p.id!==ini?.id)
              const pctOtras=otrasProps.reduce((s:number,p:any)=>s+(p.pct_expensas||0),0)
              const pctActual=parseFloat(d.pct_expensas)||0
              const total=pctOtras+pctActual
              const restante=100-pctOtras
              return(
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                    <label style={{...S.lbl,marginBottom:0,flex:1}}>% Expensas que le tocan a esta propiedad</label>
                    <button type="button" onClick={()=>up('pct_expensas',Math.max(0,restante))} style={{background:'#dbeafe',color:'#2563eb',padding:'3px 9px',borderRadius:6,fontSize:11,fontWeight:700,border:'none',cursor:'pointer'}}>Auto: {restante.toFixed(1)}%</button>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <input style={{...S.inp,flex:1}} type="number" step="0.01" placeholder="Ej: 25" value={d.pct_expensas||''} onChange={e=>up('pct_expensas',parseFloat(e.target.value)||0)}/>
                    <span style={{fontSize:18,fontWeight:700,color:'#475569'}}>%</span>
                  </div>
                  {otrasProps.length>0&&<div style={{marginTop:10,padding:'10px 12px',background:'white',borderRadius:9,border:'1px solid #e5e7eb'}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6}}>Otras propiedades en {grupoElegido?.nombre}:</div>
                    {otrasProps.map((p:any)=>(
                      <div key={p.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'2px 0'}}>
                        <span>{p.codigo} · {p.nombre}</span>
                        <span style={{fontWeight:700,color:'#475569'}}>{p.pct_expensas||0}%</span>
                      </div>
                    ))}
                    <div style={{marginTop:7,paddingTop:7,borderTop:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',fontSize:13,fontWeight:700,color:total===100?'#16a34a':total>100?'#dc2626':'#d97706'}}>
                      <span>Total acumulado:</span>
                      <span>{total.toFixed(1)}% {total===100?'✓':total>100?'⚠️ Pasa de 100':`(falta ${(100-total).toFixed(1)}%)`}</span>
                    </div>
                  </div>}
                </div>
              )
            })()}
          </>}
        </div>
        <div style={S.fg}><label style={S.lbl}>Valor de compra ($) — para ROI</label><input style={S.inp} type="number" value={d.valor_compra||''} onChange={e=>up('valor_compra',parseFloat(e.target.value)||0)}/></div>
        {owners&&owners.length>0&&<div style={S.fg}>
          <label style={S.lbl}>Propietarios y porcentajes</label>
          <div style={{padding:'8px 10px',borderRadius:9,fontSize:11,marginBottom:7,background:'#dbeafe',color:'#1e3a8a'}}>Si esta propiedad tiene varios dueños, asigná el % de cada uno. La suma debería dar 100%.</div>
          {owners.map((o:any)=>{
            const asig=(d.propietarios||[]).find((p:any)=>p.owner_id===o.id)
            return(
              <div key={o.id} style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                <span style={{fontSize:13,flex:1}}>{o.nombre}</span>
                <input style={{width:80,padding:'5px 8px',border:'1.5px solid #e5e7eb',borderRadius:8,fontSize:13,textAlign:'right'}} type="number" placeholder="0%" value={asig?.pct||''} onChange={e=>{
                  const v=parseFloat(e.target.value)||0
                  const list=(d.propietarios||[]).filter((p:any)=>p.owner_id!==o.id)
                  if(v>0)list.push({owner_id:o.id,nombre:o.nombre,pct:v})
                  up('propietarios',list)
                }}/>
                <span style={{fontSize:12,color:'#6b7280'}}>%</span>
              </div>
            )
          })}
        </div>}
        <div style={S.fg}><label style={S.lbl}>Observaciones</label><textarea style={{...S.inp,resize:'none'}} rows={2} value={d.observaciones} onChange={e=>up('observaciones',e.target.value)}/></div>
        <button style={{...S.btnP,opacity:ok?1:.5}} disabled={!ok} onClick={()=>{if(ok){onSave(d);onClose()}}}>Guardar</button>
        {ini&&<button style={S.btnD} onClick={()=>{onDelete();onClose()}}>Eliminar propiedad</button>}
        <button style={{...S.btnS,marginTop:7}} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── FORM INQUILINO ───────────────────────────
function FormInq({ini,onSave,onDelete,onClose}:any){
  const [d,setD]=useState(ini||{nombre:'',es_sociedad:false,cuit:'',dni:'',telefono:'',email:'',contacto_pagos:'',tel_contacto:'',observaciones:''})
  const up=(f:string,v:any)=>setD((p:any)=>({...p,[f]:v}))
  const ok=d.nombre.trim()
  return(
    <div style={S.modal} onClick={(e:any)=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={S.modalBox}>
        <div style={S.handle}/>
        <div style={{fontSize:17,fontWeight:800,marginBottom:13}}>{ini?'Editar inquilino':'Nuevo inquilino'}</div>
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',fontSize:14,marginBottom:8}}>
          <input type="checkbox" id="es_soc" checked={d.es_sociedad} onChange={e=>up('es_sociedad',e.target.checked)} style={{width:17,height:17,accentColor:'#2563eb'}}/>
          <label htmlFor="es_soc" style={{fontWeight:600}}>Es sociedad / empresa</label>
        </div>
        <div style={S.fg}><label style={S.lbl}>{d.es_sociedad?'Razón social':'Nombre completo'}</label><input style={S.inp} value={d.nombre} onChange={e=>up('nombre',e.target.value)}/></div>
        {d.es_sociedad&&<div style={S.fg}><label style={S.lbl}>CUIT</label><input style={S.inp} value={d.cuit||''} onChange={e=>up('cuit',e.target.value)} placeholder="30-12345678-9"/></div>}
        {d.es_sociedad&&<div style={{background:'#dbeafe',borderRadius:9,padding:'9px 10px',marginBottom:11}}>
          <p style={{fontSize:11,fontWeight:700,color:'#1e3a8a',marginBottom:6}}>CONTACTO DE PAGOS</p>
          <div style={S.fg}><label style={S.lbl}>Nombre</label><input style={S.inp} value={d.contacto_pagos||''} onChange={e=>up('contacto_pagos',e.target.value)}/></div>
          <div style={{marginBottom:0}}><label style={S.lbl}>WhatsApp</label><input style={S.inp} type="tel" value={d.tel_contacto||''} onChange={e=>up('tel_contacto',e.target.value)}/></div>
        </div>}
        {!d.es_sociedad&&<div style={S.fg}><label style={S.lbl}>DNI</label><input style={S.inp} value={d.dni||''} onChange={e=>up('dni',e.target.value)}/></div>}
        <div style={S.fg}><label style={S.lbl}>Teléfono / WhatsApp</label><input style={S.inp} type="tel" value={d.telefono} onChange={e=>up('telefono',e.target.value)}/></div>
        <div style={S.fg}><label style={S.lbl}>Email</label><input style={S.inp} type="email" value={d.email} onChange={e=>up('email',e.target.value)}/></div>
        <button style={{...S.btnP,opacity:ok?1:.5}} disabled={!ok} onClick={()=>{if(ok){onSave(d);onClose()}}}>Guardar</button>
        {ini&&<button style={S.btnD} onClick={()=>{onDelete();onClose()}}>Eliminar</button>}
        <button style={{...S.btnS,marginTop:7}} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── FORM CONTRATO ────────────────────────────
function FormContrato({ini,props,inqs,onSave,onDelete,onClose}:any){
  const hasConceptos = ini?.contrato?.conceptos?.length > 0
  const [modo,setModo]=useState<'simple'|'multi'>(hasConceptos?'multi':(ini?'simple':'simple'))
  const [d,setD]=useState(ini||{
    propiedad_id:'',propiedades_ids:[],inquilino_id:'',
    fecha_inicio:new Date().toISOString().slice(0,10),fecha_fin:'',
    activo:true,tipo:'fijo',moneda:'pesos',monto_base:'',ajuste:'ninguno',frec_ajuste:'mensual',iva:false,
    tramos:[{id:uid(),fechaDesde:new Date().toISOString().slice(0,10),fechaHasta:new Date(new Date().setMonth(new Date().getMonth()+6)).toISOString().slice(0,10),montoBase:'',moneda:'pesos',ajuste:'ninguno',frecAjuste:'mensual'}],
    conceptos:[]
  })
  const [propSearch,setPropSearch]=useState('')
  const [inqSearch,setInqSearch]=useState('')

  // Inicializar propiedades_ids desde propiedad_id si viene legacy
  useEffect(()=>{
    if(ini && (!d.propiedades_ids || d.propiedades_ids.length===0) && d.propiedad_id){
      setD((p:any)=>({...p,propiedades_ids:[d.propiedad_id]}))
    }
  },[])

  useEffect(()=>{
    if(modo==='multi'&&(!d.conceptos||d.conceptos.length===0)){
      setD((p:any)=>({...p,conceptos:[
        {id:uid(),nombre:'Alquiler',tipo:'fijo',monto:'',moneda:'pesos',ajuste:'ninguno',frec_ajuste:'mensual',iva:false,tramos:[]}
      ]}))
    }
  },[modo])

  const up=(f:string,v:any)=>setD((p:any)=>({...p,[f]:v}))

  // Tramos del modo simple escalonado
  const upT=(tid:string,f:string,v:any)=>setD((p:any)=>({...p,tramos:p.tramos.map((t:any)=>t.id===tid?{...t,[f]:v}:t)}))
  const addT=()=>setD((p:any)=>{
    const last=p.tramos[p.tramos.length-1]
    let fechaDesde=p.fecha_inicio||new Date().toISOString().slice(0,10)
    let fechaHasta=new Date(new Date(fechaDesde).setMonth(new Date(fechaDesde).getMonth()+6)).toISOString().slice(0,10)
    if(last?.fechaHasta){
      const next=new Date(last.fechaHasta);next.setDate(next.getDate()+1)
      fechaDesde=next.toISOString().slice(0,10)
      const fin=new Date(fechaDesde);fin.setMonth(fin.getMonth()+6)
      fechaHasta=fin.toISOString().slice(0,10)
    }
    return{...p,tramos:[...p.tramos,{id:uid(),fechaDesde,fechaHasta,montoBase:'',moneda:p.moneda||'pesos',ajuste:'ninguno',frecAjuste:'mensual'}]}
  })
  const delT=(tid:string)=>setD((p:any)=>({...p,tramos:p.tramos.filter((t:any)=>t.id!==tid)}))

  // Conceptos
  const upC=(cid:string,f:string,v:any)=>setD((p:any)=>({...p,conceptos:p.conceptos.map((cp:any)=>cp.id===cid?{...cp,[f]:v}:cp)}))
  const addC=()=>setD((p:any)=>({...p,conceptos:[...(p.conceptos||[]),{id:uid(),nombre:'',tipo:'fijo',monto:'',moneda:'pesos',ajuste:'ninguno',frec_ajuste:'mensual',iva:false,tramos:[]}]}))
  const delC=(cid:string)=>setD((p:any)=>({...p,conceptos:p.conceptos.filter((cp:any)=>cp.id!==cid)}))

  // Tramos dentro de conceptos
  const addCT=(cid:string)=>setD((p:any)=>({...p,conceptos:p.conceptos.map((cp:any)=>{
    if(cp.id!==cid)return cp
    const tramos=cp.tramos||[]
    const last=tramos[tramos.length-1]
    let fechaDesde=p.fecha_inicio||new Date().toISOString().slice(0,10)
    let fechaHasta=new Date(new Date(fechaDesde).setMonth(new Date(fechaDesde).getMonth()+6)).toISOString().slice(0,10)
    if(last?.fechaHasta){
      const next=new Date(last.fechaHasta);next.setDate(next.getDate()+1)
      fechaDesde=next.toISOString().slice(0,10)
      const fin=new Date(fechaDesde);fin.setMonth(fin.getMonth()+6)
      fechaHasta=fin.toISOString().slice(0,10)
    }
    return{...cp,tramos:[...tramos,{id:uid(),fechaDesde,fechaHasta,montoBase:'',moneda:cp.moneda||'pesos',ajuste:'ninguno',frecAjuste:'mensual'}]}
  })}))
  const upCT=(cid:string,tid:string,f:string,v:any)=>setD((p:any)=>({...p,conceptos:p.conceptos.map((cp:any)=>{
    if(cp.id!==cid)return cp
    return{...cp,tramos:(cp.tramos||[]).map((t:any)=>t.id===tid?{...t,[f]:v}:t)}
  })}))
  const delCT=(cid:string,tid:string)=>setD((p:any)=>({...p,conceptos:p.conceptos.map((cp:any)=>{
    if(cp.id!==cid)return cp
    return{...cp,tramos:(cp.tramos||[]).filter((t:any)=>t.id!==tid)}
  })}))

  // Multi-propiedad toggle
  const toggleProp=(propId:string)=>setD((p:any)=>{
    const list=p.propiedades_ids||[]
    if(list.includes(propId))return{...p,propiedades_ids:list.filter((id:string)=>id!==propId)}
    return{...p,propiedades_ids:[...list,propId]}
  })

  const propsActivas=props.filter((p:any)=>p.activo)
  const propsSeleccionadas=(d.propiedades_ids||[])
  
  const ok=propsSeleccionadas.length>0&&d.inquilino_id&&d.fecha_inicio&&(
    modo==='multi' ? (d.conceptos?.length>0 && d.conceptos.every((cp:any)=>{
      if(!cp.nombre)return false
      if(cp.tipo==='escalonado')return cp.tramos&&cp.tramos.length>0&&cp.tramos.every((t:any)=>t.montoBase)
      return cp.monto
    })) :
    (d.tipo==='fijo'?d.monto_base:d.tramos.every((t:any)=>t.montoBase))
  )

  const inq=inqs.find((i:any)=>i.id===d.inquilino_id)
  const propsObjs=propsActivas.filter((p:any)=>propsSeleccionadas.includes(p.id))
  const nombrePropConcat=propsObjs.map((p:any)=>p.codigo||p.nombre).join(' + ')

  const handleSave=()=>{
    if(!ok)return
    let data:any={...d,nombre_propiedad:nombrePropConcat||'',nombre_inquilino:inq?inq.nombre:''}
    // Mantener propiedad_id por compatibilidad (la primera)
    data.propiedad_id=propsSeleccionadas[0]
    
    if(modo==='multi'){
      data.conceptos=data.conceptos.map((cp:any)=>{
        if(cp.tipo==='escalonado'){
          return{...cp,monto:0,tramos:(cp.tramos||[]).map((t:any)=>({...t,montoBase:parseFloat(t.montoBase)||0}))}
        }
        return{...cp,monto:parseFloat(cp.monto)||0,tramos:[]}
      })
      data.tipo='multi'
      data.monto_base=0
      data.tramos=[]
    } else {
      data.conceptos=[]
      if(data.tipo==='fijo')data.monto_base=parseFloat(data.monto_base)||0
      else data.tramos=data.tramos.map((t:any)=>({...t,montoBase:parseFloat(t.montoBase)||0}))
    }
    onSave(data);onClose()
  }

  const AJ=['ninguno','ipc','dolar','nafta']
  const FR=['mensual','trimestral','semestral','anual']

  return(
    <div style={S.modal} onClick={(e:any)=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={S.modalBox}>
        <div style={S.handle}/>
        <div style={{fontSize:17,fontWeight:800,marginBottom:13}}>{ini?'Editar contrato':'Nuevo contrato'}</div>

        {/* PROPIEDADES (multi) */}
        <div style={{...S.fg,background:'#f8fafc',padding:12,borderRadius:11,border:'1px solid #e5e7eb'}}>
          <label style={{...S.lbl,marginBottom:6}}>🏢 Propiedades del contrato</label>
          <div style={{padding:'8px 10px',borderRadius:8,fontSize:11,marginBottom:9,background:'#dbeafe',color:'#1e3a8a'}}>
            Marcá una o varias propiedades (ej: dos locales que se alquilan juntos)
          </div>
          {propsActivas.length===0?<div style={{padding:10,fontSize:12,color:'#78350f',background:'#fef3c7',borderRadius:8}}>No hay propiedades activas. Creá una primero.</div>:<>
            <div style={{position:'relative',marginBottom:6}}>
              <input style={{...S.inp,paddingLeft:32,fontSize:13}} placeholder="🔍 Buscar..." value={propSearch} onChange={e=>setPropSearch(e.target.value)}/>
              {propSearch&&<button type="button" onClick={()=>setPropSearch('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'#f3f4f6',border:'none',color:'#64748b',fontSize:12,cursor:'pointer',padding:'2px 7px',borderRadius:5}}>✕</button>}
            </div>
            <div style={{maxHeight:180,overflowY:'auto',background:'white',border:'1px solid #e5e7eb',borderRadius:9,padding:6}}>
              {(()=>{
                const q=propSearch.toLowerCase().trim()
                const lista=q?propsActivas.filter((p:any)=>((p.codigo||'')+' '+(p.nombre||'')+' '+(p.direccion||'')).toLowerCase().includes(q)):propsActivas
                if(lista.length===0)return<div style={{textAlign:'center',padding:18,color:'#94a3b8',fontSize:12}}>Sin resultados</div>
                return lista.map((p:any)=>{
                  const sel=propsSeleccionadas.includes(p.id)
                  return(
                    <label key={p.id} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 9px',borderRadius:7,cursor:'pointer',background:sel?'#dbeafe':'transparent',marginBottom:2}}>
                      <input type="checkbox" checked={sel} onChange={()=>toggleProp(p.id)} style={{width:16,height:16,accentColor:'#2563eb'}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:'#0f172a'}}>{p.codigo} · {p.nombre}</div>
                        {p.direccion&&<div style={{fontSize:11,color:'#64748b'}}>{p.direccion}</div>}
                      </div>
                    </label>
                  )
                })
              })()}
            </div>
          </>}
          {propsSeleccionadas.length>1&&<div style={{marginTop:7,padding:'6px 9px',background:'#dcfce7',color:'#14532d',borderRadius:7,fontSize:11,fontWeight:600}}>✓ {propsSeleccionadas.length} propiedades seleccionadas</div>}
        </div>

        <div style={S.fg}><label style={S.lbl}>👤 Inquilino</label>
          {inqs.length>5?<>
            <div style={{position:'relative',marginBottom:6}}>
              <input style={{...S.inp,fontSize:13}} placeholder="🔍 Buscar inquilino..." value={inqSearch} onChange={e=>setInqSearch(e.target.value)}/>
              {inqSearch&&<button type="button" onClick={()=>setInqSearch('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'#f3f4f6',border:'none',color:'#64748b',fontSize:12,cursor:'pointer',padding:'2px 7px',borderRadius:5}}>✕</button>}
            </div>
            <div style={{maxHeight:160,overflowY:'auto',background:'white',border:'1px solid #e5e7eb',borderRadius:9,padding:4}}>
              {(()=>{
                const q=inqSearch.toLowerCase().trim()
                const lista=q?inqs.filter((i:any)=>((i.nombre||'')+' '+(i.email||'')+' '+(i.telefono||'')+' '+(i.dni||'')+' '+(i.cuit||'')).toLowerCase().includes(q)):inqs
                if(lista.length===0)return<div style={{textAlign:'center',padding:14,color:'#94a3b8',fontSize:12}}>Sin resultados</div>
                return lista.map((i:any)=>(
                  <button key={i.id} type="button" onClick={()=>up('inquilino_id',i.id)} style={{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'7px 9px',borderRadius:7,cursor:'pointer',background:d.inquilino_id===i.id?'#dbeafe':'transparent',border:'none',textAlign:'left',marginBottom:1}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#0f172a'}}>{i.nombre}{i.es_sociedad?' 🏢':''}</div>
                      {(i.telefono||i.email)&&<div style={{fontSize:11,color:'#64748b'}}>{i.telefono||i.email}</div>}
                    </div>
                    {d.inquilino_id===i.id&&<span style={{color:'#2563eb',fontWeight:700}}>✓</span>}
                  </button>
                ))
              })()}
            </div>
          </>:<select style={S.sel} value={d.inquilino_id} onChange={e=>up('inquilino_id',e.target.value)}>
            <option value="">— Seleccionar —</option>
            {inqs.map((i:any)=><option key={i.id} value={i.id}>{i.nombre}{i.es_sociedad?' 🏢':''}</option>)}
          </select>}
        </div>

        <div style={{display:'flex',gap:9,marginBottom:11}}>
          <div style={{flex:1}}><label style={S.lbl}>📅 Inicio</label><input style={S.inp} type="date" value={d.fecha_inicio} onChange={e=>up('fecha_inicio',e.target.value)}/></div>
          <div style={{flex:1}}><label style={S.lbl}>📅 Vencimiento</label><input style={S.inp} type="date" value={d.fecha_fin||''} onChange={e=>up('fecha_fin',e.target.value)}/></div>
        </div>

        <div style={S.fg}><label style={S.lbl}>Modo de contrato</label>
          <div style={{display:'flex',gap:6}}>
            <button type="button" onClick={()=>setModo('simple')} style={{flex:1,padding:10,borderRadius:9,border:`1.5px solid ${modo==='simple'?'#2563eb':'#e5e7eb'}`,background:modo==='simple'?'#dbeafe':'white',fontSize:13,fontWeight:700,color:modo==='simple'?'#2563eb':'#6b7280',cursor:'pointer'}}>
              Simple<div style={{fontSize:10,fontWeight:500,marginTop:2}}>1 monto único</div>
            </button>
            <button type="button" onClick={()=>setModo('multi')} style={{flex:1,padding:10,borderRadius:9,border:`1.5px solid ${modo==='multi'?'#2563eb':'#e5e7eb'}`,background:modo==='multi'?'#dbeafe':'white',fontSize:13,fontWeight:700,color:modo==='multi'?'#2563eb':'#6b7280',cursor:'pointer'}}>
              Conceptos<div style={{fontSize:10,fontWeight:500,marginTop:2}}>varios items</div>
            </button>
          </div>
        </div>

        {modo==='multi'&&<div>
          <div style={{padding:'9px 11px',borderRadius:9,fontSize:12,marginBottom:9,background:'#dbeafe',color:'#1e3a8a'}}>
            💡 Cada concepto puede ser fijo o escalonado por separado. Ej: alquiler escalonado + cochera fija con IVA.
          </div>
          {(d.conceptos||[]).map((cp:any,i:number)=>(
            <div key={cp.id} style={{background:'#f8fafc',borderRadius:11,padding:12,marginBottom:8,border:'1.5px solid #e5e7eb'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:9}}>
                <span style={{fontWeight:700,fontSize:13,color:'#1e3a8a'}}>📌 Concepto {i+1}</span>
                {d.conceptos.length>1&&<button type="button" style={{background:'#fee2e2',color:'#7f1d1d',padding:'3px 8px',borderRadius:6,fontSize:12,fontWeight:700,border:'none',cursor:'pointer'}} onClick={()=>delC(cp.id)}>✕</button>}
              </div>
              <div style={S.fg}><label style={S.lbl}>Nombre</label><input style={S.inp} value={cp.nombre} onChange={e=>upC(cp.id,'nombre',e.target.value)} placeholder="Ej: Alquiler / Cochera / Expensas"/></div>

              <div style={S.fg}><label style={S.lbl}>Tipo</label>
                <div style={{display:'flex',gap:5}}>
                  <button type="button" onClick={()=>upC(cp.id,'tipo','fijo')} style={{flex:1,padding:7,borderRadius:7,border:`1.5px solid ${cp.tipo!=='escalonado'?'#2563eb':'#e5e7eb'}`,background:cp.tipo!=='escalonado'?'#dbeafe':'white',fontSize:12,fontWeight:700,color:cp.tipo!=='escalonado'?'#2563eb':'#64748b',cursor:'pointer'}}>Monto fijo</button>
                  <button type="button" onClick={()=>upC(cp.id,'tipo','escalonado')} style={{flex:1,padding:7,borderRadius:7,border:`1.5px solid ${cp.tipo==='escalonado'?'#2563eb':'#e5e7eb'}`,background:cp.tipo==='escalonado'?'#dbeafe':'white',fontSize:12,fontWeight:700,color:cp.tipo==='escalonado'?'#2563eb':'#64748b',cursor:'pointer'}}>Escalonado</button>
                </div>
              </div>

              {cp.tipo!=='escalonado'?<>
                <div style={S.fg}><label style={S.lbl}>Monto</label>
                  <div style={{display:'flex',border:'1.5px solid #e5e7eb',borderRadius:10,overflow:'hidden'}}>
                    <select style={{border:'none',background:'#f3f4f6',padding:'9px 8px',fontSize:13,fontWeight:700,outline:'none',borderRight:'1px solid #e5e7eb',minWidth:72,color:'#111827'}} value={cp.moneda} onChange={e=>upC(cp.id,'moneda',e.target.value)}>
                      <option value="pesos">$ Pesos</option><option value="dolar">U$D</option><option value="nafta">L Nafta</option>
                    </select>
                    <input style={{flex:1,border:'none',padding:'9px 11px',fontSize:15,outline:'none',background:'white',minWidth:0}} type="number" value={cp.monto} onChange={e=>upC(cp.id,'monto',e.target.value)}/>
                  </div>
                </div>
                <div style={{display:'flex',gap:9,marginBottom:9}}>
                  <div style={{flex:1}}><label style={S.lbl}>Ajuste</label>
                    <select style={S.sel} value={cp.ajuste||'ninguno'} onChange={e=>upC(cp.id,'ajuste',e.target.value)}>
                      {AJ.map(a=><option key={a} value={a}>{a==='ninguno'?'Sin ajuste':a.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div style={{flex:1}}><label style={S.lbl}>Frecuencia</label>
                    <select style={S.sel} value={cp.frec_ajuste||'mensual'} onChange={e=>upC(cp.id,'frec_ajuste',e.target.value)}>
                      {FR.map(f=><option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
              </>:<>
                <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'10px 0 7px'}}>Tramos</p>
                {(cp.tramos||[]).map((t:any,j:number)=>(
                  <div key={t.id} style={{background:'white',borderRadius:8,padding:9,marginBottom:5,border:'1px solid #e5e7eb'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
                      <span style={{fontWeight:700,fontSize:12}}>Tramo {j+1}</span>
                      {cp.tramos.length>1&&<button type="button" style={{background:'#fee2e2',color:'#7f1d1d',padding:'2px 6px',borderRadius:5,fontSize:11,fontWeight:700,border:'none',cursor:'pointer'}} onClick={()=>delCT(cp.id,t.id)}>✕</button>}
                    </div>
                    <div style={{display:'flex',gap:7,marginBottom:6}}>
                      <div style={{flex:1}}><label style={{...S.lbl,fontSize:10}}>📅 Desde</label><input style={S.inp} type="date" value={t.fechaDesde||''} onChange={e=>upCT(cp.id,t.id,'fechaDesde',e.target.value)}/></div>
                      <div style={{flex:1}}><label style={{...S.lbl,fontSize:10}}>📅 Hasta</label><input style={S.inp} type="date" value={t.fechaHasta||''} onChange={e=>upCT(cp.id,t.id,'fechaHasta',e.target.value)}/></div>
                    </div>
                    <div style={{...S.fg,marginBottom:6}}><label style={{...S.lbl,fontSize:10}}>Monto</label>
                      <div style={{display:'flex',border:'1.5px solid #e5e7eb',borderRadius:8,overflow:'hidden'}}>
                        <select style={{border:'none',background:'#f3f4f6',padding:'7px 6px',fontSize:11,fontWeight:700,outline:'none',borderRight:'1px solid #e5e7eb',minWidth:62,color:'#111827'}} value={t.moneda||'pesos'} onChange={e=>upCT(cp.id,t.id,'moneda',e.target.value)}>
                          <option value="pesos">$</option><option value="dolar">U$D</option><option value="nafta">L</option>
                        </select>
                        <input style={{flex:1,border:'none',padding:'7px 9px',fontSize:13,outline:'none',background:'white',minWidth:0}} type="number" value={t.montoBase} onChange={e=>upCT(cp.id,t.id,'montoBase',e.target.value)}/>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <div style={{flex:1}}><label style={{...S.lbl,fontSize:10}}>Ajuste</label>
                        <select style={S.sel} value={t.ajuste||'ninguno'} onChange={e=>upCT(cp.id,t.id,'ajuste',e.target.value)}>
                          {AJ.map(a=><option key={a} value={a}>{a==='ninguno'?'-':a.toUpperCase()}</option>)}
                        </select>
                      </div>
                      <div style={{flex:1}}><label style={{...S.lbl,fontSize:10}}>Frec.</label>
                        <select style={S.sel} value={t.frecAjuste||'mensual'} onChange={e=>upCT(cp.id,t.id,'frecAjuste',e.target.value)}>
                          {FR.map(f=><option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1,4)}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" style={{background:'#dbeafe',color:'#2563eb',padding:'6px 10px',borderRadius:8,fontSize:11,fontWeight:700,width:'100%',cursor:'pointer',border:'none'}} onClick={()=>addCT(cp.id)}>+ Tramo</button>
              </>}

              <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0 4px',fontSize:13}}>
                <input type="checkbox" id={`iva_${cp.id}`} checked={!!cp.iva} onChange={e=>upC(cp.id,'iva',e.target.checked)} style={{width:17,height:17,accentColor:'#2563eb'}}/>
                <label htmlFor={`iva_${cp.id}`} style={{fontWeight:600}}>IVA 21% en este concepto</label>
              </div>
            </div>
          ))}
          <button type="button" style={{background:'#dbeafe',color:'#2563eb',padding:'9px 12px',borderRadius:10,fontSize:13,fontWeight:700,width:'100%',marginTop:4,cursor:'pointer',border:'none'}} onClick={addC}>+ Agregar concepto</button>
        </div>}

        {modo==='simple'&&<div>
          <div style={S.fg}><label style={S.lbl}>Tipo</label>
            <select style={S.sel} value={d.tipo} onChange={e=>up('tipo',e.target.value)}>
              <option value="fijo">Monto fijo</option><option value="escalonado">Escalonado por tramos</option>
            </select>
          </div>
          {d.tipo==='fijo'&&<div>
            <div style={S.fg}><label style={S.lbl}>Monto base</label>
              <div style={{display:'flex',border:'1.5px solid #e5e7eb',borderRadius:10,overflow:'hidden'}}>
                <select style={{border:'none',background:'#f3f4f6',padding:'9px 8px',fontSize:13,fontWeight:700,outline:'none',borderRight:'1px solid #e5e7eb',minWidth:72,color:'#111827'}} value={d.moneda} onChange={e=>up('moneda',e.target.value)}>
                  <option value="pesos">$ Pesos</option><option value="dolar">U$D</option><option value="nafta">L Nafta</option>
                </select>
                <input style={{flex:1,border:'none',padding:'9px 11px',fontSize:15,outline:'none',background:'white',minWidth:0}} type="number" value={d.monto_base} onChange={e=>up('monto_base',e.target.value)}/>
              </div>
            </div>
            <div style={{display:'flex',gap:9,marginBottom:11}}>
              <div style={{flex:1}}><label style={S.lbl}>Ajuste</label>
                <select style={S.sel} value={d.ajuste} onChange={e=>up('ajuste',e.target.value)}>
                  {AJ.map(a=><option key={a} value={a}>{a==='ninguno'?'Sin ajuste':a.toUpperCase()}</option>)}
                </select>
              </div>
              <div style={{flex:1}}><label style={S.lbl}>Frecuencia</label>
                <select style={S.sel} value={d.frec_ajuste||'mensual'} onChange={e=>up('frec_ajuste',e.target.value)}>
                  {FR.map(f=><option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
                </select>
              </div>
            </div>
          </div>}
          {d.tipo==='escalonado'&&<div>
            <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'14px 0 7px'}}>Tramos</p>
            {d.tramos.map((t:any,i:number)=>(
              <div key={t.id} style={{background:'#f3f4f6',borderRadius:9,padding:10,marginBottom:6,border:'1px solid #e5e7eb'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <span style={{fontWeight:700,fontSize:14}}>Tramo {i+1}</span>
                  {d.tramos.length>1&&<button type="button" style={{background:'#fee2e2',color:'#7f1d1d',padding:'3px 8px',borderRadius:6,fontSize:12,fontWeight:700,border:'none',cursor:'pointer'}} onClick={()=>delT(t.id)}>✕</button>}
                </div>
                <div style={{display:'flex',gap:9,marginBottom:8}}>
                  <div style={{flex:1}}><label style={S.lbl}>📅 Desde</label><input style={S.inp} type="date" value={t.fechaDesde||''} onChange={e=>upT(t.id,'fechaDesde',e.target.value)}/></div>
                  <div style={{flex:1}}><label style={S.lbl}>📅 Hasta</label><input style={S.inp} type="date" value={t.fechaHasta||''} onChange={e=>upT(t.id,'fechaHasta',e.target.value)}/></div>
                </div>
                <div style={S.fg}><label style={S.lbl}>Monto</label>
                  <div style={{display:'flex',border:'1.5px solid #e5e7eb',borderRadius:10,overflow:'hidden'}}>
                    <select style={{border:'none',background:'#f3f4f6',padding:'9px 8px',fontSize:13,fontWeight:700,outline:'none',borderRight:'1px solid #e5e7eb',minWidth:72,color:'#111827'}} value={t.moneda||'pesos'} onChange={e=>upT(t.id,'moneda',e.target.value)}>
                      <option value="pesos">$ Pesos</option><option value="dolar">U$D</option><option value="nafta">L Nafta</option>
                    </select>
                    <input style={{flex:1,border:'none',padding:'9px 11px',fontSize:15,outline:'none',background:'white',minWidth:0}} type="number" value={t.montoBase} onChange={e=>upT(t.id,'montoBase',e.target.value)}/>
                  </div>
                </div>
                <div style={{display:'flex',gap:9}}>
                  <div style={{flex:1}}><label style={S.lbl}>Ajuste</label>
                    <select style={S.sel} value={t.ajuste||'ninguno'} onChange={e=>upT(t.id,'ajuste',e.target.value)}>
                      {AJ.map(a=><option key={a} value={a}>{a==='ninguno'?'Sin ajuste':a.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div style={{flex:1}}><label style={S.lbl}>Frecuencia</label>
                    <select style={S.sel} value={t.frecAjuste||'mensual'} onChange={e=>upT(t.id,'frecAjuste',e.target.value)}>
                      {FR.map(f=><option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" style={{background:'#dbeafe',color:'#2563eb',padding:'8px 12px',borderRadius:10,fontSize:13,fontWeight:700,width:'100%',marginTop:4,cursor:'pointer',border:'none'}} onClick={addT}>+ Agregar tramo</button>
          </div>}
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',fontSize:14,marginBottom:8}}>
            <input type="checkbox" id="ck_iva" checked={d.iva} onChange={e=>up('iva',e.target.checked)} style={{width:17,height:17,accentColor:'#2563eb'}}/>
            <label htmlFor="ck_iva">Aplicar IVA 21%</label>
          </div>
        </div>}

        <button style={{...S.btnP,opacity:ok?1:.5,marginTop:5}} disabled={!ok} onClick={handleSave}>Guardar contrato</button>
        {ini&&<button style={S.btnD} onClick={()=>{onDelete();onClose()}}>Eliminar contrato</button>}
        <button style={{...S.btnS,marginTop:7}} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── APP PRINCIPAL ────────────────────────────
export default function Dashboard(){
  const router=useRouter()
  const [user,setUser]=useState<any>(null)
  const [userData,setUserData]=useState<any>(null)
  const [workspaces,setWorkspaces]=useState<any[]>([])
  const [currentWs,setCurrentWs]=useState<any>(null)
  const [tab,setTab]=useState('inicio')
  const [modal,setModal]=useState<any>(null)
  const [authLoading,setAuthLoading]=useState(true)
  const [searchProps,setSearchProps]=useState('')
  const [searchInqs,setSearchInqs]=useState('')

  async function loadUserAndWorkspaces(uid:string){
    const{data:userRow}=await sb.from('usuarios').select('*').eq('id',uid).single()
    setUserData(userRow)
    // Load memberships first (no join)
    const{data:memberships}=await sb.from('workspace_members').select('workspace_id,rol').eq('usuario_id',uid).eq('estado','activo')
    if(!memberships||memberships.length===0){setWorkspaces([]);return}
    // Then load workspaces by IDs
    const wsIds=memberships.map((m:any)=>m.workspace_id)
    const{data:wsData}=await sb.from('workspaces').select('id,nombre,owner_id').in('id',wsIds)
    const wsList=(wsData||[]).map((w:any)=>{
      const m=memberships.find((mm:any)=>mm.workspace_id===w.id)
      return{...w,rol:m?.rol||'editor'}
    })
    setWorkspaces(wsList)
    const savedWs=typeof window!=='undefined'?localStorage.getItem('current_ws'):null
    const ws=wsList.find((w:any)=>w.id===savedWs)||wsList[0]
    if(ws)setCurrentWs(ws)
  }

  useEffect(()=>{
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      sb.auth.getSession().then(async({data:{session}})=>{
        if(session){
          setUser(session.user)
          await loadUserAndWorkspaces(session.user.id)
          setAuthLoading(false)
          window.history.replaceState(null,'','/dashboard')
        } else {
          sb.auth.onAuthStateChange(async(event, session) => {
            if(session){
              setUser(session.user)
              await loadUserAndWorkspaces(session.user.id)
              setAuthLoading(false)
              window.history.replaceState(null,'','/dashboard')
            } else {
              router.push('/')
            }
          })
        }
      })
      return
    }
    sb.auth.getSession().then(async({data:{session}})=>{
      if(!session){router.push('/');return}
      setUser(session.user)
      await loadUserAndWorkspaces(session.user.id)
      setAuthLoading(false)
    })
  },[])

  useEffect(()=>{
    if(currentWs?.id&&typeof window!=='undefined')localStorage.setItem('current_ws',currentWs.id)
  },[currentWs])

  const store=useAppData(currentWs?.id||'', user?.id||'')
  const {props,inqs,contratos,pagos,vars,gastos,grupos,owners,loading}=store

  const logout=async()=>{await sb.auth.signOut();router.push('/')}
  const mesActK=mk(NOW.getFullYear(),NOW.getMonth())
  const vm=(vars&&vars[mesActK])||{}
  const diasTrial=userData?Math.max(0,Math.ceil((new Date(userData.trial_fin).getTime()-Date.now())/86400000)):0

  const TABS=[
    {id:'inicio',ico:'🏠',lbl:'Inicio'},
    {id:'props',ico:'🏢',lbl:'Propied.'},
    {id:'inqs',ico:'👤',lbl:'Inquilin.'},
    {id:'contratos',ico:'📄',lbl:'Contratos'},
    {id:'grupos',ico:'🏘️',lbl:'Grupos'},
    {id:'expensas',ico:'💸',lbl:'Expensas'},
    {id:'owners',ico:'👔',lbl:'Dueños'},
    {id:'vars',ico:'📈',lbl:'Variables'},
    {id:'gastos',ico:'🔧',lbl:'Gastos'},
    {id:'reporte',ico:'📊',lbl:'Reporte'},
    {id:'equipo',ico:'👥',lbl:'Equipo'},
    {id:'importar',ico:'📥',lbl:'Importar'},
  ]

  if(authLoading)return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f9fafb'}}>
      <div style={{textAlign:'center'}}><div style={{fontSize:32,marginBottom:12}}>⏳</div><p style={{color:'#6b7280'}}>Cargando...</p></div>
    </div>
  )

  // ── TAB INICIO ──────────────────────────────
  const renderInicio=()=>{
    // Detectar contratos por vencer (próximos 30 días)
    const ahora=Date.now()
    const dia=86400000
    const contratosPorVencer=contratos.filter((c:any)=>{
      if(c.activo===false||!c.fecha_fin)return false
      const fin=new Date(c.fecha_fin).getTime()
      const dias=Math.ceil((fin-ahora)/dia)
      return dias>=0&&dias<=30
    }).map((c:any)=>{
      const fin=new Date(c.fecha_fin).getTime()
      const dias=Math.ceil((fin-ahora)/dia)
      return{...c,diasRestantes:dias}
    })
    const contratosVencidos=contratos.filter((c:any)=>{
      if(c.activo===false||!c.fecha_fin)return false
      const fin=new Date(c.fecha_fin).getTime()
      return fin<ahora
    })

    const rows=contratos.filter(c=>c.activo!==false).map(c=>{
      const mObj=calcM(c,NOW.getFullYear(),NOW.getMonth(),vars,[])
      const espP=toP(mObj,vm)
      const {lista,total}=estP(c.id,mesActK,pagos)
      const diff=total-espP
      const estado=diff>=-0.5?'pagado':(total>0?'parcial':'pendiente')
      const inq=inqs.find(i=>i.id===c.inquilino_id)
      return{c,mObj,lista,total,diff,estado,espP,inq}
    })
    const totEsp=rows.reduce((s,r)=>s+r.espP,0)
    const totCob=rows.reduce((s,r)=>s+r.total,0)
    const np=rows.filter(r=>r.estado==='pagado').length
    const nn=rows.filter(r=>r.estado==='pendiente').length
    const nx=rows.filter(r=>r.estado==='parcial').length

    return(
      <div style={{padding:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:9}}>
          <div><p style={{fontSize:11,color:'#6b7280'}}>Mes actual</p><p style={{fontSize:16,fontWeight:800}}>{mlbl(NOW.getFullYear(),NOW.getMonth())}</p></div>
          {rows.length>0&&<div style={{textAlign:'right'}}><p style={{fontSize:10,color:'#6b7280'}}>Cobrado / Esperado</p><p style={{fontSize:13,fontWeight:700}}>{fmtN(totCob,'pesos')} / {fmtN(totEsp,'pesos')}</p></div>}
        </div>
        {contratosVencidos.length>0&&<div style={{padding:'11px 13px',borderRadius:11,marginBottom:9,background:'#fee2e2',border:'1.5px solid #fca5a5',color:'#7f1d1d'}}>
          <div style={{fontSize:13,fontWeight:800,marginBottom:4}}>🚨 {contratosVencidos.length} contrato{contratosVencidos.length>1?'s':''} VENCIDO{contratosVencidos.length>1?'S':''}</div>
          {contratosVencidos.slice(0,3).map((c:any)=>(<div key={c.id} style={{fontSize:12}}>• {c.nombre_propiedad||c.propiedad_id} · {c.nombre_inquilino||'—'} · venció el {c.fecha_fin}</div>))}
          {contratosVencidos.length>3&&<div style={{fontSize:11,marginTop:3}}>...y {contratosVencidos.length-3} más</div>}
        </div>}
        {contratosPorVencer.length>0&&<div style={{padding:'11px 13px',borderRadius:11,marginBottom:9,background:'#fef3c7',border:'1.5px solid #fbbf24',color:'#78350f'}}>
          <div style={{fontSize:13,fontWeight:800,marginBottom:4}}>⏰ {contratosPorVencer.length} contrato{contratosPorVencer.length>1?'s':''} por vencer</div>
          {contratosPorVencer.slice(0,3).map((c:any)=>(<div key={c.id} style={{fontSize:12}}>• {c.nombre_propiedad||c.propiedad_id} · {c.nombre_inquilino||'—'} · vence en {c.diasRestantes} día{c.diasRestantes!==1?'s':''} ({c.fecha_fin})</div>))}
          {contratosPorVencer.length>3&&<div style={{fontSize:11,marginTop:3}}>...y {contratosPorVencer.length-3} más</div>}
        </div>}
        {rows.length>0&&<div style={{display:'flex',gap:6,marginBottom:11}}>
          {[{n:np,l:'Pagados',c:'#16a34a'},{n:nx,l:'Parciales',c:'#d97706'},{n:nn,l:'Pendientes',c:'#dc2626'}].map((s,i)=>(
            <div key={i} style={{flex:1,background:'white',border:'1px solid #e5e7eb',borderRadius:10,padding:9,textAlign:'center',boxShadow:'0 1px 3px rgba(0,0,0,.07)'}}>
              <div style={{fontSize:20,fontWeight:800,color:s.c,marginBottom:1}}>{s.n}</div>
              <div style={{fontSize:10,color:'#6b7280'}}>{s.l}</div>
            </div>
          ))}
        </div>}
        {rows.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:'#6b7280'}}>
          <div style={{fontSize:40,marginBottom:8}}>🏠</div>
          <div style={{fontSize:15,fontWeight:600,color:'#111827',marginBottom:4}}>Sin contratos activos</div>
          <div style={{fontSize:13}}>Andá a Contratos para crear uno</div>
        </div>}
        {rows.map(({c,mObj,lista,total,diff,estado,espP,inq})=>{
          const waN=inq?(inq.es_sociedad&&inq.contacto_pagos?inq.contacto_pagos:inq.nombre):''
          const waT=inq?(inq.es_sociedad&&inq.tel_contacto?inq.tel_contacto:inq.telefono):''
          const waM=waT?`Hola ${waN}! Te recuerdo el vencimiento de ${c.nombre_propiedad||''} para ${mlbl(NOW.getFullYear(),NOW.getMonth())}. Monto: ${mObj?fmtN(mObj.monto,mObj.moneda):'—'}. Gracias!`:''
          return(
            <div key={c.id} style={{background:'white',borderRadius:14,border:'1px solid #e5e7eb',padding:13,marginBottom:9,boxShadow:'0 1px 3px rgba(0,0,0,.07)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700}}>{c.nombre_propiedad||c.propiedad_id}</div>
                  <div style={{fontSize:12,color:'#6b7280'}}>{inq?inq.nombre:(c.nombre_inquilino||'—')}</div>
                </div>
                <Badge e={estado}/>
              </div>
              <div style={{display:'flex',gap:5,marginBottom:9}}>
                {[
                  {l:'Esperado',v:mObj?fmtN(mObj.monto,mObj.moneda):'—',c:'#111827'},
                  {l:'Pagado',v:fmtN(total,'pesos'),c:total===0?'#dc2626':total>=espP?'#16a34a':'#d97706'},
                  {l:'Diferencia',v:diff===0?'±0':(diff>0?'+':'')+fmtN(Math.abs(diff),'pesos'),c:diff>=0?'#16a34a':'#dc2626'},
                ].map((a,i)=>(
                  <div key={i} style={{flex:1,background:'#f3f4f6',borderRadius:8,padding:'6px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:'#6b7280',marginBottom:1}}>{a.l}</div>
                    <div style={{fontSize:13,fontWeight:700,color:a.c}}>{a.v}</div>
                  </div>
                ))}
              </div>
              {lista.length>0&&<div style={{background:'#f3f4f6',borderRadius:8,padding:'6px 9px',marginBottom:8,fontSize:12,color:'#6b7280'}}>
                {lista.map((pg:any)=><span key={pg.id}>{pg.tipo_pago==='efectivo'?'💵':pg.tipo_pago==='cheque'?'📋':'🏦'} {fmtN(pg.monto,pg.moneda)}  </span>)}
              </div>}
              <div style={{display:'flex',gap:5}}>
                <button style={{flex:1,background:'#2563eb',color:'white',padding:9,borderRadius:9,fontWeight:700,fontSize:13,cursor:'pointer',border:'none'}}
                  onClick={()=>setModal({type:'pago',contrato:c,mes:{year:NOW.getFullYear(),month:NOW.getMonth(),key:mesActK},mObj,lista})}>
                  {estado==='pagado'?`✓ ${lista.length} pago${lista.length>1?'s':''}` :'+ Pago'}
                </button>
                {waM&&<button style={{background:'#25d366',color:'white',padding:'9px 10px',borderRadius:9,fontSize:14,border:'none',cursor:'pointer'}} onClick={()=>window.open(waURL(waT,waM),'_blank')}>💬</button>}
                <button style={{background:'#f3f4f6',color:'#111827',padding:'9px 10px',borderRadius:9,fontSize:13,fontWeight:600,border:'none',cursor:'pointer'}} onClick={()=>setModal({type:'contrato',data:c})}>✎</button>
              </div>
            </div>
          )
        })}
        <div style={{height:70}}/>
      </div>
    )
  }

  // ── TAB PROPS ───────────────────────────────
  const renderProps=()=>{
    const q=searchProps.toLowerCase().trim()
    const propsFiltered=q?props.filter((p:any)=>(
      (p.codigo||'').toLowerCase().includes(q)||
      (p.nombre||'').toLowerCase().includes(q)||
      (p.direccion||'').toLowerCase().includes(q)||
      (p.ciudad||'').toLowerCase().includes(q)
    )):props
    return(
    <div style={{padding:'18px 14px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,color:'#0f172a',margin:0}}>Propiedades</h2>
          <p style={{fontSize:13,color:'#64748b',margin:'2px 0 0'}}>{props.length} propiedad{props.length!==1?'es':''}{grupos.length>0?` · ${grupos.length} grupos`:''}{q?` · ${propsFiltered.length} resultados`:''}</p>
        </div>
        <button onClick={()=>setModal({type:'prop',data:null})} style={{background:'linear-gradient(135deg,#2563eb,#1e3a8a)',color:'white',padding:'9px 16px',borderRadius:10,fontSize:13,fontWeight:700,border:'none',cursor:'pointer',boxShadow:'0 4px 10px rgba(37,99,235,.25)'}}>+ Nueva</button>
      </div>
      <div style={{position:'relative',marginBottom:14}}>
        <input style={{...S.inp,paddingLeft:36}} placeholder="🔍 Buscar por código, nombre, dirección..." value={searchProps} onChange={e=>setSearchProps(e.target.value)}/>
        {searchProps&&<button onClick={()=>setSearchProps('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'#f3f4f6',border:'none',color:'#64748b',fontSize:14,cursor:'pointer',padding:'2px 8px',borderRadius:6}}>✕</button>}
      </div>
      {props.length===0&&<div style={{textAlign:'center',padding:'60px 20px',color:'#64748b',background:'white',borderRadius:14,border:'1px solid #e5e7eb'}}><div style={{fontSize:48,marginBottom:12}}>🏢</div><div style={{fontSize:16,fontWeight:600,color:'#0f172a',marginBottom:6}}>Sin propiedades</div><div style={{fontSize:13}}>Tocá "Nueva" para agregar la primera</div></div>}
      {propsFiltered.length===0&&props.length>0&&<div style={{textAlign:'center',padding:'30px 20px',color:'#64748b'}}>No hay resultados para "{searchProps}"</div>}
      <div className="pc-grid-2">
      {propsFiltered.map((p:any)=>{
        const aa=contratos.find(c=>c.propiedad_id===p.id&&c.activo!==false)
        const grupo=grupos.find((g:any)=>g.id===p.grupo_id)
        return(
          <div key={p.id} className="card-hover" style={{...S.card,marginBottom:0,cursor:'default'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:700,color:'#2563eb'}}>{p.codigo}</div>
                <div style={{fontSize:15,fontWeight:700}}>{p.nombre}</div>
                <div style={{fontSize:12,color:'#6b7280'}}>{p.direccion}{p.ciudad?' · '+p.ciudad:''}</div>
                {p.superficie&&<div style={{fontSize:11,color:'#6b7280',marginTop:1}}>{p.superficie} m²</div>}
              </div>
              <span style={{display:'inline-block',fontSize:11,fontWeight:600,padding:'2px 6px',borderRadius:5,background:p.tipo==='local'?'#e0f2fe':p.tipo==='depto'?'#dcfce7':p.tipo==='terreno'?'#fef3c7':'#f3e8ff',color:p.tipo==='local'?'#0c4a6e':p.tipo==='depto'?'#14532d':p.tipo==='terreno'?'#78350f':'#581c87'}}>{p.tipo}</span>
            </div>
            {p.observaciones&&<div style={{fontSize:12,color:'#6b7280',marginTop:5,borderTop:'1px solid #e5e7eb',paddingTop:5}}>{p.observaciones}</div>}
            <div style={{marginTop:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              {aa?<span style={{fontSize:12,background:'#dcfce7',color:'#14532d',padding:'3px 10px',borderRadius:20,fontWeight:700}}>● En alquiler</span>:<span style={{fontSize:12,background:'#f3f4f6',color:'#64748b',padding:'3px 10px',borderRadius:20}}>Disponible</span>}
              <button style={{background:'none',border:'none',color:'#2563eb',fontSize:13,fontWeight:700,cursor:'pointer'}} onClick={()=>setModal({type:'prop',data:p})}>Editar →</button>
            </div>
            {grupo&&<div style={{marginTop:6,padding:'4px 8px',background:'#f3f4f6',borderRadius:7,fontSize:11,color:'#475569'}}>🏘️ {grupo.nombre} · {p.pct_expensas||0}% expensas</div>}
          </div>
        )
      })}
      </div>
      <div style={{height:80}}/>
    </div>
    )
  }

  // ── TAB INQS ────────────────────────────────
  const renderInqs=()=>{
    const q=searchInqs.toLowerCase().trim()
    const inqsFiltered=q?inqs.filter((i:any)=>(
      (i.nombre||'').toLowerCase().includes(q)||
      (i.email||'').toLowerCase().includes(q)||
      (i.telefono||'').toLowerCase().includes(q)||
      (i.cuit||'').toLowerCase().includes(q)||
      (i.dni||'').toLowerCase().includes(q)
    )):inqs
    return(
    <div style={{padding:14}}>
      <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'0 0 9px'}}>{inqs.length} inquilinos{q?` · ${inqsFiltered.length} resultados`:''}</p>
      <div style={{position:'relative',marginBottom:11}}>
        <input style={{...S.inp,paddingLeft:36}} placeholder="🔍 Buscar por nombre, email, teléfono, DNI..." value={searchInqs} onChange={e=>setSearchInqs(e.target.value)}/>
        {searchInqs&&<button onClick={()=>setSearchInqs('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'#f3f4f6',border:'none',color:'#64748b',fontSize:14,cursor:'pointer',padding:'2px 8px',borderRadius:6}}>✕</button>}
      </div>
      {inqs.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:'#6b7280'}}><div style={{fontSize:40,marginBottom:8}}>👤</div><div style={{fontSize:15,fontWeight:600,color:'#111827',marginBottom:4}}>Sin inquilinos</div></div>}
      {inqsFiltered.length===0&&inqs.length>0&&<div style={{textAlign:'center',padding:'30px 20px',color:'#64748b'}}>No hay resultados para "{searchInqs}"</div>}
      {inqsFiltered.map((inq:any)=>{
        const aa=contratos.filter(c=>c.inquilino_id===inq.id&&c.activo!==false).length
        const tel=inq.es_sociedad&&inq.tel_contacto?inq.tel_contacto:inq.telefono
        return(
          <div key={inq.id} style={{...S.card,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{width:35,height:35,borderRadius:'50%',background:'#dbeafe',color:'#1e3a8a',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,flexShrink:0}}>{(inq.nombre||'?')[0].toUpperCase()}</div>
            <div style={{flex:1,marginLeft:9}}>
              <div style={{fontWeight:700,fontSize:15}}>{inq.nombre}{inq.es_sociedad?' 🏢':''}</div>
              {inq.cuit&&<div style={{fontSize:12,color:'#6b7280'}}>CUIT: {inq.cuit}</div>}
              {inq.es_sociedad&&inq.contacto_pagos&&<div style={{fontSize:12,fontWeight:600}}>👤 {inq.contacto_pagos}</div>}
              {tel&&<div style={{fontSize:12,color:'#6b7280'}}>📱 {tel}</div>}
              {aa>0&&<div style={{fontSize:12,color:'#16a34a',fontWeight:700,marginTop:2}}>{aa} contrato{aa>1?'s':''}</div>}
            </div>
            <div style={{display:'flex',gap:5}}>
              {tel&&<a href={`https://wa.me/${tel.replace(/\D/g,'')}`} target="_blank" style={{background:'#25d366',color:'white',padding:'7px 9px',borderRadius:8,fontSize:14,textDecoration:'none'}}>💬</a>}
              <button style={{background:'#f3f4f6',color:'#111827',padding:'7px 9px',borderRadius:8,fontSize:13,fontWeight:600,border:'none',cursor:'pointer'}} onClick={()=>setModal({type:'inq',data:inq})}>✎</button>
            </div>
          </div>
        )
      })}
      <div style={{height:70}}/>
    </div>
    )
  }

  // ── TAB CONTRATOS ───────────────────────────
  const renderContratos=()=>(
    <div style={{padding:14}}>
      <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'0 0 9px'}}>{contratos.filter(c=>c.activo!==false).length} contratos activos</p>
      {contratos.filter(c=>c.activo!==false).length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:'#6b7280'}}><div style={{fontSize:40,marginBottom:8}}>📄</div><div style={{fontSize:15,fontWeight:600,color:'#111827',marginBottom:4}}>Sin contratos</div><div style={{fontSize:13}}>Tocá + para crear uno</div></div>}
      {contratos.filter(c=>c.activo!==false).map((c:any)=>{
        const inq=inqs.find(i=>i.id===c.inquilino_id)
        return(
          <div key={c.id} style={S.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:5}}>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>{c.nombre_propiedad||c.propiedad_id}</div>
                <div style={{fontSize:13,color:'#6b7280'}}>{inq?inq.nombre:(c.nombre_inquilino||'—')}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:11,color:'#6b7280'}}>Desde {c.fecha_inicio}</div>
                <span style={{display:'inline-block',fontSize:11,fontWeight:600,padding:'2px 6px',borderRadius:5,background:c.tipo==='escalonado'?'#f3e8ff':'#dcfce7',color:c.tipo==='escalonado'?'#581c87':'#14532d'}}>{c.tipo==='escalonado'?'Escalonado':'Fijo'}</span>
              </div>
            </div>
            <div style={{marginTop:5}}>
              <span style={{display:'inline-block',fontSize:11,fontWeight:600,padding:'2px 6px',borderRadius:5,background:'#fef3c7',color:'#78350f',marginRight:3}}>{c.moneda||'pesos'}</span>
              {c.ajuste&&c.ajuste!=='ninguno'&&<span style={{display:'inline-block',fontSize:11,fontWeight:600,padding:'2px 6px',borderRadius:5,background:'#f3e8ff',color:'#581c87',marginRight:3}}>{c.ajuste}</span>}
              {c.frec_ajuste&&c.frec_ajuste!=='mensual'&&<span style={{display:'inline-block',fontSize:11,fontWeight:600,padding:'2px 6px',borderRadius:5,background:'#dbeafe',color:'#1e3a8a',marginRight:3}}>{c.frec_ajuste}</span>}
              {c.iva&&<span style={{display:'inline-block',fontSize:11,fontWeight:600,padding:'2px 6px',borderRadius:5,background:'#f3e8ff',color:'#581c87'}}>IVA 21%</span>}
            </div>
            <button style={{...S.btnS,marginTop:8}} onClick={()=>setModal({type:'contrato',data:c})}>Editar</button>
          </div>
        )
      })}
      <div style={{height:70}}/>
    </div>
  )

  // ── TAB VARS ────────────────────────────────
  const renderVars=()=>{
    const meses=[]
    for(let i=-1;i<=3;i++){const d=new Date(NOW.getFullYear(),NOW.getMonth()+i,1);meses.push({year:d.getFullYear(),month:d.getMonth(),key:mk(d.getFullYear(),d.getMonth())})}
    const fields=[{id:'dolar',l:'Dólar ($ por U$D)',ph:'1200'},{id:'nafta',l:'Nafta ($ por litro)',ph:'950'},{id:'ipc',l:'IPC variación (%)',ph:'4.5'}]
    const customs=store.varsCustom||[]
    return(
      <div style={{padding:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:9}}>
          <div>
            <h2 style={{fontSize:19,fontWeight:800,color:'#0f172a',margin:0}}>Variables</h2>
            <p style={{fontSize:12,color:'#64748b',margin:'2px 0 0'}}>Datos del mes que se aplican a los contratos</p>
          </div>
          <button onClick={()=>setModal({type:'varCustom',data:null})} style={{background:'linear-gradient(135deg,#2563eb,#1e3a8a)',color:'white',padding:'8px 14px',borderRadius:9,fontSize:12,fontWeight:700,border:'none',cursor:'pointer'}}>+ Nueva variable</button>
        </div>
        <div style={{padding:'9px 11px',borderRadius:9,fontSize:12,marginBottom:11,background:'#dbeafe',color:'#1e3a8a'}}>💡 Cargá los valores de cada mes. Las variables predefinidas (Dólar, Nafta, IPC) ya están creadas. Podés agregar las tuyas (ej: aumento del consorcio, ICL).</div>
        
        {/* Variables custom: header con opciones */}
        {customs.length>0&&<div style={{background:'white',borderRadius:11,border:'1px solid #e5e7eb',padding:10,marginBottom:11}}>
          <div style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,marginBottom:7}}>Variables propias</div>
          {customs.map((cv:any)=>(
            <div key={cv.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid #f3f4f6'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600}}>{cv.nombre}</div>
                {cv.descripcion&&<div style={{fontSize:11,color:'#6b7280'}}>{cv.descripcion}</div>}
              </div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>setModal({type:'varCustom',data:cv})} style={{background:'#f3f4f6',color:'#111827',padding:'4px 9px',borderRadius:6,fontSize:11,fontWeight:600,border:'none',cursor:'pointer'}}>Editar</button>
                <button onClick={async()=>{if(confirm('¿Eliminar esta variable? Los valores cargados se conservarán.'))await store.delVarCustom(cv.id)}} style={{background:'#fee2e2',color:'#7f1d1d',padding:'4px 9px',borderRadius:6,fontSize:11,fontWeight:600,border:'none',cursor:'pointer'}}>×</button>
              </div>
            </div>
          ))}
        </div>}

        {/* Cards por mes */}
        {meses.map(m=>{
          const v=(vars&&vars[m.key])||{}
          const ea=m.key===mesActK
          const valoresCustom=v.valores_custom||{}
          return(
            <div key={m.key} style={{...S.card,border:ea?'2px solid #2563eb':'1px solid #e5e7eb'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:9}}>
                <span style={{fontWeight:700,fontSize:15}}>{mlbl(m.year,m.month)}</span>
                {ea&&<span style={{fontSize:11,background:'#dbeafe',color:'#2563eb',padding:'2px 8px',borderRadius:20,fontWeight:700}}>Actual</span>}
              </div>
              {fields.map(f=>(
                <div key={f.id} style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                  <span style={{fontSize:13,color:'#6b7280',flex:1}}>{f.l}</span>
                  <input style={{width:105,padding:'6px 8px',border:'1.5px solid #e5e7eb',borderRadius:8,fontSize:14,textAlign:'right',background:'white'}} type="number" placeholder={f.ph} value={(v as any)[f.id]||''} onChange={e=>store.setVar(m.key,f.id,parseFloat(e.target.value)||0)}/>
                </div>
              ))}
              {customs.length>0&&<div style={{borderTop:'1px solid #e5e7eb',marginTop:7,paddingTop:7}}>
                {customs.map((cv:any)=>(
                  <div key={cv.id} style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                    <span style={{fontSize:13,color:'#475569',flex:1,fontWeight:500}}>📊 {cv.nombre} ({cv.unidad||'%'})</span>
                    <input style={{width:105,padding:'6px 8px',border:'1.5px solid #e5e7eb',borderRadius:8,fontSize:14,textAlign:'right',background:'white'}} type="number" step="0.01" placeholder="0" value={valoresCustom[cv.id]||''} onChange={e=>store.setVarCustom(m.key,cv.id,parseFloat(e.target.value)||0)}/>
                  </div>
                ))}
              </div>}
            </div>
          )
        })}
        <div style={{height:70}}/>
      </div>
    )
  }

  // ── TAB GASTOS ──────────────────────────────
  const renderGastos=()=>{
    const totI=gastos.filter(g=>g.quien==='inquilino').reduce((s,g)=>s+g.monto,0)
    const totP=gastos.filter(g=>g.quien==='propietario').reduce((s,g)=>s+g.monto,0)
    const ico:any={arreglo:'🔧',expensas:'🏢',servicio:'💡',impuesto:'📋',otro:'📌'}
    return(
      <div style={{padding:14}}>
        <div style={{display:'flex',gap:6,marginBottom:11}}>
          <div style={{flex:1,background:'white',border:'1px solid #e5e7eb',borderRadius:10,padding:9,textAlign:'center',boxShadow:'0 1px 3px rgba(0,0,0,.07)'}}>
            <div style={{fontSize:14,fontWeight:800,marginBottom:1}}>{fmtN(totI,'pesos')}</div>
            <div style={{fontSize:10,color:'#6b7280'}}>Inquilino</div>
          </div>
          <div style={{flex:1,background:'white',border:'1px solid #e5e7eb',borderRadius:10,padding:9,textAlign:'center',boxShadow:'0 1px 3px rgba(0,0,0,.07)'}}>
            <div style={{fontSize:14,fontWeight:800,marginBottom:1}}>{fmtN(totP,'pesos')}</div>
            <div style={{fontSize:10,color:'#6b7280'}}>Propietario</div>
          </div>
        </div>
        {gastos.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:'#6b7280'}}><div style={{fontSize:40,marginBottom:8}}>🔧</div><div style={{fontSize:15,fontWeight:600,color:'#111827',marginBottom:4}}>Sin gastos</div></div>}
        {gastos.map((g:any)=>{
          const prop=props.find((p:any)=>p.id===g.propiedad_id)
          return(
            <div key={g.id} style={S.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14}}>{ico[g.tipo]||'📌'} {g.tipo}</div>
                  <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>{prop?prop.nombre:'—'}</div>
                  {g.descripcion&&<div style={{fontSize:12,color:'#6b7280'}}>→ {g.descripcion}</div>}
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:15,fontWeight:700}}>{fmtN(g.monto,g.moneda||'pesos')}</div>
                  <div style={{marginTop:3}}>
                    <span style={{fontSize:11,fontWeight:700,padding:'1px 6px',borderRadius:9,background:g.quien==='inquilino'?'#dbeafe':'#fef3c7',color:g.quien==='inquilino'?'#1e3a8a':'#78350f'}}>{g.quien}</span>
                    {' '}
                    <span style={{fontSize:11,fontWeight:700,padding:'1px 6px',borderRadius:9,background:g.estado==='pagado'?'#dcfce7':'#fee2e2',color:g.estado==='pagado'?'#14532d':'#7f1d1d'}}>{g.estado}</span>
                  </div>
                  <div style={{fontSize:11,color:'#6b7280',marginTop:2}}>{g.fecha||''}</div>
                  <button onClick={()=>store.delGasto(g.id)} style={{marginTop:3,background:'#fee2e2',color:'#7f1d1d',border:'none',padding:'3px 8px',borderRadius:6,fontSize:11,cursor:'pointer'}}>Eliminar</button>
                </div>
              </div>
            </div>
          )
        })}
        <div style={{height:70}}/>
      </div>
    )
  }

  // ── TAB REPORTE ─────────────────────────────
  const renderReporte=()=>{
    const rows=contratos.filter(c=>c.activo!==false).map(c=>{
      const mObj=calcM(c,NOW.getFullYear(),NOW.getMonth(),vars,[])
      const espP=toP(mObj,vm)
      const {lista,total}=estP(c.id,mesActK,pagos)
      const diff=total-espP
      const estado=diff>=-0.5?'pagado':(total>0?'parcial':'pendiente')
      const inq=inqs.find(i=>i.id===c.inquilino_id)
      return{c,mObj,lista,total,diff,estado,espP,inq}
    })
    const totEsp=rows.reduce((s,r)=>s+r.espP,0)
    const totCob=rows.reduce((s,r)=>s+r.total,0)

    const exportar=()=>{
      const lines=[`PropControl — Reporte ${mlbl(NOW.getFullYear(),NOW.getMonth())}`,'','Propiedad | Inquilino | Esperado | Pagado | Estado']
      rows.forEach(r=>lines.push(`${r.c.nombre_propiedad||'—'} | ${r.inq?r.inq.nombre:'—'} | ${r.mObj?fmtN(r.mObj.monto,r.mObj.moneda):'—'} | ${fmtN(r.total,'pesos')} | ${r.estado}`))
      lines.push('',`TOTAL ESPERADO: ${fmtN(totEsp,'pesos')}`,`TOTAL COBRADO: ${fmtN(totCob,'pesos')}`,`DEUDA: ${fmtN(totEsp-totCob,'pesos')}`)
      const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'})
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`reporte_${mesActK}.txt`;a.click()
    }

    const backupCompleto=()=>{
      const data={
        version:'1.0',
        fecha:new Date().toISOString(),
        usuario:user?.email,
        propiedades:props,inquilinos:inqs,contratos,pagos,gastos,grupos,propietarios:owners,variables:vars
      }
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
      const url=URL.createObjectURL(blob);const a=document.createElement('a')
      a.href=url;a.download=`backup_propcontrol_${new Date().toISOString().slice(0,10)}.json`;a.click()
    }
    return(
      <div style={{padding:14}}>
        <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'0 0 9px'}}>Reporte — {mlbl(NOW.getFullYear(),NOW.getMonth())}</p>
        <div style={{display:'flex',gap:6,marginBottom:11}}>
          <div style={{flex:1,background:'white',border:'1px solid #e5e7eb',borderRadius:10,padding:9,textAlign:'center'}}>
            <div style={{fontSize:14,fontWeight:800,color:'#16a34a',marginBottom:1}}>{fmtN(totCob,'pesos')}</div>
            <div style={{fontSize:10,color:'#6b7280'}}>Total cobrado</div>
          </div>
          <div style={{flex:1,background:'white',border:'1px solid #e5e7eb',borderRadius:10,padding:9,textAlign:'center'}}>
            <div style={{fontSize:14,fontWeight:800,color:'#dc2626',marginBottom:1}}>{fmtN(totEsp-totCob,'pesos')}</div>
            <div style={{fontSize:10,color:'#6b7280'}}>Deuda total</div>
          </div>
        </div>
        {rows.map(({c,mObj,lista,total,diff,estado,espP,inq})=>(
          <div key={c.id} style={S.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:5}}>
              <div><div style={{fontWeight:700}}>{c.nombre_propiedad||'—'}</div><div style={{fontSize:13,color:'#6b7280'}}>{inq?inq.nombre:'—'}</div></div>
              <Badge e={estado}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{fontSize:13,color:'#6b7280'}}>Esperado</span><span style={{fontWeight:600}}>{mObj?fmtN(mObj.monto,mObj.moneda):'—'}</span></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:13,color:'#6b7280'}}>Pagado ARS</span><span style={{fontWeight:600,color:total>=(espP||0)?'#16a34a':'#dc2626'}}>{fmtN(total,'pesos')}</span></div>
          </div>
        ))}
        {rows.length>0&&<button style={{...S.btnS,marginTop:8}} onClick={exportar}>⬇ Exportar reporte (.txt)</button>}
        <button style={{...S.btnP,marginTop:8,background:'#16a34a'}} onClick={backupCompleto}>💾 Backup completo de mis datos (.json)</button>
        <div style={{padding:'9px 11px',borderRadius:9,fontSize:12,marginTop:8,background:'#fef3c7',color:'#78350f'}}>
          ⚠️ Recomendamos hacer backup mensual de tus datos. El archivo .json contiene toda tu información y se descarga a tu computadora.
        </div>
        <div style={{height:70}}/>
      </div>
    )
  }

  const renderContent=()=>{
    if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:300}}><div style={{textAlign:'center'}}><div style={{fontSize:32,marginBottom:12}}>⏳</div><p style={{color:'#6b7280'}}>Cargando datos...</p></div></div>
    switch(tab){
      case 'inicio':return renderInicio()
      case 'props':return renderProps()
      case 'inqs':return renderInqs()
      case 'contratos':return renderContratos()
      case 'grupos':return <RenderGrupos store={store} setModal={setModal}/>
      case 'expensas':return <RenderExpensas store={store} setModal={setModal}/>
      case 'owners':return <RenderOwners store={store} setModal={setModal}/>
      case 'vars':return renderVars()
      case 'gastos':return renderGastos()
      case 'reporte':return renderReporte()
      case 'equipo':return <RenderEquipo workspace={currentWs} userId={user?.id} workspaces={workspaces} setWorkspaces={setWorkspaces} setCurrentWs={setCurrentWs}/>
      case 'importar':return <RenderImportar store={store}/>
      default:return renderInicio()
    }
  }

  const FAB_ACTIONS:any={
    inicio:()=>setModal({type:'contrato',data:null}),
    props:()=>setModal({type:'prop',data:null}),
    inqs:()=>setModal({type:'inq',data:null}),
    contratos:()=>setModal({type:'contrato',data:null}),
    grupos:()=>setModal({type:'grupo',data:null}),
    expensas:()=>setModal({type:'expensa',data:null}),
    owners:()=>setModal({type:'owner',data:null}),
    vars:()=>setModal({type:'indice',data:null}),
    gastos:()=>setModal({type:'gasto'}),
  }

  const ini=(user?.email||'?')[0].toUpperCase()

  return(
    <>
    <style jsx global>{`
      :root { --primary: #2563eb; --primary-dark: #1e3a8a; --success: #16a34a; --bg: #f8fafc; --surface: #ffffff; --border: #e5e7eb; --text: #0f172a; --text-muted: #64748b; }
      * { box-sizing: border-box; }
      body { background: var(--bg); color: var(--text); font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; -webkit-font-smoothing: antialiased; }
      button { transition: all 0.15s ease; }
      button:hover:not(:disabled) { transform: translateY(-1px); }
      .card-hover { transition: all 0.2s ease; }
      .card-hover:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.08) !important; }
      
      /* Layout responsive */
      .pc-layout { min-height: 100vh; background: var(--bg); }
      .pc-sidebar { display: none; }
      .pc-mobile-tabs { display: flex; }
      .pc-content-wrap { padding: 0; }
      
      @media (min-width: 768px) {
        .pc-layout { display: flex; }
        .pc-sidebar { display: flex; flex-direction: column; width: 220px; background: white; border-right: 1px solid var(--border); position: sticky; top: 0; height: 100vh; padding: 16px 12px; flex-shrink: 0; overflow-y: auto; }
        .pc-mobile-tabs { display: none; }
        .pc-mobile-nav { display: none; }
        .pc-content-wrap { flex: 1; max-width: 1100px; margin: 0 auto; padding: 0 24px; }
      }
      
      .pc-grid-2 { display: grid; grid-template-columns: 1fr; gap: 12px; }
      @media (min-width: 640px) { .pc-grid-2 { grid-template-columns: repeat(2, 1fr); } }
      @media (min-width: 1024px) { .pc-grid-2 { grid-template-columns: repeat(2, 1fr); } }
      
      .pc-grid-3 { display: grid; grid-template-columns: 1fr; gap: 12px; }
      @media (min-width: 640px) { .pc-grid-3 { grid-template-columns: repeat(2, 1fr); } }
      @media (min-width: 1024px) { .pc-grid-3 { grid-template-columns: repeat(3, 1fr); } }
    `}</style>
    
    <div className="pc-layout">
      {/* SIDEBAR (desktop) */}
      <aside className="pc-sidebar">
        <div style={{padding:'4px 0 12px',marginBottom:14,borderBottom:'1px solid #e5e7eb'}}>
          <img src="/logo.svg" alt="PropControl" style={{width:'100%',maxWidth:200,height:'auto',display:'block'}}/>
        </div>
        
        {workspaces.length>0&&<div style={{marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:1,marginBottom:5,padding:'0 8px'}}>Workspace</div>
          <select value={currentWs?.id||''} onChange={e=>{const w=workspaces.find((x:any)=>x.id===e.target.value);if(w)setCurrentWs(w)}} style={{width:'100%',padding:'8px 10px',border:'1.5px solid #e5e7eb',borderRadius:9,fontSize:12,fontWeight:600,outline:'none',background:'#f8fafc'}}>
            {workspaces.map((w:any)=><option key={w.id} value={w.id}>{w.nombre}{w.rol==='owner'?'':' 🤝'}</option>)}
          </select>
        </div>}
        
        <nav style={{flex:1,overflowY:'auto'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 12px',marginBottom:2,borderRadius:9,
              background:tab===t.id?'#dbeafe':'transparent',color:tab===t.id?'#2563eb':'#475569',
              fontSize:13,fontWeight:tab===t.id?700:500,border:'none',cursor:'pointer',textAlign:'left'
            }}>
              <span style={{fontSize:16,width:18,textAlign:'center'}}>{t.ico}</span>
              <span>{t.lbl}</span>
            </button>
          ))}
        </nav>
        
        <div style={{borderTop:'1px solid #e5e7eb',paddingTop:10,marginTop:10}}>
          {userData?.es_superadmin&&<div style={{display:'inline-block',background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'white',padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:700,marginBottom:8}}>✦ ADMIN</div>}
          {!userData?.es_superadmin&&userData?.suscripcion_estado==='trial'&&<div style={{background:'#fef3c7',color:'#78350f',padding:'5px 10px',borderRadius:8,fontSize:11,fontWeight:600,marginBottom:8,textAlign:'center'}}>⏳ {diasTrial} días de trial</div>}
          {!userData?.es_superadmin&&<button onClick={()=>router.push('/planes')} style={{width:'100%',background:userData?.suscripcion_estado==='activa'?'#dcfce7':'#16a34a',color:userData?.suscripcion_estado==='activa'?'#14532d':'white',padding:'8px',borderRadius:8,fontSize:12,fontWeight:700,border:'none',cursor:'pointer',marginBottom:8}}>
            {userData?.suscripcion_estado==='activa'?'✓ Plan activo':'Suscribirse'}
          </button>}
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px',borderRadius:8,background:'#f8fafc'}}>
            <div style={{width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#2563eb,#1e3a8a)',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,flexShrink:0}}>{ini}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:600,color:'#0f172a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{user?.email}</div>
            </div>
            <button onClick={logout} title="Cerrar sesión" style={{background:'none',border:'none',color:'#64748b',fontSize:14,cursor:'pointer',padding:4}}>↪</button>
          </div>
        </div>
      </aside>
      
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>
        {/* MOBILE NAV */}
        <nav className="pc-mobile-nav" style={{background:'white',borderBottom:'1px solid #e5e7eb',position:'sticky',top:0,zIndex:100,display:'flex',alignItems:'center',padding:'0 12px',height:54,gap:8}}>
          <img src="/logo.svg" alt="PropControl" style={{height:36,display:'block'}}/>
          {workspaces.length>0&&<select value={currentWs?.id||''} onChange={e=>{const w=workspaces.find((x:any)=>x.id===e.target.value);if(w)setCurrentWs(w)}} style={{flex:1,maxWidth:140,padding:'5px 8px',border:'1.5px solid #e5e7eb',borderRadius:8,fontSize:11,fontWeight:600,outline:'none'}}>
            {workspaces.map((w:any)=><option key={w.id} value={w.id}>{w.nombre}</option>)}
          </select>}
          <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:'auto'}}>
            {userData?.es_superadmin&&<div style={{background:'linear-gradient(135deg,#7c3aed,#a855f7)',color:'white',padding:'3px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>ADMIN</div>}
            {!userData?.es_superadmin&&userData?.suscripcion_estado==='trial'&&<div style={{background:'#fef3c7',color:'#78350f',padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:600}}>{diasTrial}d</div>}
            {!userData?.es_superadmin&&<button onClick={()=>router.push('/planes')} style={{background:'#16a344',color:'white',padding:'5px 10px',borderRadius:8,fontSize:11,fontWeight:700,border:'none',cursor:'pointer'}}>
              {userData?.suscripcion_estado==='activa'?'Plan':'Plan'}
            </button>}
            <button onClick={logout} style={{width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#2563eb,#1e3a8a)',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,border:'none',cursor:'pointer'}}>{ini}</button>
          </div>
        </nav>

        {/* MOBILE TABS */}
        <div className="pc-mobile-tabs" style={{background:'white',borderBottom:'1px solid #e5e7eb',overflowX:'auto',scrollbarWidth:'none'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flexShrink:0,minWidth:62,padding:'10px 8px 8px',textAlign:'center',fontSize:10,fontWeight:tab===t.id?700:600,color:tab===t.id?'#2563eb':'#64748b',borderBottom:`2px solid ${tab===t.id?'#2563eb':'transparent'}`,background:'none',border:'none',cursor:'pointer',whiteSpace:'nowrap'}}>
              <span style={{display:'block',fontSize:16,marginBottom:2}}>{t.ico}</span>{t.lbl}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="pc-content-wrap">
          {renderContent()}
        </div>
      </div>

      {/* FAB */}
      {FAB_ACTIONS[tab]&&<button onClick={FAB_ACTIONS[tab]} style={{position:'fixed',bottom:24,right:24,width:56,height:56,background:'linear-gradient(135deg,#2563eb,#1e3a8a)',color:'white',borderRadius:28,fontSize:26,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 24px rgba(37,99,235,.4)',zIndex:150,border:'none',cursor:'pointer',fontWeight:300}}>+</button>}

      {/* MODALES */}
      {modal?.type==='pago'&&<ModalPago
        contrato={modal.contrato} mes={modal.mes} mObj={modal.mObj} vm={vm}
        lista={modal.lista||[]}
        inqNombre={(()=>{const inq=inqs.find(i=>i.id===modal.contrato.inquilino_id);return inq?inq.nombre:''})()}
        onClose={()=>setModal(null)}
        onAdd={async(pg:any)=>{
          const data=await store.addPago({...pg,contrato_id:modal.contrato.id,periodo:modal.mes.key})
          if(data)setModal((m:any)=>m?{...m,lista:[...m.lista,data]}:m)
        }}
        onDel={async(id:string)=>{
          await store.delPago(id)
          setModal((m:any)=>m?{...m,lista:m.lista.filter((p:any)=>p.id!==id)}:m)
        }}
      />}

      {modal?.type==='prop'&&<FormProp
        ini={modal.data} grupos={grupos} owners={owners} propsList={props}
        onSave={async(d:any)=>{if(modal.data)await store.updProp(modal.data.id,d);else await store.addProp(d)}}
        onDelete={async()=>{if(modal.data)await store.delProp(modal.data.id)}}
        onClose={()=>setModal(null)}
      />}

      {modal?.type==='inq'&&<FormInq
        ini={modal.data}
        onSave={async(d:any)=>{if(modal.data)await store.updInq(modal.data.id,d);else await store.addInq(d)}}
        onDelete={async()=>{if(modal.data)await store.delInq(modal.data.id)}}
        onClose={()=>setModal(null)}
      />}

      {modal?.type==='contrato'&&<FormContrato
        ini={modal.data} props={props} inqs={inqs}
        onSave={async(d:any)=>{
          const payload={propiedad_id:d.propiedad_id,inquilino_id:d.inquilino_id,fecha_inicio:d.fecha_inicio,activo:true,tipo:d.tipo,moneda:d.moneda,monto_base:d.monto_base||0,ajuste:d.ajuste||'ninguno',frec_ajuste:d.frec_ajuste||'mensual',iva:d.iva||false,tramos:d.tramos||[],conceptos:d.conceptos||[],nombre_propiedad:d.nombre_propiedad,nombre_inquilino:d.nombre_inquilino,contrato:{...d}}
          if(modal.data)await store.updContrato(modal.data.id,payload)
          else await store.addContrato(payload)
        }}
        onDelete={async()=>{if(modal.data)await store.delContrato(modal.data.id)}}
        onClose={()=>setModal(null)}
      />}

      {modal?.type==='gasto'&&(
        <div style={S.modal} onClick={(e:any)=>{if(e.target===e.currentTarget)setModal(null)}}>
          <div style={S.modalBox}>
            <div style={S.handle}/>
            <div style={{fontSize:17,fontWeight:800,marginBottom:13}}>Registrar Gasto</div>
            <GastoForm props={props} grupos={grupos} onSave={async(d:any)=>{
              if(Array.isArray(d)){
                // Multiple gastos del grupo
                for(const g of d){await store.addGasto(g)}
              } else {
                await store.addGasto(d)
              }
              setModal(null)
            }} onClose={()=>setModal(null)}/>
          </div>
        </div>
      )}

      {modal?.type==='grupo'&&<FormGrupo
        ini={modal.data} grupos={grupos}
        onSave={async(d:any)=>{if(modal.data)await store.updGrupo(modal.data.id,d);else await store.addGrupo(d)}}
        onDelete={async()=>{if(modal.data)await store.delGrupo(modal.data.id)}}
        onClose={()=>setModal(null)}
      />}

      {modal?.type==='owner'&&<FormOwner
        ini={modal.data}
        onSave={async(d:any)=>{if(modal.data)await store.updOwner(modal.data.id,d);else await store.addOwner(d)}}
        onDelete={async()=>{if(modal.data)await store.delOwner(modal.data.id)}}
        onClose={()=>setModal(null)}
      />}

      {modal?.type==='expensa'&&<FormExpensa
        ini={modal.data} grupos={grupos} props={props}
        onSave={async(d:any)=>{if(modal.data)await store.updExpensa(modal.data.id,d);else await store.addExpensa(d)}}
        onDelete={async()=>{if(modal.data)await store.delExpensa(modal.data.id)}}
        onClose={()=>setModal(null)}
      />}

      {modal?.type==='varCustom'&&<FormVarCustom
        ini={modal.data}
        onSave={async(d:any)=>{if(modal.data)await store.updVarCustom(modal.data.id,d);else await store.addVarCustom(d)}}
        onDelete={async()=>{if(modal.data)await store.delVarCustom(modal.data.id)}}
        onClose={()=>setModal(null)}
      />}
    </div>
    </>
  )
}

function GastoForm({props,grupos,onSave,onClose}:any){
  const [d,setD]=useState<any>({alcance:'propiedad',propiedad_id:'',grupo_id:'',tipo:'arreglo',monto:'',moneda:'pesos',quien:'propietario',estado:'pendiente',descripcion:''})
  const up=(f:string,v:any)=>setD((p:any)=>({...p,[f]:v}))
  const ok=d.monto&&((d.alcance==='propiedad'&&d.propiedad_id)||(d.alcance==='grupo'&&d.grupo_id))
  const propsDelGrupo=d.grupo_id?props.filter((p:any)=>p.grupo_id===d.grupo_id):[]
  const monto=parseFloat(d.monto)||0
  
  return(<>
    {/* Alcance */}
    <div style={S.fg}><label style={S.lbl}>¿A qué se aplica el gasto?</label>
      <div style={{display:'flex',gap:6}}>
        <button type="button" onClick={()=>up('alcance','propiedad')} style={{flex:1,padding:10,borderRadius:9,border:`1.5px solid ${d.alcance==='propiedad'?'#2563eb':'#e5e7eb'}`,background:d.alcance==='propiedad'?'#dbeafe':'white',fontSize:13,fontWeight:700,color:d.alcance==='propiedad'?'#2563eb':'#64748b',cursor:'pointer'}}>
          🏢 Una propiedad<div style={{fontSize:10,fontWeight:500,marginTop:2}}>específica</div>
        </button>
        <button type="button" onClick={()=>up('alcance','grupo')} style={{flex:1,padding:10,borderRadius:9,border:`1.5px solid ${d.alcance==='grupo'?'#2563eb':'#e5e7eb'}`,background:d.alcance==='grupo'?'#dbeafe':'white',fontSize:13,fontWeight:700,color:d.alcance==='grupo'?'#2563eb':'#64748b',cursor:'pointer'}}>
          🏘️ Un grupo<div style={{fontSize:10,fontWeight:500,marginTop:2}}>distribuir por %</div>
        </button>
      </div>
    </div>

    {d.alcance==='propiedad'&&<div style={S.fg}><label style={S.lbl}>Propiedad</label>
      <select style={S.sel} value={d.propiedad_id} onChange={e=>up('propiedad_id',e.target.value)}>
        <option value="">— Seleccionar —</option>
        {props.filter((p:any)=>p.activo).map((p:any)=><option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
      </select>
    </div>}

    {d.alcance==='grupo'&&<div style={S.fg}><label style={S.lbl}>Grupo / Edificio</label>
      <select style={S.sel} value={d.grupo_id} onChange={e=>up('grupo_id',e.target.value)}>
        <option value="">— Seleccionar —</option>
        {(grupos||[]).map((g:any)=><option key={g.id} value={g.id}>{g.nombre}</option>)}
      </select>
      {d.grupo_id&&<div style={{padding:'9px 11px',borderRadius:9,fontSize:11,marginTop:8,background:'#dbeafe',color:'#1e3a8a'}}>
        💡 El gasto se distribuirá entre las {propsDelGrupo.length} propiedades del grupo según el % de expensas asignado.
      </div>}
    </div>}

    <div style={S.fg}><label style={S.lbl}>Tipo</label>
      <select style={S.sel} value={d.tipo} onChange={e=>up('tipo',e.target.value)}>
        <option value="arreglo">Arreglo/Reparación</option><option value="expensas">Expensas</option><option value="servicio">Servicio</option><option value="impuesto">Impuesto</option><option value="otro">Otro</option>
      </select>
    </div>
    <div style={S.fg}><label style={S.lbl}>Monto</label>
      <div style={{display:'flex',border:'1.5px solid #e5e7eb',borderRadius:10,overflow:'hidden'}}>
        <select style={{border:'none',background:'#f3f4f6',padding:'9px 8px',fontSize:13,fontWeight:700,outline:'none',borderRight:'1px solid #e5e7eb',minWidth:72,color:'#111827'}} value={d.moneda} onChange={e=>up('moneda',e.target.value)}>
          <option value="pesos">$ Pesos</option><option value="dolar">U$D</option>
        </select>
        <input style={{flex:1,border:'none',padding:'9px 11px',fontSize:15,outline:'none',background:'white',minWidth:0}} type="number" value={d.monto} onChange={e=>up('monto',e.target.value)}/>
      </div>
    </div>

    {d.alcance==='grupo'&&d.grupo_id&&propsDelGrupo.length>0&&monto>0&&<div style={{background:'#f3f4f6',borderRadius:9,padding:10,marginBottom:11}}>
      <div style={{fontSize:11,fontWeight:700,color:'#6b7280',marginBottom:5}}>Distribución automática:</div>
      {propsDelGrupo.map((p:any)=>{
        const pct=p.pct_expensas||0
        const m=monto*pct/100
        return(
          <div key={p.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'2px 0'}}>
            <span>{p.codigo} ({pct}%)</span>
            <span style={{fontWeight:600}}>{fmtN(m,'pesos')}</span>
          </div>
        )
      })}
    </div>}

    <div style={{display:'flex',gap:9,marginBottom:11}}>
      <div style={{flex:1}}><label style={S.lbl}>¿Quién paga?</label>
        <select style={S.sel} value={d.quien} onChange={e=>up('quien',e.target.value)}>
          <option value="propietario">Propietario</option><option value="inquilino">Inquilino</option>
        </select>
      </div>
      <div style={{flex:1}}><label style={S.lbl}>Estado</label>
        <select style={S.sel} value={d.estado} onChange={e=>up('estado',e.target.value)}>
          <option value="pendiente">Pendiente</option><option value="pagado">Pagado</option>
        </select>
      </div>
    </div>
    <div style={S.fg}><label style={S.lbl}>Descripción</label><input style={S.inp} value={d.descripcion} onChange={e=>up('descripcion',e.target.value)}/></div>
    <button style={{...S.btnP,opacity:ok?1:.5}} disabled={!ok} onClick={()=>{
      if(!ok)return
      const base={tipo:d.tipo,monto:parseFloat(d.monto),moneda:d.moneda,quien:d.quien,estado:d.estado,descripcion:d.descripcion,fecha:new Date().toISOString().slice(0,10)}
      if(d.alcance==='propiedad'){
        onSave({...base,propiedad_id:d.propiedad_id})
      } else {
        // Crear un gasto por cada propiedad del grupo distribuyendo por %
        const items=propsDelGrupo.filter((p:any)=>p.pct_expensas>0).map((p:any)=>({
          ...base,
          propiedad_id:p.id,
          monto:parseFloat(d.monto)*p.pct_expensas/100,
          descripcion:`${d.descripcion||'Gasto del grupo'} (${p.pct_expensas}%)`,
          grupo_id:d.grupo_id
        }))
        onSave(items)
      }
    }}>Guardar gasto</button>
    <button style={{...S.btnS,marginTop:7}} onClick={onClose}>Cancelar</button>
  </>)
}


// ─── TAB EQUIPO ───────────────────────────────
function RenderEquipo({workspace, userId, workspaces, setWorkspaces, setCurrentWs}:any){
  const [members,setMembers]=useState<any[]>([])
  const [email,setEmail]=useState('')
  const [loading,setLoading]=useState(false)
  const [msg,setMsg]=useState('')
  const [newWsName,setNewWsName]=useState('')
  const isOwner=workspace?.owner_id===userId

  async function loadMembers(){
    if(!workspace)return
    const{data}=await sb.from('workspace_members').select('id,rol,estado,usuario_id,invited_email,usuarios(email,nombre)').eq('workspace_id',workspace.id)
    setMembers(data||[])
  }

  useEffect(()=>{loadMembers()},[workspace?.id])

  async function invitar(){
    if(!email)return
    setLoading(true);setMsg('')
    const{data,error}=await sb.rpc('invitar_miembro',{p_workspace_id:workspace.id,p_email:email})
    setLoading(false)
    if(error){setMsg('Error: '+error.message);return}
    if(data?.ok){
      setMsg(data.pendiente?'Invitación enviada. La persona debe registrarse con ese email.':'¡Miembro agregado!')
      setEmail('')
      loadMembers()
    } else setMsg('Error: '+(data?.error||'desconocido'))
  }

  async function quitar(memberId:string){
    if(!confirm('¿Quitar a este miembro?'))return
    await sb.from('workspace_members').delete().eq('id',memberId)
    loadMembers()
  }

  async function crearWs(){
    if(!newWsName.trim())return
    const{data,error}=await sb.from('workspaces').insert({nombre:newWsName.trim(),owner_id:userId}).select().single()
    if(error){alert('Error: '+error.message);return}
    if(data){
      await sb.from('workspace_members').insert({workspace_id:data.id,usuario_id:userId,rol:'owner',estado:'activo'})
      setWorkspaces([...workspaces,{...data,rol:'owner'}])
      setCurrentWs({...data,rol:'owner'})
      setNewWsName('')
    }
  }

  return(
    <div style={{padding:14}}>
      <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'0 0 9px'}}>Workspace actual</p>
      <div style={{...S.card}}>
        <div style={{fontWeight:700,fontSize:15}}>{workspace?.nombre||'—'}</div>
        <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>{isOwner?'Sos el dueño de este espacio':'Compartido contigo'}</div>
      </div>

      <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'14px 0 9px'}}>Miembros ({members.length})</p>
      {members.map((m:any)=>(
        <div key={m.id} style={{...S.card,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontWeight:700,fontSize:14}}>{m.usuarios?.nombre||m.usuarios?.email||m.invited_email||'Pendiente'}</div>
            <div style={{fontSize:12,color:'#6b7280'}}>
              {m.rol==='owner'?'👑 Dueño':'✏️ Editor'}
              {m.estado==='pendiente'&&' · ⏳ Esperando registro'}
            </div>
          </div>
          {isOwner&&m.rol!=='owner'&&<button onClick={()=>quitar(m.id)} style={{background:'#fee2e2',color:'#7f1d1d',padding:'5px 10px',borderRadius:8,fontSize:12,fontWeight:600,border:'none',cursor:'pointer'}}>Quitar</button>}
        </div>
      ))}

      {isOwner&&<>
        <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'14px 0 9px'}}>Invitar a alguien</p>
        <div style={{...S.card}}>
          <div style={{fontSize:12,color:'#6b7280',marginBottom:8}}>La persona debe tener cuenta de Google. Si todavía no se registró, dejará la invitación pendiente.</div>
          <div style={S.fg}><label style={S.lbl}>Email</label><input style={S.inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ejemplo@gmail.com"/></div>
          <button style={{...S.btnP,opacity:email?1:.5}} disabled={!email||loading} onClick={invitar}>{loading?'Enviando...':'Invitar'}</button>
          {msg&&<div style={{padding:'9px 11px',borderRadius:9,fontSize:13,marginTop:8,background:msg.startsWith('Error')?'#fee2e2':'#dcfce7',color:msg.startsWith('Error')?'#7f1d1d':'#14532d'}}>{msg}</div>}
        </div>
      </>}

      <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'14px 0 9px'}}>Crear otro workspace</p>
      <div style={{...S.card}}>
        <div style={{fontSize:12,color:'#6b7280',marginBottom:8}}>Útil si querés separar datos de distintos clientes o proyectos.</div>
        <div style={S.fg}><label style={S.lbl}>Nombre</label><input style={S.inp} value={newWsName} onChange={e=>setNewWsName(e.target.value)} placeholder="Ej: Edificio Belgrano"/></div>
        <button style={{...S.btnS,opacity:newWsName?1:.5}} disabled={!newWsName} onClick={crearWs}>+ Crear workspace</button>
      </div>
      <div style={{height:70}}/>
    </div>
  )
}

// ─── TAB IMPORTAR ─────────────────────────────
function RenderImportar({store}:any){
  const [tab,setTab]=useState<'json'|'csv'>('json')
  const [msg,setMsg]=useState('')
  const fileRef=useRef<HTMLInputElement>(null)

  async function handleJSON(file:File){
    setMsg('Procesando...')
    try{
      const text=await file.text()
      const data=JSON.parse(text)
      let count=0
      if(data.propiedades?.length){
        const items=data.propiedades.map((p:any)=>{const{id,usuario_id,workspace_id,created_at,...rest}=p;return rest})
        const r=await store.bulkImport(items,'propiedades');count+=r.count
      }
      if(data.inquilinos?.length){
        const items=data.inquilinos.map((p:any)=>{const{id,usuario_id,workspace_id,created_at,...rest}=p;return rest})
        const r=await store.bulkImport(items,'inquilinos');count+=r.count
      }
      if(data.grupos?.length){
        const items=data.grupos.map((p:any)=>{const{id,usuario_id,workspace_id,created_at,...rest}=p;return rest})
        const r=await store.bulkImport(items,'grupos');count+=r.count
      }
      if(data.propietarios?.length){
        const items=data.propietarios.map((p:any)=>{const{id,usuario_id,workspace_id,created_at,...rest}=p;return rest})
        const r=await store.bulkImport(items,'propietarios');count+=r.count
      }
      setMsg(`✓ Importados ${count} registros correctamente`)
    } catch(e:any){
      setMsg('Error: '+e.message)
    }
  }

  async function handleCSV(file:File){
    setMsg('Procesando...')
    try{
      const text=await file.text()
      const lines=text.split(/\r?\n/).filter((l:string)=>l.trim())
      if(lines.length<2){setMsg('El archivo está vacío');return}
      const headers=lines[0].split(',').map((h:string)=>h.trim().toLowerCase())
      const items=[]
      for(let i=1;i<lines.length;i++){
        const vals=lines[i].split(',').map((v:string)=>v.trim())
        const row:any={}
        headers.forEach((h:string,j:number)=>{
          row[h]=vals[j]||''
        })
        const item:any={
          codigo:row.codigo||row.cod||`P${i}`,
          nombre:row.nombre||row.name||`Propiedad ${i}`,
          direccion:row.direccion||row.address||'',
          ciudad:row.ciudad||row.city||'Yerba Buena',
          tipo:row.tipo||row.type||'local',
          superficie:parseFloat(row.superficie||row.m2||row.metros||'0')||null,
          observaciones:row.observaciones||row.notas||'',
          activo:true,
          valor_compra:parseFloat(row.valor_compra||row.valor||'0')||0
        }
        items.push(item)
      }
      const r=await store.bulkImport(items,'propiedades')
      if(r.error)setMsg('Error: '+r.error.message)
      else setMsg(`✓ Importadas ${r.count} propiedades`)
    } catch(e:any){
      setMsg('Error: '+e.message)
    }
  }

  function onFile(e:any){
    const f=e.target.files?.[0]
    if(!f)return
    if(tab==='json')handleJSON(f)
    else handleCSV(f)
  }

  return(
    <div style={{padding:14}}>
      <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'0 0 9px'}}>Importar datos</p>
      <div style={{display:'flex',gap:6,marginBottom:11}}>
        <button onClick={()=>setTab('json')} style={{flex:1,padding:10,borderRadius:9,border:`1.5px solid ${tab==='json'?'#2563eb':'#e5e7eb'}`,background:tab==='json'?'#dbeafe':'white',fontSize:13,fontWeight:700,color:tab==='json'?'#2563eb':'#6b7280',cursor:'pointer'}}>Backup JSON</button>
        <button onClick={()=>setTab('csv')} style={{flex:1,padding:10,borderRadius:9,border:`1.5px solid ${tab==='csv'?'#2563eb':'#e5e7eb'}`,background:tab==='csv'?'#dbeafe':'white',fontSize:13,fontWeight:700,color:tab==='csv'?'#2563eb':'#6b7280',cursor:'pointer'}}>CSV propiedades</button>
      </div>

      {tab==='json'&&<div style={{...S.card}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>Restaurar desde backup</div>
        <div style={{fontSize:12,color:'#6b7280',marginBottom:10}}>Subí un archivo JSON exportado desde la pestaña Reporte. Se importarán propiedades, inquilinos, grupos y propietarios.</div>
        <div style={{padding:'9px 11px',borderRadius:9,fontSize:12,marginBottom:10,background:'#fef3c7',color:'#78350f'}}>
          ⚠️ Los datos se agregarán a los existentes. Si querés empezar de cero, primero borrá los datos viejos.
        </div>
      </div>}

      {tab==='csv'&&<div style={{...S.card}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>Importar propiedades desde CSV</div>
        <div style={{fontSize:12,color:'#6b7280',marginBottom:10}}>El archivo debe tener las siguientes columnas en la primera fila:</div>
        <div style={{background:'#f3f4f6',padding:10,borderRadius:8,fontFamily:'monospace',fontSize:11,color:'#111827',marginBottom:10,overflow:'auto'}}>
          codigo,nombre,direccion,ciudad,tipo,superficie,observaciones,valor_compra
        </div>
        <div style={{fontSize:12,color:'#6b7280',marginBottom:10}}>
          <strong>Tipos válidos:</strong> local, depto, terreno, otro<br/>
          <strong>Ejemplo de fila:</strong><br/>
          <span style={{fontFamily:'monospace',fontSize:11}}>HL01,Punto Heller L1,Av. Aconquija 1234,Yerba Buena,local,80,,150000000</span>
        </div>
        <a href={"data:text/csv;charset=utf-8,"+encodeURIComponent("codigo,nombre,direccion,ciudad,tipo,superficie,observaciones,valor_compra\nHL01,Ejemplo Local,Av. Aconquija 1234,Yerba Buena,local,80,,150000000")} download="plantilla_propiedades.csv" style={{display:'inline-block',background:'#dbeafe',color:'#2563eb',padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:600,textDecoration:'none',marginBottom:10}}>⬇ Descargar plantilla CSV</a>
      </div>}

      <input type="file" accept={tab==='json'?'.json':'.csv'} ref={fileRef} onChange={onFile} style={{display:'none'}}/>
      <button style={S.btnP} onClick={()=>fileRef.current?.click()}>📁 Seleccionar archivo</button>
      {msg&&<div style={{padding:'10px 12px',borderRadius:9,fontSize:13,marginTop:9,background:msg.startsWith('Error')?'#fee2e2':msg.startsWith('✓')?'#dcfce7':'#dbeafe',color:msg.startsWith('Error')?'#7f1d1d':msg.startsWith('✓')?'#14532d':'#1e3a8a'}}>{msg}</div>}
      <div style={{height:70}}/>
    </div>
  )
}


// ─── TAB GRUPOS ───────────────────────────────
function RenderGrupos({store,setModal}:any){
  const {grupos,props}=store
  // Construir árbol: padres primero
  const padres=grupos.filter((g:any)=>!g.parent_id)
  const hijosOf=(parentId:string)=>grupos.filter((g:any)=>g.parent_id===parentId)
  
  function GrupoCard({g,nivel}:{g:any,nivel:number}){
    const propsDelGrupo=props.filter((p:any)=>p.grupo_id===g.id)
    const totalPct=propsDelGrupo.reduce((s:number,p:any)=>s+(p.pct_expensas||0),0)
    const subgrupos=hijosOf(g.id)
    return(
      <div style={{marginLeft:nivel*16}}>
        <div style={S.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:15}}>
                {nivel>0&&<span style={{color:'#94a3b8',marginRight:5}}>↳</span>}
                {g.nombre}
              </div>
              {g.direccion&&<div style={{fontSize:12,color:'#6b7280'}}>{g.direccion}</div>}
              <div style={{display:'flex',gap:8,fontSize:12,marginTop:3,flexWrap:'wrap'}}>
                <span style={{color:'#16a34a',fontWeight:600}}>{propsDelGrupo.length} prop.</span>
                <span style={{color:'#6b7280'}}>Suma: {totalPct}%</span>
                {subgrupos.length>0&&<span style={{color:'#7c3aed',fontWeight:600}}>{subgrupos.length} subgrupo{subgrupos.length>1?'s':''}</span>}
              </div>
            </div>
            <button onClick={()=>setModal({type:'grupo',data:g})} style={{background:'#f3f4f6',color:'#111827',padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:600,border:'none',cursor:'pointer'}}>Editar</button>
          </div>
          {propsDelGrupo.length>0&&<div style={{marginTop:8,paddingTop:8,borderTop:'1px solid #e5e7eb'}}>
            {propsDelGrupo.map((p:any)=>(
              <div key={p.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'2px 0'}}>
                <span>• {p.codigo} · {p.nombre}</span>
                <span style={{fontWeight:600,color:'#6b7280'}}>{p.pct_expensas||0}%</span>
              </div>
            ))}
          </div>}
          {totalPct!==100&&propsDelGrupo.length>0&&<div style={{padding:'6px 9px',borderRadius:7,fontSize:11,marginTop:6,background:'#fef3c7',color:'#78350f'}}>
            ⚠️ La suma de % no llega a 100.
          </div>}
        </div>
        {subgrupos.map((sub:any)=><GrupoCard key={sub.id} g={sub} nivel={nivel+1}/>)}
      </div>
    )
  }
  
  return(
    <div style={{padding:14}}>
      <div style={{padding:'9px 11px',borderRadius:9,fontSize:12,marginBottom:9,background:'#dbeafe',color:'#1e3a8a'}}>
        💡 Podés crear grupos y subgrupos. Ej: <strong>Edificio Belgrano</strong> → <strong>Planta Baja</strong>, <strong>Pisos 1-5</strong>, <strong>Cocheras</strong>. Útil para distribuir expensas con más detalle.
      </div>
      <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'0 0 9px'}}>{grupos.length} grupos</p>
      {grupos.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:'#6b7280'}}>
        <div style={{fontSize:40,marginBottom:8}}>🏘️</div>
        <div style={{fontSize:15,fontWeight:600,color:'#111827',marginBottom:4}}>Sin grupos</div>
        <div style={{fontSize:13}}>Tocá + para crear uno (ej: Edificio Belgrano)</div>
      </div>}
      {padres.map((g:any)=><GrupoCard key={g.id} g={g} nivel={0}/>)}
      <div style={{height:70}}/>
    </div>
  )
}

function FormGrupo({ini,grupos,onSave,onDelete,onClose}:any){
  const [d,setD]=useState(ini||{nombre:'',direccion:'',descripcion:'',parent_id:''})
  const up=(f:string,v:any)=>setD((p:any)=>({...p,[f]:v}))
  const ok=d.nombre.trim()
  // Excluir self y descendientes para evitar ciclos
  const posiblesPadres=(grupos||[]).filter((g:any)=>!ini||g.id!==ini.id)
  return(
    <div style={S.modal} onClick={(e:any)=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={S.modalBox}>
        <div style={S.handle}/>
        <div style={{fontSize:17,fontWeight:800,marginBottom:13}}>{ini?'Editar grupo':'Nuevo grupo'}</div>
        <div style={S.fg}><label style={S.lbl}>Nombre</label><input style={S.inp} value={d.nombre} onChange={e=>up('nombre',e.target.value)} placeholder="Ej: Edificio Belgrano / Planta Baja" autoFocus/></div>
        <div style={S.fg}><label style={S.lbl}>🏢 Pertenece a otro grupo (opcional)</label>
          <select style={S.sel} value={d.parent_id||''} onChange={e=>up('parent_id',e.target.value||null)}>
            <option value="">— Es un grupo principal —</option>
            {posiblesPadres.map((g:any)=><option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          <div style={{fontSize:11,color:'#64748b',marginTop:5}}>Útil para crear subgrupos. Ej: Edificio Belgrano → Planta Baja, Pisos 1-5, Cocheras.</div>
        </div>
        <div style={S.fg}><label style={S.lbl}>Dirección</label><input style={S.inp} value={d.direccion||''} onChange={e=>up('direccion',e.target.value)}/></div>
        <div style={S.fg}><label style={S.lbl}>Descripción / Notas</label><textarea style={{...S.inp,resize:'none'}} rows={2} value={d.descripcion||''} onChange={e=>up('descripcion',e.target.value)}/></div>
        <button style={{...S.btnP,opacity:ok?1:.5}} disabled={!ok} onClick={()=>{if(ok){onSave(d);onClose()}}}>Guardar</button>
        {ini&&<button style={S.btnD} onClick={()=>{onDelete();onClose()}}>Eliminar</button>}
        <button style={{...S.btnS,marginTop:7}} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── TAB EXPENSAS ─────────────────────────────
function RenderExpensas({store,setModal}:any){
  const {expensas,grupos,props}=store
  return(
    <div style={{padding:14}}>
      <div style={{padding:'9px 11px',borderRadius:9,fontSize:12,marginBottom:9,background:'#dbeafe',color:'#1e3a8a'}}>
        💡 Cargá un gasto del edificio (ej: $200.000 de mantenimiento) y se distribuye automáticamente entre las propiedades del grupo según su %.
      </div>
      <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'0 0 9px'}}>{expensas.length} expensas</p>
      {expensas.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:'#6b7280'}}>
        <div style={{fontSize:40,marginBottom:8}}>💸</div>
        <div style={{fontSize:15,fontWeight:600,color:'#111827',marginBottom:4}}>Sin expensas cargadas</div>
        <div style={{fontSize:13}}>Tocá + para registrar la primera</div>
      </div>}
      {expensas.map((e:any)=>{
        const grupo=grupos.find((g:any)=>g.id===e.grupo_id)
        const propsDelGrupo=props.filter((p:any)=>p.grupo_id===e.grupo_id)
        return(
          <div key={e.id} style={S.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14}}>{e.concepto||'Expensa'}</div>
                <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>{grupo?.nombre||'Sin grupo'} · {e.periodo||''}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:16,fontWeight:800}}>{fmtN(e.monto,'pesos')}</div>
                <button onClick={()=>setModal({type:'expensa',data:e})} style={{background:'#f3f4f6',color:'#111827',padding:'4px 10px',borderRadius:7,fontSize:11,fontWeight:600,border:'none',cursor:'pointer',marginTop:4}}>Editar</button>
              </div>
            </div>
            {propsDelGrupo.length>0&&<div style={{marginTop:8,paddingTop:8,borderTop:'1px solid #e5e7eb'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#6b7280',marginBottom:4}}>Distribución:</div>
              {propsDelGrupo.map((p:any)=>{
                const pct=p.pct_expensas||0
                const monto=e.monto*pct/100
                return(
                  <div key={p.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'2px 0'}}>
                    <span>{p.codigo} ({pct}%)</span>
                    <span style={{fontWeight:600}}>{fmtN(monto,'pesos')}</span>
                  </div>
                )
              })}
            </div>}
          </div>
        )
      })}
      <div style={{height:70}}/>
    </div>
  )
}

function FormExpensa({ini,grupos,props,onSave,onDelete,onClose}:any){
  const [d,setD]=useState(ini||{concepto:'',monto:'',grupo_id:'',periodo:new Date().toISOString().slice(0,7),estado:'pendiente',descripcion:''})
  const up=(f:string,v:any)=>setD((p:any)=>({...p,[f]:v}))
  const ok=d.concepto&&d.monto&&d.grupo_id
  const propsDelGrupo=props.filter((p:any)=>p.grupo_id===d.grupo_id)
  const monto=parseFloat(d.monto)||0
  return(
    <div style={S.modal} onClick={(e:any)=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={S.modalBox}>
        <div style={S.handle}/>
        <div style={{fontSize:17,fontWeight:800,marginBottom:13}}>{ini?'Editar expensa':'Nueva expensa'}</div>
        <div style={S.fg}><label style={S.lbl}>Concepto</label><input style={S.inp} value={d.concepto} onChange={e=>up('concepto',e.target.value)} placeholder="Ej: Limpieza, Ascensor, ABL" autoFocus/></div>
        <div style={S.fg}><label style={S.lbl}>Grupo / Edificio</label>
          <select style={S.sel} value={d.grupo_id} onChange={e=>up('grupo_id',e.target.value)}>
            <option value="">— Seleccionar —</option>
            {grupos.map((g:any)=><option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </div>
        <div style={S.fg}><label style={S.lbl}>Monto total ($)</label><input style={S.inp} type="number" value={d.monto} onChange={e=>up('monto',e.target.value)}/></div>
        <div style={S.fg}><label style={S.lbl}>Período (AAAA-MM)</label><input style={S.inp} type="month" value={d.periodo} onChange={e=>up('periodo',e.target.value)}/></div>
        {d.grupo_id&&propsDelGrupo.length>0&&monto>0&&<div style={{background:'#f3f4f6',borderRadius:9,padding:10,marginBottom:9}}>
          <div style={{fontSize:11,fontWeight:700,color:'#6b7280',marginBottom:5}}>Distribución automática:</div>
          {propsDelGrupo.map((p:any)=>{
            const pct=p.pct_expensas||0
            const m=monto*pct/100
            return(
              <div key={p.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'2px 0'}}>
                <span>{p.codigo} ({pct}%)</span>
                <span style={{fontWeight:600}}>{fmtN(m,'pesos')}</span>
              </div>
            )
          })}
        </div>}
        <button style={{...S.btnP,opacity:ok?1:.5}} disabled={!ok} onClick={()=>{if(ok){onSave({...d,monto:parseFloat(d.monto)||0});onClose()}}}>Guardar</button>
        {ini&&<button style={S.btnD} onClick={()=>{onDelete();onClose()}}>Eliminar</button>}
        <button style={{...S.btnS,marginTop:7}} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── TAB DUEÑOS / PROPIETARIOS ────────────────
function RenderOwners({store,setModal}:any){
  const {owners,props}=store
  return(
    <div style={{padding:14}}>
      <div style={{padding:'9px 11px',borderRadius:9,fontSize:12,marginBottom:9,background:'#dbeafe',color:'#1e3a8a'}}>
        💡 Cargá los dueños/propietarios de las propiedades. Después en cada propiedad asignás el % de cada uno (puede haber varios).
      </div>
      <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'0 0 9px'}}>{owners.length} propietarios</p>
      {owners.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:'#6b7280'}}>
        <div style={{fontSize:40,marginBottom:8}}>👔</div>
        <div style={{fontSize:15,fontWeight:600,color:'#111827',marginBottom:4}}>Sin propietarios</div>
        <div style={{fontSize:13}}>Tocá + para agregar uno</div>
      </div>}
      {owners.map((o:any)=>{
        const propsDelOwner=props.filter((p:any)=>(p.propietarios||[]).some((x:any)=>x.owner_id===o.id))
        return(
          <div key={o.id} style={S.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:15}}>{o.nombre}</div>
                {o.email&&<div style={{fontSize:12,color:'#6b7280'}}>📧 {o.email}</div>}
                {o.telefono&&<div style={{fontSize:12,color:'#6b7280'}}>📱 {o.telefono}</div>}
                {o.cuit&&<div style={{fontSize:12,color:'#6b7280'}}>CUIT: {o.cuit}</div>}
                <div style={{fontSize:12,color:'#16a34a',fontWeight:600,marginTop:3}}>{propsDelOwner.length} propiedad{propsDelOwner.length!==1?'es':''}</div>
              </div>
              <button onClick={()=>setModal({type:'owner',data:o})} style={{background:'#f3f4f6',color:'#111827',padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:600,border:'none',cursor:'pointer'}}>Editar</button>
            </div>
            {propsDelOwner.length>0&&<div style={{marginTop:8,paddingTop:8,borderTop:'1px solid #e5e7eb'}}>
              {propsDelOwner.map((p:any)=>{
                const asig=(p.propietarios||[]).find((x:any)=>x.owner_id===o.id)
                return(
                  <div key={p.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'2px 0'}}>
                    <span>• {p.codigo} {p.nombre}</span>
                    <span style={{fontWeight:600,color:'#6b7280'}}>{asig?.pct||0}%</span>
                  </div>
                )
              })}
            </div>}
          </div>
        )
      })}
      <div style={{height:70}}/>
    </div>
  )
}

function FormOwner({ini,onSave,onDelete,onClose}:any){
  const [d,setD]=useState(ini||{nombre:'',cuit:'',dni:'',telefono:'',email:'',direccion:'',observaciones:''})
  const up=(f:string,v:any)=>setD((p:any)=>({...p,[f]:v}))
  const ok=d.nombre.trim()
  return(
    <div style={S.modal} onClick={(e:any)=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={S.modalBox}>
        <div style={S.handle}/>
        <div style={{fontSize:17,fontWeight:800,marginBottom:13}}>{ini?'Editar propietario':'Nuevo propietario'}</div>
        <div style={S.fg}><label style={S.lbl}>Nombre completo</label><input style={S.inp} value={d.nombre} onChange={e=>up('nombre',e.target.value)} autoFocus/></div>
        <div style={{display:'flex',gap:9,marginBottom:11}}>
          <div style={{flex:1}}><label style={S.lbl}>CUIT</label><input style={S.inp} value={d.cuit||''} onChange={e=>up('cuit',e.target.value)}/></div>
          <div style={{flex:1}}><label style={S.lbl}>DNI</label><input style={S.inp} value={d.dni||''} onChange={e=>up('dni',e.target.value)}/></div>
        </div>
        <div style={S.fg}><label style={S.lbl}>Teléfono</label><input style={S.inp} type="tel" value={d.telefono||''} onChange={e=>up('telefono',e.target.value)}/></div>
        <div style={S.fg}><label style={S.lbl}>Email</label><input style={S.inp} type="email" value={d.email||''} onChange={e=>up('email',e.target.value)}/></div>
        <div style={S.fg}><label style={S.lbl}>Dirección</label><input style={S.inp} value={d.direccion||''} onChange={e=>up('direccion',e.target.value)}/></div>
        <div style={S.fg}><label style={S.lbl}>Observaciones</label><textarea style={{...S.inp,resize:'none'}} rows={2} value={d.observaciones||''} onChange={e=>up('observaciones',e.target.value)}/></div>
        <button style={{...S.btnP,opacity:ok?1:.5}} disabled={!ok} onClick={()=>{if(ok){onSave(d);onClose()}}}>Guardar</button>
        {ini&&<button style={S.btnD} onClick={()=>{onDelete();onClose()}}>Eliminar</button>}
        <button style={{...S.btnS,marginTop:7}} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── TAB ÍNDICES ──────────────────────────────
function RenderIndices({store,setModal}:any){
  const {indices}=store
  return(
    <div style={{padding:14}}>
      <div style={{padding:'9px 11px',borderRadius:9,fontSize:12,marginBottom:9,background:'#dbeafe',color:'#1e3a8a'}}>
        💡 Creá índices personalizados (ej: ICL, IPC propio, índice del consorcio) y cargá el % de variación de cada mes. Después usalos en los contratos.
      </div>
      <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'0 0 9px'}}>{indices.length} índices</p>
      {indices.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:'#6b7280'}}>
        <div style={{fontSize:40,marginBottom:8}}>📏</div>
        <div style={{fontSize:15,fontWeight:600,color:'#111827',marginBottom:4}}>Sin índices</div>
        <div style={{fontSize:13}}>Tocá + para crear uno (ej: ICL, IPC Tucumán)</div>
      </div>}
      {indices.map((i:any)=>{
        const valores=i.valores||{}
        const meses=Object.keys(valores).sort().reverse().slice(0,6)
        return(
          <div key={i.id} style={S.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:15}}>{i.nombre}</div>
                {i.descripcion&&<div style={{fontSize:12,color:'#6b7280'}}>{i.descripcion}</div>}
              </div>
              <button onClick={()=>setModal({type:'indice',data:i})} style={{background:'#f3f4f6',color:'#111827',padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:600,border:'none',cursor:'pointer'}}>Editar valores</button>
            </div>
            {meses.length>0&&<div style={{marginTop:8,paddingTop:8,borderTop:'1px solid #e5e7eb'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#6b7280',marginBottom:4}}>Últimos meses:</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {meses.map((m:string)=>(
                  <span key={m} style={{fontSize:11,fontWeight:600,padding:'2px 7px',borderRadius:6,background:'#f3f4f6',color:'#111827'}}>{m}: {valores[m]}%</span>
                ))}
              </div>
            </div>}
          </div>
        )
      })}
      <div style={{height:70}}/>
    </div>
  )
}
function FormVarCustom({ini,onSave,onDelete,onClose}:any){
  const [d,setD]=useState(ini||{nombre:'',descripcion:'',unidad:'%',tipo:'porcentaje'})
  const up=(f:string,v:any)=>setD((p:any)=>({...p,[f]:v}))
  const ok=d.nombre.trim()
  return(
    <div style={S.modal} onClick={(e:any)=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={S.modalBox}>
        <div style={S.handle}/>
        <div style={{fontSize:17,fontWeight:800,marginBottom:13}}>{ini?'Editar variable':'Nueva variable'}</div>
        <div style={{padding:'9px 11px',borderRadius:9,fontSize:12,marginBottom:11,background:'#dbeafe',color:'#1e3a8a'}}>
          💡 Creá una variable propia (ej: Aumento del consorcio, ICL, Cuota mantenimiento). Después la cargás cada mes con su valor.
        </div>
        <div style={S.fg}><label style={S.lbl}>Nombre</label><input style={S.inp} value={d.nombre} onChange={e=>up('nombre',e.target.value)} placeholder="Ej: ICL, Aumento consorcio" autoFocus/></div>
        <div style={S.fg}><label style={S.lbl}>Tipo de valor</label>
          <div style={{display:'flex',gap:6}}>
            <button type="button" onClick={()=>{up('tipo','porcentaje');up('unidad','%')}} style={{flex:1,padding:10,borderRadius:9,border:`1.5px solid ${d.tipo==='porcentaje'?'#2563eb':'#e5e7eb'}`,background:d.tipo==='porcentaje'?'#dbeafe':'white',fontSize:13,fontWeight:700,color:d.tipo==='porcentaje'?'#2563eb':'#64748b',cursor:'pointer'}}>
              📈 Porcentaje (%)<div style={{fontSize:10,fontWeight:500,marginTop:2}}>Variación mensual</div>
            </button>
            <button type="button" onClick={()=>{up('tipo','monto');up('unidad','$')}} style={{flex:1,padding:10,borderRadius:9,border:`1.5px solid ${d.tipo==='monto'?'#2563eb':'#e5e7eb'}`,background:d.tipo==='monto'?'#dbeafe':'white',fontSize:13,fontWeight:700,color:d.tipo==='monto'?'#2563eb':'#64748b',cursor:'pointer'}}>
              💵 Monto ($)<div style={{fontSize:10,fontWeight:500,marginTop:2}}>Cotización</div>
            </button>
          </div>
        </div>
        <div style={S.fg}><label style={S.lbl}>Descripción (opcional)</label><input style={S.inp} value={d.descripcion||''} onChange={e=>up('descripcion',e.target.value)} placeholder="Ayuda a recordar para qué es"/></div>
        <button style={{...S.btnP,opacity:ok?1:.5}} disabled={!ok} onClick={()=>{if(ok){onSave(d);onClose()}}}>Guardar</button>
        {ini&&<button style={S.btnD} onClick={()=>{onDelete();onClose()}}>Eliminar variable</button>}
        <button style={{...S.btnS,marginTop:7}} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}
