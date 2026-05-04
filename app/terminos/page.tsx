'use client'
import Link from 'next/link'

export default function Terminos() {
  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',padding:'40px 20px'}}>
      <div style={{maxWidth:780,margin:'0 auto',background:'white',borderRadius:16,padding:'40px 32px',boxShadow:'0 1px 3px rgba(0,0,0,.07)',fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',color:'#374151',lineHeight:1.7}}>
        <Link href="/" style={{color:'#2563eb',fontSize:14,fontWeight:600,textDecoration:'none'}}>← Volver al inicio</Link>
        <h1 style={{fontSize:32,fontWeight:900,color:'#1e3a8a',marginTop:20,marginBottom:8}}>Términos y Condiciones</h1>
        <p style={{color:'#6b7280',fontSize:13,marginBottom:30}}>Última actualización: Mayo 2026</p>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>1. Aceptación</h2>
          <p>Al registrarse y utilizar PropControl ("la Aplicación", "el Servicio") usted acepta estos Términos y Condiciones en su totalidad. Si no está de acuerdo con alguna disposición, debe abstenerse de usar el Servicio.</p>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>2. Descripción del Servicio</h2>
          <p>PropControl es una herramienta digital de gestión de alquileres que permite registrar propiedades, contratos, inquilinos, pagos y gastos. La Aplicación es una herramienta de organización personal y NO constituye:</p>
          <ul style={{marginLeft:20,marginTop:8}}>
            <li>Asesoramiento legal, contable, fiscal o financiero.</li>
            <li>Servicio de cobranza o intermediación de pagos.</li>
            <li>Sustituto de un contador, abogado o administrador inmobiliario profesional.</li>
            <li>Plataforma de pagos ni custodio de fondos.</li>
          </ul>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>3. Limitación de Responsabilidad</h2>
          <p style={{fontWeight:600,background:'#fef3c7',padding:12,borderRadius:8,border:'1px solid #fbbf24'}}>EL SERVICIO SE PROVEE "TAL CUAL" Y "SEGÚN DISPONIBILIDAD", SIN GARANTÍAS DE NINGÚN TIPO.</p>
          <p style={{marginTop:10}}>El Titular del Servicio NO será responsable, en ningún caso, por:</p>
          <ul style={{marginLeft:20,marginTop:8}}>
            <li>Daños directos, indirectos, incidentales, especiales, consecuentes o ejemplares.</li>
            <li>Pérdida de datos, lucro cesante, pérdida de oportunidades comerciales o pérdida de información.</li>
            <li>Decisiones financieras, legales o comerciales tomadas por el Usuario en base a información mostrada por la Aplicación.</li>
            <li>Errores de cálculo, interrupciones del servicio, fallas técnicas o problemas con proveedores externos (Supabase, Vercel, Google, MercadoPago).</li>
            <li>Acciones de terceros, incluyendo accesos no autorizados a la cuenta del Usuario.</li>
            <li>Conflictos legales con inquilinos, propietarios o terceros derivados del uso de la Aplicación.</li>
          </ul>
          <p style={{marginTop:10,fontWeight:600}}>El Usuario reconoce que utiliza la Aplicación bajo su EXCLUSIVA RESPONSABILIDAD y libera al Titular de todo reclamo, demanda o acción legal derivada de su uso.</p>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>4. Datos Personales y Privacidad</h2>
          <p>El Usuario es el ÚNICO responsable de los datos que carga en la Aplicación, incluyendo:</p>
          <ul style={{marginLeft:20,marginTop:8}}>
            <li>Datos personales de inquilinos, propietarios y terceros.</li>
            <li>Información financiera, contractual y comercial.</li>
            <li>Cumplimiento de la Ley 25.326 de Protección de Datos Personales (Argentina) o legislación equivalente.</li>
          </ul>
          <p style={{marginTop:10}}>El Usuario garantiza tener autorización legal para registrar y procesar dicha información, y se compromete a indemnizar al Titular ante cualquier reclamo de terceros relacionado con datos cargados en la cuenta del Usuario.</p>
          <p style={{marginTop:10}}>Los datos se almacenan en servidores de Supabase Inc. (Estados Unidos), con encriptación en tránsito (HTTPS) y en reposo. Cada usuario tiene acceso aislado a sus propios datos mediante Row Level Security.</p>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>5. Backup y Pérdida de Datos</h2>
          <p>El Servicio realiza backups automáticos a través de su proveedor de base de datos (Supabase), con retención según el plan contratado. Sin embargo:</p>
          <ul style={{marginLeft:20,marginTop:8}}>
            <li>El Titular NO garantiza la integridad ni disponibilidad permanente de los datos.</li>
            <li>El Usuario debe realizar sus propios backups periódicos mediante la función de exportación.</li>
            <li>El Titular NO será responsable por pérdida total o parcial de datos por cualquier causa.</li>
          </ul>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>6. Suscripción y Pagos</h2>
          <p>La Aplicación ofrece un período de prueba gratuito de 15 días. Posteriormente se requiere suscripción mensual o anual paga. Los pagos se procesan a través de MercadoPago (Argentina). El Titular no almacena datos de tarjetas de crédito ni medios de pago.</p>
          <p style={{marginTop:10}}>Las suscripciones se renuevan automáticamente. El Usuario puede cancelar en cualquier momento desde su panel. NO se realizan reembolsos por períodos parcialmente utilizados.</p>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>7. Uso Aceptable</h2>
          <p>El Usuario se compromete a no:</p>
          <ul style={{marginLeft:20,marginTop:8}}>
            <li>Usar la Aplicación con fines ilegales o fraudulentos.</li>
            <li>Intentar vulnerar la seguridad o acceder a datos de otros usuarios.</li>
            <li>Compartir su cuenta o credenciales con terceros.</li>
            <li>Hacer ingeniería inversa, copiar o redistribuir el software.</li>
          </ul>
          <p style={{marginTop:10}}>El incumplimiento puede resultar en la suspensión inmediata de la cuenta sin reembolso.</p>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>8. Cálculos y Precisión</h2>
          <p>Los cálculos de ajustes (IPC, dólar, índices personalizados), totales y reportes son referenciales. El Usuario debe verificar todos los montos antes de utilizarlos en operaciones reales. El Titular NO se responsabiliza por errores en cálculos derivados de datos mal cargados, índices desactualizados o fallas del sistema.</p>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>9. Modificaciones</h2>
          <p>El Titular se reserva el derecho de modificar estos Términos en cualquier momento. Las modificaciones se notificarán por email o en la Aplicación. El uso continuado del Servicio implica aceptación de los nuevos términos.</p>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>10. Eliminación de Cuenta</h2>
          <p>El Usuario puede solicitar la eliminación de su cuenta en cualquier momento. Los datos serán borrados dentro de los 30 días siguientes, salvo aquellos que el Titular deba conservar por obligación legal.</p>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>11. Jurisdicción</h2>
          <p>Estos Términos se rigen por las leyes de la República Argentina. Cualquier controversia será resuelta por los Tribunales Ordinarios de la ciudad de San Miguel de Tucumán, Provincia de Tucumán, con renuncia expresa a cualquier otro fuero o jurisdicción.</p>
        </section>

        <section style={{marginBottom:24}}>
          <h2 style={{fontSize:20,fontWeight:800,color:'#111827',marginBottom:10}}>12. Contacto</h2>
          <p>Para consultas sobre estos términos: <a href="mailto:propcontroladm@gmail.com" style={{color:'#2563eb'}}>propcontroladm@gmail.com</a></p>
        </section>

        <div style={{marginTop:40,padding:20,background:'#f3f4f6',borderRadius:10,fontSize:13,color:'#6b7280',textAlign:'center'}}>
          PropControl · Yerba Buena, Tucumán, Argentina<br/>
          Al registrarse, el Usuario declara haber leído, comprendido y aceptado estos Términos y Condiciones en su totalidad.
        </div>
      </div>
    </div>
  )
}
