'use server'

import { pool } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { sendPasswordResetEmail } from '@/lib/utils/email'

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get('email') as string
  
  const client = await pool.connect()
  
  try {
    const result = await client.query(
      'SELECT id, nombre FROM usuarios WHERE email = $1',
      [email]
    )
    
    if (result.rows.length === 0) {
      // Por seguridad, no revelamos si el email existe o no
      return { 
        success: true, 
        message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.' 
      }
    }
    
    const user = result.rows[0]
    const resetToken = uuidv4()
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hora
    
    await client.query(
      'UPDATE usuarios SET reset_token = $1, reset_token_expira = $2 WHERE id = $3',
      [resetToken, resetTokenExpires, user.id]
    )
    
    // Enviar email
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`
    await sendPasswordResetEmail(email, resetUrl, user.nombre)
    
    return { 
      success: true, 
      message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.' 
    }
  } catch (error) {
    console.error('Error en solicitud de restablecimiento:', error)
    return { 
      success: false, 
      message: 'Error al procesar la solicitud. Intenta nuevamente.' 
    }
  } finally {
    client.release()
  }
}