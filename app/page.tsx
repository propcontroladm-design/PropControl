'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push('/dashboard')
    })
  }, [])

  const loginGoogle = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f1f3d 0%,#1e3a8a 50%,#16a344 100%)'}}>
      {/* NAV */}
      <nav style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 40px',maxWidth:1200,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="8" fill="white" fillOpacity="0.15"/>
            <path d="M8 22L14 10L20 18L26 8" stroke="#16a344" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M6 28h24" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <rect x="10" y="22" width="4" height="6" rx="1" fill="#16a344"/>
            <rect x="16" y="18" width="4" height="10" rx="1" fill="#16a344" fillOpacity="0.7"/>
            <rect x="22" y="14" width="4" height="14" rx="1" fill="#16a344" fillOpacity="0.5"/>
          </svg>
          <span style={{color:'white',fontWeight:800,fontSize:22,letterSpacing:'-0.5px'}}>
            Prop<span style={{color:'#16a344'}}>Control</span>
          </span>
        </div>
        <button onClick={loginGoogle} style={{background:'white',color:'#1e3a8a',padding:'10px 24px',borderRadius:8,fontWeight:700,fontSize:14,cursor:'pointer'}}>
          Iniciar sesión
        </button>
      </nav>

      {/* HERO */}
      <div style={{textAlign:'center',padding:'80px 24px 60px',maxWidth:800,margin:'0 auto'}}>
        <div style={{display:'inline-block',background:'rgba(22,163,68,0.2)',border:'1px solid rgba(22,163,68,0.4)',borderRadius:20,padding:'6px 16px',marginBottom:20}}>
          <span style={{color:'#86efac',fontSize:13,fontWeight:600}}>✓ 15 días gratis · Sin tarjeta de crédito</span>
        </div>
        <h1 style={{color:'white',fontSize:52,fontWeight:900,lineHeight:1.1,marginBottom:20,letterSpacing:'-1px'}}>
          Controlá tus alquileres.<br/>
          <span style={{color:'#16a344'}}>Maximizá tus resultados.</span>
        </h1>
        <p style={{color:'rgba(255,255,255,0.75)',fontSize:18,lineHeight:1.6,marginBottom:40,maxWidth:600,margin:'0 auto 40px'}}>
          La única app argentina que calcula automáticamente contratos escalonados, ajustes por IPC y te dice exactamente quién pagó y quién no.
        </p>
        <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
          <button onClick={loginGoogle} disabled={loading} style={{background:'#16a344',color:'white',padding:'16px 36px',borderRadius:12,fontSize:17,fontWeight:800,cursor:'pointer',boxShadow:'0 8px 24px rgba(22,163,68,0.4)'}}>
            {loading ? 'Conectando...' : '🚀 Empezar gratis 15 días'}
          </button>
          <a href="#planes" style={{background:'rgba(255,255,255,0.1)',color:'white',padding:'16px 28px',borderRadius:12,fontSize:16,fontWeight:600,border:'1px solid rgba(255,255,255,0.2)'}}>
            Ver planes →
          </a>
        </div>
      </div>

      {/* FEATURES */}
      <div style={{background:'white',padding:'80px 24px',marginTop:60}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <h2 style={{textAlign:'center',fontSize:36,fontWeight:800,color:'#1e3a8a',marginBottom:12}}>Todo lo que necesitás en un solo lugar</h2>
          <p style={{textAlign:'center',color:'#6b7280',fontSize:16,marginBottom:60}}>Diseñado específicamente para propietarios argentinos</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:28}}>
            {[
              {ico:'🏠',title:'Propiedades y grupos',desc:'Organizá tus propiedades por edificio o conjunto. Filtrá y visualizá agrupado para no perderte en listas largas.'},
              {ico:'📄',title:'Contratos inteligentes',desc:'Fijo o escalonado por tramos. Ajuste por IPC, Dólar, Nafta o índice propio. Frecuencia mensual, trimestral, semestral o anual.'},
              {ico:'💰',title:'Control de pagos',desc:'Registrá múltiples pagos por período. Transferencia, cheque o efectivo. El estado (pagado/parcial/pendiente) se calcula solo.'},
              {ico:'💬',title:'WhatsApp automático',desc:'Con un toque enviás el recordatorio de pago con el monto exacto calculado. Directo al inquilino o al contacto de pagos de la empresa.'},
              {ico:'📊',title:'ROI y rentabilidad',desc:'Ves exactamente cuánto ganás por propiedad y por edificio. Ingresos, gastos y retorno sobre la inversión en segundos.'},
              {ico:'👔',title:'Propietarios múltiples',desc:'Cada propiedad puede tener uno o más propietarios con su porcentaje. Los ingresos se distribuyen automáticamente.'},
            ].map((f,i) => (
              <div key={i} style={{background:'#f9fafb',borderRadius:16,padding:28,border:'1px solid #e5e7eb'}}>
                <div style={{fontSize:32,marginBottom:12}}>{f.ico}</div>
                <h3 style={{fontWeight:700,fontSize:17,color:'#1e3a8a',marginBottom:8}}>{f.title}</h3>
                <p style={{color:'#6b7280',fontSize:14,lineHeight:1.6}}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PLANES */}
      <div id="planes" style={{padding:'80px 24px',background:'#f9fafb'}}>
        <div style={{maxWidth:900,margin:'0 auto'}}>
          <h2 style={{textAlign:'center',fontSize:36,fontWeight:800,color:'#1e3a8a',marginBottom:12}}>Planes simples y transparentes</h2>
          <p style={{textAlign:'center',color:'#6b7280',fontSize:16,marginBottom:50}}>Sin sorpresas. Cancelás cuando querés.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:24}}>
            {/* STARTER */}
            <div style={{background:'white',borderRadius:20,padding:32,border:'2px solid #e5e7eb',boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
              <div style={{fontWeight:700,fontSize:13,color:'#6b7280',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Starter</div>
              <div style={{fontSize:42,fontWeight:900,color:'#1e3a8a',marginBottom:4}}>$9.900<span style={{fontSize:16,fontWeight:400,color:'#6b7280'}}>/mes</span></div>
              <p style={{color:'#6b7280',fontSize:14,marginBottom:24}}>Ideal para hasta 10 propiedades</p>
              <ul style={{listStyle:'none',marginBottom:28}}>
                {['Hasta 10 propiedades','Contratos y pagos','Inquilinos ilimitados','Reportes básicos','Soporte por email'].map((f,i) => (
                  <li key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:10,fontSize:14,color:'#374151'}}>
                    <span style={{color:'#16a344',fontWeight:700}}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button onClick={loginGoogle} style={{width:'100%',background:'#f3f4f6',color:'#1e3a8a',padding:'13px',borderRadius:10,fontWeight:700,fontSize:15,cursor:'pointer'}}>
                Empezar gratis
              </button>
            </div>
            {/* PRO */}
            <div style={{background:'linear-gradient(135deg,#1e3a8a,#2563eb)',borderRadius:20,padding:32,border:'2px solid #2563eb',boxShadow:'0 8px 32px rgba(30,58,138,0.3)',position:'relative'}}>
              <div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'#16a344',color:'white',padding:'4px 16px',borderRadius:20,fontSize:12,fontWeight:700}}>MÁS POPULAR</div>
              <div style={{fontWeight:700,fontSize:13,color:'rgba(255,255,255,0.6)',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Pro</div>
              <div style={{fontSize:42,fontWeight:900,color:'white',marginBottom:4}}>$19.900<span style={{fontSize:16,fontWeight:400,color:'rgba(255,255,255,0.6)'}}>/mes</span></div>
              <p style={{color:'rgba(255,255,255,0.7)',fontSize:14,marginBottom:24}}>Propiedades ilimitadas</p>
              <ul style={{listStyle:'none',marginBottom:28}}>
                {['Propiedades ilimitadas','Todo lo del Starter','ROI y rentabilidad','Expensas por edificio','Propietarios múltiples','Índices personalizados','WhatsApp automático','Soporte prioritario'].map((f,i) => (
                  <li key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:10,fontSize:14,color:'rgba(255,255,255,0.9)'}}>
                    <span style={{color:'#86efac',fontWeight:700}}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button onClick={loginGoogle} style={{width:'100%',background:'#16a344',color:'white',padding:'13px',borderRadius:10,fontWeight:700,fontSize:15,cursor:'pointer',boxShadow:'0 4px 12px rgba(22,163,68,0.4)'}}>
                Empezar gratis 15 días
              </button>
            </div>
            {/* ANUAL */}
            <div style={{background:'white',borderRadius:20,padding:32,border:'2px solid #e5e7eb',boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
              <div style={{fontWeight:700,fontSize:13,color:'#6b7280',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Pro Anual</div>
              <div style={{fontSize:42,fontWeight:900,color:'#1e3a8a',marginBottom:4}}>$179.900<span style={{fontSize:16,fontWeight:400,color:'#6b7280'}}>/año</span></div>
              <div style={{display:'inline-block',background:'#dcfce7',color:'#14532d',padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:700,marginBottom:16}}>Ahorrás 2 meses</div>
              <p style={{color:'#6b7280',fontSize:14,marginBottom:24}}>Todo Pro con descuento anual</p>
              <ul style={{listStyle:'none',marginBottom:28}}>
                {['Todo lo del plan Pro','Ahorro vs mensual','Factura anual','Precio fijo todo el año'].map((f,i) => (
                  <li key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:10,fontSize:14,color:'#374151'}}>
                    <span style={{color:'#16a344',fontWeight:700}}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button onClick={loginGoogle} style={{width:'100%',background:'#f3f4f6',color:'#1e3a8a',padding:'13px',borderRadius:10,fontWeight:700,fontSize:15,cursor:'pointer'}}>
                Empezar gratis
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{background:'#0f1f3d',padding:'40px 24px',textAlign:'center'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:12}}>
          <span style={{color:'white',fontWeight:800,fontSize:18}}>Prop<span style={{color:'#16a344'}}>Control</span></span>
        </div>
        <p style={{color:'rgba(255,255,255,0.4)',fontSize:13}}>© 2026 PropControl · Clarita María Di Bacco · Yerba Buena, Tucumán</p>
        <p style={{color:'rgba(255,255,255,0.3)',fontSize:12,marginTop:6}}>
          <a href="/terminos" style={{color:'rgba(255,255,255,0.4)'}}>Términos</a> · <a href="/privacidad" style={{color:'rgba(255,255,255,0.4)'}}>Privacidad</a>
        </p>
      </footer>
    </div>
  )
}
