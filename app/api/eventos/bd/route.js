import { NextResponse } from 'next/server';
import { Client } from 'pg';

// Configuración de TU PostgreSQL
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hikvision_events',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'OnePiece00.'
};

// Función para determinar estado basado en subtipo y fecha
const determinarEstado = (subtipo, fecha) => {
  const hoy = new Date().toISOString().split('T')[0];
  const esHoy = new Date(fecha).toISOString().split('T')[0] === hoy;
  
  const estados = {
    'Jornada completa': { 
      estado: 'COMPLETO', 
      color: '#28a745', 
      icono: '✅',
      prioridad: 1 
    },
    'Sin almuerzo registrado': { 
      estado: esHoy ? 'PENDIENTE' : 'INCOMPLETO', 
      color: esHoy ? '#ffc107' : '#dc3545', 
      icono: esHoy ? '⏳' : '⚠️',
      prioridad: 2 
    },
    'Solo entrada': { 
      estado: esHoy ? 'PENDIENTE' : 'INCOMPLETO', 
      color: esHoy ? '#ffc107' : '#dc3545', 
      icono: esHoy ? '⏳' : '⚠️',
      prioridad: 3 
    },
    'Solo salida': { 
      estado: esHoy ? 'PENDIENTE' : 'INCOMPLETO', 
      color: esHoy ? '#ffc107' : '#dc3545', 
      icono: esHoy ? '⏳' : '⚠️',
      prioridad: 3 
    },
    'Falta salida final': { 
      estado: esHoy ? 'PENDIENTE' : 'INCOMPLETO', 
      color: esHoy ? '#ffc107' : '#dc3545', 
      icono: esHoy ? '⏳' : '⚠️',
      prioridad: 2 
    },
    'Falta entrada inicial': { 
      estado: esHoy ? 'PENDIENTE' : 'INCOMPLETO', 
      color: esHoy ? '#ffc107' : '#dc3545', 
      icono: esHoy ? '⏳' : '⚠️',
      prioridad: 3 
    },
    'Solo almuerzo': { 
      estado: 'INCOMPLETO', 
      color: '#dc3545', 
      icono: '⚠️',
      prioridad: 4 
    },
    'Solo salida almuerzo': { 
      estado: 'INCOMPLETO', 
      color: '#dc3545', 
      icono: '⚠️',
      prioridad: 5 
    },
    'Solo entrada almuerzo': { 
      estado: 'INCOMPLETO', 
      color: '#dc3545', 
      icono: '⚠️',
      prioridad: 5 
    },
    'ERROR - Misma hora': { 
      estado: 'ERROR', 
      color: '#dc3545', 
      icono: '❌',
      prioridad: 0 
    },
    'Sin registros': { 
      estado: 'SIN REGISTRO', 
      color: '#6c757d', 
      icono: '📭',
      prioridad: 6 
    },
    'Entrada y Salida': { 
      estado: 'COMPLETO', 
      color: '#28a745', 
      icono: '✅',
      prioridad: 1 
    },
    'Entrada y Salida Almuerzo': { 
      estado: 'COMPLETO', 
      color: '#28a745', 
      icono: '✅',
      prioridad: 1 
    },
    'Solo Entrada': { 
      estado: esHoy ? 'PENDIENTE' : 'INCOMPLETO', 
      color: esHoy ? '#ffc107' : '#dc3545', 
      icono: esHoy ? '⏳' : '⚠️',
      prioridad: 3 
    },
    'Solo Salida': { 
      estado: esHoy ? 'PENDIENTE' : 'INCOMPLETO', 
      color: esHoy ? '#ffc107' : '#dc3545', 
      icono: esHoy ? '⏳' : '⚠️',
      prioridad: 3 
    }
  };
  
  return estados[subtipo] || { 
    estado: 'DESCONOCIDO', 
    color: '#6c757d', 
    icono: '❓',
    prioridad: 7 
  };
};

export async function GET(request) {
  console.log('📊 [BD] Consultando PostgreSQL...');
  
  const { searchParams } = new URL(request.url);
  const rango = searchParams.get('rango') || 'hoy';
  const fechaInicio = searchParams.get('fechaInicio');
  const fechaFin = searchParams.get('fechaFin');
  
  let client = null;
  
  try {
    // Calcular fechas según el rango
    let inicio;
    let fin;
    
    if (rango === 'personalizado' && fechaInicio && fechaFin) {
      inicio = fechaInicio;
      fin = fechaFin;
    } else {
      const hoy = new Date();
      switch (rango) {
        case 'hoy':
          inicio = hoy.toISOString().split('T')[0];
          fin = hoy.toISOString().split('T')[0];
          break;
        case '7dias':
          const sieteDias = new Date(hoy);
          sieteDias.setDate(hoy.getDate() - 7);
          inicio = sieteDias.toISOString().split('T')[0];
          fin = hoy.toISOString().split('T')[0];
          break;
        case '30dias':
          const treintaDias = new Date(hoy);
          treintaDias.setDate(hoy.getDate() - 30);
          inicio = treintaDias.toISOString().split('T')[0];
          fin = hoy.toISOString().split('T')[0];
          break;
        default:
          inicio = hoy.toISOString().split('T')[0];
          fin = hoy.toISOString().split('T')[0];
      }
    }
    
    console.log(`📅 [BD] Rango: ${inicio} a ${fin}`);
    
    // Conectar a TU PostgreSQL
    client = new Client(DB_CONFIG);
    await client.connect();
    console.log('✅ [BD] Conectado a PostgreSQL');
    
    // Consultar TU tabla eventos_procesados INCLUYENDO ALMUERZOS
    const query = `
      SELECT 
        documento as "empleadoId",
        nombre,
        fecha,
        hora_entrada as "horaEntrada",
        hora_salida as "horaSalida",
        hora_salida_almuerzo as "horaSalidaAlmuerzo",
        hora_entrada_almuerzo as "horaEntradaAlmuerzo",
        tipo_evento as "tipo",
        subtipo_evento as "subtipo",
        dispositivo_ip as "dispositivo",
        imagen as "foto"
      FROM eventos_procesados 
      WHERE fecha >= $1 AND fecha <= $2
      ORDER BY fecha DESC, hora_entrada DESC
    `;
    
    const result = await client.query(query, [inicio, fin]);
    
    console.log(`✅ [BD] ${result.rows.length} eventos encontrados`);
    
    // Formatear para tu dashboard CON ALMUERZOS
    const eventosFormateados = result.rows.map(evento => {
      const estadoInfo = determinarEstado(evento.subtipo, evento.fecha);
      
      // Determinar qué horas faltan específicamente
      const faltas = [];
      if (!evento.horaEntrada) faltas.push('Entrada');
      if (!evento.horaSalida) faltas.push('Salida');
      if (!evento.horaSalidaAlmuerzo) faltas.push('Salida Almuerzo');
      if (!evento.horaEntradaAlmuerzo) faltas.push('Entrada Almuerzo');
      
      // Calcular duración del almuerzo si hay ambas horas
      let duracionAlmuerzo = null;
      if (evento.horaSalidaAlmuerzo && evento.horaEntradaAlmuerzo) {
        try {
          const [h1, m1] = evento.horaSalidaAlmuerzo.split(':').map(Number);
          const [h2, m2] = evento.horaEntradaAlmuerzo.split(':').map(Number);
          const minutosTotal1 = h1 * 60 + m1;
          const minutosTotal2 = h2 * 60 + m2;
          const diferencia = Math.abs(minutosTotal2 - minutosTotal1);
          duracionAlmuerzo = `${Math.floor(diferencia / 60)}h ${diferencia % 60}m`;
        } catch (error) {
          duracionAlmuerzo = '--';
        }
      }
      
      // Formatear horas para display
      const formatearHora = (hora) => {
        if (!hora) return '--:--';
        if (typeof hora === 'string') {
          // Si es un objeto time de PostgreSQL, viene como "HH:MM:SS"
          return hora.substring(0, 5);
        }
        return hora;
      };
      
      return {
        // Datos básicos
        empleadoId: evento.empleadoId || '',
        nombre: evento.nombre || 'Sin nombre',
        fecha: evento.fecha,
        
        // Horas con formato
        horaEntrada: formatearHora(evento.horaEntrada),
        horaSalida: formatearHora(evento.horaSalida),
        horaSalidaAlmuerzo: formatearHora(evento.horaSalidaAlmuerzo),
        horaEntradaAlmuerzo: formatearHora(evento.horaEntradaAlmuerzo),
        duracionAlmuerzo: duracionAlmuerzo,
        
        // Información de estado
        tipo: evento.tipo || 'Asistencia',
        subtipo: evento.subtipo || 'Sin clasificar',
        estado: estadoInfo.estado,
        estadoColor: estadoInfo.color,
        estadoIcono: estadoInfo.icono,
        estadoDescripcion: evento.subtipo,
        
        // Para filtros y análisis
        faltas: faltas,
        tieneProblemas: estadoInfo.estado !== 'COMPLETO',
        necesitaRevision: estadoInfo.estado === 'ERROR' || estadoInfo.estado === 'INCOMPLETO',
        tieneAlmuerzoCompleto: evento.horaSalidaAlmuerzo && evento.horaEntradaAlmuerzo,
        
        // Datos adicionales
        dispositivo: evento.dispositivo || 'Desconocido',
        foto: evento.foto || '',
        campaña: 'Sin grupo'
      };
    });
    
    // Calcular estadísticas
    const conteoEstados = {
      COMPLETO: eventosFormateados.filter(e => e.estado === 'COMPLETO').length,
      PENDIENTE: eventosFormateados.filter(e => e.estado === 'PENDIENTE').length,
      INCOMPLETO: eventosFormateados.filter(e => e.estado === 'INCOMPLETO').length,
      ERROR: eventosFormateados.filter(e => e.estado === 'ERROR').length,
      'SIN REGISTRO': eventosFormateados.filter(e => e.estado === 'SIN REGISTRO').length,
      DESCONOCIDO: eventosFormateados.filter(e => e.estado === 'DESCONOCIDO').length
    };
    
    // Estadísticas de almuerzos
    const estadisticasAlmuerzos = {
      conAlmuerzoCompleto: eventosFormateados.filter(e => e.tieneAlmuerzoCompleto).length,
      sinAlmuerzo: eventosFormateados.filter(e => !e.horaSalidaAlmuerzo && !e.horaEntradaAlmuerzo).length,
      almuerzoIncompleto: eventosFormateados.filter(e => 
        (e.horaSalidaAlmuerzo && !e.horaEntradaAlmuerzo) || 
        (!e.horaSalidaAlmuerzo && e.horaEntradaAlmuerzo)
      ).length
    };
    
    return NextResponse.json({
      success: true,
      eventos: eventosFormateados,
      total: eventosFormateados.length,
      estadisticas: {
        porEstado: conteoEstados,
        almuerzos: estadisticasAlmuerzos
      },
      rango: {
        tipo: rango,
        inicio,
        fin
      }
    });
    
  } catch (error) {
    console.error('❌ [BD] Error:', error.message);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      eventos: [],
      total: 0
    }, { status: 500 });
    
  } finally {
    if (client) {
      await client.end();
      console.log('🔌 [BD] Conexión cerrada');
    }
  }
}