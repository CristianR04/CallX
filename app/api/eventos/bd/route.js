import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db/eventos/database';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rango = searchParams.get('rango') || 'hoy';
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');

    console.log('📊 Consultando eventos desde BD - Rango:', rango);

    const eventos = await DatabaseService.obtenerEventosDesdeBD({
      rango,
      fechaInicio,
      fechaFin
    });

    return NextResponse.json({
      success: true,
      eventos: eventos,
      total: eventos.length
    });

  } catch (error) {
    console.error('❌ Error consultando BD:', error);
    return NextResponse.json(
      { success: false, error: 'Error consultando eventos' },
      { status: 500 }
    );
  }
}