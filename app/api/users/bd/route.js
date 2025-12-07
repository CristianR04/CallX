import { query, getClient } from '@/lib/db/usuarios/database';
import { NextResponse } from 'next/server';
import { syncUsersFromHikvision, createSyncLog, getStats } from '@/lib/db/usuarios/sync-utils/route';

// Obtener usuarios con paginación
export async function getUsersFromDatabase(filters = {}) {
    const {
        departamento = null,
        estado = null,
        search = null,
        page = 1,
        limit = 200
    } = filters;

    const offset = (page - 1) * limit;

    let queryText = `
    SELECT 
      id,
      employee_no as "employeeNo",
      nombre,
      tipo_usuario as "tipoUsuario",
      estado,
      departamento,
      genero,
      foto_path as "fotoPath"
    FROM usuarios_hikvision
    WHERE 1=1
  `;

    const whereConditions = [];
    const queryParams = [];

    if (departamento) {
        whereConditions.push(`departamento = $${whereConditions.length + 1}`);
        queryParams.push(departamento);
    }

    if (estado) {
        whereConditions.push(`estado = $${whereConditions.length + 1}`);
        queryParams.push(estado);
    }

    if (search) {
        whereConditions.push(`(
      nombre ILIKE $${whereConditions.length + 1} OR 
      employee_no ILIKE $${whereConditions.length + 1} OR
      departamento ILIKE $${whereConditions.length + 1}
    )`);
        queryParams.push(`%${search}%`);
    }

    if (whereConditions.length > 0) {
        queryText += ` AND ${whereConditions.join(' AND ')}`;
    }

    queryText += ` ORDER BY id DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    try {
        const usersResult = await query(queryText, queryParams);

        // Contar total
        let countQuery = `SELECT COUNT(*) as total FROM usuarios_hikvision WHERE 1=1`;
        if (whereConditions.length > 0) {
            countQuery += ` AND ${whereConditions.join(' AND ')}`;
        }

        const countResult = await query(countQuery, queryParams.slice(0, -2));
        const total = parseInt(countResult.rows[0]?.total || 0);

        return {
            usuarios: usersResult.rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };

    } catch (error) {
        console.error('❌ Error en getUsersFromDatabase:', error.message);
        throw error;
    }
}

// Verificar conexión a la tabla
export async function checkTable() {
    try {
        const result = await query(`
            SELECT COUNT(*) as count FROM usuarios_hikvision
        `);
        return { exists: true, count: result.rows[0].count };
    } catch (error) {
        return { exists: false, error: error.message };
    }
}

// ENDPOINT GET
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'stats') {
            const stats = await getStats();
            return NextResponse.json({
                success: true,
                data: stats
            });
        }

        if (action === 'check-table') {
            const tableInfo = await checkTable();
            return NextResponse.json({
                success: true,
                table: tableInfo
            });
        }

        if (action === 'clear-test') {
            await query("DELETE FROM usuarios_hikvision WHERE employee_no LIKE 'TEST%'");
            return NextResponse.json({
                success: true,
                message: "Usuarios de prueba eliminados"
            });
        }

        // Obtener usuarios con filtros (acción por defecto)
        const filters = {
            departamento: searchParams.get('departamento'),
            estado: searchParams.get('estado'),
            search: searchParams.get('search'),
            page: parseInt(searchParams.get('page') || '1'),
            limit: parseInt(searchParams.get('limit') || '50')
        };

        const result = await getUsersFromDatabase(filters);

        return NextResponse.json({
            success: true,
            data: result.usuarios,
            pagination: result.pagination,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error en GET /api/users/bd:', error.message);

        return NextResponse.json(
            {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}

// ENDPOINT POST para sincronizar
export async function POST(request) {
    try {
        const body = await request.json();
        const { users, action } = body;

        if (action === 'sync' && Array.isArray(users)) {
            if (users.length === 0) {
                return NextResponse.json({
                    success: false,
                    error: "Array de usuarios vacío"
                }, { status: 400 });
            }

            const syncStart = Date.now();
            const result = await syncUsersFromHikvision(users);
            const syncDuration = Date.now() - syncStart;

            // Crear log
            const logId = await createSyncLog({
                totalDevices: 1,
                successfulDevices: 1,
                devicesWithErrors: 0,
                totalUsers: users.length,
                newUsers: result.created,
                updatedUsers: result.updated,
                durationMs: syncDuration,
                status: 'completed'
            });

            return NextResponse.json({
                success: true,
                message: "Sincronización completada",
                result: {
                    ...result,
                    logId: logId,
                    durationMs: syncDuration
                },
                timestamp: new Date().toISOString()
            });
        }

        return NextResponse.json(
            {
                success: false,
                error: "Acción no válida"
            },
            { status: 400 }
        );

    } catch (error) {
        console.error('❌ Error en POST /api/users/bd:', error.message);

        try {
            await createSyncLog({
                totalDevices: 0,
                successfulDevices: 0,
                devicesWithErrors: 1,
                totalUsers: 0,
                newUsers: 0,
                updatedUsers: 0,
                durationMs: 0,
                status: 'error',
                error_message: error.message
            });
        } catch (logError) {
            console.error('Error creando log de error:', logError);
        }

        return NextResponse.json(
            {
                success: false,
                error: error.message
            },
            { status: 500 }
        );
    }
}