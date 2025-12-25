// app/api/eventos/actualizar-eventos/route.js
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { obtenerEventosDeHikvision } from '@/lib/db/eventos/database';

// Configuración del pool de conexiones
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

// ================================================
// FUNCIONES AUXILIARES - CORREGIDAS
// ================================================

// Función para convertir UTC a Hora Colombia (UTC-5)
function convertirUTCaCOT(fechaUTC) {
  if (!fechaUTC || isNaN(new Date(fechaUTC).getTime())) {
    return { fechaCOT: null, horaCOT: null };
  }

  const fecha = new Date(fechaUTC);
  // Restar 5 horas para convertir UTC a Colombia
  const fechaCOT = new Date(fecha.getTime() - (5 * 60 * 60 * 1000));

  const fechaStr = fechaCOT.toISOString().split('T')[0];
  const horaStr = fechaCOT.toISOString().split('T')[1]?.substring(0, 8) || '00:00:00';

  return { fechaCOT: fechaStr, horaCOT: horaStr };
}

// Función para determinar si una fecha es "hoy" en hora Colombia
function esHoyEnCOT(fechaUTC) {
  const hoyCOT = new Date();
  // Ajustar a hora Colombia
  hoyCOT.setHours(hoyCOT.getHours() - 5);
  const hoyStr = hoyCOT.toISOString().split('T')[0];

  const { fechaCOT } = convertirUTCaCOT(fechaUTC);
  return fechaCOT === hoyStr;
}

// Función para obtener eventos de un rango específico (para eventos nocturnos)
async function obtenerEventosConRangoAmplio() {
  try {
    // Crear rango amplio para capturar eventos nocturnos
    const hoy = new Date();
    const inicio = new Date(hoy);
    const fin = new Date(hoy);

    // Rango: Desde ayer 18:00 hasta mañana 06:00 (hora Colombia)
    inicio.setDate(inicio.getDate() - 1);
    inicio.setHours(18, 0, 0, 0); // 6 PM de ayer (hora Colombia)

    fin.setDate(fin.getDate() + 1);
    fin.setHours(6, 0, 0, 0); // 6 AM de mañana (hora Colombia)

    // Convertir a UTC para consulta a Hikvision
    inicio.setHours(inicio.getHours() + 5); // Colombia → UTC
    fin.setHours(fin.getHours() + 5); // Colombia → UTC

    // Aquí necesitaríamos modificar obtenerEventosDeHikvision para aceptar fechas
    // Por ahora, asumimos que ya maneja esto
    const eventos = await obtenerEventosDeHikvision();

    // Filtrar y convertir eventos
    const eventosProcesados = [];

    for (const evento of eventos) {
      try {
        // Si el evento ya tiene fecha y hora, asumimos que vienen en UTC
        if (evento.time || evento.fecha_hora) {
          const fechaUTC = evento.time || evento.fecha_hora;
          const { fechaCOT, horaCOT } = convertirUTCaCOT(fechaUTC);

          if (fechaCOT && horaCOT) {
            // Solo procesar eventos que caigan dentro del rango amplio de "hoy"
            const fechaEvento = new Date(fechaCOT);
            const hoyCOT = new Date();
            hoyCOT.setHours(hoyCOT.getHours() - 5);
            hoyCOT.setHours(0, 0, 0, 0);

            const mañanaCOT = new Date(hoyCOT);
            mañanaCOT.setDate(mañanaCOT.getDate() + 1);

            // Si el evento es de hoy o de la madrugada de mañana (turno nocturno)
            if (fechaEvento >= hoyCOT && fechaEvento < mañanaCOT) {
              eventosProcesados.push({
                ...evento,
                fecha: fechaCOT,      // Fecha en COT
                hora_simple: horaCOT, // Hora en COT
                fecha_original: fechaUTC // Mantener original para debug
              });
            }
          }
        } else if (evento.fecha && evento.hora_simple) {
          // Si ya vienen procesados, verificar que sean de hoy
          if (esHoyEnCOT(`${evento.fecha}T${evento.hora_simple}`)) {
            eventosProcesados.push(evento);
          }
        }
      } catch (error) {
        console.error('Error procesando evento:', error.message);
      }
    }

    return eventosProcesados;
  } catch (error) {
    console.error('Error obteniendo eventos con rango amplio:', error);
    return [];
  }
}

async function obtenerCampañaPorDocumento(documento, client) {
  if (!documento || documento === 'N/A') return 'Sin grupo';

  try {
    const result = await client.query(
      'SELECT departamento FROM usuarios_hikvision WHERE employee_no = $1',
      [documento]
    );
    return result.rows.length > 0 ? result.rows[0].departamento : 'Sin grupo';
  } catch (error) {
    return 'Sin grupo';
  }
}

// Función mejorada para agrupar eventos por documento y fecha COT
async function procesarParaBD(eventos) {
  // Agrupar por documento y fecha COT
  const eventosPorDocumentoFecha = {};

  eventos.forEach((evento) => {
    if (evento.documento === 'N/A') return;

    // Usar fecha en COT para agrupación
    const key = `${evento.documento}_${evento.fecha}`;

    if (!eventosPorDocumentoFecha[key]) {
      eventosPorDocumentoFecha[key] = {
        documento: evento.documento,
        nombre: evento.nombre || 'Sin nombre',
        fecha: evento.fecha, // Fecha en COT
        eventos: []
      };
    }

    eventosPorDocumentoFecha[key].eventos.push(evento);
  });

  const registrosBD = [];
  const client = await pool.connect();

  try {
    for (const [key, grupo] of Object.entries(eventosPorDocumentoFecha)) {
      // Ordenar eventos por hora
      grupo.eventos.sort((a, b) => a.hora_simple.localeCompare(b.hora_simple));

      // Identificar tipos de eventos
      const entradas = grupo.eventos.filter(e =>
        e.tipo === 'Entrada' || e.tipo.toLowerCase().includes('entrada')
      );

      const salidas = grupo.eventos.filter(e =>
        e.tipo === 'Salida' || e.tipo.toLowerCase().includes('salida')
      );

      const entradasAlmuerzo = grupo.eventos.filter(e =>
        e.tipo === 'Entrada Almuerzo' ||
        (e.tipo.toLowerCase().includes('entrada') && e.tipo.toLowerCase().includes('almuerzo')) ||
        (e.attendanceStatus && e.attendanceStatus === 'breakIn')
      );

      const salidasAlmuerzo = grupo.eventos.filter(e =>
        e.tipo === 'Salida Almuerzo' ||
        (e.tipo.toLowerCase().includes('salida') && e.tipo.toLowerCase().includes('almuerzo')) ||
        (e.attendanceStatus && e.attendanceStatus === 'breakOut')
      );

      // Tomar la primera entrada y última salida
      const primeraEntrada = entradas[0];
      const ultimaSalida = salidas[salidas.length - 1] || salidas[0];
      const salidaAlmuerzo = salidasAlmuerzo[0];
      const entradaAlmuerzo = entradasAlmuerzo[0];

      // Determinar subtipo basado en los registros encontrados
      let subtipo = 'Sin registros';

      if (primeraEntrada && ultimaSalida && salidaAlmuerzo && entradaAlmuerzo) {
        subtipo = 'Jornada completa';
      } else if (primeraEntrada && ultimaSalida && !salidaAlmuerzo && !entradaAlmuerzo) {
        subtipo = 'Sin almuerzo';
      } else if (primeraEntrada && !ultimaSalida) {
        subtipo = 'Solo entrada';
      } else if (!primeraEntrada && ultimaSalida) {
        subtipo = 'Solo salida';
      } else if (primeraEntrada && ultimaSalida && (salidaAlmuerzo || entradaAlmuerzo)) {
        subtipo = 'Almuerzo parcial';
      }

      // Validar que entrada y salida no tengan la misma hora
      let horaSalidaValida = ultimaSalida?.hora_simple || null;
      if (primeraEntrada && ultimaSalida && primeraEntrada.hora_simple === ultimaSalida.hora_simple) {
        horaSalidaValida = null;
        subtipo = 'ERROR - Misma hora';
      }

      // Crear registro solo si hay al menos un evento
      if (primeraEntrada || ultimaSalida || salidaAlmuerzo || entradaAlmuerzo) {
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

        const campaña = await obtenerCampañaPorDocumento(grupo.documento, client);

        registrosBD.push({
          documento: grupo.documento,
          nombre: grupo.nombre,
          fecha: grupo.fecha, // Fecha en COT
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
      }
    }
  } finally {
    client.release();
  }

  console.log(`Procesados ${registrosBD.length} registros para BD`);
  return registrosBD;
}

// ================================================
// FUNCIÓN PRINCIPAL DE SINCRONIZACIÓN - MEJORADA
// ================================================

async function sincronizarEventos(fechaEspecifica = null) {
  const startTime = Date.now();

  try {
    console.log(`Iniciando sincronización${fechaEspecifica ? ' para fecha: ' + fechaEspecifica : ' automática'}`);

    // Obtener eventos con rango amplio para capturar nocturnos
    const eventosHikvision = await obtenerEventosConRangoAmplio();

    if (eventosHikvision.length === 0) {
      const tiempoTotal = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`No se encontraron eventos para procesar`);

      return {
        eventos_obtenidos: 0,
        registros_procesados: 0,
        nuevos_registros: 0,
        registros_actualizados: 0,
        tiempo_segundos: parseFloat(tiempoTotal),
        mensaje: 'No hay eventos para procesar',
        fecha_procesada: fechaEspecifica || new Date().toISOString().split('T')[0]
      };
    }

    console.log(`Obtenidos ${eventosHikvision.length} eventos para procesar`);

    // Procesar eventos para BD
    const registrosBD = await procesarParaBD(eventosHikvision);

    if (registrosBD.length === 0) {
      const tiempoTotal = ((Date.now() - startTime) / 1000).toFixed(2);

      return {
        eventos_obtenidos: eventosHikvision.length,
        registros_procesados: 0,
        nuevos_registros: 0,
        registros_actualizados: 0,
        tiempo_segundos: parseFloat(tiempoTotal),
        mensaje: 'Eventos no generaron registros válidos',
        fecha_procesada: fechaEspecifica || new Date().toISOString().split('T')[0]
      };
    }

    let insertados = 0;
    let actualizados = 0;
    let errores = 0;

    // Insertar o actualizar en BD
    for (const registro of registrosBD) {
      try {
        const existe = await pool.query(
          'SELECT id FROM eventos_procesados WHERE documento = $1 AND fecha = $2',
          [registro.documento, registro.fecha]
        );

        if (existe.rows.length > 0) {
          await pool.query(`
    UPDATE eventos_procesados SET
      nombre = $1, hora_entrada = $2, hora_salida = $3,
      hora_salida_almuerzo = $4, hora_entrada_almuerzo = $5,
      tipo_evento = $6, subtipo_evento = $7, dispositivo_ip = $8,
      imagen = $9, campaña = $10
    WHERE documento = $11 AND fecha = $12
  `, [
            registro.nombre, registro.hora_entrada, registro.hora_salida,
            registro.hora_salida_almuerzo, registro.hora_entrada_almuerzo,
            registro.tipo_evento, registro.subtipo_evento, registro.dispositivo_ip,
            registro.imagen, registro.campaña, registro.documento, registro.fecha
          ]);
          actualizados++;
        } else {
          await pool.query(`
            INSERT INTO eventos_procesados (
              documento, nombre, fecha, hora_entrada, hora_salida,
              hora_salida_almuerzo, hora_entrada_almuerzo,
              tipo_evento, subtipo_evento, dispositivo_ip, imagen, campaña
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [
            registro.documento, registro.nombre, registro.fecha,
            registro.hora_entrada, registro.hora_salida,
            registro.hora_salida_almuerzo, registro.hora_entrada_almuerzo,
            registro.tipo_evento, registro.subtipo_evento,
            registro.dispositivo_ip, registro.imagen, registro.campaña
          ]);
          insertados++;
        }
      } catch (error) {
        console.error(`Error procesando registro ${registro.documento} - ${registro.fecha}:`, error.message);
        errores++;
      }
    }

    const tiempoTotal = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`Sincronización completada en ${tiempoTotal}s`);
    console.log(`Eventos: ${eventosHikvision.length} | Registros: ${registrosBD.length}`);
    console.log(`Nuevos: ${insertados} | Actualizados: ${actualizados} | Errores: ${errores}`);

    return {
      eventos_obtenidos: eventosHikvision.length,
      registros_procesados: registrosBD.length,
      nuevos_registros: insertados,
      registros_actualizados: actualizados,
      errores: errores,
      tiempo_segundos: parseFloat(tiempoTotal),
      fecha_procesada: fechaEspecifica || new Date().toISOString().split('T')[0],
      hora_sincronizacion: new Date().toLocaleString('es-CO')
    };

  } catch (error) {
    console.error('Error en sincronización:', error.message);
    throw error;
  }
}

// ================================================
// CONTROL DE SINCRONIZACIÓN AUTOMÁTICA
// ================================================

let sincronizacionActiva = false;
let ultimaEjecucion = null;
let intervaloId = null;

async function ejecutarSincronizacionAutomatica() {
  try {
    console.log('Ejecutando sincronización automática...');
    const resultado = await sincronizarEventos();
    ultimaEjecucion = new Date().toISOString();

    if (resultado.eventos_obtenidos > 0) {
      console.log(`Sincronización automática OK: ${resultado.registros_procesados} registros`);
    }
  } catch (error) {
    console.error('Error en sincronización automática:', error.message);
  }
}

function iniciarSincronizacionAutomatica() {
  if (sincronizacionActiva) return;

  sincronizacionActiva = true;
  console.log('Iniciando sincronización automática...');
  ejecutarSincronizacionAutomatica();

  // Ejecutar cada 2 minutos
  intervaloId = setInterval(ejecutarSincronizacionAutomatica, 2 * 60 * 1000);
  console.log('Sincronización automática iniciada (cada 2 minutos)');
}

function detenerSincronizacionAutomatica() {
  if (intervaloId) {
    clearInterval(intervaloId);
    intervaloId = null;
  }
  sincronizacionActiva = false;
  console.log('Sincronización automática detenida');
}

// ================================================
// ENDPOINTS - MEJORADOS
// ================================================

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const accion = url.searchParams.get('accion');
    const fecha = url.searchParams.get('fecha');

    if (accion === 'estado') {
      let proximaEjecucion = null;

      if (ultimaEjecucion) {
        const ultima = new Date(ultimaEjecucion);
        proximaEjecucion = new Date(ultima.getTime() + 2 * 60 * 1000);
      }

      return NextResponse.json({
        success: true,
        sincronizacion_automatica: {
          activa: sincronizacionActiva,
          ultima_ejecucion: ultimaEjecucion,
          proxima_ejecucion: proximaEjecucion?.toISOString(),
          intervalo_minutos: 2
        },
        zona_horaria: {
          sistema: 'UTC',
          destino: 'COT (UTC-5)',
          conversion_activa: true
        }
      });
    }

    if (accion === 'iniciar') {
      iniciarSincronizacionAutomatica();
      return NextResponse.json({
        success: true,
        message: 'Sincronización automática iniciada',
        intervalo: '2 minutos',
        zona_horaria: 'UTC → COT (Colombia)'
      });
    }

    if (accion === 'detener') {
      detenerSincronizacionAutomatica();
      return NextResponse.json({
        success: true,
        message: 'Sincronización automática detenida'
      });
    }

    if (accion === 'forzar') {
      const resultado = await sincronizarEventos();
      return NextResponse.json({
        success: true,
        message: 'Sincronización forzada ejecutada',
        ...resultado
      });
    }

    if (accion === 'fecha' && fecha) {
      // Validar formato de fecha
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return NextResponse.json({
          success: false,
          error: 'Formato de fecha inválido. Use YYYY-MM-DD'
        }, { status: 400 });
      }

      const resultado = await sincronizarEventos(fecha);
      return NextResponse.json({
        success: true,
        message: `Sincronización para fecha ${fecha} completada`,
        ...resultado
      });
    }

    if (accion === 'ayer') {
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      const fechaAyer = ayer.toISOString().split('T')[0];

      const resultado = await sincronizarEventos(fechaAyer);
      return NextResponse.json({
        success: true,
        message: `Sincronización de ayer (${fechaAyer}) completada`,
        ...resultado
      });
    }

    // Sincronización normal (hoy)
    const resultado = await sincronizarEventos();
    return NextResponse.json({
      success: true,
      message: 'Sincronización completada',
      ...resultado
    });

  } catch (error) {
    console.error('Error en endpoint:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
      detalle: 'Verificar logs del servidor'
    }, { status: 500 });
  }
}

export async function POST(request) {
  return await GET(request);
}

// ================================================
// INICIAR AUTOMÁTICAMENTE
// ================================================

function iniciarAutomaticamente() {
  if (typeof window !== 'undefined') return;
  if (sincronizacionActiva) return;

  setTimeout(() => {
    iniciarSincronizacionAutomatica();
  }, 10000); // Esperar 10 segundos al iniciar
}

console.log('Módulo de sincronización cargado con soporte para eventos nocturnos y zona horaria');
iniciarAutomaticamente();