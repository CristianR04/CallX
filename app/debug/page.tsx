// app/debug/user/page.tsx
import { pool } from '@/lib/db'

export default async function UserDebugPage() {
  const client = await pool.connect()
  
  try {
    // Buscar usuario "jorge.gomez" en todas las tablas posibles
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `)
    
    const results = []
    
    for (const table of tables.rows) {
      try {
        // Buscar columnas que puedan ser de usuario
        const columns = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 
            AND (column_name ILIKE '%user%' OR column_name ILIKE '%usuario%')
        `, [table.table_name])
        
        if (columns.rows.length > 0) {
          const userColumn = columns.rows[0].column_name
          
          // Buscar jorge.gomez
          const query = `
            SELECT * FROM "${table.table_name}" 
            WHERE "${userColumn}" ILIKE '%jorge%' OR "${userColumn}" ILIKE '%gomez%'
            LIMIT 5
          `
          
          const data = await client.query(query)
          
          if (data.rows.length > 0) {
            results.push({
              table: table.table_name,
              userColumn: userColumn,
              data: data.rows
            })
          }
        }
      } catch (error) {
        // Ignorar errores
        continue
      }
    }
    
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">🔍 Usuario: jorge.gomez</h1>
        
        {results.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p>No se encontró el usuario "jorge.gomez" en ninguna tabla.</p>
          </div>
        ) : (
          results.map((result, idx) => (
            <div key={idx} className="mb-8 bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-blue-600 mb-3">
                Tabla: <span className="font-mono">{result.table}</span>
              </h2>
              
              {result.data.map((row, rowIdx) => (
                <div key={rowIdx} className="mb-4 p-4 border rounded">
                  <h3 className="font-medium mb-2">Registro #{rowIdx + 1}:</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(row).map(([key, value]) => (
                      <div key={key} className="border p-2 rounded">
                        <div className="text-xs text-gray-500 font-medium">{key}</div>
                        <div className={`mt-1 font-mono ${
                          key.toLowerCase().includes('pass') 
                            ? 'text-red-600 bg-red-50 p-1 rounded' 
                            : 'text-gray-800'
                        }`}>
                          {String(value)}
                          {key.toLowerCase().includes('pass') && (
                            <div className="text-xs text-gray-500 mt-1">
                              Longitud: {String(value).length} caracteres
                              {String(value).startsWith('$2') && ' (Hash bcrypt)'}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    )
  } finally {
    client.release()
  }
}