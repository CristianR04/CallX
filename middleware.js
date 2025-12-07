import { NextResponse } from 'next/server';

// Almacena el último timestamp de sincronización
let lastSyncTime = 0;
const SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas

export async function middleware(request) {
  const response = NextResponse.next();
  
  // Solo sincronizar en rutas específicas
  if (request.nextUrl.pathname.startsWith('/users')) {
    const now = Date.now();
    
    // Si pasó más de 24 horas desde la última sincronización
    if (now - lastSyncTime > SYNC_INTERVAL) {
      try {
        // Ejecutar sincronización en segundo plano (no bloquear al usuario)
        fetch(`${request.nextUrl.origin}/api/users/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sync_now', test_mode: false }),
          // No esperar respuesta para no bloquear
          signal: AbortSignal.timeout(5000)
        }).catch(error => {
          console.error('Error en sincronización automática:', error);
        });
        
        lastSyncTime = now;
        console.log('🔄 Sincronización automática iniciada');
      } catch (error) {
        console.error('Error al iniciar sincronización:', error);
      }
    }
  }
  
  return response;
}

export const config = {
  matcher: ['/users/:path*']
};