import { NextResponse } from 'next/server';
import { obtenerEventosDeHikvision } from '@/lib/db/eventos/database';

export async function GET() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 API EVENTOS HIKVISION - SOLO HOY');
  console.log('='.repeat(50));

  const startTime = Date.now();

  try {
    const eventos = await obtenerEventosDeHikvision();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    const velocidad = eventos.length > 0 ? (eventos.length / duration).toFixed(1) : '0';

    console.log(`\n✅ CONSULTA COMPLETADA EN ${duration}s`);
    console.log(`   • Total eventos: ${eventos.length}`);
    console.log(`   • Velocidad: ${velocidad} eventos/s`);

    // Análisis adicional
    const eventosAlmuerzo = eventos.filter(e => e.tipo?.includes('Almuerzo'));
    console.log(`   • Eventos de almuerzo: ${eventosAlmuerzo.length}`);
    console.log(`   • Fecha consultada: ${new Date().toISOString().split('T')[0]}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      fecha_consulta: new Date().toISOString().split('T')[0],
      estadisticas: {
        total_eventos: eventos.length,
        eventos_almuerzo: eventosAlmuerzo.length,
        tiempo_segundos: parseFloat(duration),
        velocidad_eventos_por_segundo: parseFloat(velocidad)
      },
      data: eventos
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      }
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}