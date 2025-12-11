import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { pool } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        usuario: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        console.log('🔐 ===== INICIO AUTENTICACIÓN =====')
        console.log('📤 Credenciales recibidas:', {
          usuario: credentials?.usuario,
          passwordLength: credentials?.password?.length
        })
        
        if (!credentials?.usuario || !credentials?.password) {
          console.log('❌ Faltan credenciales')
          throw new Error('Usuario y contraseña son requeridos')
        }

        const client = await pool.connect()
        try {
          console.log('📊 Ejecutando consulta en tabla "auth"...')
          
          // 🔥 CORREGIDO: Verificar que la consulta está obteniendo el campo correcto
          const result = await client.query(
            `SELECT id, documento, nombre, rol, users, passward, campaña FROM auth WHERE users = $1`, 
            [credentials.usuario.trim()]
          )
          
          console.log('📈 Resultado de consulta:', {
            rowsFound: result.rows.length,
            usuarioBuscado: credentials.usuario,
            // 🔥 Verificar que la columna 'campaña' existe y tiene valor
            primeraFila: result.rows[0] ? {
              users: result.rows[0].users,
              nombre: result.rows[0].nombre,
              rol: result.rows[0].rol,
              campaña: result.rows[0].campaña // Este es el campo REAL de la BD
            } : null
          })
          
          if (result.rows.length === 0) {
            console.log('❌ Usuario no encontrado en tabla "auth"')
            throw new Error('Usuario no encontrado')
          }
          
          const user = result.rows[0]
          console.log('👤 Datos del usuario encontrado en BD:', {
            id: user.id,
            nombre: user.nombre,
            rol: user.rol,
            // 🔥 IMPORTANTE: Aquí se usa 'campaña' (con ñ) porque es el nombre real en la BD
            campaña_BD: user.campaña,
            // Verificar si es null, vacío o tiene valor
            tieneCampaña: !!user.campaña,
            tipoCampaña: typeof user.campaña,
            valorCampaña: user.campaña || 'NULL o VACÍO'
          })
                    
          if (credentials.password !== user.passward) {
            throw new Error('Contraseña incorrecta')
          }
          
          console.log('✅ ¡CONTRASEÑA VÁLIDA! Login exitoso')
          
          // 🔥 CORREGIDO CRÍTICO: Asegurar que el objeto user tenga el campo 'campana' (sin ñ)
          // pero el valor viene de 'campaña' (con ñ) de la BD
          const authUser = {
            id: user.id.toString(),
            documento: user.documento,
            nombre: user.nombre,
            username: user.users,
            role: user.rol,
            // 🔥 Aquí está la clave: mapear 'campaña' (BD) a 'campana' (NextAuth)
            campana: user.campaña || null, // 'campaña' viene de la BD
            email: `${user.users}@calix.com`
          }
          
          console.log('✅ Usuario para NextAuth (mapeado):', {
            ...authUser,
            nota: "campana viene de campaña (BD)"
          })
          console.log('===== FIN AUTENTICACIÓN =====\n')
          
          return authUser
          
        } catch (error: any) {
          console.error('❌ Error en authorize:', error)
          throw new Error(error.message || 'Error de autenticación')
        } finally {
          client.release()
        }
      }
    })
  ],
  
  pages: {
    signIn: '/login',
    error: '/auth/error',
    newUser: '/register'
  },
  
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  
  jwt: {
    maxAge: 8 * 60 * 60,
  },
  
  callbacks: {
    async jwt({ token, user }) {      
      console.log('🔄 JWT Callback - Inicio:', {
        tieneUser: !!user,
        userData: user ? {
          id: (user as any).id,
          role: (user as any).role,
          campana: (user as any).campana // Esto debe venir de authorize
        } : null,
        tokenInicial: token
      })
      
      if (user) {
        // 🔥 CORREGIDO: Asegurar que todos los campos se pasan al token
        token.id = (user as any).id
        token.documento = (user as any).documento
        token.nombre = (user as any).nombre
        token.username = (user as any).username
        token.role = (user as any).role
        
        // 🔥 ESTO ES CRÍTICO: 'campana' debe venir del user (que viene de authorize)
        token.campana = (user as any).campana || null
        token.email = (user as any).email
        
        console.log('🔄 JWT Callback - Token actualizado:', {
          id: token.id,
          role: token.role,
          campana: token.campana, // Esto NO debe ser null
          nombre: token.nombre
        })
      } else {
        console.log('🔄 JWT Callback - No hay user, manteniendo token existente')
      }
      
      return token
    },
    
    async session({ session, token }) {
      console.log('🔄 Session Callback - Token recibido:', {
        id: token.id,
        role: token.role,
        campana: token.campana, // 🔥 Esto debe tener valor
        nombre: token.nombre,
        tieneCampana: !!(token.campana),
        valorCampana: token.campana || 'NULL'
      })
      
      if (session.user) {
        const extendedUser = session.user as any
        extendedUser.id = token.id
        extendedUser.documento = token.documento
        extendedUser.nombre = token.nombre
        extendedUser.username = token.username
        extendedUser.role = token.role
        
        // 🔥 CORREGIDO: Pasar campana del token a la sesión
        extendedUser.campana = token.campana || null
        extendedUser.email = token.email
        
        console.log('🔄 Session Callback - User extendido:', {
          id: extendedUser.id,
          nombre: extendedUser.nombre,
          role: extendedUser.role,
          campana: extendedUser.campana, // 🔥 Esto debe tener valor
          tieneCampana: !!(extendedUser.campana)
        })
      }
      
      console.log('🔄 Session final completa:', session.user)
      console.log('===== FIN SESSION CALLBACK =====\n')
      return session
    }
  },
  
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}