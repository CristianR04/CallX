// C:\Users\jorge.gomez\Documents\Proyectos\CallX\lib\db\eventos\database.js

import DigestFetch from 'digest-fetch';

// Configuración
const CONFIG = {
  username: process.env.HIKUSER,
  password: process.env.HIKPASS,
  devices: [process.env.HIKVISION_IP1, process.env.HIKVISION_IP2].filter(Boolean),
  hikvisionMaxResults: 50,
  requestDelay: 200,
  deviceDelay: 1000,
  timeout: 30000
};

if (!CONFIG.username || !CONFIG.password) {
  throw new Error('Faltan credenciales Hikvision en variables de entorno');
}
if (CONFIG.devices.length === 0) {
  throw new Error('No hay dispositivos Hikvision configurados');
}

// Utilidades
const formatHikvisionDate = (date) => date.toISOString().replace(/\.\d{3}Z$/, '');
const createDigestClient = () => new DigestFetch(CONFIG.username, CONFIG.password, {
  disableRetry: true,
  algorithm: 'MD5'
});
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función auxiliar para obtener fecha/hora actual en Colombia (UTC-5)
function getNowColombia() {
  const nowUTC = new Date();
  // Colombia es UTC-5
  const nowColombia = new Date(nowUTC.getTime() - (5 * 60 * 60 * 1000));
  return nowColombia;
}

// Cliente Hikvision
class HikvisionClient {
  constructor(deviceIp) {
    this.deviceIp = deviceIp;
    this.baseUrl = `https://${deviceIp}/ISAPI/AccessControl/AcsEvent?format=json`;
    this.client = createDigestClient();
  }

  async fetchEvents(startTime, endTime, position = 0) {
    const body = {
      AcsEventCond: {
        searchID: `search_${this.deviceIp}_${Date.now()}`,
        searchResultPosition: position,
        maxResults: CONFIG.hikvisionMaxResults,
        major: 5,
        minor: 75,
        startTime,
        endTime
      }
    };

    try {
      const res = await this.client.fetch(this.baseUrl, {
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
          return { AcsEvent: { InfoList: [], totalMatches: 0 } };
        }
        throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 100)}`);
      }

      const responseText = await res.text();
      if (!responseText || responseText.trim() === '') {
        return { AcsEvent: { InfoList: [], totalMatches: 0 } };
      }

      return JSON.parse(responseText);
    } catch (error) {
      throw error;
    }
  }
}

// Función para consultar todos los eventos de un dispositivo
async function consultarTodosEventosDispositivo(deviceIp, startTime, endTime) {
  const client = new HikvisionClient(deviceIp);
  let allEvents = [];
  let position = 0;
  let batchNumber = 1;
  let totalMatches = null;
  let maxBatches = 50;

  while (batchNumber <= maxBatches) {
    try {
      const data = await client.fetchEvents(startTime, endTime, position);
      if (!data?.AcsEvent) {
        break;
      }

      const eventosBatch = data.AcsEvent.InfoList || [];
      const batchSize = eventosBatch.length;

      if (batchNumber === 1) {
        totalMatches = data.AcsEvent.totalMatches || 0;
      }

      if (batchSize === 0) {
        if (totalMatches > 0 && allEvents.length >= totalMatches) {
          break;
        }
        if (batchNumber === 1 && totalMatches > 0) {
          position = 1;
          continue;
        }
        break;
      }

      const eventosConInfo = eventosBatch.map(evento => ({
        ...evento,
        dispositivo: deviceIp,
        batch: batchNumber,
        position
      }));

      allEvents.push(...eventosConInfo);

      if (totalMatches > 0 && allEvents.length >= totalMatches) {
        break;
      }

      position += batchSize;
      batchNumber++;
      await delay(CONFIG.requestDelay);

    } catch (error) {
      if (error.message.includes('position') || error.message.includes('range')) {
        position += 1;
        await delay(500);
        continue;
      }

      if (batchNumber <= 3) {
        await delay(2000);
        continue;
      }
      break;
    }
  }

  return {
    eventos: allEvents,
    totalReportado: totalMatches,
    dispositivo: deviceIp
  };
}

// Procesar eventos
function procesarEventos(resultadosConsulta, fechaHoyColombia) {
  const eventosProcesados = [];

  for (const resultado of resultadosConsulta) {
    const { dispositivo } = resultado;

    for (const evento of resultado.eventos) {
      try {
        if (!evento.time) continue;

        const fechaUTC = new Date(evento.time);
        if (isNaN(fechaUTC.getTime())) continue;
        
        // Convertir UTC a hora Colombia (UTC-5)
        const fechaColombia = new Date(fechaUTC.getTime() - (5 * 60 * 60 * 1000));
        const fechaColombiaStr = fechaColombia.toISOString().split('T')[0];
        const horaColombiaStr = fechaColombia.toISOString().split('T')[1]?.substring(0, 8) || '00:00:00';
        
        // Solo procesar eventos de hoy en Colombia
        if (fechaColombiaStr !== fechaHoyColombia) {
          continue;
        }

        // Determinar tipo de evento
        let tipo = 'Evento';
        const label = evento.label || '';
        const attendanceStatus = evento.attendanceStatus || '';

        if (attendanceStatus === 'breakOut') tipo = 'Salida Almuerzo';
        else if (attendanceStatus === 'breakIn') tipo = 'Entrada Almuerzo';
        else if (label.toLowerCase().includes('almuerzo')) {
          if (label.toLowerCase().includes('salida') || label.toLowerCase().includes('a almuerzo')) {
            tipo = 'Salida Almuerzo';
          } else if (label.toLowerCase().includes('entrada') || label.toLowerCase().includes('de almuerzo')) {
            tipo = 'Entrada Almuerzo';
          }
        } else if (label.toLowerCase().includes('salida')) tipo = 'Salida';
        else if (label.toLowerCase().includes('entrada')) tipo = 'Entrada';
        else if (evento.minor === 75) tipo = evento.major === 5 ? 'Salida' : 'Entrada';

        // Documento del empleado
        let documento = 'N/A';
        if (evento.employeeNoString && evento.employeeNoString.trim() !== '') {
          documento = evento.employeeNoString.trim();
        } else if (evento.cardNo && evento.cardNo.trim() !== '') {
          documento = evento.cardNo.trim();
        }

        const nombre = evento.name ? evento.name.trim() : 'Sin nombre';

        eventosProcesados.push({
          dispositivo,
          nombre,
          documento,
          fecha: fechaColombiaStr,
          hora: `${fechaColombiaStr}T${horaColombiaStr}Z`,
          hora_simple: horaColombiaStr,
          tipo,
          departamento: evento.department || 'Sin departamento',
          foto: evento.pictureURL || '',
          label_original: label,
          attendance_status_original: attendanceStatus,
          time_original: evento.time
        });

      } catch (error) {
        continue;
      }
    }
  }

  return eventosProcesados;
}

// FUNCIÓN PRINCIPAL MODIFICADA - SOLO HOY
export async function obtenerEventosDeHikvision() {
  try {
    // Obtener HOY en hora Colombia
    const hoyColombia = getNowColombia();
    const fechaHoyColombia = hoyColombia.toISOString().split('T')[0];
    
    // Calcular inicio y fin del día en hora Colombia
    const inicioDiaColombia = new Date(`${fechaHoyColombia}T00:00:00`);
    const finDiaColombia = new Date(`${fechaHoyColombia}T23:59:59`);
    
    // Convertir a UTC para consulta a Hikvision
    const inicioUTC = new Date(inicioDiaColombia.getTime() + (5 * 60 * 60 * 1000));
    const finUTC = new Date(finDiaColombia.getTime() + (5 * 60 * 60 * 1000));

    console.log('📅 Consultando eventos SOLO de HOY:', {
      fecha_hoy_colombia: fechaHoyColombia,
      inicio_utc: inicioUTC.toISOString(),
      fin_utc: finUTC.toISOString(),
      hora_actual_colombia: hoyColombia.toLocaleTimeString('es-CO')
    });

    const resultadosConsulta = [];

    // Consultar cada dispositivo solo para HOY
    for (const deviceIp of CONFIG.devices) {
      let resultado;
      let intentos = 0;

      while (intentos < 2) {
        intentos++;

        try {
          resultado = await consultarTodosEventosDispositivo(
            deviceIp,
            formatHikvisionDate(inicioUTC),
            formatHikvisionDate(finUTC)
          );

          if (resultado.eventos.length > 0) break;
        } catch (error) {
          if (intentos < 2) {
            await delay(5000);
          }
        }
      }

      if (resultado?.eventos.length > 0) {
        resultadosConsulta.push(resultado);
        console.log(`✅ ${deviceIp}: ${resultado.eventos.length} eventos de hoy`);
      }

      if (deviceIp !== CONFIG.devices[CONFIG.devices.length - 1]) {
        await delay(CONFIG.deviceDelay);
      }
    }

    if (resultadosConsulta.length === 0) {
      console.log('⚠️ No se encontraron eventos para hoy');
      return [];
    }

    // Procesar eventos (solo los de hoy)
    const eventosProcesados = procesarEventos(resultadosConsulta, fechaHoyColombia);
    
    console.log(`✅ Eventos de HOY procesados: ${eventosProcesados.length}`);
    
    // Debug: mostrar primeros eventos para verificar fechas
    if (eventosProcesados.length > 0) {
      console.log('📋 Primeros 5 eventos de hoy:');
      eventosProcesados.slice(0, 5).forEach((evento, i) => {
        console.log(`  ${i+1}. ${evento.nombre} - ${evento.fecha} ${evento.hora_simple} - ${evento.tipo}`);
      });
    }

    return eventosProcesados;

  } catch (error) {
    console.error('❌ Error obteniendo eventos de hoy:', error);
    return [];
  }
}