import DigestFetch from 'digest-fetch';

// Configuración
const CONFIG = {
  username: "admin",
  password: "Tattered3483",
  devices: ["172.31.0.165", "172.31.0.164"],
  hikvisionMaxResults: 50,
  requestDelay: 200,
  deviceDelay: 1000,
  timeout: 30000
};

 process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // ← ELIMINAR ESTO EN PRODUCCIÓN

// Utilidades
const formatHikvisionDate = (date) => date.toISOString().replace(/\.\d{3}Z$/, '');
const createDigestClient = () => new DigestFetch(CONFIG.username, CONFIG.password, {
  disableRetry: true,
  algorithm: 'MD5'
});
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Logger condicional
const logger = {
  debug: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
  },
  info: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
  },
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args)
};

// Cliente Hikvision
class HikvisionClient {
  constructor(deviceIp) {
    this.deviceIp = deviceIp;
    this.baseUrl = `https://${deviceIp}/ISAPI/AccessControl/AcsEvent?format=json`;
    this.client = createDigestClient();
    this.zonaHoraria = null;
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

      const data = JSON.parse(responseText);

      // Detectar zona horaria
      if (data?.AcsEvent?.InfoList?.length > 0 && !this.zonaHoraria) {
        const primerEvento = data.AcsEvent.InfoList[0];
        if (primerEvento.time) {
          if (primerEvento.time.includes('+08:00')) this.zonaHoraria = '+08:00';
          else if (primerEvento.time.includes('-05:00')) this.zonaHoraria = '-05:00';
          else if (primerEvento.time.includes('Z')) this.zonaHoraria = 'Z';
          logger.debug(`Zona horaria detectada: ${this.zonaHoraria}`);
        }
      }

      return data;
    } catch (error) {
      logger.error(`Error consultando ${this.deviceIp}: ${error.message}`);
      throw error;
    }
  }
}

// Función para consultar todos los eventos de un dispositivo
async function consultarTodosEventosDispositivo(deviceIp, startTime, endTime) {
  logger.debug(`Consultando dispositivo: ${deviceIp}`);

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
        logger.debug('Respuesta inválida del dispositivo');
        break;
      }

      const eventosBatch = data.AcsEvent.InfoList || [];
      const batchSize = eventosBatch.length;

      if (batchNumber === 1) {
        totalMatches = data.AcsEvent.totalMatches || 0;
        logger.debug(`Total reportado por ${deviceIp}: ${totalMatches}`);
      }

      if (batchSize === 0) {
        if (totalMatches > 0 && allEvents.length >= totalMatches) {
          logger.debug(`Todos los ${totalMatches} eventos obtenidos`);
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
      logger.debug(`Lote ${batchNumber}: ${batchSize} eventos, acumulados: ${allEvents.length}`);

      if (totalMatches > 0 && allEvents.length >= totalMatches) {
        logger.debug(`Obtenidos todos los ${totalMatches} eventos`);
        break;
      }

      position += batchSize;
      batchNumber++;
      await delay(CONFIG.requestDelay);

    } catch (error) {
      logger.error(`Error en lote ${batchNumber}: ${error.message}`);
      
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

  logger.debug(`${deviceIp}: ${allEvents.length} eventos obtenidos`);

  return {
    eventos: allEvents,
    totalReportado: totalMatches,
    dispositivo: deviceIp,
    zonaHoraria: client.zonaHoraria
  };
}

// Función para ajustar fecha según zona horaria
function ajustarFechaSegunZona(fechaOriginal, zonaHorariaDispositivo) {
  if (!fechaOriginal || zonaHorariaDispositivo !== '+08:00') return null;

  try {
    const partes = fechaOriginal.split('T');
    if (partes.length !== 2) return null;

    const fechaParte = partes[0];
    const tiempoParte = partes[1];

    let horaLocal;
    if (tiempoParte.includes('-') || tiempoParte.includes('+')) {
      const match = tiempoParte.match(/^(\d{2}:\d{2}:\d{2})/);
      if (match) horaLocal = match[1];
    } else if (tiempoParte.includes('Z')) {
      horaLocal = tiempoParte.substring(0, 8);
    } else {
      horaLocal = tiempoParte.substring(0, 8);
    }

    if (!horaLocal) return null;

    const fechaUTC = new Date(`${fechaParte}T${horaLocal}Z`);
    if (isNaN(fechaUTC.getTime())) return null;

    // UTC+8 a Colombia (UTC-5): diferencia de 13 horas
    fechaUTC.setHours(fechaUTC.getHours() - 13);
    const fechaAjustada = fechaUTC.toISOString().split('T')[0];
    const horaAjustada = fechaUTC.toISOString().split('T')[1].substring(0, 8);

    if (process.env.NODE_ENV === 'development' && fechaAjustada !== fechaParte) {
      logger.debug(`Ajuste de zona horaria: ${fechaParte} ${horaLocal} → ${fechaAjustada} ${horaAjustada}`);
    }

    return fechaAjustada;

  } catch (error) {
    logger.error(`Error ajustando fecha: ${error.message}`);
    return null;
  }
}

// Procesar eventos con ajuste de zona horaria
function procesarEventosConZona(resultadosConsulta, fechaHoy) {
  const eventosProcesados = [];
  let eventosConZonaAjustada = 0;
  let eventosDescartados = 0;

  for (const resultado of resultadosConsulta) {
    const { dispositivo, zonaHoraria = '-05:00' } = resultado;

    for (const evento of resultado.eventos) {
      try {
        if (!evento.time) {
          eventosDescartados++;
          continue;
        }

        const partes = evento.time.split('T');
        if (partes.length !== 2) {
          eventosDescartados++;
          continue;
        }

        let fecha = partes[0];
        const tiempoParte = partes[1];

        // Detectar timezone
        let timezoneOffset = null;
        if (tiempoParte.includes('+08:00')) timezoneOffset = '+08:00';
        else if (tiempoParte.includes('-05:00')) timezoneOffset = '-05:00';
        else if (tiempoParte.includes('Z')) timezoneOffset = 'Z';

        // Extraer hora
        let horaLocal;
        if (tiempoParte.includes('-') || tiempoParte.includes('+')) {
          const match = tiempoParte.match(/^(\d{2}:\d{2}:\d{2})/);
          if (match) horaLocal = match[1];
        } else if (tiempoParte.includes('Z')) {
          horaLocal = tiempoParte.substring(0, 8);
        } else {
          horaLocal = tiempoParte.substring(0, 8);
        }

        if (!horaLocal) {
          eventosDescartados++;
          continue;
        }

        // Ajustar fecha si es UTC+8
        if (zonaHoraria === '+08:00' || timezoneOffset === '+08:00') {
          const fechaAjustada = ajustarFechaSegunZona(evento.time, '+08:00');
          if (fechaAjustada) {
            const fechaAjustadaObj = new Date(fechaAjustada);
            const fechaHoyObj = new Date(fechaHoy);
            const diffDias = Math.abs(fechaAjustadaObj - fechaHoyObj) / (1000 * 60 * 60 * 24);

            if (diffDias <= 1) {
              fecha = fechaAjustada;
              eventosConZonaAjustada++;
            } else {
              eventosDescartados++;
              continue;
            }
          }
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
          fecha,
          hora: `${fecha}T${horaLocal}Z`,
          hora_simple: horaLocal,
          tipo,
          departamento: evento.department || 'Sin departamento',
          foto: evento.pictureURL || '',
          label_original: label,
          attendance_status_original: attendanceStatus,
          time_original: evento.time,
          zona_horaria_dispositivo: zonaHoraria,
          timezone_offset: timezoneOffset
        });

      } catch (error) {
        logger.error(`Error procesando evento: ${error.message}`);
        eventosDescartados++;
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    logger.debug(`Procesados: ${eventosProcesados.length}, Ajustados: ${eventosConZonaAjustada}, Descartados: ${eventosDescartados}`);
  }

  return eventosProcesados;
}

// FUNCIÓN PRINCIPAL
export async function obtenerEventosDeHikvision() {
  const startTime = Date.now();

  try {
    const fechaActual = new Date().toISOString().split('T')[0];
    const resultadosConsulta = [];

    // Consultar cada dispositivo
    for (const deviceIp of CONFIG.devices) {
      let resultado;
      let intentos = 0;

      while (intentos < 2) {
        intentos++;

        try {
          const fechaObj = new Date(fechaActual);
          const inicio = new Date(Date.UTC(
            fechaObj.getUTCFullYear(),
            fechaObj.getUTCMonth(),
            fechaObj.getUTCDate(),
            0, 0, 0, 0
          ));

          const fin = new Date(Date.UTC(
            fechaObj.getUTCFullYear(),
            fechaObj.getUTCMonth(),
            fechaObj.getUTCDate() + 1,
            0, 0, 0, 0
          ));

          resultado = await consultarTodosEventosDispositivo(
            deviceIp,
            formatHikvisionDate(inicio),
            formatHikvisionDate(fin)
          );

          if (resultado.eventos.length > 0) break;
        } catch (error) {
          logger.error(`Error consultando ${deviceIp}: ${error.message}`);
          if (intentos < 2) {
            await delay(5000);
          }
        }
      }

      if (resultado?.eventos.length > 0) {
        resultadosConsulta.push(resultado);
      }

      if (deviceIp !== CONFIG.devices[CONFIG.devices.length - 1]) {
        await delay(CONFIG.deviceDelay);
      }
    }

    if (resultadosConsulta.length === 0) {
      logger.warn('No se obtuvieron eventos de ningún dispositivo');
      return [];
    }

    // Procesar eventos
    const eventosProcesados = procesarEventosConZona(resultadosConsulta, fechaActual);
    const eventosHoy = eventosProcesados.filter(e => e.fecha === fechaActual);

    const tiempoTotal = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Consulta completada en ${tiempoTotal}s`);
      logger.debug(`Eventos de hoy: ${eventosHoy.length}`);
    }

    return eventosHoy;

  } catch (error) {
    logger.error(`Error en obtenerEventosDeHikvision: ${error.message}`);
    return [];
  }
}