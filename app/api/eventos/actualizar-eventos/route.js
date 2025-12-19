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
// FUNCIONES DE UTILIDAD
// ================================================

const formatHoraColombia = (fecha = new Date()) => {
  const fechaColombia = new Date(fecha);
  // Colombia es UTC-5
  return fechaColombia.toLocaleString('es-CO', { 
    timeZone: 'America/Bogota',
    hour12: false 
  });
};

const log = {
  info: (...args) => {
    console.log(`[${formatHoraColombia()}]`, ...args);
  },
  error: (...args) => {
    console.error(`[${formatHoraColombia()}] ❌`, ...args);
  },
  success: (...args) => {
    console.log(`[${formatHoraColombia()}] ✅`, ...args);
  },
  warn: (...args) => {
    console.warn(`[${formatHoraColombia()}] ⚠️`, ...args);
  }
};

// ================================================
// FUNCIÓN PARA OBTENER EVENTOS DE AYER
// ================================================

async function obtenerEventosDeAyer() {
  try {
    // Calcular fecha de ayer
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    const fechaAyer = ayer.toISOString().split('T')[0];
    
    log.info(`📅 Buscando eventos de ayer: ${fechaAyer}`);
    
    // Usar la función existente para obtener eventos de un día específico
    const eventosAyer = await obtenerEventosDeHikvisionPorDia(fechaAyer);
    
    if (eventosAyer.length === 0) {
      log.warn(`⚠️ No se encontraron eventos para ayer (${fechaAyer})`);
    } else {
      log.success(`✅ ${eventosAyer.length} eventos obtenidos para ayer`);
    }
    
    return eventosAyer;
  } catch (error) {
    log.error(`Error obteniendo eventos de ayer: ${error.message}`);
    return [];
  }
}

// ================================================
// FUNCIÓN MEJORADA PARA OBTENER EVENTOS POR DÍA
// ================================================

async function obtenerEventosDeHikvisionPorDia(fecha) {
  const startTime = Date.now();
  
  try {
    log.info(`🔍 Consultando eventos para: ${fecha}`);
    
    // Importar DigestFetch dinámicamente
    const DigestFetchModule = await import('digest-fetch');
    const DigestFetch = DigestFetchModule.default;
    
    const createDigestClient = () => new DigestFetch("admin", "Tattered3483", {
      disableRetry: true,
      algorithm: 'MD5'
    });

    const resultadosConsulta = [];
    const dispositivos = ["172.31.0.165", "172.31.0.164"];

    // Consultar cada dispositivo
    for (const deviceIp of dispositivos) {
      const baseUrl = `https://${deviceIp}/ISAPI/AccessControl/AcsEvent?format=json`;
      const client = createDigestClient();
      
      log.info(`📡 Consultando dispositivo: ${deviceIp}`);

      // Ajustar para zona horaria correcta (UTC)
      const inicio = new Date(`${fecha}T05:00:00Z`); // 00:00 Colombia = 05:00 UTC
      const fin = new Date(`${fecha}T28:59:59Z`); // 23:59 Colombia del día siguiente = 04:59 UTC
      
      const formatHikvisionDate = (date) => date.toISOString().replace(/\.\d{3}Z$/, '');

      let allEvents = [];
      let position = 0;
      let batchNumber = 1;
      let totalMatches = null;
      let maxBatches = 30;

      while (batchNumber <= maxBatches) {
        try {
          const body = {
            AcsEventCond: {
              searchID: `search_${deviceIp}_${Date.now()}`,
              searchResultPosition: position,
              maxResults: 100,
              major: 5,
              minor: 75,
              startTime: formatHikvisionDate(inicio),
              endTime: formatHikvisionDate(fin)
            }
          };

          const res = await client.fetch(baseUrl, {
            method: "POST",
            body: JSON.stringify(body),
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            timeout: 30000
          });

          if (!res.ok) {
            const errorText = await res.text();
            if (res.status === 400 || res.status === 404) {
              log.warn(`Dispositivo ${deviceIp} sin eventos para ${fecha}`);
              break;
            }
            log.error(`Error HTTP ${res.status}: ${errorText.substring(0, 100)}`);
            break;
          }

          const responseText = await res.text();
          if (!responseText || responseText.trim() === '') {
            break;
          }

          const data = JSON.parse(responseText);
          const eventosBatch = data?.AcsEvent?.InfoList || [];
          const batchSize = eventosBatch.length;

          if (batchNumber === 1) {
            totalMatches = data?.AcsEvent?.totalMatches || 0;
            log.info(`📊 Total reportado por ${deviceIp}: ${totalMatches}`);
          }

          if (batchSize === 0) {
            if (batchNumber === 1 && totalMatches > 0) {
              position = 1;
              continue;
            }
            break;
          }

          allEvents.push(...eventosBatch.map(evento => ({
            ...evento,
            dispositivo: deviceIp,
            batchNumber
          })));

          log.info(`📦 Lote ${batchNumber}: ${batchSize} eventos, acumulados: ${allEvents.length}`);

          if (totalMatches > 0 && allEvents.length >= totalMatches) {
            log.info(`🎯 Obtenidos todos los ${totalMatches} eventos`);
            break;
          }

          position += batchSize;
          batchNumber++;
          await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
          log.error(`Error en lote ${batchNumber}: ${error.message}`);
          
          if (error.message.includes('position') || error.message.includes('range')) {
            position += 1;
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }

          if (batchNumber <= 3) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          break;
        }
      }

      if (allEvents.length > 0) {
        resultadosConsulta.push({
          dispositivo: deviceIp,
          eventos: allEvents,
          totalReportado: totalMatches,
          fecha: fecha
        });
        log.success(`✅ ${deviceIp}: ${allEvents.length} eventos obtenidos`);
      } else {
        log.warn(`⚠️ ${deviceIp}: Sin eventos para ${fecha}`);
      }
      
      // Delay entre dispositivos
      if (deviceIp !== dispositivos[dispositivos.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    // Procesar eventos obtenidos
    const eventosProcesados = procesarEventosCrudos(resultadosConsulta, fecha);
    
    const tiempoTotal = ((Date.now() - startTime) / 1000).toFixed(2);
    log.success(`📈 Consulta para ${fecha} completada en ${tiempoTotal}s`);
    log.info(`🎯 Total eventos procesados: ${eventosProcesados.length}`);

    return eventosProcesados;

  } catch (error) {
    log.error(`❌ Error obteniendo eventos para ${fecha}: ${error.message}`);
    return [];
  }
}

// ================================================
// FUNCIÓN PARA PROCESAR EVENTOS CRUDOS
// ================================================

function procesarEventosCrudos(resultadosConsulta, fechaSolicitada) {
  const eventosProcesados = [];
  
  log.info(`🔄 Procesando eventos crudos para fecha: ${fechaSolicitada}`);

  for (const resultado of resultadosConsulta) {
    const { dispositivo, eventos } = resultado;

    for (const evento of eventos) {
      try {
        if (!evento.time) continue;

        const partes = evento.time.split('T');
        if (partes.length !== 2) continue;

        const fechaEvento = partes[0];
        const tiempoParte = partes[1];

        // Convertir fecha del evento a Colombia
        const fechaEventoObj = new Date(evento.time);
        fechaEventoObj.setHours(fechaEventoObj.getHours() - 5); // UTC a Colombia
        
        const fechaEventoColombia = fechaEventoObj.toISOString().split('T')[0];
        
        // Verificar si el evento corresponde al día solicitado (en hora Colombia)
        if (fechaEventoColombia !== fechaSolicitada) {
          // Solo mostrar logs si hay diferencia significativa
          const diffDias = Math.abs((new Date(fechaEventoColombia) - new Date(fechaSolicitada)) / (1000 * 60 * 60 * 24));
          if (diffDias >= 1) {
            log.warn(`⚠️ Evento fuera de rango: ${fechaEvento} UTC → ${fechaEventoColombia} CO (solicitado: ${fechaSolicitada})`);
          }
          continue;
        }

        let horaLocal;
        if (tiempoParte.includes('-') || tiempoParte.includes('+')) {
          const match = tiempoParte.match(/^(\d{2}:\d{2}:\d{2})/);
          if (match) horaLocal = match[1];
        } else if (tiempoParte.includes('Z')) {
          horaLocal = tiempoParte.substring(0, 8);
        } else {
          horaLocal = tiempoParte.substring(0, 8);
        }

        if (!horaLocal) continue;

        // MEJORAR LA CLASIFICACIÓN DE TIPOS
        let tipo = 'Evento';
        const label = evento.label || '';
        const attendanceStatus = evento.attendanceStatus || '';
        
        // Log para debug
        if (evento.employeeNoString) {
          log.info(`👤 ${evento.employeeNoString}: label="${label}", attendanceStatus="${attendanceStatus}"`);
        }

        // MEJOR LÓGICA DE CLASIFICACIÓN
        if (attendanceStatus === 'breakOut') {
          tipo = 'Salida Almuerzo';
        } else if (attendanceStatus === 'breakIn') {
          tipo = 'Entrada Almuerzo';
        } else if (label.toLowerCase().includes('entrada')) {
          if (label.toLowerCase().includes('almuerzo') || label.toLowerCase().includes('lunch')) {
            tipo = 'Entrada Almuerzo';
          } else {
            tipo = 'Entrada';
          }
        } else if (label.toLowerCase().includes('salida')) {
          if (label.toLowerCase().includes('almuerzo') || label.toLowerCase().includes('lunch')) {
            tipo = 'Salida Almuerzo';
          } else {
            tipo = 'Salida';
          }
        } 
        // Si no hay label claro, usar major/minor
        else if (evento.minor === 75) {
          if (evento.major === 5 || evento.major === 1) {
            tipo = 'Entrada';
          } else if (evento.major === 6 || evento.major === 2) {
            tipo = 'Salida';
          }
        }
        // Si aún no está clasificado, usar valores por defecto
        else if (evento.major === 1 || evento.cardReaderNo === 1) {
          tipo = 'Entrada';
        } else if (evento.major === 2 || evento.cardReaderNo === 2) {
          tipo = 'Salida';
        }

        // Documento del empleado
        let documento = 'N/A';
        if (evento.employeeNoString && evento.employeeNoString.trim() !== '') {
          documento = evento.employeeNoString.trim();
        } else if (evento.cardNo && evento.cardNo.trim() !== '') {
          documento = evento.cardNo.trim();
        } else if (evento.employeeNo) {
          documento = evento.employeeNo.toString();
        }

        const nombre = evento.name ? evento.name.trim() : 'Sin nombre';

        eventosProcesados.push({
          dispositivo,
          nombre,
          documento,
          fecha: fechaEventoColombia, // Usar fecha en hora Colombia
          hora: `${fechaEventoColombia}T${horaLocal}`,
          hora_simple: horaLocal,
          tipo,
          departamento: evento.department || 'Sin departamento',
          foto: evento.pictureURL || '',
          label_original: label,
          attendance_status_original: attendanceStatus,
          time_original: evento.time
        });

      } catch (error) {
        log.error(`Error procesando evento crudo: ${error.message}`);
      }
    }
  }

  // Mostrar resumen
  const conteoTipos = eventosProcesados.reduce((acc, e) => {
    acc[e.tipo] = (acc[e.tipo] || 0) + 1;
    return acc;
  }, {});
  
  log.info(`📊 Resumen tipos de eventos para ${fechaSolicitada}:`, conteoTipos);

  return eventosProcesados;
}

// ================================================
// FUNCIÓN PARA OBTENER EVENTOS POR RANGO
// ================================================

async function obtenerEventosDeHikvisionPorRango(fechaInicio, fechaFin) {
  log.info(`🔍 Iniciando consulta desde ${fechaInicio} hasta ${fechaFin}`);
  
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  const todosEventos = [];
  
  // Procesar día por día
  const fechaActual = new Date(inicio);
  
  while (fechaActual <= fin) {
    const fechaStr = fechaActual.toISOString().split('T')[0];
    
    log.info(`\n📅 Consultando fecha: ${fechaStr}`);
    
    const eventosDelDia = await obtenerEventosDeHikvisionPorDia(fechaStr);
    
    if (eventosDelDia.length > 0) {
      log.success(`✅ ${fechaStr}: ${eventosDelDia.length} eventos obtenidos`);
      todosEventos.push(...eventosDelDia);
    } else {
      log.warn(`⚠️ ${fechaStr}: Sin eventos`);
    }
    
    // Pasar al siguiente día
    fechaActual.setDate(fechaActual.getDate() + 1);
    
    // Delay entre días
    if (fechaActual <= fin) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  log.info(`\n📈 Total eventos obtenidos: ${todosEventos.length}`);
  
  return todosEventos;
}

// ================================================
// FUNCIONES DE SINCRONIZACIÓN
// ================================================

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

async function procesarParaBD(eventos, client) {
  log.info('🔄 Procesando eventos para BD...');

  // Agrupar eventos por fecha y documento
  const eventosPorFechaDocumento = {};

  eventos.forEach((evento) => {
    if (evento.documento === 'N/A') return;

    const key = `${evento.fecha}_${evento.documento}`;
    if (!eventosPorFechaDocumento[key]) {
      eventosPorFechaDocumento[key] = {
        documento: evento.documento,
        nombre: evento.nombre,
        fecha: evento.fecha,
        eventos: []
      };
    }
    eventosPorFechaDocumento[key].eventos.push(evento);
  });

  const registrosBD = [];

  // Procesar cada documento por fecha
  for (const key of Object.keys(eventosPorFechaDocumento)) {
    const grupo = eventosPorFechaDocumento[key];
    
    // Ordenar eventos por hora
    grupo.eventos.sort((a, b) => a.hora_simple.localeCompare(b.hora_simple));

    const entradas = grupo.eventos.filter(e => e.tipo === 'Entrada');
    const salidas = grupo.eventos.filter(e => e.tipo === 'Salida');
    const entradasAlmuerzo = grupo.eventos.filter(e => e.tipo === 'Entrada Almuerzo');
    const salidasAlmuerzo = grupo.eventos.filter(e => e.tipo === 'Salida Almuerzo');

    const primeraEntrada = entradas[0];
    const ultimaSalida = salidas[salidas.length - 1] || salidas[0];
    const salidaAlmuerzo = salidasAlmuerzo[0];
    const entradaAlmuerzo = entradasAlmuerzo[0];

    // DEBUG: Mostrar información del grupo
    log.info(`📊 ${grupo.fecha} - ${grupo.documento}:`);
    log.info(`   Entradas: ${entradas.length} - ${entradas.map(e => e.hora_simple).join(', ')}`);
    log.info(`   Salidas: ${salidas.length} - ${salidas.map(e => e.hora_simple).join(', ')}`);
    log.info(`   Salidas Almuerzo: ${salidasAlmuerzo.length} - ${salidasAlmuerzo.map(e => e.hora_simple).join(', ')}`);
    log.info(`   Entradas Almuerzo: ${entradasAlmuerzo.length} - ${entradasAlmuerzo.map(e => e.hora_simple).join(', ')}`);

    let subtipo = 'Sin registros';

    // Determinar subtipo basado en eventos encontrados
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

    // Validar hora de salida
    let horaSalidaValida = ultimaSalida?.hora_simple || null;
    if (primeraEntrada && ultimaSalida && primeraEntrada.hora_simple === ultimaSalida.hora_simple) {
      horaSalidaValida = null;
      subtipo = 'ERROR - Misma hora';
    }

    // Solo crear registro si hay algún evento significativo
    if (primeraEntrada || ultimaSalida || salidaAlmuerzo || entradaAlmuerzo) {
      const dispositivo = primeraEntrada?.dispositivo || ultimaSalida?.dispositivo || 'Desconocido';
      const foto = primeraEntrada?.foto || '';

      // Obtener campaña
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

      log.info(`📝 Registrado: ${grupo.documento} - ${grupo.fecha} - ${subtipo}`);
    }
  }

  log.info(`✅ Total registros generados: ${registrosBD.length}`);
  return registrosBD;
}

// ================================================
// FUNCIÓN PRINCIPAL DE SINCRONIZACIÓN
// ================================================

async function sincronizarEventos(fechaInicio = null, fechaFin = null) {
  const startTime = Date.now();
  let client;

  try {
    log.info('\n' + '='.repeat(60));
    
    if (fechaInicio && fechaFin) {
      log.info('💾 SINCRONIZACIÓN HISTÓRICA → POSTGRESQL');
      log.info(`📅 Rango: ${fechaInicio} al ${fechaFin}`);
    } else {
      log.info('💾 SINCRONIZACIÓN DE HOY → POSTGRESQL');
      const hoy = new Date().toISOString().split('T')[0];
      fechaInicio = hoy;
      fechaFin = hoy;
      log.info(`📅 Eventos del día: ${hoy}`);
    }
    
    log.info('='.repeat(60));

    let eventosHikvision;
    
    if (fechaInicio && fechaFin && fechaInicio !== fechaFin) {
      eventosHikvision = await obtenerEventosDeHikvisionPorRango(fechaInicio, fechaFin);
    } else {
      // Usar función mejorada para un solo día
      eventosHikvision = await obtenerEventosDeHikvisionPorDia(fechaInicio);
    }

    if (eventosHikvision.length === 0) {
      const tiempoTotal = ((Date.now() - startTime) / 1000).toFixed(2);
      const mensaje = fechaInicio === fechaFin 
        ? 'No hay eventos para hoy' 
        : `No hay eventos en el rango ${fechaInicio} - ${fechaFin}`;
      
      return {
        eventos_obtenidos: 0,
        registros_procesados: 0,
        nuevos_registros: 0,
        registros_actualizados: 0,
        tiempo_segundos: parseFloat(tiempoTotal),
        mensaje: mensaje
      };
    }

    log.success(`✅ ${eventosHikvision.length} eventos obtenidos`);

    client = new Client(DB_CONFIG);
    await client.connect();
    log.success('Conectado a PostgreSQL');

    // Crear tabla si no existe
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(documento, fecha)
      )
    `);

    log.success('Tabla verificada/creada');

    const registrosBD = await procesarParaBD(eventosHikvision, client);

    if (registrosBD.length === 0) {
      const tiempoTotal = ((Date.now() - startTime) / 1000).toFixed(2);
      return {
        eventos_obtenidos: eventosHikvision.length,
        registros_procesados: 0,
        nuevos_registros: 0,
        registros_actualizados: 0,
        tiempo_segundos: parseFloat(tiempoTotal),
        mensaje: 'Eventos obtenidos pero no generaron registros válidos'
      };
    }

    log.info(`📝 Guardando ${registrosBD.length} registros...`);

    let insertados = 0;
    let actualizados = 0;
    let errores = 0;

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
              campaña = $10
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
        }

      } catch (error) {
        errores++;
        log.error(`Error con ${registro.documento} - ${registro.fecha}: ${error.message}`);
      }
    }

    const tiempoTotal = ((Date.now() - startTime) / 1000).toFixed(2);

    log.info('\n' + '='.repeat(60));
    log.success('SINCRONIZACIÓN COMPLETADA');
    log.info('='.repeat(60));
    log.info(`📊 RESULTADOS:`);
    log.info(`   • Eventos obtenidos: ${eventosHikvision.length}`);
    log.info(`   • Registros procesados: ${registrosBD.length}`);
    log.info(`   • Nuevos registros: ${insertados}`);
    log.info(`   • Registros actualizados: ${actualizados}`);
    log.info(`   • Errores: ${errores}`);
    log.info(`   • Tiempo total: ${tiempoTotal}s`);
    log.info(`   • Fecha: ${fechaInicio === fechaFin ? fechaInicio : `${fechaInicio} a ${fechaFin}`}`);

    return {
      eventos_obtenidos: eventosHikvision.length,
      registros_procesados: registrosBD.length,
      nuevos_registros: insertados,
      registros_actualizados: actualizados,
      errores: errores,
      tiempo_segundos: parseFloat(tiempoTotal),
      fecha_sincronizada: fechaInicio === fechaFin ? fechaInicio : `${fechaInicio} a ${fechaFin}`,
      hora_sincronizacion: formatHoraColombia()
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
// VARIABLES DE CONTROL PARA SINCRONIZACIÓN
// ================================================

let sincronizacionActiva = false;
let ultimaEjecucion = null;
let intervaloId = null;

// ================================================
// FUNCIONES DE CONTROL AUTOMÁTICO
// ================================================

async function ejecutarSincronizacionAutomatica() {
  try {
    log.info('\n' + '🔄 EJECUTANDO SINCRONIZACIÓN AUTOMÁTICA');
    log.info(`🕐 Hora Colombia: ${formatHoraColombia()}`);

    const resultado = await sincronizarEventos();
    
    ultimaEjecucion = new Date().toISOString();

    if (resultado.eventos_obtenidos > 0) {
      log.success(`✅ Sincronización completada: ${resultado.eventos_obtenidos} eventos`);
    } else {
      log.info('📭 No hay eventos nuevos para sincronizar');
    }

  } catch (error) {
    log.error('❌ Error en sincronización automática:', error.message);
  }
}

function iniciarSincronizacionAutomatica() {
  if (sincronizacionActiva) {
    log.info('Sincronización automática ya está activa');
    return;
  }

  sincronizacionActiva = true;

  // Ejecutar inmediatamente
  ejecutarSincronizacionAutomatica();

  // Configurar intervalo de 2 minutos
  intervaloId = setInterval(ejecutarSincronizacionAutomatica, 2 * 60 * 1000);

  log.info('⏰ Sincronización automática iniciada (cada 2 minutos)');
}

function detenerSincronizacionAutomatica() {
  if (!sincronizacionActiva) return;

  if (intervaloId) {
    clearInterval(intervaloId);
    log.info('🛑 Intervalo de sincronización detenido');
  }
  sincronizacionActiva = false;
  intervaloId = null;
}

// ================================================
// ENDPOINT PRINCIPAL (GET)
// ================================================

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const accion = url.searchParams.get('accion');
    const fechaInicio = url.searchParams.get('fechaInicio');
    const fechaFin = url.searchParams.get('fechaFin');
    
    // Sincronizar ayer específicamente
    if (accion === 'ayer') {
      log.info('\n📅 Sincronizando específicamente eventos de AYER');
      
      const hoy = new Date();
      const ayer = new Date(hoy);
      ayer.setDate(hoy.getDate() - 1);
      const fechaAyer = ayer.toISOString().split('T')[0];
      
      const resultado = await sincronizarEventos(fechaAyer, fechaAyer);
      
      return NextResponse.json({
        success: true,
        message: `Sincronización de AYER (${fechaAyer}) completada`,
        hora_colombia: formatHoraColombia(),
        ...resultado
      });
    }
    
    // Casos existentes...
    if (accion === 'historico' && fechaInicio && fechaFin) {
      const resultado = await sincronizarEventos(fechaInicio, fechaFin);
      
      return NextResponse.json({
        success: true,
        message: `Sincronización histórica de ${fechaInicio} al ${fechaFin} completada`,
        hora_colombia: formatHoraColombia(),
        ...resultado
      });
    }
    
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
        hora_colombia: formatHoraColombia()
      });
    }
    
    if (accion === 'iniciar') {
      iniciarSincronizacionAutomatica();
      return NextResponse.json({
        success: true,
        message: 'Sincronización automática iniciada',
        intervalo: '2 minutos',
        hora_colombia: formatHoraColombia()
      });
    }
    
    if (accion === 'detener') {
      detenerSincronizacionAutomatica();
      return NextResponse.json({
        success: true,
        message: 'Sincronización automática detenida',
        hora_colombia: formatHoraColombia()
      });
    }
    
    if (accion === 'forzar') {
      const resultado = await sincronizarEventos();
      
      return NextResponse.json({
        success: true,
        message: 'Sincronización forzada ejecutada',
        hora_colombia: formatHoraColombia(),
        ...resultado
      });
    }

    // Sincronización normal (hoy por defecto)
    const resultado = await sincronizarEventos();

    return NextResponse.json({
      success: true,
      message: 'Sincronización completada',
      hora_colombia: formatHoraColombia(),
      ...resultado
    });

  } catch (error) {
    log.error('ERROR EN ENDPOINT:', error.message);

    return NextResponse.json({
      success: false,
      error: error.message,
      hora_colombia: formatHoraColombia()
    }, {
      status: 500
    });
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

  log.info('\n🔍 INICIANDO SINCRONIZACIÓN AUTOMÁTICA...');
  
  setTimeout(() => {
    iniciarSincronizacionAutomatica();
  }, 3000);
}

log.info('📦 Módulo de sincronización cargado');
iniciarAutomaticamente();