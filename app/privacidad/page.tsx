'use client'
import Link from 'next/link'

export default function Privacidad() {
  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',padding:'40px 20px'}}>
      <div style={{maxWidth:780,margin:'0 auto',background:'white',borderRadius:16,padding:'40px 32px',boxShadow:'0 1px 3px rgba(0,0,0,.07)',fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',color:'#374151',lineHeight:1.7}}>
        <Link href="/" style={{color:'#2563eb',fontSize:14,fontWeight:600,textDecoration:'none'}}>← Volver al inicio</Link>
        <h1 style={{fontSize:32,fontWeight:900,color:'#1e3a8a',marginTop:20,marginBottom:8}}>Política de Privacidad</h1>
        <p style={{color:'#6b7280',fontSize:13,marginBottom:30}}>Última actualización: Mayo 2026</p>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>Datos que recopilamos</h2>
          <p>Cuando usted utiliza PropControl, recopilamos:</p>
          <ul style={{marginLeft:20,marginTop:8}}>
            <li><strong>Datos de la cuenta:</strong> email, nombre y foto de perfil de Google (a través de OAuth).</li>
            <li><strong>Datos que usted carga:</strong> propiedades, contratos, inquilinos, pagos, gastos. Estos datos son privados y solo accesibles por usted.</li>
            <li><strong>Datos técnicos:</strong> dirección IP, navegador, fecha y hora de acceso (estándar de seguridad).</li>
          </ul>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>Cómo usamos sus datos</h2>
          <ul style={{marginLeft:20,marginTop:8}}>
            <li>Para proveer el servicio y mostrar su información organizada.</li>
            <li>Para procesar pagos de suscripción a través de MercadoPago.</li>
            <li>Para enviar notificaciones operativas (cambios de plan, vencimiento de trial).</li>
            <li>Para mejorar el servicio (estadísticas agregadas, sin datos personales).</li>
          </ul>
          <p style={{marginTop:10,fontWeight:600}}>NO vendemos, alquilamos ni compartimos sus datos con terceros para fines de marketing.</p>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>Almacenamiento y seguridad</h2>
          <ul style={{marginLeft:20,marginTop:8}}>
            <li>Los datos se almacenan en Supabase Inc. (servidores en Estados Unidos).</li>
            <li>Toda la comunicación está encriptada con HTTPS/TLS.</li>
            <li>Los datos están encriptados en reposo en la base de datos.</li>
            <li>Cada usuario solo accede a sus propios datos mediante Row Level Security.</li>
            <li>No almacenamos contraseñas (la autenticación es vía Google OAuth).</li>
            <li>No almacenamos datos de tarjetas de crédito (los procesa MercadoPago).</li>
          </ul>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>Sus derechos (Ley 25.326)</h2>
          <p>Como titular de los datos, usted tiene derecho a:</p>
          <ul style={{marginLeft:20,marginTop:8}}>
            <li><strong>Acceso:</strong> consultar qué datos tenemos sobre usted.</li>
            <li><strong>Rectificación:</strong> corregir datos incorrectos.</li>
            <li><strong>Supresión:</strong> solicitar la eliminación de su cuenta y datos.</li>
            <li><strong>Portabilidad:</strong> exportar sus datos en formato legible.</li>
          </ul>
          <p style={{marginTop:10}}>Para ejercer estos derechos: <a href="mailto:propcontroladm@gmail.com" style={{color:'#2563eb'}}>propcontroladm@gmail.com</a></p>
          <p style={{marginTop:10,fontSize:13,color:'#6b7280'}}>La Agencia de Acceso a la Información Pública es el órgano de control de la Ley 25.326 y tiene atribuciones para atender denuncias y reclamos.</p>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>Cookies</h2>
          <p>Utilizamos cookies esenciales para mantener su sesión iniciada. No usamos cookies publicitarias ni de seguimiento de terceros.</p>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>Contacto</h2>
          <p><a href="mailto:propcontroladm@gmail.com" style={{color:'#2563eb'}}>propcontroladm@gmail.com</a></p>
        </section>
      </div>
    </div>
  )
}
