import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { obtenerEventosDeHikvision } from '@/lib/db/eventos/database';

// Configuración de PostgreSQL
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hikvision_events',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'OnePiece00.'
};

// ================================================
// FUNCIONES DE UTILIDAD (SIN ZONA HORARIA)
// ================================================

// Función simple para obtener hora local
const getCurrentDateTime = () => {
  return new Date().toLocaleString('es-CO');
};

const log = {
  info: (...args) => {
    console.log(`[${getCurrentDateTime()}]`, ...args);
  },
  error: (...args) => {
    console.error(`[${getCurrentDateTime()}] ❌`, ...args);
  },
  success: (...args) => {
    console.log(`[${getCurrentDateTime()}] ✅`, ...args);
  },
  warn: (...args) => {
    console.warn(`[${getCurrentDateTime()}] ⚠️`, ...args);
  }
};

// ================================================
// VARIABLES DE CONTROL PARA SINCRONIZACIÓN AUTOMÁTICA
// ================================================

let sincronizacionActiva = false;
let ultimaEjecucion = null;
let intervaloId = null;

// ================================================
// FUNCIONES DE SINCRONIZACIÓN
// ================================================

// Función para obtener campaña/departamento desde usuarios_hikvision
async function obtenerCampañaPorDocumento(documento, client) {
  if (!documento || documento === 'N/A') return 'Sin grupo';
  
  try {
    const result = await client.query(
      'SELECT departamento FROM usuarios_hikvision WHERE employee_no = $1',
      [documento]
    );
    return result.rows.length > 0 ? result.rows[0].departamento : 'Sin grupo';
  } catch (error) {
    log.error(`Error obteniendo campaña para ${documento}:`, error.message);
    return 'Sin grupo';
  }
}

// Función para procesar eventos para la BD
async function procesarParaBD(eventos, client) {
  log.info('🔄 Procesando eventos para BD...');

  const hoy = new Date().toISOString().split('T')[0];
  log.info(`📅 Filtrando solo eventos del día: ${hoy}`);

  const eventosHoy = eventos.filter(evento => evento.fecha === hoy);

  log.info(`📊 Eventos totales obtenidos: ${eventos.length}`);
  log.info(`📊 Eventos de hoy (${hoy}): ${eventosHoy.length}`);

  if (eventosHoy.length === 0) {
    log.warn('No hay eventos de hoy para procesar');
    return [];
  }

  const eventosPorDocumento = {};

  // Clasificar eventos por documento
  eventosHoy.forEach((evento, index) => {
    if (evento.documento === 'N/A') {
      log.warn(`   ${index + 1}. Evento sin documento: ${evento.nombre} - ${evento.tipo}`);
      return;
    }

    const key = evento.documento;
    if (!eventosPorDocumento[key]) {
      eventosPorDocumento[key] = {
        documento: evento.documento,
        nombre: evento.nombre,
        fecha: evento.fecha,
        eventos: []
      };
    }

    eventosPorDocumento[key].eventos.push(evento);
  });

  const registrosBD = [];

  // Procesar cada documento
  for (const grupo of Object.values(eventosPorDocumento)) {
    grupo.eventos.sort((a, b) => a.hora_simple.localeCompare(b.hora_simple));

    const entradas = grupo.eventos.filter(e => e.tipo === 'Entrada');
    const salidas = grupo.eventos.filter(e => e.tipo === 'Salida');
    const entradasAlmuerzo = grupo.eventos.filter(e => e.tipo === 'Entrada Almuerzo');
    const salidasAlmuerzo = grupo.eventos.filter(e => e.tipo === 'Salida Almuerzo');
    const otrosEventos = grupo.eventos.filter(e => 
      !['Entrada', 'Salida', 'Entrada Almuerzo', 'Salida Almuerzo'].includes(e.tipo)
    );

    log.info(`📋 ${grupo.documento} - ${grupo.nombre}:`);
    log.info(`   • Entradas: ${entradas.length} - ${entradas.map(e => e.hora_simple).join(', ')}`);
    log.info(`   • Salidas: ${salidas.length} - ${salidas.map(e => e.hora_simple).join(', ')}`);
    log.info(`   • Salidas Almuerzo: ${salidasAlmuerzo.length} - ${salidasAlmuerzo.map(e => e.hora_simple).join(', ')}`);
    log.info(`   • Entradas Almuerzo: ${entradasAlmuerzo.length} - ${entradasAlmuerzo.map(e => e.hora_simple).join(', ')}`);
    
    if (otrosEventos.length > 0) {
      log.info(`   • Otros eventos (${otrosEventos.length}): ${otrosEventos.map(e => e.tipo).join(', ')}`);
    }

    const primeraEntrada = entradas[0];
    const ultimaSalida = salidas[salidas.length - 1] || salidas[0];
    const salidaAlmuerzo = salidasAlmuerzo[0];
    const entradaAlmuerzo = entradasAlmuerzo[0];

    let subtipo = '';

    if (primeraEntrada && ultimaSalida && salidaAlmuerzo && entradaAlmuerzo) {
      subtipo = 'Jornada completa';
    } else if (primeraEntrada && ultimaSalida && !salidaAlmuerzo && !entradaAlmuerzo) {
      subtipo = 'Sin almuerzo registrado';
    } else if (primeraEntrada && !ultimaSalida && !salidaAlmuerzo && !entradaAlmuerzo) {
      subtipo = 'Solo entrada';
    } else if (!primeraEntrada && ultimaSalida && !salidaAlmuerzo && !entradaAlmuerzo) {
      subtipo = 'Solo salida';
    } else if (primeraEntrada && !ultimaSalida && salidaAlmuerzo && entradaAlmuerzo) {
      subtipo = 'Falta salida final';
    } else if (!primeraEntrada && ultimaSalida && salidaAlmuerzo && entradaAlmuerzo) {
      subtipo = 'Falta entrada inicial';
    } else if (!primeraEntrada && !ultimaSalida && salidaAlmuerzo && entradaAlmuerzo) {
      subtipo = 'Solo almuerzo';
    } else if (primeraEntrada && ultimaSalida && salidaAlmuerzo && !entradaAlmuerzo) {
      subtipo = 'Falta entrada almuerzo';
    } else if (primeraEntrada && ultimaSalida && !salidaAlmuerzo && entradaAlmuerzo) {
      subtipo = 'Falta salida almuerzo';
    } else if (!primeraEntrada && !ultimaSalida && salidaAlmuerzo && !entradaAlmuerzo) {
      subtipo = 'Solo salida almuerzo';
    } else if (!primeraEntrada && !ultimaSalida && !salidaAlmuerzo && entradaAlmuerzo) {
      subtipo = 'Solo entrada almuerzo';
    } else if (otrosEventos.length > 0) {
      subtipo = `Otros eventos (${otrosEventos.map(e => e.tipo).join(', ')})`;
    } else {
      subtipo = 'Sin registros';
    }

    let horaSalidaValida = ultimaSalida?.hora_simple || null;
    if (primeraEntrada && ultimaSalida && 
        primeraEntrada.hora_simple === ultimaSalida.hora_simple) {
      horaSalidaValida = null;
      subtipo = 'ERROR - Misma hora entrada/salida';
    }

    if (primeraEntrada || ultimaSalida || salidaAlmuerzo || entradaAlmuerzo || otrosEventos.length > 0) {
      const dispositivo = primeraEntrada?.dispositivo || 
                         ultimaSalida?.dispositivo || 
                         salidaAlmuerzo?.dispositivo || 
                         entradaAlmuerzo?.dispositivo || 
                         'Desconocido';

      const foto = primeraEntrada?.foto || 
                   ultimaSalida?.foto || 
                   salidaAlmuerzo?.foto || 
                   entradaAlmuerzo?.foto || 
                   '';

      // Obtener la campaña/departamento del usuario
      const campaña = await obtenerCampañaPorDocumento(grupo.documento, client);

      registrosBD.push({
        documento: grupo.documento,
        nombre: grupo.nombre,
        fecha: grupo.fecha,
        hora_entrada: primeraEntrada?.hora_simple || null,
        hora_salida: horaSalidaValida,
        hora_salida_almuerzo: salidaAlmuerzo?.hora_simple || null,
        hora_entrada_almuerzo: entradaAlmuerzo?.hora_simple || null,
        tipo_evento: 'Asistencia',
        subtipo_evento: subtipo,
        dispositivo_ip: dispositivo,
        imagen: foto,
        campaña: campaña
      });

      log.info(`📝 Registro generado: ${grupo.documento} - ${subtipo} - Campaña: ${campaña}`);
    } else {
      log.warn(`❌ No se generó registro para ${grupo.documento}`);
    }
  }

  const eventosSinDocumento = eventosHoy.filter(e => e.documento === 'N/A');
  if (eventosSinDocumento.length > 0) {
    log.warn(`\n⚠️ EVENTOS SIN DOCUMENTO (no procesados): ${eventosSinDocumento.length}`);
  }

  const eventosProcesados = Object.keys(eventosPorDocumento).length;
  if (eventosProcesados !== eventosHoy.length - eventosSinDocumento.length) {
    log.error(`⚠️ DISCREPANCIA: ${eventosProcesados} documentos vs ${eventosHoy.length - eventosSinDocumento.length} eventos`);
  }

  log.info(`\n📊 TOTAL REGISTROS GENERADOS: ${registrosBD.length}`);
  return registrosBD;
}

// Función principal de sincronización
async function sincronizarEventos() {
  const startTime = Date.now();
  let client;

  try {
    log.info('='.repeat(60));
    log.info('💾 SINCRONIZACIÓN EVENTOS DE HOY → POSTGRESQL');
    log.info('='.repeat(60));

    const eventosHikvision = await obtenerEventosDeHikvision();

    if (eventosHikvision.length === 0) {
      return {
        eventos_obtenidos: 0,
        registros_procesados: 0,
        nuevos_registros: 0,
        registros_actualizados: 0,
        tiempo_segundos: ((Date.now() - startTime) / 1000).toFixed(2),
        mensaje: 'No hay eventos de hoy para sincronizar'
      };
    }

    log.success(`${eventosHikvision.length} eventos de hoy obtenidos`);

    client = new Client(DB_CONFIG);
    await client.connect();
    log.success('Conectado a PostgreSQL');

    // Crear tabla si no existe, incluyendo columna campaña
    await client.query(`
      CREATE TABLE IF NOT EXISTS eventos_procesados (
        id SERIAL PRIMARY KEY,
        documento VARCHAR(50) NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        fecha DATE NOT NULL,
        hora_entrada TIME,
        hora_salida TIME,
        hora_salida_almuerzo TIME,
        hora_entrada_almuerzo TIME,
        tipo_evento VARCHAR(50),
        subtipo_evento VARCHAR(50),
        dispositivo_ip VARCHAR(50),
        imagen TEXT,
        campaña VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(documento, fecha)
      )
    `);

    log.success('Tabla verificada/creada (incluye columna campaña)');

    const registrosBD = await procesarParaBD(eventosHikvision, client);

    if (registrosBD.length === 0) {
      return {
        eventos_obtenidos: eventosHikvision.length,
        registros_procesados: 0,
        nuevos_registros: 0,
        registros_actualizados: 0,
        tiempo_segundos: ((Date.now() - startTime) / 1000).toFixed(2),
        mensaje: 'Eventos obtenidos pero no generaron registros válidos'
      };
    }

    log.info(`📝 Guardando ${registrosBD.length} registros...`);

    let insertados = 0;
    let actualizados = 0;

    for (const registro of registrosBD) {
      try {
        const existe = await client.query(
          'SELECT id FROM eventos_procesados WHERE documento = $1 AND fecha = $2',
          [registro.documento, registro.fecha]
        );

        if (existe.rows.length > 0) {
          await client.query(`
            UPDATE eventos_procesados SET
              nombre = $1,
              hora_entrada = $2,
              hora_salida = $3,
              hora_salida_almuerzo = $4,
              hora_entrada_almuerzo = $5,
              tipo_evento = $6,
              subtipo_evento = $7,
              dispositivo_ip = $8,
              imagen = $9,
              campaña = $10,
              created_at = CURRENT_TIMESTAMP
            WHERE documento = $11 AND fecha = $12
          `, [
            registro.nombre,
            registro.hora_entrada,
            registro.hora_salida,
            registro.hora_salida_almuerzo,
            registro.hora_entrada_almuerzo,
            registro.tipo_evento,
            registro.subtipo_evento,
            registro.dispositivo_ip,
            registro.imagen,
            registro.campaña,
            registro.documento,
            registro.fecha
          ]);
          actualizados++;
          log.info(`   🔄 Actualizado: ${registro.documento} - Campaña: ${registro.campaña}`);
        } else {
          await client.query(`
            INSERT INTO eventos_procesados (
              documento, nombre, fecha, hora_entrada, hora_salida,
              hora_salida_almuerzo, hora_entrada_almuerzo,
              tipo_evento, subtipo_evento, dispositivo_ip, imagen, campaña
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [
            registro.documento,
            registro.nombre,
            registro.fecha,
            registro.hora_entrada,
            registro.hora_salida,
            registro.hora_salida_almuerzo,
            registro.hora_entrada_almuerzo,
            registro.tipo_evento,
            registro.subtipo_evento,
            registro.dispositivo_ip,
            registro.imagen,
            registro.campaña
          ]);
          insertados++;
          log.success(`   ➕ Insertado: ${registro.documento} - Campaña: ${registro.campaña}`);
        }

      } catch (error) {
        log.error(`Error con ${registro.documento}: ${error.message}`);
      }
    }

    const tiempoTotal = ((Date.now() - startTime) / 1000).toFixed(2);

    log.info('\n' + '='.repeat(60));
    log.success('SINCRONIZACIÓN COMPLETADA');
    log.info('='.repeat(60));
    log.info(`📊 RESULTADOS:`);
    log.info(`   • Eventos obtenidos de Hikvision: ${eventosHikvision.length}`);
    log.info(`   • Registros procesados para BD: ${registrosBD.length}`);
    log.info(`   • Nuevos registros insertados: ${insertados}`);
    log.info(`   • Registros actualizados: ${actualizados}`);
    log.info(`   • Tiempo total: ${tiempoTotal} segundos`);

    const diferencia = eventosHikvision.length - registrosBD.length;
    if (diferencia > 0) {
      log.warn(`⚠️  ${diferencia} eventos no generaron registros`);
    }

    return {
      eventos_obtenidos: eventosHikvision.length,
      registros_procesados: registrosBD.length,
      nuevos_registros: insertados,
      registros_actualizados: actualizados,
      tiempo_segundos: parseFloat(tiempoTotal),
      fecha_sincronizada: new Date().toISOString().split('T')[0],
      hora_sincronizacion: getCurrentDateTime()
    };

  } catch (error) {
    log.error('ERROR EN SINCRONIZACIÓN:', error.message);
    throw error;

  } finally {
    if (client) {
      await client.end();
      log.info('🔌 Conexión PostgreSQL cerrada');
    }
  }
}

// ================================================
// FUNCIONES DE CONTROL AUTOMÁTICO
// ================================================

// Función para ejecutar sincronización automática
async function ejecutarSincronizacionAutomatica() {
  try {
    log.info('\n' + '-'.repeat(50));
    log.info('🔄 EJECUTANDO SINCRONIZACIÓN AUTOMÁTICA');
    log.info(`🕐 Hora: ${getCurrentDateTime()}`);
    log.info('-'.repeat(50));

    const resultado = await sincronizarEventos();
    
    ultimaEjecucion = new Date().toISOString();

    if (resultado.eventos_obtenidos > 0) {
      log.success(`Sincronización completada: ${resultado.eventos_obtenidos} eventos`);
      log.info(`📊 Guardados: ${resultado.registros_procesados} registros`);
      log.info(`⏱️  Tiempo: ${resultado.tiempo_segundos}s`);
    } else {
      log.info('No hay eventos nuevos para sincronizar');
    }

    const proximaEjecucion = new Date(Date.now() + 1 * 60 * 1000);
    log.info(`⏰ Próxima ejecución: ${proximaEjecucion.toLocaleTimeString('es-CO')}`);

  } catch (error) {
    log.error('Error en sincronización automática:', error.message);
  }
}

// Función para iniciar la sincronización automática
function iniciarSincronizacionAutomatica() {
  if (sincronizacionActiva) {
    log.info('Sincronización automática ya está activa');
    return;
  }

  log.info('\n' + '='.repeat(70));
  log.info('⏰ INICIANDO SINCRONIZACIÓN AUTOMÁTICA (Cada 1 minuto)');
  log.info('='.repeat(70));
  log.info(`🕐 Hora: ${getCurrentDateTime()}`);
  log.info('='.repeat(70));

  sincronizacionActiva = true;

  ejecutarSincronizacionAutomatica();

  // Configurar intervalo de 1 minuto (60,000 ms)
  intervaloId = setInterval(ejecutarSincronizacionAutomatica, 1 * 60 * 1000);

  if (typeof process !== 'undefined') {
    process.on('SIGINT', limpiarSincronizacion);
    process.on('SIGTERM', limpiarSincronizacion);
  }
}

// Función para detener la sincronización automática
function detenerSincronizacionAutomatica() {
  if (!sincronizacionActiva) {
    log.info('Sincronización automática no está activa');
    return;
  }

  if (intervaloId) {
    clearInterval(intervaloId);
    log.info('🛑 Intervalo de sincronización detenido');
  }
  sincronizacionActiva = false;
  intervaloId = null;
}

// Función para limpiar recursos
function limpiarSincronizacion() {
  detenerSincronizacionAutomatica();
}

// ================================================
// ENDPOINT PRINCIPAL (GET)
// ================================================

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const accion = url.searchParams.get('accion');
    
    if (accion === 'estado') {
      let proximaEjecucion = null;
      
      if (ultimaEjecucion) {
        const ultima = new Date(ultimaEjecucion);
        proximaEjecucion = new Date(ultima.getTime() + 1 * 60 * 1000);
      }
      
      return NextResponse.json({
        success: true,
        sincronizacion_automatica: {
          activa: sincronizacionActiva,
          ultima_ejecucion: ultimaEjecucion,
          proxima_ejecucion: proximaEjecucion ? proximaEjecucion.toISOString() : null,
          intervalo_minutos: 1,
          configuracion: {
            dispositivos: ['172.31.0.165', '172.31.0.164']
          }
        },
        timestamps: {
          servidor: new Date().toISOString(),
          hora_local: getCurrentDateTime()
        }
      });
    }
    
    if (accion === 'iniciar') {
      if (!sincronizacionActiva) {
        iniciarSincronizacionAutomatica();
        return NextResponse.json({
          success: true,
          message: 'Sincronización automática iniciada',
          intervalo: '1 minuto',
          hora: getCurrentDateTime()
        });
      } else {
        return NextResponse.json({
          success: true,
          message: 'La sincronización automática ya está activa',
          hora: getCurrentDateTime()
        });
      }
    }
    
    if (accion === 'detener') {
      if (sincronizacionActiva) {
        detenerSincronizacionAutomatica();
        return NextResponse.json({
          success: true,
          message: 'Sincronización automática detenida',
          hora: getCurrentDateTime()
        });
      } else {
        return NextResponse.json({
          success: true,
          message: 'La sincronización automática no está activa',
          hora: getCurrentDateTime()
        });
      }
    }
    
    if (accion === 'forzar') {
      log.info('🔧 Ejecución forzada solicitada');
      const resultado = await sincronizarEventos();
      
      return NextResponse.json({
        success: true,
        message: 'Sincronización forzada ejecutada',
        hora: getCurrentDateTime(),
        ...resultado
      });
    }

    // Ejecutar sincronización normal
    const resultado = await sincronizarEventos();

    return NextResponse.json({
      success: true,
      message: 'Sincronización de eventos de hoy completada',
      timestamp: new Date().toISOString(),
      hora: getCurrentDateTime(),
      ...resultado
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      }
    });

  } catch (error) {
    log.error('ERROR EN ENDPOINT:', error.message);

    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      hora: getCurrentDateTime()
    }, {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ================================================
// ENDPOINT POST
// ================================================

export async function POST(request) {
  return await GET(request);
}

// ================================================
// INICIAR AUTOMÁTICAMENTE AL CARGAR EL MÓDULO
// ================================================

function iniciarAutomaticamente() {
  if (typeof window !== 'undefined') {
    return;
  }

  if (sincronizacionActiva) {
    log.info('Sincronización automática ya está activa');
    return;
  }

  log.info('\n🔍 INICIANDO SINCRONIZACIÓN AUTOMÁTICA...');
  log.info(`🕐 Hora: ${getCurrentDateTime()}`);
  log.info(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);

  setTimeout(() => {
    log.info('🚀 SINCRONIZACIÓN AUTOMÁTICA INICIADA');
    iniciarSincronizacionAutomatica();
  }, 1000);
}

log.info('📦 Módulo de sincronización cargado');
iniciarAutomaticamente();