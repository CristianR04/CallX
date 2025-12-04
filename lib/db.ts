import { Pool } from 'pg'

// Configuración específica para tu base Hikvision
export const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hikvision_events',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'OnePiece00.',
  // Para desarrollo local, SSL generalmente no es necesario
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// Verificar conexión al iniciar
export async function testConnection() {
  try {
    const client = await pool.connect()
    console.log('✅ Conexión a PostgreSQL establecida')
    client.release()
    return true
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error)
    return false
  }
}

// Función helper para queries
export async function query(text: string, params?: any[]) {
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return result
  } catch (error) {
    console.error('Error en query:', error)
    throw error
  } finally {
    client.release()
  }
}