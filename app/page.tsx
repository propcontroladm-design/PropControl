'use client'
import { useState } from 'react'

export default function Home() {
  const [loading, setLoading] = useState(false)

  const login = async () => {
    setLoading(true)
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` }
      })
    } catch(e) {
      setLoading(false)
    }
  }

  return (
    <div style={{fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'}}>
      {/* HERO */}
      <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f1f3d 0%,#1e3a8a 60%,#16a344 100%)',display:'flex',flexDirection:'column'}}>
        <nav style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 40px',maxWidth:1200,margin:'0 auto',width:'100%'}}>
          <span style={{color:'white',fontWeight:800,fontSize:24,letterSpacing:'-0.5px'}}>
            Prop<span style={{color:'#4ade80'}}>Control</span>
          </span>
          <button onClick={login} style={{background:'white',color:'#1e3a8a',padding:'10px 24px',borderRadius:8,fontWeight:700,fontSize:14,cursor:'pointer',border:'none'}}>
            Iniciar sesion
          </button>
        </nav>
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 24px'}}>
          <div style={{textAlign:'center',maxWidth:800}}>
            <div style={{display:'inline-block',background:'rgba(22,163,68,0.2)',border:'1px solid rgba(74,222,128,0.4)',borderRadius:20,padding:'6px 16px',marginBottom:24}}>
              <span style={{color:'#86efac',fontSize:13,fontWeight:600}}>✓ 15 dias gratis · Sin tarjeta de credito</span>
            </div>
            <h1 style={{color:'white',fontSize:56,fontWeight:900,lineHeight:1.1,marginBottom:20,letterSpacing:'-1px'}}>
              Controla tus alquileres.<br/>
              <span style={{color:'#4ade80'}}>Maximiza tus resultados.</span>
            </h1>
            <p style={{color:'rgba(255,255,255,0.75)',fontSize:18,lineHeight:1.7,marginBottom:40,maxWidth:600,margin:'0 auto 40px'}}>
              La unica app argentina que calcula automaticamente contratos escalonados, ajustes por IPC y te dice exactamente quien pago y quien no.
            </p>
            <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
              <button onClick={login} disabled={loading} style={{background:'#16a344',color:'white',padding:'16px 36px',borderRadius:12,fontSize:17,fontWeight:800,cursor:'pointer',border:'none',boxShadow:'0 8px 24px rgba(22,163,68,0.4)'}}>
                {loading ? 'Conectando...' : 'Empezar gratis 15 dias'}
              </button>
              <a href="#planes" style={{background:'rgba(255,255,255,0.1)',color:'white',padding:'16px 28px',borderRadius:12,fontSize:16,fontWeight:600,border:'1px solid rgba(255,255,255,0.2)',textDecoration:'none',display:'inline-flex',alignItems:'center'}}>
                Ver planes →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div style={{background:'white',padding:'80px 24px'}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <h2 style={{textAlign:'center',fontSize:36,fontWeight:800,color:'#1e3a8a',marginBottom:12}}>Todo lo que necesitas en un solo lugar</h2>
          <p style={{textAlign:'center',color:'#6b7280',fontSize:16,marginBottom:56}}>Disenado especificamente para propietarios argentinos</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:24}}>
            {[
              {ico:'🏠',t:'Propiedades y grupos',d:'Organiza tus propiedades por edificio. Filtra y visualiza agrupado para no perderte en listas largas.'},
              {ico:'📄',t:'Contratos inteligentes',d:'Fijo o escalonado por tramos. Ajuste por IPC, Dolar, Nafta o indice propio. Frecuencia mensual, trimestral o anual.'},
              {ico:'💰',t:'Control de pagos',d:'Registra multiples pagos por periodo. Transferencia, cheque o efectivo. El estado se calcula automaticamente.'},
              {ico:'💬',t:'WhatsApp automatico',d:'Con un toque envias el recordatorio de pago con el monto exacto calculado directamente al inquilino.'},
              {ico:'📊',t:'ROI y rentabilidad',d:'Ves exactamente cuanto ganas por propiedad. Ingresos, gastos y retorno sobre la inversion en segundos.'},
              {ico:'👔',t:'Propietarios multiples',d:'Cada propiedad puede tener varios propietarios con su porcentaje. Los ingresos se distribuyen solos.'},
            ].map((f,i) => (
              <div key={i} style={{background:'#f9fafb',borderRadius:16,padding:28,border:'1px solid #e5e7eb'}}>
                <div style={{fontSize:32,marginBottom:12}}>{f.ico}</div>
                <h3 style={{fontWeight:700,fontSize:17,color:'#1e3a8a',marginBottom:8}}>{f.t}</h3>
                <p style={{color:'#6b7280',fontSize:14,lineHeight:1.6}}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PLANES */}
      <div id="planes" style={{padding:'80px 24px',background:'#f9fafb'}}>
        <div style={{maxWidth:900,margin:'0 auto'}}>
          <h2 style={{textAlign:'center',fontSize:36,fontWeight:800,color:'#1e3a8a',marginBottom:12}}>Planes simples y transparentes</h2>
          <p style={{textAlign:'center',color:'#6b7280',fontSize:16,marginBottom:50}}>Sin sorpresas. Cancelas cuando quieres.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:24}}>
            {[
              {n:'Starter',p:'$9.900',s:'/mes',d:'Hasta 10 propiedades',f:['Hasta 10 propiedades','Contratos y pagos','Inquilinos ilimitados','Reportes basicos','Soporte por email'],pop:false},
              {n:'Pro',p:'$19.900',s:'/mes',d:'Propiedades ilimitadas',f:['Propiedades ilimitadas','Todo lo del Starter','ROI y rentabilidad','Expensas por edificio','Propietarios multiples','WhatsApp automatico','Soporte prioritario'],pop:true},
              {n:'Pro Anual',p:'$179.900',s:'/año',d:'Ahorras 2 meses',f:['Todo lo del plan Pro','Precio fijo todo el año','Factura anual'],pop:false},
            ].map((pl,i) => (
              <div key={i} style={{background:pl.pop?'linear-gradient(135deg,#1e3a8a,#2563eb)':'white',borderRadius:20,padding:28,border:pl.pop?'2px solid #2563eb':'2px solid #e5e7eb',boxShadow:pl.pop?'0 8px 32px rgba(30,58,138,0.25)':'0 2px 8px rgba(0,0,0,0.06)',position:'relative'}}>
                {pl.pop&&<div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'#16a344',color:'white',padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:700,whiteSpace:'nowrap'}}>MAS POPULAR</div>}
                <div style={{fontWeight:700,fontSize:12,color:pl.pop?'rgba(255,255,255,0.6)':'#6b7280',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>{pl.n}</div>
                <div style={{fontSize:38,fontWeight:900,color:pl.pop?'white':'#1e3a8a',marginBottom:4}}>{pl.p}<span style={{fontSize:14,fontWeight:400,color:pl.pop?'rgba(255,255,255,0.6)':'#6b7280'}}>{pl.s}</span></div>
                <p style={{color:pl.pop?'rgba(255,255,255,0.7)':'#6b7280',fontSize:13,marginBottom:20}}>{pl.d}</p>
                <ul style={{listStyle:'none',marginBottom:24,padding:0}}>
                  {pl.f.map((f,j)=>(
                    <li key={j} style={{display:'flex',gap:8,alignItems:'center',marginBottom:9,fontSize:13,color:pl.pop?'rgba(255,255,255,0.9)':'#374151'}}>
                      <span style={{color:pl.pop?'#86efac':'#16a344',fontWeight:700}}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button onClick={login} style={{width:'100%',background:pl.pop?'#16a344':'#1e3a8a',color:'white',padding:'13px',borderRadius:10,fontWeight:700,fontSize:15,cursor:'pointer',border:'none',boxShadow:pl.pop?'0 4px 12px rgba(22,163,68,0.4)':'none'}}>
                  Empezar gratis 15 dias
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{background:'#0f1f3d',padding:'40px 24px',textAlign:'center'}}>
        <span style={{color:'white',fontWeight:800,fontSize:20}}>Prop<span style={{color:'#4ade80'}}>Control</span></span>
        <p style={{color:'rgba(255,255,255,0.4)',fontSize:13,marginTop:12}}>© 2026 PropControl · Clarita Maria Di Bacco · Yerba Buena, Tucuman</p>
      </footer>
    </div>
  )
}
