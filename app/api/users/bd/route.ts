import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// 🔥 Mapeo CORREGIDO: Códigos de campaña → Nombres visuales de departamento
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
  // 🔥 CAMPAÑA DE VENTAS (múltiples variaciones)
  'campana_ventas': 'Campana SAV',
  'campaña_ventas': 'Campana SAV',
  'campana_ventas_casa': 'Campana SAV',
  'campaña_ventas_casa': 'Campana SAV',
  'ventas': 'Campana SAV',
  'sales': 'Campana SAV',
  // Variaciones con mayúsculas
  'CAMPANA_5757': 'Campana 5757',
  'CAMPANA_SAV': 'Campana SAV',
  'CAMPANA_REFI': 'Campana REFI',
  'CAMPANA_PL': 'Campana PL',
  'CAMPANA_PARLO': 'Campana PARLO',
  'CAMPANA_VENTAS': 'Campana SAV',
  'CAMPAÑA_VENTAS': 'Campana SAV',
  'TI': 'TI',
  'TEAMS_LEADERS': 'Teams Leaders',
  'ADMINISTRATIVO': 'Administrativo'
};

// 🔥 Función helper para normalizar códigos de campaña
function getCampaignName(campanaCode: string | null | undefined): string | null {
  if (!campanaCode) return null;
  
  const normalized = campanaCode
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  const key = Object.keys(CAMPAIGNS_MAP).find(k => 
    k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalized
  );
  
  return key ? CAMPAIGNS_MAP[key] : null;
}

// 🔥 Mapeo inverso: Nombres visuales → Códigos de campaña
const CAMPAIGNS_REVERSE_MAP: Record<string, string> = {};
Object.entries(CAMPAIGNS_MAP).forEach(([code, name]) => {
  CAMPAIGNS_REVERSE_MAP[name] = code;
});

// 🔥 Función para detectar si es campaña de ventas (servidor)
function esCampanaVentasServidor(campana: string | null): boolean {
  if (!campana) return false;
  
  const normalized = campana
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  const ventasVariants = [
    'campaña_ventas',
    'campana_ventas',
    'campaña_ventas_casa',
    'campana_ventas_casa',
    'ventas',
    'sales',
    'ventas_consolidado'
  ];
  
  return ventasVariants.includes(normalized);
}

// 🔥 Función para obtener departamentos de Team Leader (servidor)
function obtenerDepartamentosTeamLeaderServidor(campana: string | null): string[] {
  if (!campana) return [];
  
  if (esCampanaVentasServidor(campana)) {
    return ['Campana SAV', 'Campana REFI', 'Campana PL'];
  }
  
  const department = getCampaignName(campana);
  return department ? [department] : [];
}

export async function GET(request: NextRequest) {
  console.log('🔍 ===== INICIO DE DEPURACIÓN /api/users/bd =====');
  
  try {
    console.log('📥 1. Iniciando consulta con filtros de usuario');
    
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.log('❌ 3. No hay sesión de usuario');
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const user = session.user as any;
    console.log('🔍 4. Usuario de sesión:', {
      id: user.id,
      nombre: user.nombre,
      role: user.role,
      campana: user.campana,
      username: user.username
    });

    const { role, campana } = user;
    
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get('limit') || '1000');
    const page = parseInt(searchParams.get('page') || '1');
    const departmentFilter = searchParams.get('department');
    const offset = (page - 1) * limit;

    console.log('🔍 5. Parámetros de consulta:', {
      limit,
      page,
      departmentFilter,
      userRole: role,
      userCampaignCode: campana
    });

    // 🔥 PASO 1: Determinar departamentos a filtrar
    let userDepartments: string[] = [];
    let appliedFilterDescription = null;
    let esTeamLeaderVentas = false;

    if (role === 'Team Leader') {
      console.log('🎯 6. Usuario es Team Leader');
      
      esTeamLeaderVentas = esCampanaVentasServidor(campana);
      console.log('🔍 7. ¿Es Team Leader de Ventas?', {
        esTeamLeaderVentas,
        campanaOriginal: campana
      });
      
      if (esTeamLeaderVentas) {
        userDepartments = ['Campana SAV', 'Campana REFI', 'Campana PL'];
        appliedFilterDescription = 'Ventas (SAV, REFI, PL)';
        console.log('🚀 8. Team Leader de Ventas viendo 3 departamentos:', userDepartments);
      } else {
        const singleDepartment = getCampaignName(campana);
        if (singleDepartment) {
          userDepartments = [singleDepartment];
          appliedFilterDescription = singleDepartment;
          console.log(`🔍 8. Team Leader individual viendo: ${singleDepartment}`);
        }
      }
      
      if (userDepartments.length === 0) {
        console.log('⚠️ 9. Team Leader sin departamento asignado.');
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          metadata: {
            warning: 'Team Leader sin departamento asignado',
            userRole: role
          }
        });
      }
    } 
    else if (role === 'TI' || role === 'Administrador') {
      console.log(`🎯 6. Usuario es ${role}`);
      
      if (departmentFilter) {
        userDepartments = [departmentFilter];
        appliedFilterDescription = departmentFilter;
        console.log(`🔍 7. [${role}] Aplicando filtro: ${departmentFilter}`);
      } else {
        console.log(`🔍 7. [${role}] Sin filtro - mostrando todos los departamentos`);
      }
    }
    else {
      console.log('⚠️ 6. Usuario sin rol válido para ver usuarios');
      return NextResponse.json({
        success: true,
        data: [],
        metadata: {
          warning: 'Usuario sin permisos para ver usuarios',
          userRole: role
        }
      });
    }

    // 🔥 PASO 2: Consultar qué departamentos existen en la BD
    console.log('🔍 10. Consultando departamentos únicos en la BD...');
    const deptCheckQuery = `SELECT DISTINCT departamento FROM usuarios_hikvision WHERE departamento IS NOT NULL ORDER BY departamento`;
    const deptCheckResult = await pool.query(deptCheckQuery);
    const existingDepartments = deptCheckResult.rows.map(r => r.departamento);
    console.log('📊 Departamentos encontrados en BD:', existingDepartments);

    // 🔥 PASO 3: Construir query SQL principal - CORREGIDO
    let query = `
      SELECT 
        id, 
        employee_no as "employeeNo",
        nombre, 
        genero,
        departamento, 
        foto_path as "fotoPath",
        tipo_usuario as "tipoUsuario",
        fecha_creacion as "createdAt",
        fecha_modificacion as "updatedAt",
        estado
      FROM usuarios_hikvision
      WHERE 1=1
    `;
    
    let queryParams: any[] = [];
    let paramIndex = 1;

    // 🔥 APLICAR FILTRO POR DEPARTAMENTO(S)
    if (userDepartments.length > 0) {
      const validDepartments = userDepartments.filter(dept => 
        existingDepartments.some(existing => 
          existing.toLowerCase() === dept.toLowerCase()
        )
      );
      
      if (validDepartments.length === 0) {
        console.log('⚠️ 11. Ninguno de los departamentos solicitados existe en la BD');
      } else {
        console.log('✅ 11. Departamentos válidos encontrados:', validDepartments);
      }
      
      const departmentsToUse = validDepartments.length > 0 ? validDepartments : userDepartments;
      
      if (departmentsToUse.length === 1) {
        query += ` AND departamento ILIKE $${paramIndex}`;
        queryParams.push(departmentsToUse[0]);
        paramIndex++;
        console.log(`🔍 12. Filtro ILIKE aplicado: ${departmentsToUse[0]}`);
      } else {
        const conditions = departmentsToUse.map((dept, idx) => {
          queryParams.push(dept);
          return `departamento ILIKE $${paramIndex + idx}`;
        });
        
        query += ` AND (${conditions.join(' OR ')})`;
        paramIndex += departmentsToUse.length;
        console.log(`🔍 12. Filtro MULTIPLE aplicado para ${departmentsToUse.length} departamentos:`, departmentsToUse);
      }
    }

    // 🔥 ORDENAMIENTO - CORREGIDO (sin ILIKE en CASE)
    if (userDepartments.length === 1) {
      query += ` 
        ORDER BY 
          fecha_creacion DESC,
          id ASC
      `;
      console.log('🔍 13. Orden: fecha_creacion DESC, id ASC (filtro único)');
    } else if (userDepartments.length > 1) {
      // Para múltiples departamentos, usar CASE con valores exactos
      query += ` 
        ORDER BY 
          CASE 
            ${userDepartments.map((dept, idx) => 
              `WHEN LOWER(departamento) = LOWER('${dept.replace(/'/g, "''")}') THEN ${idx}`
            ).join(' ')}
            ELSE 999
          END,
          fecha_creacion DESC,
          id ASC
      `;
      console.log('🔍 13. Orden: CASE con múltiples departamentos, fecha_creacion DESC, id ASC');
    } else {
      query += ` 
        ORDER BY 
          LOWER(departamento) ASC,
          fecha_creacion DESC,
          id ASC
      `;
      console.log('🔍 13. Orden: departamento ASC, fecha_creacion DESC, id ASC');
    }
    
    // 🔥 PAGINACIÓN
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    console.log('🔍 14. Query SQL final:', query.replace(/\s+/g, ' '));
    console.log('🔍 15. Parámetros:', queryParams);

    // 🔥 PASO 4: Ejecutar consulta
    console.log('🔍 16. Ejecutando consulta en la base de datos...');
    const result = await pool.query(query, queryParams);
    
    console.log('🔍 17. Consulta ejecutada. Filas encontradas:', result.rows.length);
    
    // 🔥 DEBUG: Mostrar distribución por departamento
    if (result.rows.length > 0) {
      const deptCounts: Record<string, number> = {};
      result.rows.forEach(user => {
        const dept = user.departamento || 'Sin departamento';
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      });
      
      console.log('📊 Distribución por departamento:', deptCounts);
      console.log('📋 Primeros 3 usuarios:', 
        result.rows.slice(0, 3).map(u => ({ 
          nombre: u.nombre, 
          departamento: u.departamento,
          tipo: u.tipoUsuario
        }))
      );
    }
    
    // 🔥 PASO 5: Mapear resultados
    const usuariosFormateados = result.rows.map(usuario => {
      let campanaCode = null;
      if (usuario.departamento) {
        campanaCode = CAMPAIGNS_REVERSE_MAP[usuario.departamento] || null;
      }
      
      return {
        ...usuario,
        numeroEmpleado: usuario.employeeNo,
        rol: usuario.tipoUsuario,
        campana: campanaCode,
        departamento: usuario.departamento || 'No asignado'
      };
    });
    
    // 🔥 PASO 6: Consulta de TOTAL
    let countQuery = `SELECT COUNT(*) as total FROM usuarios_hikvision WHERE 1=1`;
    let countParams: any[] = [];

    if (userDepartments.length > 0) {
      const departmentsToUse = userDepartments.filter(dept => 
        existingDepartments.some(existing => 
          existing.toLowerCase() === dept.toLowerCase()
        )
      ).length > 0 ? userDepartments.filter(dept => 
        existingDepartments.some(existing => 
          existing.toLowerCase() === dept.toLowerCase()
        )
      ) : userDepartments;
      
      if (departmentsToUse.length === 1) {
        countQuery += ` AND departamento ILIKE $1`;
        countParams.push(departmentsToUse[0]);
      } else if (departmentsToUse.length > 1) {
        const conditions = departmentsToUse.map((dept, idx) => {
          countParams.push(dept);
          return `departamento ILIKE $${idx + 1}`;
        });
        countQuery += ` AND (${conditions.join(' OR ')})`;
      }
    }

    console.log('🔍 18. Count query:', countQuery);
    console.log('🔍 19. Count params:', countParams);

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    console.log('✅ 20. Consulta completada exitosamente:', {
      usuariosEncontrados: result.rows.length,
      totalUsuarios: total,
      filtroAplicado: appliedFilterDescription,
      userRole: role,
      userCampaign: campana,
      userDepartments,
      esTeamLeaderVentas,
      paginaActual: page,
      totalPaginas: Math.ceil(total / limit),
      existingDepartments: existingDepartments.length
    });

    console.log('===== FIN DEPURACIÓN =====\n');

    return NextResponse.json({
      success: true,
      data: usuariosFormateados,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      metadata: {
        userRole: role,
        userCampaign: campana,
        userDepartments,
        appliedFilter: appliedFilterDescription,
        esTeamLeaderVentas,
        totalDepartmentsInDb: existingDepartments.length,
        note: esTeamLeaderVentas ? 
          'Team Leader de Ventas viendo SAV, REFI y PL' : 
          (userDepartments.length > 1 ? 'Viendo múltiples departamentos' : 'Viendo un solo departamento')
      }
    });

  } catch (error: any) {
    console.error('❌ ===== ERROR EN /api/users/bd =====');
    console.error('❌ Mensaje:', error.message);
    console.error('❌ Stack:', error.stack);
    console.error('❌ ===== FIN ERROR =====\n');
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}