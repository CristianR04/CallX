"use client";

// Definir la interfaz Usuario localmente
interface Usuario {
  id: string;
  nombre: string;
  tipoUsuario?: string;
  numeroEmpleado: string;
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
  onConfirm: () => void;
}

export default function UsuarioDelete({
  usuario,
  onCancel,
  onConfirm
}: UsuarioDeleteProps) {
  if (!usuario) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-md text-center w-80 max-w-sm mx-4">
        
        <h3 className="text-lg font-semibold text-black mb-3">¿Eliminar usuario?</h3>

        {/* Información del usuario */}
        <div className="mb-4 text-left">
          <p className="text-gray-800 font-medium">
            {usuario.nombre}
          </p>
          <div className="text-sm text-gray-600 mt-2 space-y-1">
            {usuario.cedula && (
              <p>Cédula: {usuario.cedula}</p>
            )}
            {usuario.numeroEmpleado && (
              <p>N° Empleado: {usuario.numeroEmpleado}</p>
            )}
            {usuario.genero && (
              <p>Género: {usuario.genero}</p>
            )}
            {usuario.correo && (
              <p>Email: {usuario.correo}</p>
            )}
            {usuario.departamento && (
              <p>Departamento: {usuario.departamento}</p>
            )}
          </div>
        </div>

        {/* Advertencia */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
          <p className="text-yellow-800 text-sm">
            ⚠️ Esta acción no se puede deshacer
          </p>
        </div>

        {/* Botones */}
        <div className="flex justify-center gap-3">
          <button
            onClick={onConfirm}
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors font-medium">
            Eliminar
          </button>

          <button
            onClick={onCancel}
            className="bg-gray-300 px-4 py-2 rounded-md text-black hover:bg-gray-400 transition-colors font-medium">
            Cancelar
          </button>
        </div>

      </div>
    </div>
  );
}