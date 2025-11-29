import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

export class DatabaseService {
  static normalizarHoraDefinitiva(horaString) {
    if (!horaString) return null;

    console.log('🕒 Normalizando hora:', horaString);

    try {
      // CASO 1: Si ya está en formato TIME (HH:MM:SS), retornar tal cual
      if (horaString.match(/^\d{2}:\d{2}:\d{2}$/)) {
        return horaString;
      }

      // CASO 2: Si es formato ISO completo (2025-11-29T05:00:06-05:00)
      if (horaString.includes('T')) {
        try {
          const fecha = new Date(horaString);
          if (!isNaN(fecha.getTime())) {
            // Extraer horas, minutos y segundos REALES
            const horas = fecha.getHours().toString().padStart(2, '0');
            const minutos = fecha.getMinutes().toString().padStart(2, '0');
            const segundos = fecha.getSeconds().toString().padStart(2, '0');
            const resultado = `${horas}:${minutos}:${segundos}`;
            console.log('✅ Hora extraída de ISO:', horaString, '→', resultado);
            return resultado;
          }
        } catch (error) {
          console.log('❌ Error parseando fecha ISO:', error.message);
        }
      }

      // CASO 3: Formato con "a. m." o "p. m." (05:00 a. m.)
      const tieneAM = horaString.toLowerCase().includes('a');
      const tienePM = horaString.toLowerCase().includes('p');

      // Extraer números usando regex - buscar también segundos
      const numeros = horaString.match(/\d+/g);

      if (numeros && numeros.length >= 2) {
        let horas = parseInt(numeros[0]);
        const minutos = numeros[1].padStart(2, '0');
        // Si hay segundos, usarlos; si no, usar "00"
        const segundos = numeros[2] ? numeros[2].padStart(2, '0') : '00';

        // Convertir AM/PM a 24h
        if (tienePM && horas < 12) {
          horas += 12;
        } else if (tieneAM && horas === 12) {
          horas = 0;
        }

        const resultado = `${horas.toString().padStart(2, '0')}:${minutos}:${segundos}`;
        console.log('✅ Hora convertida AM/PM:', horaString, '→', resultado);
        return resultado;
      }

      // CASO 4: Si es solo hora simple (05:00 o 05:00:15)
      if (horaString.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
        const partes = horaString.split(':');
        if (partes.length === 2) {
          // Solo tiene horas y minutos, agregar segundos
          return `${horaString}:00`;
        } else if (partes.length === 3) {
          // Ya tiene segundos, retornar tal cual
          return horaString;
        }
      }

      console.log('❌ Formato no reconocido:', horaString);
      return null;

    } catch (error) {
      console.error('❌ Error crítico normalizando hora:', error.message);
      return null;
    }
  }

  static async guardarEventosAutomatico(eventos) {
    if (eventos.length === 0) {
      console.log('📝 No hay eventos para guardar');
      return { guardados: 0, duplicados: 0 };
    }

    console.log('📝 Recibiendo', eventos.length, 'eventos para guardar');

    const client = await pool.connect();
    let nuevos = 0;
    let actualizados = 0;
    let errores = 0;

    try {
      await client.query('BEGIN');

      for (const evento of eventos) {
        try {
          // Validar datos mínimos requeridos
          if (!evento.documento || !evento.fecha) {
            console.log('⚠️ Evento omitido - falta documento o fecha:', evento);
            errores++;
            continue;
          }

          const horaEntradaNormalizada = this.normalizarHoraDefinitiva(evento.hora_entrada);
          const horaSalidaNormalizada = this.normalizarHoraDefinitiva(evento.hora_salida);

          console.log('🕒 Procesando evento:', evento.documento, {
            entrada_original: evento.hora_entrada,
            entrada_normalizada: horaEntradaNormalizada,
            salida_original: evento.hora_salida,
            salida_normalizada: horaSalidaNormalizada
          });

          // Verificar si existe registro
          const verificarQuery = `
          SELECT id, hora_entrada, hora_salida 
          FROM eventos_acceso 
          WHERE documento = $1 AND fecha = $2
        `;

          const existe = await client.query(verificarQuery, [evento.documento, evento.fecha]);

          if (existe.rows.length > 0) {
            // REGISTRO EXISTENTE
            const registro = existe.rows[0];

            const necesitaEntrada = !registro.hora_entrada && horaEntradaNormalizada;
            const necesitaSalida = !registro.hora_salida && horaSalidaNormalizada;

            if (necesitaEntrada || necesitaSalida) {
              let updateQuery = '';
              let params = [];

              if (necesitaEntrada && necesitaSalida) {
                updateQuery = `
                UPDATE eventos_acceso SET
                  hora_entrada = $1,
                  hora_salida = $2,
                  tipo_evento = 'Entrada/Salida',
                  dispositivo_ip = $3,
                  nombre = COALESCE($4, nombre)
                WHERE documento = $5 AND fecha = $6
              `;
                params = [
                  horaEntradaNormalizada,
                  horaSalidaNormalizada,
                  evento.dispositivo_ip,
                  evento.nombre,
                  evento.documento,
                  evento.fecha
                ];
              } else if (necesitaEntrada) {
                const nuevoTipo = registro.hora_salida ? 'Entrada/Salida' : 'Solo Entrada';
                updateQuery = `
                UPDATE eventos_acceso SET
                  hora_entrada = $1,
                  tipo_evento = $2,
                  dispositivo_ip = $3,
                  nombre = COALESCE($4, nombre)
                WHERE documento = $5 AND fecha = $6
              `;
                params = [
                  horaEntradaNormalizada,
                  nuevoTipo,
                  evento.dispositivo_ip,
                  evento.nombre,
                  evento.documento,
                  evento.fecha
                ];
              } else if (necesitaSalida) {
                const nuevoTipo = registro.hora_entrada ? 'Entrada/Salida' : 'Solo Salida';
                updateQuery = `
                UPDATE eventos_acceso SET
                  hora_salida = $1,
                  tipo_evento = $2,
                  dispositivo_ip = $3,
                  nombre = COALESCE($4, nombre)
                WHERE documento = $5 AND fecha = $6
              `;
                params = [
                  horaSalidaNormalizada,
                  nuevoTipo,
                  evento.dispositivo_ip,
                  evento.nombre,
                  evento.documento,
                  evento.fecha
                ];
              }

              const result = await client.query(updateQuery, params);
              actualizados++;
              console.log('✅ Actualizado:', evento.documento);
            } else {
              console.log('⏭️ Ya completo:', evento.documento);
            }

          } else {
            // NUEVO REGISTRO - Solo si tenemos datos válidos
            if (horaEntradaNormalizada || horaSalidaNormalizada) {
              const insertQuery = `
              INSERT INTO eventos_acceso 
              (documento, nombre, fecha, hora_entrada, hora_salida, tipo_evento, dispositivo_ip, imagen)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;

              await client.query(insertQuery, [
                evento.documento,
                evento.nombre || 'Sin nombre',
                evento.fecha,
                horaEntradaNormalizada,
                horaSalidaNormalizada,
                evento.tipo_evento || 'Registro',
                evento.dispositivo_ip || 'Desconocido',
                evento.imagen || null
              ]);
              nuevos++;
              console.log('🆕 Nuevo registro:', evento.documento);
            } else {
              console.log('🚫 Omitido (sin horas válidas):', evento.documento);
              errores++;
            }
          }
        } catch (errorEvento) {
          console.error('❌ Error procesando evento', evento.documento, ':', errorEvento.message);
          errores++;
          // CONTINUAR con el siguiente evento en lugar de romper la transacción
        }
      }

      await client.query('COMMIT');
      console.log(`🎉 RESULTADO FINAL BD: ${nuevos} nuevos, ${actualizados} actualizados, ${errores} errores`);

      return {
        guardados: nuevos + actualizados,
        nuevos,
        actualizados,
        errores
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error general guardando eventos:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }
  static async obtenerEventosDesdeBD({ rango, fechaInicio, fechaFin }) {
    const client = await pool.connect();

    try {
      let query = `
        SELECT 
          documento as "empleadoId",
          nombre,
          fecha,
          hora_entrada as "horaEntrada",
          hora_salida as "horaSalida",
          tipo_evento as "tipo",
          dispositivo_ip as "dispositivo",
          imagen as "foto"
        FROM eventos_acceso 
        WHERE 1=1
      `;
      const params = [];

      if (rango === 'hoy') {
        query += ` AND fecha = CURRENT_DATE`;
      } else if (rango === '7dias') {
        query += ` AND fecha >= CURRENT_DATE - INTERVAL '7 days'`;
      } else if (rango === '30dias') {
        query += ` AND fecha >= CURRENT_DATE - INTERVAL '30 days'`;
      } else if (rango === 'personalizado' && fechaInicio && fechaFin) {
        query += ` AND fecha BETWEEN $1 AND $2`;
        params.push(fechaInicio, fechaFin);
      }

      query += ` ORDER BY fecha DESC, hora_entrada DESC`;

      console.log('📊 Ejecutando query BD:', query);
      const result = await client.query(query, params);

      return result.rows;

    } catch (error) {
      console.error('❌ Error obteniendo eventos desde BD:', error);
      return [];
    } finally {
      client.release();
    }
  }

  static async verificarConexion() {
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('✅ Conexión a BD exitosa');
      return true;
    } catch (error) {
      console.error('❌ Error conectando a BD:', error);
      return false;
    }
  }
}