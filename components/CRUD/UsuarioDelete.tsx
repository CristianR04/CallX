// components/CRUD/UsuarioDeleteReal.tsx
"use client";

import { useState } from "react";

interface Usuario {
  id: string;
  nombre: string;
  tipoUsuario?: string;
  numeroEmpleado: string;
  employeeNo: string; // <-- Asegurar que siempre esté este campo
  correo?: string;
  telefono?: string;
  fechaCreacion?: string;
  fechaModificacion?: string;
  estado?: string;
  departamento?: string;
  dispositivo?: string;
  cedula?: string;
  genero?: string;
  foto?: string;
}

interface UsuarioDeleteProps {
  usuario: Usuario | null;
  onCancel: () => void;
  onConfirm: (deletedEmployeeNo: string) => void;
}

interface DeviceResult {
  success: boolean;
  deviceIp: string;
  error?: string;
  message?: string;
  method?: string;
  format?: string;
}

export default function UsuarioDeleteReal({
  usuario,
  onCancel,
  onConfirm
}: UsuarioDeleteProps) {
  const [loading, setLoading] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ 
    success: boolean; 
    message: string; 
    results?: DeviceResult[];
    deletedEmployeeNo?: string;
  } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleDelete = async () => {
    if (!usuario) return;
    
    setLoading(true);
    setDeleteResult(null);
    setConfirmed(false);
    
    try {
      // Usar employeeNo si está disponible, de lo contrario usar numeroEmpleado
      const employeeNo = usuario.employeeNo || usuario.numeroEmpleado;
      
      if (!employeeNo || employeeNo.trim() === '') {
        throw new Error("El usuario no tiene un número de empleado válido");
      }

      console.log(`🔴 SOLICITUD DE ELIMINACIÓN REAL PARA: ${employeeNo}`);
      
      const response = await fetch('/api/hikvision/users/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          employeeNo: employeeNo.trim()
        })
      });

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📋 RESULTADO REAL DE LA API:', result);

      if (result.securityViolation) {
        setDeleteResult({
          success: false,
          message: `❌ Violación de seguridad: ${result.error}`,
          deletedEmployeeNo: employeeNo
        });
        return;
      }

      if (result.success) {
        const successfulDevices = result.results?.filter((r: DeviceResult) => r.success).length || 0;
        const totalDevices = result.results?.length || 0;
        
        setDeleteResult({
          success: true,
          message: `✅ Eliminado de ${successfulDevices}/${totalDevices} dispositivos`,
          results: result.results,
          deletedEmployeeNo: employeeNo
        });
        
        setConfirmed(true);
        
        // Si todos los dispositivos tuvieron éxito, continuar automáticamente
        if (successfulDevices === totalDevices) {
          setTimeout(() => {
            onConfirm(employeeNo);
          }, 2000);
        }
        
      } else {
        setDeleteResult({
          success: false,
          message: `❌ ${result.error || 'Error al eliminar'}`,
          results: result.results,
          deletedEmployeeNo: employeeNo
        });
      }
    } catch (error: unknown) {
      console.error('💥 ERROR EN ELIMINACIÓN:', error);
      
      let errorMessage = 'Error desconocido al eliminar usuario';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setDeleteResult({
        success: false,
        message: `❌ ${errorMessage}`,
        deletedEmployeeNo: usuario.employeeNo || usuario.numeroEmpleado
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAnyway = () => {
    if (!usuario) return;
    
    const employeeNo = usuario.employeeNo || usuario.numeroEmpleado;
    if (employeeNo) {
      onConfirm(employeeNo);
    }
  };

  const handleClose = () => {
    if (confirmed && deleteResult?.deletedEmployeeNo) {
      onConfirm(deleteResult.deletedEmployeeNo);
    } else {
      onCancel();
    }
  };

  if (!usuario) return null;

  const employeeNo = usuario.employeeNo || usuario.numeroEmpleado;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold">Eliminar Usuario</h3>
                <p className="text-red-100 text-sm mt-1">Acción real en dispositivos Hikvision</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white text-2xl"
              disabled={loading}
            >
              ×
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6">
          {/* Información del usuario */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-3">
              {usuario.foto ? (
                <img 
                  src={usuario.foto} 
                  alt={usuario.nombre}
                  className="w-16 h-16 rounded-full object-cover border-2 border-white shadow"
                />
              ) : (
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center border-2 border-white shadow">
                  <span className="text-2xl text-blue-600 font-bold">
                    {usuario.nombre?.charAt(0) || 'U'}
                  </span>
                </div>
              )}
              <div>
                <h4 className="text-lg font-bold text-gray-800">{usuario.nombre}</h4>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                    ID: {employeeNo}
                  </span>
                  {usuario.departamento && (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                      {usuario.departamento}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Resultado de eliminación */}
          {deleteResult && (
            <div className={`mb-6 rounded-lg p-4 ${deleteResult.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'}`}
            >
              <div className="flex items-center gap-3">
                {deleteResult.success ? (
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <div>
                  <p className={`font-medium ${deleteResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {deleteResult.message}
                  </p>
                  
                  {deleteResult.results && (
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {showDetails ? 'Ocultar detalles' : 'Ver detalles por dispositivo'}
                    </button>
                  )}
                </div>
              </div>
              
              {showDetails && deleteResult.results && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Resultados por dispositivo:</h5>
                  <div className="space-y-2">
                    {deleteResult.results.map((result, index) => (
                      <div key={index} className={`flex flex-col p-2 rounded ${result.success ? 'bg-green-100' : 'bg-red-100'}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-sm">{result.deviceIp}</span>
                          <span className={`text-xs font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                            {result.success ? '✅ Éxito' : `❌ ${result.error || 'Error'}`}
                          </span>
                        </div>
                        {result.method && (
                          <div className="text-xs text-gray-600 mt-1">
                            Método: {result.method} | Formato: {result.format || 'N/A'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Advertencia */}
          {!deleteResult && !confirmed && (
            <div className="mb-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-yellow-800 font-medium text-sm mb-2">
                      ⚠️ Eliminación REAL en dispositivos Hikvision
                    </p>
                    <ul className="text-yellow-700 text-sm space-y-1">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        Se eliminará del dispositivo 172.31.0.165
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        Se eliminará del dispositivo 172.31.0.164
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        También del sistema local
                      </li>
                    </ul>
                    <p className="text-yellow-600 text-xs mt-3 font-medium">
                      Esta acción es irreversible y afectará el control de acceso físico
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex flex-col gap-3">
            {!deleteResult ? (
              <>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    loading
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Eliminando...
                    </>
                  ) : (
                    'ELIMINAR DE DISPOSITIVOS HIKVISION'
                  )}
                </button>

                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                >
                  Cancelar
                </button>
              </>
            ) : confirmed ? (
              <button
                onClick={handleClose}
                className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
              >
                Continuar
              </button>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={handleConfirmAnyway}
                  className="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium transition-colors"
                >
                  Eliminar solo del sistema local
                </button>
                
                <button
                  onClick={handleClose}
                  className="w-full px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>

          {/* Información de seguridad */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <p className="font-medium mb-1">🔒 Seguridad implementada:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Solo se permite eliminar un usuario a la vez</li>
                <li>Validación de formato del employeeNo</li>
                <li>Log de todas las eliminaciones</li>
                <li>Múltiples métodos de API probados automáticamente</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}