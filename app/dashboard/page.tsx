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
  function cb(base:number,mon:string,aj:string,iid:string,fr:string,iva:boolean){
    let v=parseFloat(String(base))||0
    if(debeAj(fr)){
      if(aj==='ipc'&&vm.ipc)v=v*(1+vm.ipc/100)
      else if(aj==='custom'&&iid&&idx){const x=idx.find((i:any)=>i.id===iid);if(x?.valores?.[mesK])v=v*(1+x.valores[mesK]/100)}
    }
    return{monto:v*(iva?1.21:1),moneda:mon||'pesos',iva:!!iva}
  }
  // NEW: multi-conceptos
  if(c.conceptos && c.conceptos.length>0){
    const items=c.conceptos.map((cp:any)=>{
      const r=cb(cp.monto,cp.moneda,cp.ajuste,cp.indice_id,cp.frec_ajuste,cp.iva)
      return{...r,nombre:cp.nombre||'Concepto'}
    })
    // Convert all to pesos and sum
    const totP=items.reduce((s:number,it:any)=>{
      if(it.moneda==='pesos')return s+it.monto
      if(it.moneda==='dolar')return s+it.monto*((vm&&vm.dolar)||0)
      return s+it.monto*((vm&&vm.nafta)||0)
    },0)
    return{monto:totP,moneda:'pesos',iva:false,items,multi:true}
  }
  // Single concept (legacy)
  const iva=c.iva?true:false
  if(c.tipo==='fijo')return cb(c.monto_base,c.moneda,c.ajuste,c.indice_id,c.frec_ajuste,iva)
  if(c.tipo==='escalonado'){const tr=c.tramos||[];const t=tr.find((t:any)=>mr>=t.mesDesde&&mr<=t.mesHasta);if(!t)return null;return cb(t.montoBase,t.moneda||c.moneda,t.ajuste,t.indiceId,t.frecAjuste,iva)}
  return null
}

function estP(cid:string,mesK:string,pagos:any[]){
  const lista=pagos.filter(p=>p.contrato_id===cid&&p.periodo===mesK)
  const tot=lista.reduce((s:number,p:any)=>s+(p.monto_pesos||0),0)
  return{lista,total:tot}
}

// ─── STORE LOCAL ──────────────────────────────
function useAppData(userId:string){
  const [props,setProps]=useState<any[]>([])
  const [inqs,setInqs]=useState<any[]>([])
  const [contratos,setContratos]=useState<any[]>([])
  const [pagos,setPagos]=useState<any[]>([])
  const [vars,setVars]=useState<any>({})
  const [gastos,setGastos]=useState<any[]>([])
  const [grupos,setGrupos]=useState<any[]>([])
  const [owners,setOwners]=useState<any[]>([])
  const [indices,setIndices]=useState<any[]>([])
  const [expensas,setExpensas]=useState<any[]>([])
  const [loading,setLoading]=useState(true)

  useEffect(()=>{if(userId)loadAll()},[userId])

  async function loadAll(){
    setLoading(true)
    const [p,i,c,pg,g,gr,ow,ix,ex]=await Promise.all([
      sb.from('propiedades').select('*').eq('usuario_id',userId),
      sb.from('inquilinos').select('*').eq('usuario_id',userId),
      sb.from('contratos').select('*').eq('usuario_id',userId),
      sb.from('pagos').select('*').eq('usuario_id',userId),
      sb.from('gastos').select('*').eq('usuario_id',userId),
      sb.from('grupos').select('*').eq('usuario_id',userId),
      sb.from('propietarios').select('*').eq('usuario_id',userId),
      sb.from('indices').select('*').eq('usuario_id',userId),
      sb.from('expensas').select('*').eq('usuario_id',userId),
    ])
    setProps(p.data||[]);setInqs(i.data||[]);setContratos(c.data||[])
    setPagos(pg.data||[]);setGastos(g.data||[]);setGrupos(gr.data||[])
    setOwners(ow.data||[]);setIndices(ix.data||[]);setExpensas(ex.data||[])
    // Load variables
    const vRes=await sb.from('variables').select('*').eq('usuario_id',userId)
    const vMap:any={}
    ;(vRes.data||[]).forEach((v:any)=>{vMap[v.periodo]={dolar:v.dolar,nafta:v.nafta,ipc:v.ipc}})
    setVars(vMap)
    setLoading(false)
  }

  async function addProp(d:any){const{data}=await sb.from('propiedades').insert({...d,usuario_id:userId}).select().single();if(data)setProps(p=>[...p,data]);return data}
  async function updProp(id:string,d:any){await sb.from('propiedades').update(d).eq('id',id);setProps(p=>p.map(x=>x.id===id?{...x,...d}:x))}
  async function delProp(id:string){await sb.from('propiedades').delete().eq('id',id);setProps(p=>p.filter(x=>x.id!==id))}
  async function addInq(d:any){const{data}=await sb.from('inquilinos').insert({...d,usuario_id:userId}).select().single();if(data)setInqs(p=>[...p,data]);return data}
  async function updInq(id:string,d:any){await sb.from('inquilinos').update(d).eq('id',id);setInqs(p=>p.map(x=>x.id===id?{...x,...d}:x))}
  async function delInq(id:string){await sb.from('inquilinos').delete().eq('id',id);setInqs(p=>p.filter(x=>x.id!==id))}
  async function addContrato(d:any){const{data}=await sb.from('contratos').insert({...d,usuario_id:userId}).select().single();if(data)setContratos(p=>[...p,data]);return data}
  async function updContrato(id:string,d:any){await sb.from('contratos').update(d).eq('id',id);setContratos(p=>p.map(x=>x.id===id?{...x,...d}:x))}
  async function delContrato(id:string){await sb.from('contratos').delete().eq('id',id);setContratos(p=>p.filter(x=>x.id!==id))}
  async function addPago(d:any){const{data}=await sb.from('pagos').insert({...d,usuario_id:userId}).select().single();if(data)setPagos(p=>[...p,data]);return data}
  async function delPago(id:string){await sb.from('pagos').delete().eq('id',id);setPagos(p=>p.filter(x=>x.id!==id))}
  async function setVar(periodo:string,field:string,val:number){
    await sb.from('variables').upsert({usuario_id:userId,periodo,[field]:val},{onConflict:'usuario_id,periodo'})
    setVars((v:any)=>({...v,[periodo]:{...(v[periodo]||{}),[field]:val}}))
  }
  async function addGasto(d:any){const{data}=await sb.from('gastos').insert({...d,usuario_id:userId}).select().single();if(data)setGastos(p=>[...p,data]);return data}
  async function delGasto(id:string){await sb.from('gastos').delete().eq('id',id);setGastos(p=>p.filter(x=>x.id!==id))}
  async function addGrupo(d:any){const{data}=await sb.from('grupos').insert({...d,usuario_id:userId}).select().single();if(data)setGrupos(p=>[...p,data]);return data}
  async function delGrupo(id:string){await sb.from('grupos').delete().eq('id',id);setGrupos(p=>p.filter(x=>x.id!==id))}
  async function addOwner(d:any){const{data}=await sb.from('propietarios').insert({...d,usuario_id:userId}).select().single();if(data)setOwners(p=>[...p,data]);return data}
  async function updOwner(id:string,d:any){await sb.from('propietarios').update(d).eq('id',id);setOwners(p=>p.map(x=>x.id===id?{...x,...d}:x))}
  async function delOwner(id:string){await sb.from('propietarios').delete().eq('id',id);setOwners(p=>p.filter(x=>x.id!==id))}

  return{props,inqs,contratos,pagos,vars,gastos,grupos,owners,indices,expensas,loading,
    addProp,updProp,delProp,addInq,updInq,delInq,addContrato,updContrato,delContrato,
    addPago,delPago,setVar,addGasto,delGasto,addGrupo,delGrupo,addOwner,updOwner,delOwner,reload:loadAll}
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
function FormProp({ini,grupos,owners,onSave,onDelete,onClose}:any){
  const [d,setD]=useState(ini||{codigo:'',nombre:'',direccion:'',ciudad:'Yerba Buena',tipo:'local',superficie:'',observaciones:'',activo:true,grupo_id:'',valor_compra:0,pct_expensas:0})
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
        {grupos.length>0&&<div style={S.fg}><label style={S.lbl}>Grupo / Edificio</label>
          <select style={S.sel} value={d.grupo_id||''} onChange={e=>up('grupo_id',e.target.value)}>
            <option value="">— Sin grupo —</option>
            {grupos.map((g:any)=><option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </div>}
        {d.grupo_id&&<div style={S.fg}><label style={S.lbl}>% Expensas del edificio</label><input style={S.inp} type="number" value={d.pct_expensas||''} onChange={e=>up('pct_expensas',parseFloat(e.target.value)||0)}/></div>}
        <div style={S.fg}><label style={S.lbl}>Valor de compra ($) — para ROI</label><input style={S.inp} type="number" value={d.valor_compra||''} onChange={e=>up('valor_compra',parseFloat(e.target.value)||0)}/></div>
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
  // Detect mode: if has conceptos use new mode, else old mode
  const hasConceptos = ini?.contrato?.conceptos?.length > 0
  const [modo,setModo]=useState<'simple'|'multi'>(hasConceptos?'multi':(ini?'simple':'simple'))
  const [d,setD]=useState(ini||{
    propiedad_id:'',inquilino_id:'',fecha_inicio:new Date().toISOString().slice(0,10),activo:true,
    tipo:'fijo',moneda:'pesos',monto_base:'',ajuste:'ninguno',frec_ajuste:'mensual',iva:false,
    tramos:[{id:uid(),mesDesde:1,mesHasta:6,montoBase:'',moneda:'pesos',ajuste:'ninguno',frecAjuste:'mensual'}],
    conceptos:[]
  })
  // If multi mode and no conceptos, init with default
  useEffect(()=>{
    if(modo==='multi'&&(!d.conceptos||d.conceptos.length===0)){
      setD((p:any)=>({...p,conceptos:[
        {id:uid(),nombre:'Alquiler',monto:'',moneda:'pesos',ajuste:'ninguno',frec_ajuste:'mensual',iva:false}
      ]}))
    }
  },[modo])

  const up=(f:string,v:any)=>setD((p:any)=>({...p,[f]:v}))
  const upT=(tid:string,f:string,v:any)=>setD((p:any)=>({...p,tramos:p.tramos.map((t:any)=>t.id===tid?{...t,[f]:v}:t)}))
  const addT=()=>setD((p:any)=>{const last=p.tramos[p.tramos.length-1];const desde=last?last.mesHasta+1:1;return{...p,tramos:[...p.tramos,{id:uid(),mesDesde:desde,mesHasta:desde+5,montoBase:'',moneda:p.moneda||'pesos',ajuste:'ninguno',frecAjuste:'mensual'}]}})
  const delT=(tid:string)=>setD((p:any)=>({...p,tramos:p.tramos.filter((t:any)=>t.id!==tid)}))

  // Conceptos handlers
  const upC=(cid:string,f:string,v:any)=>setD((p:any)=>({...p,conceptos:p.conceptos.map((cp:any)=>cp.id===cid?{...cp,[f]:v}:cp)}))
  const addC=()=>setD((p:any)=>({...p,conceptos:[...(p.conceptos||[]),{id:uid(),nombre:'',monto:'',moneda:'pesos',ajuste:'ninguno',frec_ajuste:'mensual',iva:false}]}))
  const delC=(cid:string)=>setD((p:any)=>({...p,conceptos:p.conceptos.filter((cp:any)=>cp.id!==cid)}))

  const ok=d.propiedad_id&&d.inquilino_id&&d.fecha_inicio&&(
    modo==='multi' ? (d.conceptos?.length>0 && d.conceptos.every((cp:any)=>cp.nombre&&cp.monto)) :
    (d.tipo==='fijo'?d.monto_base:d.tramos.every((t:any)=>t.montoBase))
  )
  const prop=props.find((p:any)=>p.id===d.propiedad_id)
  const inq=inqs.find((i:any)=>i.id===d.inquilino_id)

  const handleSave=()=>{
    if(!ok)return
    let data:any={...d,nombre_propiedad:prop?(prop.nombre||prop.codigo):'',nombre_inquilino:inq?inq.nombre:''}
    if(modo==='multi'){
      data.conceptos=data.conceptos.map((cp:any)=>({...cp,monto:parseFloat(cp.monto)||0}))
      // Clear old fields
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
        <div style={S.fg}><label style={S.lbl}>Propiedad</label>
          <select style={S.sel} value={d.propiedad_id} onChange={e=>up('propiedad_id',e.target.value)}>
            <option value="">— Seleccionar —</option>
            {props.filter((p:any)=>p.activo).map((p:any)=><option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
          </select>
        </div>
        <div style={S.fg}><label style={S.lbl}>Inquilino</label>
          <select style={S.sel} value={d.inquilino_id} onChange={e=>up('inquilino_id',e.target.value)}>
            <option value="">— Seleccionar —</option>
            {inqs.map((i:any)=><option key={i.id} value={i.id}>{i.nombre}{i.es_sociedad?' 🏢':''}</option>)}
          </select>
        </div>
        <div style={S.fg}><label style={S.lbl}>Inicio</label><input style={S.inp} type="date" value={d.fecha_inicio} onChange={e=>up('fecha_inicio',e.target.value)}/></div>

        <div style={S.fg}><label style={S.lbl}>Modo de contrato</label>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>setModo('simple')} style={{flex:1,padding:10,borderRadius:9,border:`1.5px solid ${modo==='simple'?'#2563eb':'#e5e7eb'}`,background:modo==='simple'?'#dbeafe':'white',fontSize:13,fontWeight:700,color:modo==='simple'?'#2563eb':'#6b7280',cursor:'pointer'}}>
              Simple<div style={{fontSize:10,fontWeight:500,marginTop:2}}>1 monto</div>
            </button>
            <button onClick={()=>setModo('multi')} style={{flex:1,padding:10,borderRadius:9,border:`1.5px solid ${modo==='multi'?'#2563eb':'#e5e7eb'}`,background:modo==='multi'?'#dbeafe':'white',fontSize:13,fontWeight:700,color:modo==='multi'?'#2563eb':'#6b7280',cursor:'pointer'}}>
              Conceptos<div style={{fontSize:10,fontWeight:500,marginTop:2}}>varios items</div>
            </button>
          </div>
        </div>

        {modo==='multi'&&<div>
          <div style={{padding:'9px 11px',borderRadius:9,fontSize:12,marginBottom:9,background:'#dbeafe',color:'#1e3a8a'}}>
            💡 Útil cuando una propiedad tiene varios conceptos (ej: alquiler sin IVA + cochera con IVA + expensas).
          </div>
          {(d.conceptos||[]).map((cp:any,i:number)=>(
            <div key={cp.id} style={{background:'#f3f4f6',borderRadius:9,padding:10,marginBottom:6,border:'1px solid #e5e7eb'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontWeight:700,fontSize:13}}>Concepto {i+1}</span>
                {d.conceptos.length>1&&<button style={{background:'#fee2e2',color:'#7f1d1d',padding:'3px 8px',borderRadius:6,fontSize:12,fontWeight:700,border:'none',cursor:'pointer'}} onClick={()=>delC(cp.id)}>✕</button>}
              </div>
              <div style={S.fg}><label style={S.lbl}>Nombre</label><input style={S.inp} value={cp.nombre} onChange={e=>upC(cp.id,'nombre',e.target.value)} placeholder="Ej: Alquiler / Cochera / Expensas"/></div>
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
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',fontSize:13}}>
                <input type="checkbox" id={`iva_${cp.id}`} checked={!!cp.iva} onChange={e=>upC(cp.id,'iva',e.target.checked)} style={{width:17,height:17,accentColor:'#2563eb'}}/>
                <label htmlFor={`iva_${cp.id}`} style={{fontWeight:600}}>Aplicar IVA 21% a este concepto</label>
              </div>
            </div>
          ))}
          <button style={{background:'#dbeafe',color:'#2563eb',padding:'8px 12px',borderRadius:10,fontSize:13,fontWeight:700,width:'100%',marginTop:4,cursor:'pointer',border:'none'}} onClick={addC}>+ Agregar concepto</button>
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
                  {d.tramos.length>1&&<button style={{background:'#fee2e2',color:'#7f1d1d',padding:'3px 8px',borderRadius:6,fontSize:12,fontWeight:700,border:'none',cursor:'pointer'}} onClick={()=>delT(t.id)}>✕</button>}
                </div>
                <div style={{display:'flex',gap:9,marginBottom:8}}>
                  <div style={{flex:1}}><label style={S.lbl}>Desde mes</label><input style={S.inp} type="number" min={1} value={t.mesDesde} onChange={e=>upT(t.id,'mesDesde',parseInt(e.target.value)||1)}/></div>
                  <div style={{flex:1}}><label style={S.lbl}>Hasta mes</label><input style={S.inp} type="number" min={1} value={t.mesHasta} onChange={e=>upT(t.id,'mesHasta',parseInt(e.target.value)||12)}/></div>
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
            <button style={{background:'#dbeafe',color:'#2563eb',padding:'8px 12px',borderRadius:10,fontSize:13,fontWeight:700,width:'100%',marginTop:4,cursor:'pointer',border:'none'}} onClick={addT}>+ Agregar tramo</button>
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
  const [tab,setTab]=useState('inicio')
  const [modal,setModal]=useState<any>(null)
  const [authLoading,setAuthLoading]=useState(true)

  useEffect(()=>{
    // Handle implicit flow (token in hash)
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      // Let Supabase parse the hash
      sb.auth.getSession().then(async({data:{session}})=>{
        if(session){
          setUser(session.user)
          const{data}=await sb.from('usuarios').select('*').eq('id',session.user.id).single()
          setUserData(data)
          setAuthLoading(false)
          // Clean the URL
          window.history.replaceState(null,'','/dashboard')
        } else {
          // Try to set session from hash
          sb.auth.onAuthStateChange(async(event, session) => {
            if(session){
              setUser(session.user)
              const{data}=await sb.from('usuarios').select('*').eq('id',session.user.id).single()
              setUserData(data)
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
      const{data}=await sb.from('usuarios').select('*').eq('id',session.user.id).single()
      setUserData(data)
      setAuthLoading(false)
    })
  },[])

  const store=useAppData(user?.id||'')
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
    {id:'vars',ico:'📈',lbl:'Variables'},
    {id:'gastos',ico:'🔧',lbl:'Gastos'},
    {id:'reporte',ico:'📊',lbl:'Reporte'},
  ]

  if(authLoading)return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f9fafb'}}>
      <div style={{textAlign:'center'}}><div style={{fontSize:32,marginBottom:12}}>⏳</div><p style={{color:'#6b7280'}}>Cargando...</p></div>
    </div>
  )

  // ── TAB INICIO ──────────────────────────────
  const renderInicio=()=>{
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
  const renderProps=()=>(
    <div style={{padding:14}}>
      <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'0 0 9px'}}>{props.length} propiedades</p>
      {props.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:'#6b7280'}}><div style={{fontSize:40,marginBottom:8}}>🏢</div><div style={{fontSize:15,fontWeight:600,color:'#111827',marginBottom:4}}>Sin propiedades</div><div style={{fontSize:13}}>Tocá + para agregar</div></div>}
      {props.map((p:any)=>{
        const aa=contratos.find(c=>c.propiedad_id===p.id&&c.activo!==false)
        return(
          <div key={p.id} style={S.card}>
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
              {aa?<span style={{fontSize:12,background:'#dcfce7',color:'#14532d',padding:'2px 8px',borderRadius:10,fontWeight:700}}>● En alquiler</span>:<span style={{fontSize:12,background:'#f3f4f6',color:'#6b7280',padding:'2px 8px',borderRadius:10}}>Disponible</span>}
              <button style={{background:'none',border:'none',color:'#2563eb',fontSize:13,fontWeight:700,cursor:'pointer'}} onClick={()=>setModal({type:'prop',data:p})}>Editar</button>
            </div>
          </div>
        )
      })}
      <div style={{height:70}}/>
    </div>
  )

  // ── TAB INQS ────────────────────────────────
  const renderInqs=()=>(
    <div style={{padding:14}}>
      <p style={{fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:.7,margin:'0 0 9px'}}>{inqs.length} inquilinos</p>
      {inqs.length===0&&<div style={{textAlign:'center',padding:'40px 20px',color:'#6b7280'}}><div style={{fontSize:40,marginBottom:8}}>👤</div><div style={{fontSize:15,fontWeight:600,color:'#111827',marginBottom:4}}>Sin inquilinos</div></div>}
      {inqs.map((inq:any)=>{
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
    return(
      <div style={{padding:14}}>
        <div style={{padding:'9px 11px',borderRadius:9,fontSize:13,marginBottom:9,background:'#dbeafe',color:'#1e3a8a'}}>Cargá una vez por mes. Se aplican automáticamente a todos los contratos.</div>
        {meses.map(m=>{
          const v=(vars&&vars[m.key])||{}
          const ea=m.key===mesActK
          return(
            <div key={m.key} style={{...S.card,border:ea?'2px solid #2563eb':'1px solid #e5e7eb'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontWeight:700,fontSize:15}}>{mlbl(m.year,m.month)}</span>
                {ea&&<span style={{fontSize:11,background:'#dbeafe',color:'#2563eb',padding:'2px 8px',borderRadius:20,fontWeight:700}}>Actual</span>}
              </div>
              {fields.map(f=>(
                <div key={f.id} style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
                  <span style={{fontSize:13,color:'#6b7280',flex:1}}>{f.l}</span>
                  <input style={{width:105,padding:'6px 8px',border:'1.5px solid #e5e7eb',borderRadius:8,fontSize:14,textAlign:'right',background:'white'}} type="number" placeholder={f.ph} value={(v as any)[f.id]||''} onChange={e=>store.setVar(m.key,f.id,parseFloat(e.target.value)||0)}/>
                </div>
              ))}
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
        {rows.length>0&&<button style={{...S.btnS,marginTop:8}} onClick={exportar}>⬇ Exportar (.txt)</button>}
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
      case 'vars':return renderVars()
      case 'gastos':return renderGastos()
      case 'reporte':return renderReporte()
      default:return renderInicio()
    }
  }

  const FAB_ACTIONS:any={
    inicio:()=>setModal({type:'contrato',data:null}),
    props:()=>setModal({type:'prop',data:null}),
    inqs:()=>setModal({type:'inq',data:null}),
    contratos:()=>setModal({type:'contrato',data:null}),
    gastos:()=>setModal({type:'gasto'}),
  }

  const ini=(user?.email||'?')[0].toUpperCase()

  return(
    <div style={{minHeight:'100vh',background:'#f9fafb',maxWidth:480,margin:'0 auto'}}>
      {/* NAV */}
      <nav style={{background:'white',borderBottom:'1px solid #e5e7eb',position:'sticky',top:0,zIndex:100,display:'flex',alignItems:'center',padding:'0 8px',height:56}}>
        <div style={{flex:1,textAlign:'center',fontWeight:800,fontSize:18,color:'#1e3a8a'}}>Prop<span style={{color:'#16a34a'}}>Control</span></div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {userData?.suscripcion_estado==='trial'&&<div style={{background:'#fef3c7',color:'#78350f',padding:'4px 10px',borderRadius:20,fontSize:12,fontWeight:600}}>{diasTrial}d trial</div>}
          <button onClick={()=>router.push('/planes')} style={{background:'#16a34a',color:'white',padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:700,border:'none',cursor:'pointer'}}>
            {userData?.suscripcion_estado==='activa'?'Mi plan':'Suscribirse'}
          </button>
          <button onClick={logout} style={{width:30,height:30,borderRadius:'50%',background:'#dbeafe',color:'#1e3a8a',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,border:'none',cursor:'pointer'}}>{ini}</button>
        </div>
      </nav>

      {/* TABS */}
      <div style={{display:'flex',background:'white',borderBottom:'1px solid #e5e7eb',overflowX:'auto',scrollbarWidth:'none'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,minWidth:46,padding:'10px 2px 8px',textAlign:'center',fontSize:10,fontWeight:600,color:tab===t.id?'#2563eb':'#6b7280',borderBottom:`2px solid ${tab===t.id?'#2563eb':'transparent'}`,background:'none',border:'none',cursor:'pointer',whiteSpace:'nowrap'}}>
            <span style={{display:'block',fontSize:16,marginBottom:2}}>{t.ico}</span>{t.lbl}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      {renderContent()}

      {/* FAB */}
      {FAB_ACTIONS[tab]&&<button onClick={FAB_ACTIONS[tab]} style={{position:'fixed',bottom:19,right:15,width:52,height:52,background:'#2563eb',color:'white',borderRadius:26,fontSize:26,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 14px rgba(37,99,235,.4)',zIndex:150,border:'none',cursor:'pointer'}}>+</button>}

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
        ini={modal.data} grupos={grupos} owners={owners}
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
            <GastoForm props={props} onSave={async(d:any)=>{await store.addGasto(d);setModal(null)}} onClose={()=>setModal(null)}/>
          </div>
        </div>
      )}
    </div>
  )
}

function GastoForm({props,onSave,onClose}:any){
  const [d,setD]=useState({propiedad_id:'',tipo:'arreglo',monto:'',moneda:'pesos',quien:'propietario',estado:'pendiente',descripcion:''})
  const up=(f:string,v:any)=>setD((p:any)=>({...p,[f]:v}))
  const ok=d.propiedad_id&&d.monto
  return(<>
    <div style={S.fg}><label style={S.lbl}>Propiedad</label>
      <select style={S.sel} value={d.propiedad_id} onChange={e=>up('propiedad_id',e.target.value)}>
        <option value="">— Seleccionar —</option>
        {props.filter((p:any)=>p.activo).map((p:any)=><option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
      </select>
    </div>
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
    <div style={S.fg}><label style={S.lbl}>Descripción</label><input style={S.sel} value={d.descripcion} onChange={e=>up('descripcion',e.target.value)}/></div>
    <button style={{...S.btnP,opacity:ok?1:.5}} disabled={!ok} onClick={()=>{if(ok)onSave({...d,monto:parseFloat(d.monto),fecha:new Date().toISOString().slice(0,10)})}}>Guardar gasto</button>
    <button style={{...S.btnS,marginTop:7}} onClick={onClose}>Cancelar</button>
  </>)
}
