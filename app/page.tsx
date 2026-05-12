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
        options: { redirectTo: `${window.location.origin}/auth/confirm` }
      })
    } catch(e) {
      setLoading(false)
    }
  }

  const features = [
    {ico:'🏠',t:'Propiedades y grupos',d:'Organizá tus propiedades por edificio o complejo. Creá subgrupos (planta baja, pisos, cocheras) para distribución detallada.'},
    {ico:'📄',t:'Contratos potentes',d:'Multi-propiedad: un contrato puede abarcar varios locales. Modo simple o por conceptos (alquiler + cochera + expensas), cada uno con su escalonamiento.'},
    {ico:'📅',t:'Escalonamientos por fecha',d:'Definí tramos de aumento por fechas reales. Ej: $300k hasta junio, $400k de julio a diciembre, ajustes IPC, dólar o nafta.'},
    {ico:'⏰',t:'Alertas de vencimiento',d:'Te avisamos 30 días antes que venza un contrato. Banner rojo si ya venció. Nunca más se te pasa renovar a tiempo.'},
    {ico:'💰',t:'Pagos múltiples',d:'Registrá varios pagos por período (transferencia, cheque, efectivo). El estado se calcula solo: pagado, parcial o pendiente.'},
    {ico:'💸',t:'Expensas y gastos',d:'Cargá un gasto del edificio y se distribuye automáticamente entre las propiedades según el % de cada una.'},
    {ico:'👔',t:'Propietarios múltiples',d:'Cada propiedad puede tener varios dueños con su porcentaje. Los ingresos se distribuyen automáticamente.'},
    {ico:'📈',t:'Índices personalizados',d:'Creá tus propios índices (ICL, IPC Tucumán, índice del consorcio) y aplicalos a contratos. Cargás el % mensual una sola vez.'},
    {ico:'👥',t:'Workspaces compartidos',d:'Trabajás con un socio o tu administrador? Compartí tu espacio de trabajo y ambos editan los mismos datos en tiempo real.'},
    {ico:'📥',t:'Importar masivo',d:'Subí un CSV con tus propiedades existentes y se cargan todas de golpe. También podés restaurar desde un backup JSON.'},
    {ico:'💾',t:'Backup descargable',d:'Exportá toda tu información cuando quieras en un archivo JSON. Tus datos siempre disponibles, en tu computadora.'},
    {ico:'💬',t:'WhatsApp automático',d:'Con un toque envías el recordatorio de pago al inquilino con el monto exacto del mes ya calculado.'},
  ]

  return (
    <div style={{fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'}}>
      {/* HERO */}
      <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f1f3d 0%,#1e3a8a 60%,#16a344 100%)',display:'flex',flexDirection:'column'}}>
        <nav style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 40px',maxWidth:1200,margin:'0 auto',width:'100%'}}>
          <div style={{background:'white',padding:'8px 16px',borderRadius:12,display:'inline-block'}}>
            <img src="/logo.svg" alt="PropControl" style={{height:48,display:'block'}}/>
          </div>
          <button onClick={login} style={{background:'white',color:'#1e3a8a',padding:'10px 24px',borderRadius:8,fontWeight:700,fontSize:14,cursor:'pointer',border:'none'}}>Iniciar sesion</button>
        </nav>
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 24px'}}>
          <div style={{textAlign:'center',maxWidth:880}}>
            <div style={{display:'inline-block',background:'rgba(22,163,68,0.2)',border:'1px solid rgba(74,222,128,0.4)',borderRadius:20,padding:'6px 16px',marginBottom:24}}>
              <span style={{color:'#86efac',fontSize:13,fontWeight:600}}>✓ 15 días gratis · Sin tarjeta de crédito</span>
            </div>
            <h1 style={{color:'white',fontSize:60,fontWeight:900,lineHeight:1.05,marginBottom:22,letterSpacing:'-1.5px'}}>
              Gestioná todos tus alquileres<br/>
              <span style={{color:'#4ade80'}}>desde un solo lugar.</span>
            </h1>
            <p style={{color:'rgba(255,255,255,0.78)',fontSize:19,lineHeight:1.6,marginBottom:36,maxWidth:700,margin:'0 auto 36px'}}>
              La app argentina más completa para propietarios. Contratos escalonados, ajustes por IPC, expensas, ROI, alertas de vencimiento y mucho más.
            </p>
            <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
              <button onClick={login} disabled={loading} style={{background:'#16a344',color:'white',padding:'17px 40px',borderRadius:12,fontSize:17,fontWeight:800,cursor:'pointer',border:'none',boxShadow:'0 8px 28px rgba(22,163,68,0.5)'}}>
                {loading ? 'Conectando...' : 'Empezar gratis 15 días'}
              </button>
              <a href="#features" style={{background:'rgba(255,255,255,0.1)',color:'white',padding:'17px 30px',borderRadius:12,fontSize:16,fontWeight:600,border:'1px solid rgba(255,255,255,0.25)',textDecoration:'none',display:'inline-flex',alignItems:'center'}}>Ver funciones →</a>
            </div>
            <p style={{color:'rgba(255,255,255,0.5)',fontSize:12,marginTop:18}}>
              Al registrarte aceptás nuestros <a href="/terminos" style={{color:'#86efac',textDecoration:'underline'}}>Términos</a> y <a href="/privacidad" style={{color:'#86efac',textDecoration:'underline'}}>Política de Privacidad</a>
            </p>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" style={{background:'white',padding:'90px 24px'}}>
        <div style={{maxWidth:1200,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:60}}>
            <div style={{display:'inline-block',background:'#dbeafe',color:'#1e3a8a',padding:'5px 14px',borderRadius:20,fontSize:12,fontWeight:700,marginBottom:14}}>FUNCIONES</div>
            <h2 style={{fontSize:42,fontWeight:900,color:'#0f1f3d',marginBottom:14,letterSpacing:'-1px'}}>Todo lo que necesitás. En serio, todo.</h2>
            <p style={{color:'#64748b',fontSize:17,maxWidth:600,margin:'0 auto'}}>Diseñada por propietarios reales, para propietarios reales en Argentina.</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))',gap:18}}>
            {features.map((f,i)=>(
              <div key={i} style={{background:'#f8fafc',borderRadius:16,padding:26,border:'1px solid #e2e8f0',transition:'all 0.2s'}}>
                <div style={{fontSize:34,marginBottom:14}}>{f.ico}</div>
                <h3 style={{fontWeight:800,fontSize:17,color:'#0f1f3d',marginBottom:8}}>{f.t}</h3>
                <p style={{color:'#475569',fontSize:14,lineHeight:1.6,margin:0}}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DEMO / SCREENSHOTS sección visual */}
      <div style={{background:'linear-gradient(180deg,#f8fafc 0%,#dbeafe 100%)',padding:'80px 24px'}}>
        <div style={{maxWidth:900,margin:'0 auto',textAlign:'center'}}>
          <h2 style={{fontSize:36,fontWeight:900,color:'#0f1f3d',marginBottom:14}}>Pensado para Argentina 🇦🇷</h2>
          <p style={{color:'#475569',fontSize:16,marginBottom:40}}>Las funciones que necesitás para alquileres argentinos: IPC, Dólar, Nafta, ICL y todos los ajustes posibles.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14,marginBottom:30}}>
            {[
              {n:'IPC mensual',d:'Cargás una vez y se aplica a todos los contratos'},
              {n:'Dólar oficial',d:'Cotización mensual para contratos en USD'},
              {n:'Litros de nafta',d:'Para los típicos contratos atados a YPF'},
              {n:'IVA 21%',d:'Por concepto, para locales comerciales'},
            ].map((x,i)=>(
              <div key={i} style={{background:'white',borderRadius:14,padding:20,border:'1px solid #e2e8f0',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
                <div style={{fontWeight:800,fontSize:15,color:'#1e3a8a',marginBottom:6}}>{x.n}</div>
                <div style={{color:'#64748b',fontSize:13}}>{x.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PLANES */}
      <div id="planes" style={{padding:'90px 24px',background:'white'}}>
        <div style={{maxWidth:1000,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:50}}>
            <div style={{display:'inline-block',background:'#dcfce7',color:'#14532d',padding:'5px 14px',borderRadius:20,fontSize:12,fontWeight:700,marginBottom:14}}>PRECIOS</div>
            <h2 style={{fontSize:42,fontWeight:900,color:'#0f1f3d',marginBottom:14,letterSpacing:'-1px'}}>Planes simples y transparentes</h2>
            <p style={{color:'#64748b',fontSize:16}}>Sin sorpresas, cancelás cuando quieras.</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:18}}>
            {[
              {n:'Starter',p:'$9.900',s:'/mes',d:'Hasta 10 propiedades',f:['Hasta 10 propiedades','Contratos y pagos','Inquilinos ilimitados','Reportes básicos','Soporte por email'],pop:false},
              {n:'Pro',p:'$19.900',s:'/mes',d:'Propiedades ilimitadas',f:['Propiedades ilimitadas','Todo lo del Starter','Subgrupos y expensas','ROI y rentabilidad','Propietarios múltiples','WhatsApp automático','Workspaces compartidos','Soporte prioritario'],pop:true},
              {n:'Pro Anual',p:'$179.900',s:'/año',d:'Ahorrás 2 meses',f:['Todo lo del plan Pro','Precio fijo todo el año','2 meses gratis','Factura anual'],pop:false},
            ].map((pl,i)=>(
              <div key={i} style={{background:pl.pop?'linear-gradient(135deg,#1e3a8a,#2563eb)':'white',borderRadius:20,padding:30,border:pl.pop?'2px solid #2563eb':'2px solid #e5e7eb',boxShadow:pl.pop?'0 12px 40px rgba(30,58,138,0.3)':'0 2px 8px rgba(0,0,0,0.06)',position:'relative'}}>
                {pl.pop&&<div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'#16a344',color:'white',padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:700,whiteSpace:'nowrap',boxShadow:'0 4px 12px rgba(22,163,68,0.4)'}}>MÁS POPULAR</div>}
                <div style={{fontWeight:700,fontSize:12,color:pl.pop?'rgba(255,255,255,0.6)':'#6b7280',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>{pl.n}</div>
                <div style={{fontSize:42,fontWeight:900,color:pl.pop?'white':'#1e3a8a',marginBottom:4,letterSpacing:'-1.5px'}}>{pl.p}<span style={{fontSize:14,fontWeight:400,color:pl.pop?'rgba(255,255,255,0.6)':'#6b7280'}}>{pl.s}</span></div>
                <p style={{color:pl.pop?'rgba(255,255,255,0.7)':'#6b7280',fontSize:13,marginBottom:24}}>{pl.d}</p>
                <ul style={{listStyle:'none',marginBottom:26,padding:0}}>
                  {pl.f.map((f,j)=>(
                    <li key={j} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:10,fontSize:13.5,color:pl.pop?'rgba(255,255,255,0.92)':'#374151'}}>
                      <span style={{color:pl.pop?'#86efac':'#16a344',fontWeight:700,flexShrink:0}}>✓</span><span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={login} style={{width:'100%',background:pl.pop?'#16a344':'#1e3a8a',color:'white',padding:'14px',borderRadius:11,fontWeight:800,fontSize:15,cursor:'pointer',border:'none',boxShadow:pl.pop?'0 4px 12px rgba(22,163,68,0.4)':'none'}}>
                  Empezar gratis 15 días
                </button>
              </div>
            ))}
          </div>
          <div style={{textAlign:'center',marginTop:30,padding:18,background:'#f8fafc',borderRadius:12,border:'1px solid #e2e8f0',maxWidth:600,margin:'30px auto 0'}}>
            <div style={{fontSize:13,color:'#64748b'}}>💳 Pago seguro por MercadoPago · 🔒 Tus datos protegidos · 🚀 Cancelás cuando quieras</div>
          </div>
        </div>
      </div>

      {/* CTA FINAL */}
      <div style={{background:'linear-gradient(135deg,#1e3a8a,#16a344)',padding:'70px 24px',textAlign:'center'}}>
        <div style={{maxWidth:600,margin:'0 auto'}}>
          <h2 style={{fontSize:34,fontWeight:900,color:'white',marginBottom:14,letterSpacing:'-1px'}}>¿Listo para dejar de hacer todo en planillas?</h2>
          <p style={{color:'rgba(255,255,255,0.85)',fontSize:16,marginBottom:30}}>Empezá hoy mismo. 15 días gratis, sin tarjeta de crédito, sin compromiso.</p>
          <button onClick={login} style={{background:'white',color:'#1e3a8a',padding:'17px 40px',borderRadius:12,fontSize:17,fontWeight:800,cursor:'pointer',border:'none',boxShadow:'0 8px 28px rgba(0,0,0,0.2)'}}>
            Empezar ahora →
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{background:'#0f1f3d',padding:'40px 24px',textAlign:'center'}}>
        <div style={{background:'white',padding:'10px 20px',borderRadius:12,display:'inline-block'}}>
          <img src="/logo.svg" alt="PropControl" style={{height:42,display:'block'}}/>
        </div>
        <div style={{marginTop:14,display:'flex',gap:24,justifyContent:'center',flexWrap:'wrap'}}>
          <a href="/terminos" style={{color:'rgba(255,255,255,0.7)',fontSize:13,textDecoration:'none'}}>Términos y Condiciones</a>
          <a href="/privacidad" style={{color:'rgba(255,255,255,0.7)',fontSize:13,textDecoration:'none'}}>Política de Privacidad</a>
          <a href="mailto:propcontroladm@gmail.com" style={{color:'rgba(255,255,255,0.7)',fontSize:13,textDecoration:'none'}}>Contacto</a>
        </div>
        <p style={{color:'rgba(255,255,255,0.4)',fontSize:13,marginTop:14}}>© 2026 PropControl · Clarita María Di Bacco · Yerba Buena, Tucumán 🇦🇷</p>
      </footer>
    </div>
  )
}
