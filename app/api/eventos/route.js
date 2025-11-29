import { NextResponse } from 'next/server';
import DigestFetch from 'digest-fetch';

// Configuración
const CONFIG = {
  username: "admin",
  password: "Tattered3483",
  devices: ["172.31.0.165", "172.31.0.164"],
  maxResults: 30,
  maxRetries: 10,
  requestDelay: 100,
  deviceDelay: 500
};

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Utilidades
const formatHikvisionDate = (date) => date.toISOString().replace(/\.\d{3}Z$/, '');
const createDigestClient = () => new DigestFetch(CONFIG.username, CONFIG.password, { disableRetry: false, algorithm: 'MD5' });
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Cliente Hikvision
class HikvisionClient {
  constructor(deviceIp) {
    this.client = createDigestClient();
    this.deviceIp = deviceIp;
    this.baseUrl = `https://${deviceIp}/ISAPI/AccessControl/AcsEvent?format=json`;
  }

  async fetchEvents(searchCondition) {
    const body = {
      AcsEventCond: {
        searchID: searchCondition.tag,
        searchResultPosition: searchCondition.position,
        maxResults: searchCondition.maxResults,
        major: 5,
        minor: 0,
        startTime: searchCondition.startTime,
        endTime: searchCondition.endTime
      }
    };

    console.log(`🔍 Consultando ${this.deviceIp}: posición ${searchCondition.position}`);

    try {
      const res = await this.client.fetch(this.baseUrl, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" }
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Dispositivo ${this.deviceIp} - Error ${res.status}: ${errorText}`);
      }

      return await res.json();
    } catch (error) {
      console.error(`❌ Error en fetchEvents ${this.deviceIp}:`, error.message);
      throw error;
    }
  }
}

// Servicio de consulta por rango
class RangeQueryService {
  constructor(hikvisionClient) {
    this.client = hikvisionClient;
  }

  async queryEventsByRange(startTime, endTime, tag = 'consulta') {
    let eventos = [];
    let position = 0;
    let intento = 1;

    while (intento <= CONFIG.maxRetries) {
      const searchCondition = { tag, position, maxResults: CONFIG.maxResults, startTime, endTime };

      try {
        console.log(`📡 ${this.client.deviceIp}: Lote ${intento}, posición ${position}`);
        const data = await this.client.fetchEvents(searchCondition);
        const eventosLote = data?.AcsEvent?.InfoList || [];

        console.log(`📨 ${this.client.deviceIp}: Lote ${intento} → ${eventosLote.length} eventos`);

        if (eventosLote.length === 0) {
          console.log(`✅ ${this.client.deviceIp}: No hay más eventos`);
          break;
        }

        eventos.push(...eventosLote.map(evento => ({
          ...evento,
          dispositivo: this.client.deviceIp
        })));

        position += eventosLote.length;
        intento++;

        if (eventosLote.length < CONFIG.maxResults) {
          console.log(`✅ ${this.client.deviceIp}: Lote incompleto, fin de datos`);
          break;
        }

        await delay(CONFIG.requestDelay);

      } catch (error) {
        console.error(`❌ Error en lote ${intento}:`, error.message);
        break;
      }
    }

    console.log(`✅ ${this.client.deviceIp}: Total obtenidos ${eventos.length} eventos`);
    return eventos;
  }
}

// Servicio de periodos de tiempo
class TimePeriodService {
  getTodayRange() {
    const today = new Date();
    const inicioDia = new Date(today);
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(today);
    finDia.setHours(23, 59, 59, 999);

    console.log(`📅 Rango de hoy: ${inicioDia.toISOString()} a ${finDia.toISOString()}`);

    return {
      startTime: formatHikvisionDate(inicioDia),
      endTime: formatHikvisionDate(finDia),
      tag: 'hoy'
    };
  }

  getLast7DaysRange() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    console.log(`📅 Rango de 7 días: ${sevenDaysAgo.toISOString()} a ${now.toISOString()}`);

    return {
      startTime: formatHikvisionDate(sevenDaysAgo),
      endTime: formatHikvisionDate(now),
      tag: '7dias'
    };
  }

  getLast30DaysRange() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    console.log(`📅 Rango de 30 días: ${thirtyDaysAgo.toISOString()} a ${now.toISOString()}`);

    return {
      startTime: formatHikvisionDate(thirtyDaysAgo),
      endTime: formatHikvisionDate(now),
      tag: '30dias'
    };
  }
}

// Procesador de eventos
class EventProcessor {
  static processEvents(eventos, startTime, endTime) {
    console.log(`📊 Procesando ${eventos.length} eventos`);

    const eventosConNombre = eventos.filter(evento => {
      const tieneNombre = evento.name && evento.name !== 'Sin nombre' && evento.name.trim() !== '';
      return tieneNombre;
    });

    console.log(`🔍 Filtrado por nombre: ${eventos.length} eventos → ${eventosConNombre.length} eventos con nombre`);

    const eventosEnRango = eventosConNombre.filter(evento => {
      const fechaEvento = new Date(evento.time);
      const fechaInicio = new Date(startTime);
      const fechaFin = new Date(endTime);

      return fechaEvento >= fechaInicio && fechaEvento <= fechaFin;
    });

    console.log(`📅 Filtrado por fecha: ${eventosConNombre.length} eventos → ${eventosEnRango.length} eventos en rango`);

    return eventosEnRango.map(evento => {
      const fechaObj = new Date(evento.time);

      return {
        empleadoId: evento.employeeNoString || 'Sin documento',
        nombre: evento.name,
        hora: evento.time,
        fecha: fechaObj.toISOString().split('T')[0],
        campaña: evento.department || 'Sin grupo',
        tipo: evento.label || 'Evento',
        foto: evento.pictureURL || '',
        dispositivo: evento.dispositivo || 'Desconocido'
      };
    }).sort((a, b) => new Date(b.hora).getTime() - new Date(a.hora).getTime());
  }
}

// Servicio principal
class BiometricService {
  async queryAllDevices(rango = 'hoy', fechaInicio = null, fechaFin = null) {
    console.log(`\n🚀 CONSULTANDO DISPOSITIVOS BIOMÉTRICOS - Rango: ${rango}`);

    const allEvents = [];
    const errors = [];
    const timeService = new TimePeriodService();

    let timeRange;
    switch (rango) {
      case '7dias':
        timeRange = timeService.getLast7DaysRange();
        break;
      case '30dias':
        timeRange = timeService.getLast30DaysRange();
        break;
      case 'personalizado':
        if (!fechaInicio || !fechaFin) {
          throw new Error('Para rango personalizado se requieren fechaInicio y fechaFin');
        }
        timeRange = {
          startTime: formatHikvisionDate(new Date(fechaInicio + 'T00:00:00')),
          endTime: formatHikvisionDate(new Date(fechaFin + 'T23:59:59')),
          tag: 'personalizado'
        };
        break;
      case 'hoy':
      default:
        timeRange = timeService.getTodayRange();
    }

    console.log(`🎯 Consultando con rango: ${timeRange.startTime} a ${timeRange.endTime}`);

    for (const deviceIp of CONFIG.devices) {
      try {
        console.log(`\n📡 Consultando dispositivo: ${deviceIp}`);

        const hikvisionClient = new HikvisionClient(deviceIp);
        const rangeService = new RangeQueryService(hikvisionClient);

        const deviceEvents = await rangeService.queryEventsByRange(
          timeRange.startTime,
          timeRange.endTime,
          timeRange.tag
        );

        console.log(`✅ ${deviceIp}: ${deviceEvents.length} eventos obtenidos`);
        allEvents.push(...deviceEvents);

        await delay(CONFIG.deviceDelay);

      } catch (error) {
        console.error(`❌ Error en ${deviceIp}:`, error.message);
        errors.push({
          dispositivo: deviceIp,
          error: error.message
        });
      }
    }

    const eventosProcesados = EventProcessor.processEvents(allEvents, timeRange.startTime, timeRange.endTime);

    console.log(`\n📈 RESUMEN CONSULTA BIOMÉTRICA:`);
    console.log(`   - Total eventos brutos: ${allEvents.length}`);
    console.log(`   - Eventos con nombre: ${eventosProcesados.length}`);
    console.log(`   - Dispositivos con error: ${errors.length}`);

    return {
      eventos: eventosProcesados,
      errors,
      timeRange,
      dispositivos_consultados: CONFIG.devices,
      estadisticas: {
        total_eventos_brutos: allEvents.length,
        total_eventos_con_nombre: eventosProcesados.length,
        dispositivos_exitosos: CONFIG.devices.length - errors.length,
        dispositivos_con_error: errors.length
      }
    };
  }
}

// Exportar GET method
export async function GET(request) {
  console.log('\n🌐 ========== CONSULTA BIOMÉTRICA ==========');

  const biometricService = new BiometricService();

  try {
    const { searchParams } = new URL(request.url);
    const rango = searchParams.get('rango') || 'hoy';
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');

    console.log(`📋 Parámetros - Rango: ${rango}, FechaInicio: ${fechaInicio}, FechaFin: ${fechaFin}`);

    if (rango === 'personalizado') {
      if (!fechaInicio || !fechaFin) {
        return NextResponse.json(
          {
            success: false,
            error: 'Para rango personalizado se requieren fechaInicio y fechaFin'
          },
          { status: 400 }
        );
      }
    }

    const result = await biometricService.queryAllDevices(rango, fechaInicio, fechaFin);

    const response = {
      success: true,
      rango_utilizado: result.timeRange.tag,
      dispositivos_consultados: CONFIG.devices,
      total_eventos: result.estadisticas.total_eventos_con_nombre,
      eventos: result.eventos
    };

    if (result.errors.length > 0) {
      response.errores = result.errors;
      response.advertencia = 'Algunos dispositivos presentaron errores';
    }

    console.log(`\n✅ CONSULTA COMPLETADA: ${result.eventos.length} eventos con nombre obtenidos`);
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Método no implementado' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Método no implementado' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Método no implementado' }, { status: 405 });
}