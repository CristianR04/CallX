import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"

export async function POST(request: NextRequest) {
  console.log("📝 Iniciando proceso de registro...")
  
  try {
    const body = await request.json()
    const { documento, nombre, users, passward, fecha_registro, rol } = body

    console.log("📊 Datos recibidos:", { 
      documento, 
      nombre, 
      users, 
      passward: passward ? "***" : "null", 
      fecha_registro,
      rol 
    })

    // 1. VALIDACIONES BÁSICAS
    if (!documento || !nombre || !users || !passward) {
      console.log("❌ Campos faltantes")
      return NextResponse.json(
        { 
          error: "Todos los campos son requeridos: documento, nombre, usuario y contraseña" 
        },
        { status: 400 }
      )
    }

    // 2. VALIDAR ROL (TI o Administrador)
    const rolesPermitidos = ['TI', 'Administrador']
    const rolFinal = rol && rolesPermitidos.includes(rol) 
      ? rol 
      : 'TI' // Valor por defecto

    console.log("✅ Rol asignado:", rolFinal)

    const client = await pool.connect()
    
    try {
      // 3. VERIFICAR QUE LA TABLA 'auth' EXISTA
      console.log("🔍 Verificando tabla 'auth'...")
      
      const tableCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'auth'
      `)
      
      if (tableCheck.rows.length === 0) {
        console.log("❌ Tabla 'auth' no encontrada")
        return NextResponse.json(
          { 
            error: "La tabla 'auth' no existe. Contacta al administrador." 
          },
          { status: 500 }
        )
      }
      
      console.log("✅ Tabla 'auth' encontrada")

      // 4. VERIFICAR SI EL DOCUMENTO YA EXISTE
      const docExists = await client.query(
        "SELECT id FROM auth WHERE documento = $1",
        [documento.trim()]
      )

      if (docExists.rows.length > 0) {
        console.log("❌ Documento ya registrado:", documento)
        return NextResponse.json(
          { error: "Este documento ya está registrado en el sistema" },
          { status: 400 }
        )
      }

      // 5. VERIFICAR SI EL USUARIO YA EXISTE
      const userExists = await client.query(
        "SELECT id FROM auth WHERE users = $1",
        [users.trim()]
      )

      if (userExists.rows.length > 0) {
        console.log("❌ Usuario ya existe:", users)
        return NextResponse.json(
          { error: "Este nombre de usuario ya está registrado. Por favor elige otro." },
          { status: 400 }
        )
      }

      // 6. INSERTAR NUEVO USUARIO CON ROL
      console.log("💾 Insertando nuevo usuario en tabla 'auth'...")
      
      const insertQuery = `
        INSERT INTO auth (
          documento, 
          nombre, 
          users, 
          passward, 
          fecha_registro, 
          rol
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, documento, nombre, users, fecha_registro, rol
      `
      
      console.log("📝 Query:", insertQuery)
      
      const result = await client.query(
        insertQuery,
        [
          documento.trim(),
          nombre.trim(),
          users.trim(),
          passward, // Texto plano
          fecha_registro || new Date().toISOString().split('T')[0],
          rolFinal
        ]
      )

      const newUser = result.rows[0]
      console.log("✅ Usuario registrado exitosamente:", {
        id: newUser.id,
        usuario: newUser.users,
        rol: newUser.rol
      })

      return NextResponse.json(
        {
          success: true,
          message: `${rolFinal} registrado exitosamente`,
          user: {
            id: newUser.id,
            documento: newUser.documento,
            nombre: newUser.nombre,
            usuario: newUser.users,
            fecha_registro: newUser.fecha_registro,
            rol: newUser.rol
          }
        },
        { status: 201 }
      )

    } catch (dbError: any) {
      console.error("💥 Error en base de datos:", dbError)
      
      // Manejo de errores específicos de PostgreSQL
      if (dbError.code === '42703') { // Columna no existe
        console.log("⚠️ Error de columna. Verificando estructura de tabla...")
        
        try {
          // Obtener estructura real de la tabla
          const actualColumns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'auth'
            ORDER BY ordinal_position
          `)
          
          console.log("📋 Estructura real de tabla 'auth':", actualColumns.rows)
          
          return NextResponse.json(
            { 
              error: "Error en la estructura de la tabla 'auth'.",
              estructura: actualColumns.rows.map(c => `${c.column_name} (${c.data_type})`)
            },
            { status: 500 }
          )
        } catch (e) {
          return NextResponse.json(
            { error: "Error al verificar estructura de tabla" },
            { status: 500 }
          )
        }
      }
      
      if (dbError.code === '23505') { // Violación de unique constraint
        return NextResponse.json(
          { error: "El usuario o documento ya existe en el sistema" },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: `Error en base de datos: ${dbError.message}` },
        { status: 500 }
      )
      
    } finally {
      client.release()
      console.log("🔓 Conexión a BD liberada")
    }

  } catch (error: any) {
    console.error("❌ Error general en registro:", error)
    
    return NextResponse.json(
      { error: "Error interno del servidor. Intenta nuevamente." },
      { status: 500 }
    )
  }
}

// Método GET para verificar la tabla (opcional)
export async function GET() {
  try {
    const client = await pool.connect()
    
    try {
      // Verificar estructura de la tabla 'auth'
      const tableStructure = await client.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_name = 'auth'
        ORDER BY ordinal_position
      `)
      
      // Verificar si hay usuarios
      const usersCount = await client.query(`
        SELECT COUNT(*) as total FROM auth
      `)
      
      return NextResponse.json({
        success: true,
        table: 'auth',
        estructura: tableStructure.rows,
        totalUsuarios: usersCount.rows[0].total,
        mensaje: "API de registro funcionando correctamente"
      })
      
    } finally {
      client.release()
    }
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      message: "No se pudo conectar a la base de datos."
    }, { status: 500 })
  }
}