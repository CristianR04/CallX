import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { pool } from '@/lib/db'
// NO necesitas bcrypt para texto plano

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        usuario: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        console.log('🔐 Login attempt for:', credentials?.usuario)
        
        if (!credentials?.usuario || !credentials?.password) {
          console.log('❌ Missing credentials')
          throw new Error('Usuario y contraseña son requeridos')
        }

        const client = await pool.connect()
        try {
          const result = await client.query(
            `SELECT * FROM auth WHERE users = $1`, 
            [credentials.usuario.trim()]
          )
          
          console.log('📊 Query result:', {
            rowsFound: result.rows.length,
            tableUsed: 'users',
            userSearched: credentials.usuario
          })
          
          if (result.rows.length === 0) {
            console.log('❌ User not found in table "users"')
            throw new Error('Usuario no encontrado')
          }
          
          const user = result.rows[0]
          console.log('👤 User found:', {
            id: user.id,
            nombre: user.nombre,
            users: user.users,
            passwardPreview: user.passward ? `${user.passward.substring(0, 15)}...` : 'null'
          })
          
          // COMPARACIÓN EN TEXTO PLANO
          const enteredPassword = credentials.password
          const storedPassword = user.passward
          
          console.log('🔑 Password comparison:', {
            entered: enteredPassword,
            stored: storedPassword,
            match: enteredPassword === storedPassword
          })
          
          // Comparación directa (texto plano)
          if (enteredPassword !== storedPassword) {
            console.log('❌ Password mismatch')
            throw new Error('Contraseña incorrecta')
          }
          
          console.log('✅ Login successful!')
          
          // Retornar datos del usuario para la sesión
          return {
            id: user.id?.toString() || user.documento || '1',
            documento: user.documento,
            nombre: user.nombre || 'Usuario',
            username: user.users || credentials.usuario,
            role: user.rol || 'usuario',
            email: user.email || `${credentials.usuario}@calix.com`
          }
          
        } catch (error: any) {
          console.error('💥 Auth error:', error.message)
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
  },
  
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 horas
  },
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.documento = user.documento
        token.nombre = user.nombre
        token.username = user.username
        token.role = user.role
        token.email = user.email
      }
      return token
    },
    
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.documento = token.documento as string
        session.user.nombre = token.nombre as string
        session.user.username = token.username as string
        session.user.role = token.role as string
        session.user.email = token.email as string
      }
      return session
    }
  },
  
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development', // Activar debug en desarrollo
}