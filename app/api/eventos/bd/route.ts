import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// Configuración de PostgreSQL desde variables de entorno
const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
};

// 🔥 Mapeo CORREGIDO: Códigos de campaña → Nombres visuales de departamento
// IMPORTANTE: Los códigos pueden venir con o sin tilde, mayúsculas/minúsculas
const CAMPAIGNS_MAP: Record<string, string> = {
  // Sin tilde
  'campana_5757': 'Campana 5757',
  'campana_sav': 'Campana SAV',
  'campana_refi': 'Campana REFI',
  'campana_pl': 'Campana PL',
  'campana_parlo': 'Campana PARLO',
  'ti': 'TI',
  'teams_leaders': 'Teams Leaders',
  'administrativo': 'Administrativo',
  // Con tilde (variaciones reales de la BD)
  'campaña_5757': 'Campana 5757',
  'campaña_sav': 'Campana SAV',
  'campaña_refi': 'Campana REFI',
  'campaña_pl': 'Campana PL',
  'campaña_parlo': 'Campana PARLO',
  'campaña_PARLO': 'Campana PARLO',
  // Variaciones con mayúsculas
  'CAMPANA_5757': 'Campana 5757',
  'CAMPANA_SAV': 'Campana SAV',
  'CAMPANA_REFI': 'Campana REFI',
  'CAMPANA_PL': 'Campana PL',
  'CAMPANA_PARLO': 'Campana PARLO',
  'TI': 'TI',
  'TEAMS_LEADERS': 'Teams Leaders',
  'ADMINISTRATIVO': 'Administrativo'
};

// 🔥 Función helper para normalizar códigos de campaña (con/sin tilde, mayúsculas)
function normalizeCampaignCode(code: string | null | undefined): string | null {
  if (!code) return null;
  
  // Normalizar: quitar tildes, convertir a minúsculas
  return code
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Quitar diacríticos (tildes)
}

// 🔥 Función para obtener nombre de campaña normalizado
function getCampaignName(campanaCode: string | null | undefined): string {
  if (!campanaCode) return 'Sin grupo';
  
  const normalized = normalizeCampaignCode(campanaCode);
  if (!normalized) return 'Sin grupo';
  
  // Buscar en el mapa (con clave normalizada)
  const key = Object.keys(CAMPAIGNS_MAP).find(k => 
    normalizeCampaignCode(k) === normalized
  );
  
  return key ? CAMPAIGNS_MAP[key] : campanaCode; // Si no encuentra, devolver original
}

// 🔥 Función para obtener todas las variantes de una campaña para búsqueda en BD
function getCampaignVariantsForDB(campaign: string | undefined): string[] {
  if (!campaign) return [];
  
  const normalized = normalizeCampaignCode(campaign);
  if (!normalized) return [];
  
  // Encontrar todas las claves que se normalizan al mismo valor
  const variants = Object.keys(CAMPAIGNS_MAP).filter(key => 
    normalizeCampaignCode(key) === normalized
  );
  
  // También incluir la versión mapeada (nombre visual)
  const visualName = getCampaignName(campaign);
  if (visualName && !variants.includes(visualName)) {
    variants.push(visualName);
  }
  
  return variants;
}

// 🔥 Replicar la lógica del hook para manejar Team Leaders de ventas
function normalizarCampana(campana: string | null): string | null {
  if (!campana) return null;
  
  return campana
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function esCampanaVentas(campana: string | null): boolean {
  if (!campana) return false;
  
  const normalizada = normalizarCampana(campana);
  if (!normalizada) return false;
  
  const ventasVariants = [
    'campaña_ventas',
    'campana_ventas',
    'campaña_ventas_casa',
    'campana_ventas_casa',
    'ventas',
    'sales',
    'ventas_consolidado'
  ];
  
  return ventasVariants.includes(normalizada);
}

function obtenerCampanasTeamLeader(campana: string | null): string[] {
  if (!campana) return [];
  
  if (esCampanaVentas(campana)) {
    return ['SAV', 'REFI', 'PL'];  // 🔥 Las 3 campañas de ventas
  }
  
  // Para otras campañas individuales
  return [campana];
}

function obtenerDepartamentosTeamLeader(campana: string | null): string[] {
  if (!campana) return [];
  
  if (esCampanaVentas(campana)) {
    return ['Campana SAV', 'Campana REFI', 'Campana PL'];  // 🔥 Departamentos en BD
  }
  
  // Mapeo para otras campañas
  const normalizada = normalizarCampana(campana);
  if (!normalizada) return [];
  
  const campaignMap: Record<string, string> = {
    'campaña_5757': 'Campana 5757',
    'campana_5757': 'Campana 5757',
    'campaña_parlo': 'Campana PARLO',
    'campana_parlo': 'Campana PARLO',
    'ti': 'TI',
    'administrativo': 'Administrativo',
    'teams_leaders': 'Teams Leaders'
  };
  
  const department = campaignMap[normalizada] || campana;
  return [department];
}

// 🔥 Obtener todas las variantes de campañas para un Team Leader
function getTeamLeaderCampaignVariants(userCampaign: string | null): string[] {
  if (!userCampaign) return [];
  
  const campaigns = obtenerCampanasTeamLeader(userCampaign);
  const allVariants: string[] = [];
  
  campaigns.forEach(campaign => {
    const variants = getCampaignVariantsForDB(campaign);
    allVariants.push(...variants);
  });
  
  return [...new Set(allVariants)];
}

// 🔥 Obtener todos los departamentos para un Team Leader
function getTeamLeaderDepartments(userCampaign: string | null): string[] {
  if (!userCampaign) return [];
  
  return obtenerDepartamentosTeamLeader(userCampaign);
}

// Función para determinar estado basado en subtipo y fecha
const determinarEstado = (subtipo: string, fecha: string) => {
  const hoy = new Date().toISOString().split('T')[0];
  const esHoy = new Date(fecha).toISOString().split('T')[0] === hoy;
  
  const estados: Record<string, any> = {
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

// Función auxiliar para formatear hora
const formatearHora = (hora: any): string => {
  if (!hora) return '--:--';
  if (typeof hora === 'string') {
    return hora.substring(0, 8);
  }
  return hora;
};

// Función para calcular duración de almuerzo
const calcularDuracionAlmuerzo = (horaSalida: string | null, horaEntrada: string | null): string | null => {
  if (!horaSalida || !horaEntrada) return null;
  
  try {
    const [h1, m1] = horaSalida.split(':').map(Number);
    const [h2, m2] = horaEntrada.split(':').map(Number);
    const minutosTotal1 = h1 * 60 + (m1 || 0);
    const minutosTotal2 = h2 * 60 + (m2 || 0);
    const diferencia = Math.abs(minutosTotal2 - minutosTotal1);
    
    const horas = Math.floor(diferencia / 60);
    const minutos = diferencia % 60;
    
    return `${horas > 0 ? `${horas}h ` : ''}${minutos}m`;
  } catch (error) {
    return null;
  }
};

// Función para determinar faltas
const determinarFaltas = (evento: any): string[] => {
  const faltas: string[] = [];
  if (!evento.horaEntrada) faltas.push('Entrada');
  if (!evento.horaSalida) faltas.push('Salida');
  if (!evento.horaSalidaAlmuerzo) faltas.push('Salida Almuerzo');
  if (!evento.horaEntradaAlmuerzo) faltas.push('Entrada Almuerzo');
  return faltas;
};

export async function GET(request: Request) {
  console.log('🔍 ===== INICIO DE DEPURACIÓN /api/eventos/bd =====');
  
  let client: Client | null = null;
  const startTime = Date.now();
  
  try {
    // 🔥 OBTENER SESIÓN DEL USUARIO usando getServerSession
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.log('❌ No hay sesión de usuario');
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const user = session.user as any;
    const userRole = user.role;
    const userCampaign = user.campaign || user.campana;
    
    console.log('🔍 Usuario de sesión:', {
      id: user.id,
      nombre: user.nombre,
      role: userRole,
      campana: userCampaign,
      username: user.username
    });

    // Obtener parámetros de la URL
    const { searchParams } = new URL(request.url);
    const rango = searchParams.get('rango') || 'hoy';
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');
    
    console.log('🔍 Parámetros de consulta:', {
      rango,
      fechaInicio,
      fechaFin,
      userRole,
      userCampaignCode: userCampaign
    });

    // Calcular fechas según el rango
    let inicio: string, fin: string;
    const hoy = new Date();
    
    if (rango === 'personalizado' && fechaInicio && fechaFin) {
      inicio = fechaInicio;
      fin = fechaFin;
    } else {
      switch (rango) {
        case 'hoy':
          inicio = fin = hoy.toISOString().split('T')[0];
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
          inicio = fin = hoy.toISOString().split('T')[0];
      }
    }
    
    console.log('🔍 Rango de fechas:', { inicio, fin });

    // Conectar a PostgreSQL
    client = new Client(DB_CONFIG);
    await client.connect();
    
    console.log('🔍 Conectado a PostgreSQL');

    // 🔥 PASO 1: Determinar campaña del usuario y construir filtro
    let userCampaignNormalized = getCampaignName(userCampaign);
    let filteredByUserCampaign = false;
    let appliedFilterDescription = null;
    
    // 🔥 CORRECCIÓN: Llamar a esCampanaVentas para determinar si es Team Leader de Ventas
    let esTeamLeaderVentas = esCampanaVentas(userCampaign);
    
    console.log('🔍 Análisis de campaña del usuario:', {
      userCampaign,
      userCampaignNormalized,
      esTeamLeaderVentas
    });

    // Determinar si el usuario debe ver eventos filtrados por su campaña
    if (userRole === 'Team Leader' || userRole === 'Agente' || userRole === 'Supervisor') {
      // Usuarios operativos solo ven eventos de su campaña
      console.log(`🎯 Usuario ${userRole} - Filtrando por su campaña asignada`);
      
      if (esTeamLeaderVentas) {
        // Team Leader de Ventas ve múltiples campañas
        userCampaignNormalized = 'Ventas Consolidado';
        appliedFilterDescription = 'Ventas (SAV, REFI, PL)';
      } else if (userCampaignNormalized) {
        appliedFilterDescription = userCampaignNormalized;
      }
      
      filteredByUserCampaign = true;
      
    } else if (userRole === 'TI' || userRole === 'Administrador') {
      // TI y Administradores ven todos los eventos
      console.log(`🎯 Usuario ${userRole} - Mostrando todos los eventos`);
      filteredByUserCampaign = false;
    } else {
      // Por defecto, otros roles ven solo su campaña
      console.log(`🎯 Usuario ${userRole} - Filtrando por campaña asignada`);
      filteredByUserCampaign = true;
      appliedFilterDescription = userCampaignNormalized;
    }
    
    console.log('🔍 Configuración de filtro:', {
      userCampaign,
      userCampaignNormalized,
      filteredByUserCampaign,
      appliedFilterDescription,
      esTeamLeaderVentas
    });

    // 🔥 CONSTRUIR QUERY BASE CON FILTRO POR CAMPAÑA DEL USUARIO
    let query = `
      SELECT 
        ep.documento as "empleadoId",
        COALESCE(uh.nombre, ep.nombre) as "nombre",
        ep.fecha,
        ep.hora_entrada as "horaEntrada",
        ep.hora_salida as "horaSalida",
        ep.hora_salida_almuerzo as "horaSalidaAlmuerzo",
        ep.hora_entrada_almuerzo as "horaEntradaAlmuerzo",
        ep.tipo_evento as "tipo",
        ep.subtipo_evento as "subtipo",
        ep.dispositivo_ip as "dispositivo",
        ep.imagen as "foto",
        COALESCE(uh.departamento, ep.campaña, 'Sin grupo') as "campañaRaw"
      FROM eventos_procesados ep
      LEFT JOIN usuarios_hikvision uh ON ep.documento = uh.employee_no
      WHERE ep.fecha >= $1 AND ep.fecha <= $2
    `;
    
    const queryParams: any[] = [inicio, fin];
    let paramCounter = 3; // Comenzar desde $3

    // 🔥 APLICAR FILTRO POR CAMPAÑA DEL USUARIO - VERSIÓN CORREGIDA
    if (filteredByUserCampaign) {
      console.log('🔍 Aplicando filtro por campaña del usuario');
      
      if (esTeamLeaderVentas) {
        // 🔥 Team Leader de Ventas: ver múltiples campañas (SAV, REFI, PL)
        console.log('🔍 Usuario es Team Leader de Ventas');
        
        // Usar la función que obtiene los departamentos para Team Leader de Ventas
        const ventasDepartments = obtenerDepartamentosTeamLeader(userCampaign);
        console.log('🔍 Departamentos para Team Leader Ventas:', ventasDepartments);
        
        if (ventasDepartments.length > 0) {
          // Construir condición OR para cada departamento
          const conditions: string[] = [];
          
          ventasDepartments.forEach((dept, idx) => {
            const paramIndex = queryParams.length + 1;
            // Buscar por departamento normalizado
            queryParams.push(`%${dept}%`);
            conditions.push(`uh.departamento ILIKE $${paramIndex}`);
            
            // También buscar por nombre de campaña en eventos_procesados
            const paramIndex2 = queryParams.length + 1;
            
            // Para ventas, también buscar por las variantes de código de ventas
            if (dept === 'Campana SAV') {
              queryParams.push(`%ventas%`);
              conditions.push(`ep.campaña ILIKE $${paramIndex2}`);
            } else {
              // Para REFI y PL, buscar directamente por el nombre
              queryParams.push(`%${dept.replace('Campana ', '')}%`);
              conditions.push(`ep.campaña ILIKE $${paramIndex2}`);
            }
          });
          
          if (conditions.length > 0) {
            query += ` AND (${conditions.join(' OR ')})`;
            console.log(`🔍 Filtro aplicado con ${conditions.length} condiciones para Ventas`);
          }
        }
        
      } else if (userCampaignNormalized) {
        // 🔥 Usuario normal: ver solo su campaña específica
        console.log(`🔍 Filtrando por campaña específica: ${userCampaignNormalized}`);
        
        // Usar la función que obtiene variantes para búsqueda en BD
        const campaignVariants = getCampaignVariantsForDB(userCampaign);
        console.log('🔍 Variantes de campaña para búsqueda:', campaignVariants);
        
        if (campaignVariants.length > 0) {
          // Construir condiciones OR para cada variante
          const conditions: string[] = [];
          
          campaignVariants.forEach((variant, idx) => {
            const paramIndex = queryParams.length + 1;
            queryParams.push(`%${variant}%`);
            conditions.push(`(ep.campaña ILIKE $${paramIndex} OR uh.departamento ILIKE $${paramIndex})`);
          });
          
          if (conditions.length > 0) {
            query += ` AND (${conditions.join(' OR ')})`;
            console.log(`🔍 Filtro aplicado con ${conditions.length} condiciones`);
          }
        }
      }
    } else {
      console.log('🔍 Sin filtro de campaña - Mostrando todos los eventos');
    }
    
    // Agregar ordenamiento
    query += ` ORDER BY ep.fecha DESC, ep.hora_entrada DESC`;
    
    console.log('🔍 Query SQL final:', query.replace(/\s+/g, ' '));
    console.log('🔍 Parámetros:', queryParams);

    // 🔥 EJECUTAR CONSULTA
    const result = await client.query(query, queryParams);
    
    console.log('🔍 Consulta ejecutada. Eventos encontrados:', result.rows.length);
    
    // 🔥 DEBUG: Mostrar distribución por campaña
    if (result.rows.length > 0) {
      const campaignCounts: Record<string, number> = {};
      result.rows.forEach(evento => {
        const campañaNormalizada = getCampaignName(evento.campañaRaw) || evento.campañaRaw;
        campaignCounts[campañaNormalizada] = (campaignCounts[campañaNormalizada] || 0) + 1;
      });
      
      console.log('📊 Distribución por campaña:', campaignCounts);
      
      // Mostrar algunos eventos de ejemplo
      if (result.rows.length > 0) {
        console.log('📋 Primeros 3 eventos:', 
          result.rows.slice(0, 3).map(e => ({ 
            empleadoId: e.empleadoId, 
            nombre: e.nombre,
            campañaRaw: e.campañaRaw,
            campañaNormalizada: getCampaignName(e.campañaRaw)
          }))
        );
      }
    }
    
    // 🔥 Formatear eventos con normalización de campaña
    const eventosFormateados = result.rows.map(evento => {
      const estadoInfo = determinarEstado(evento.subtipo, evento.fecha);
      const faltas = determinarFaltas(evento);
      const duracionAlmuerzo = calcularDuracionAlmuerzo(evento.horaSalidaAlmuerzo, evento.horaEntradaAlmuerzo);
      
      // Normalizar el nombre de la campaña
      const campañaNormalizada = getCampaignName(evento.campañaRaw) || evento.campañaRaw;
      
      return {
        empleadoId: evento.empleadoId || '',
        nombre: evento.nombre || 'Sin nombre',
        fecha: evento.fecha,
        horaEntrada: formatearHora(evento.horaEntrada),
        horaSalida: formatearHora(evento.horaSalida),
        horaSalidaAlmuerzo: formatearHora(evento.horaSalidaAlmuerzo),
        horaEntradaAlmuerzo: formatearHora(evento.horaEntradaAlmuerzo),
        duracionAlmuerzo: duracionAlmuerzo,
        tipo: evento.tipo || 'Asistencia',
        subtipo: evento.subtipo || 'Sin clasificar',
        estado: estadoInfo.estado,
        estadoColor: estadoInfo.color,
        estadoIcono: estadoInfo.icono,
        estadoDescripcion: evento.subtipo,
        faltas: faltas,
        tieneProblemas: estadoInfo.estado !== 'COMPLETO',
        necesitaRevision: estadoInfo.estado === 'ERROR' || estadoInfo.estado === 'INCOMPLETO',
        tieneAlmuerzoCompleto: !!evento.horaSalidaAlmuerzo && !!evento.horaEntradaAlmuerzo,
        dispositivo: evento.dispositivo || 'Desconocido',
        foto: evento.foto || '',
        campaña: campañaNormalizada,
        campañaOriginal: evento.campañaRaw
      };
    });
    
    // Calcular estadísticas eficientemente
    const conteoEstados = eventosFormateados.reduce((acc, evento) => {
      acc[evento.estado] = (acc[evento.estado] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const estadisticasAlmuerzos = eventosFormateados.reduce((acc, evento) => {
      if (evento.tieneAlmuerzoCompleto) acc.conAlmuerzoCompleto++;
      else if (!evento.horaSalidaAlmuerzo && !evento.horaEntradaAlmuerzo) acc.sinAlmuerzo++;
      else acc.almuerzoIncompleto++;
      return acc;
    }, { conAlmuerzoCompleto: 0, sinAlmuerzo: 0, almuerzoIncompleto: 0 });
    
    // Estadísticas por campaña
    const porCampaña = eventosFormateados.reduce((acc, evento) => {
      const camp = evento.campaña;
      if (!acc[camp]) {
        acc[camp] = { total: 0, completos: 0, pendientes: 0, incompletos: 0 };
      }
      acc[camp].total++;
      if (evento.estado === 'COMPLETO') acc[camp].completos++;
      else if (evento.estado === 'PENDIENTE') acc[camp].pendientes++;
      else if (evento.estado === 'INCOMPLETO') acc[camp].incompletos++;
      return acc;
    }, {} as Record<string, any>);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('✅ Consulta completada exitosamente:', {
      eventosEncontrados: result.rows.length,
      totalEventos: eventosFormateados.length,
      tiempoConsulta: `${duration}s`,
      filtroAplicado: appliedFilterDescription,
      userRole,
      userCampaign,
      userCampaignNormalized,
      esTeamLeaderVentas,
      campanasUnicas: Object.keys(porCampaña)
    });

    console.log('===== FIN DEPURACIÓN =====\n');
    
    // 🔥 AGREGAR METADATOS A LA RESPUESTA
    const responseData: any = {
      success: true,
      eventos: eventosFormateados,
      total: eventosFormateados.length,
      estadisticas: {
        porEstado: conteoEstados,
        almuerzos: estadisticasAlmuerzos,
        porCampaña: porCampaña,
        tiempoConsulta: parseFloat(duration)
      },
      rango: {
        tipo: rango,
        inicio,
        fin
      },
      metadata: {
        userRole: userRole,
        userCampaign: userCampaign,
        userCampaignNormalized: userCampaignNormalized,
        appliedFilter: appliedFilterDescription,
        esTeamLeaderVentas,
        filteredByUserCampaign: filteredByUserCampaign
      }
    };
    
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30'
      }
    });
    
  } catch (error: any) {
    console.error('❌ ===== ERROR EN /api/eventos/bd =====');
    console.error('❌ Mensaje:', error.message);
    console.error('❌ Stack:', error.stack);
    console.error('❌ ===== FIN ERROR =====\n');
    
    return NextResponse.json({
      success: false,
      error: process.env.NODE_ENV === 'production' 
        ? 'Error interno del servidor' 
        : error.message,
      eventos: [],
      total: 0
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store'
      }
    });
    
  } finally {
    if (client) {
      try {
        await client.end();
        if (process.env.NODE_ENV === 'development') {
          console.log('[API BD Eventos] Conexión cerrada');
        }
      } catch (error: any) {
        console.error('[API BD Eventos] Error cerrando conexión:', error.message);
      }
    }
  }
}


export const dynamic = 'force-dynamic';