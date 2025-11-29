"use client";

import { useState, useEffect } from "react";

// Interfaces TypeScript
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
  department_id?: number;
}

interface UsuarioListProps {
  usuarios: Usuario[];
  onEdit: (usuario: Usuario) => void;
  onDelete: (usuario: Usuario) => void;
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

// Componente de Avatar (se mantiene igual)
function UserAvatar({ employeeNo, nombre, className = "" }: { 
  employeeNo: string; 
  nombre: string; 
  className?: string;
}) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const iniciales = nombre 
    ? nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    : '?';

  useEffect(() => {
    if (!employeeNo || employeeNo === 'N/A' || employeeNo === 'undefined') {
      console.log(`❌ EmployeeNo inválido: "${employeeNo}"`);
      setDebugInfo(`EmployeeNo inválido: ${employeeNo}`);
      setHasError(true);
      setIsLoading(false);
      return;
    }

    const loadImage = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        setDebugInfo(`Cargando...`);
        console.log(`🔄 Cargando foto para: "${employeeNo}"`);
        
        const response = await fetch(`/api/foto/${encodeURIComponent(employeeNo)}`);
        
        console.log(`📊 Response status: ${response.status} para ${employeeNo}`);
        
        if (response.ok) {
          console.log(`✅ Foto encontrada para: ${employeeNo}`);
          setDebugInfo(`Foto encontrada`);
          const blob = await response.blob();
          
          if (blob.size === 0) {
            throw new Error('Blob vacío');
          }
          
          const imageUrl = URL.createObjectURL(blob);
          setImgSrc(imageUrl);
          setHasError(false);
        } else if (response.status === 404) {
          console.log(`❌ Foto no existe para: ${employeeNo}`);
          setDebugInfo(`Foto no encontrada en el sistema`);
          setHasError(true);
        } else if (response.status === 400) {
          console.log(`❌ Bad request para: ${employeeNo}`);
          setDebugInfo(`EmployeeNo inválido: ${employeeNo}`);
          setHasError(true);
        } else {
          console.log(`⚠️ Error ${response.status} para: ${employeeNo}`);
          setDebugInfo(`Error ${response.status} al cargar`);
          setHasError(true);
        }
      } catch (error) {
        console.error(`🚨 Error cargando foto para ${employeeNo}:`, error);
        setDebugInfo(`Error de conexión`);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();

    return () => {
      if (imgSrc && imgSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imgSrc);
      }
    };
  }, [employeeNo]);

  if (isLoading) {
    return (
      <div 
        className={`w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center border ${className}`}
        title={`Cargando foto de ${nombre}...`}
      >
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (hasError || !imgSrc) {
    return (
      <div 
        className={`w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-semibold text-sm border ${className}`}
        title={`${nombre} - ${debugInfo || 'Foto no disponible'}`}
      >
        {iniciales}
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={`Foto de ${nombre}`}
      className={`w-10 h-10 rounded-full object-cover border ${className}`}
      onError={() => {
        console.log(`🖼️ Error cargando imagen para: ${employeeNo}`);
        setDebugInfo('Error al mostrar imagen');
        setHasError(true);
      }}
      title={`${nombre}`}
    />
  );
}

// Componente de Paginación
function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="bg-white rounded-lg shadow px-4 py-3 mt-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Anterior
        </button>

        <div className="flex gap-1">
          {getPageNumbers().map((page, index) =>
            page === "..." ? (
              <span key={`ellipsis-${index}`} className="px-3 py-1 text-gray-500">
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page as number)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  currentPage === page
                    ? "bg-blue-500 text-white"
                    : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {page}
              </button>
            )
          )}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

// Componente principal de lista de usuarios CORREGIDO
export default function UsuarioList({ usuarios, onEdit, onDelete }: UsuarioListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);

  // Calcular usuarios de la página actual
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = usuarios.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(usuarios.length / usersPerPage);

  // Resetear a página 1 cuando cambia la lista
  useEffect(() => {
    setCurrentPage(1);
  }, [usuarios]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Estadísticas de fotos
  const usuariosConFotoValida = usuarios.filter(u => 
    u.numeroEmpleado && 
    u.numeroEmpleado !== 'N/A' && 
    u.numeroEmpleado !== 'undefined'
  ).length;

  // Función para formatear el correo - mostrar "No disponible" si está vacío
  const getCorreoDisplay = (correo: string | undefined) => {
    if (!correo || correo === 'No disponible' || correo === 'undefined') {
      return <span className="text-gray-400 text-sm">No disponible</span>;
    }
    return <div className="text-sm">{correo}</div>;
  };

  // Función para formatear el departamento
  const getDepartamentoDisplay = (departamento: string | undefined) => {
    if (!departamento || departamento === 'No asignado' || departamento === 'undefined') {
      return <span className="text-gray-400 text-sm">No asignado</span>;
    }
    return (
      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
        {departamento}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto mt-10">
      <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-100 text-gray-700 text-left">
            <th className="p-3">Foto</th>
            <th className="p-3">Cédula/ID</th>
            <th className="p-3">Nombre Completo</th>
            <th className="p-3">Departamento</th>
            <th className="p-3">Correo</th>
            <th className="p-3">Teléfono</th>
            <th className="p-3 text-center">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {currentUsers.map((u, index) => (
            <tr 
              key={u.id || index} 
              className="border-b text-black last:border-none hover:bg-gray-50"
            >
              <td className="p-3">
                <UserAvatar 
                  employeeNo={u.numeroEmpleado}
                  nombre={u.nombre}
                />
              </td>

              <td className="p-3 font-mono text-sm">
                <code className="bg-gray-100 px-2 py-1 rounded">{u.numeroEmpleado || u.id || "N/A"}</code>
              </td>

              <td className="p-3">
                <div className="font-medium">{u.nombre || "Sin nombre"}</div>
                {u.genero && u.genero !== 'No especificado' && u.genero !== 'undefined' && (
                  <div className="text-xs text-gray-500">{u.genero}</div>
                )}
              </td>

              <td className="p-3">
                {getDepartamentoDisplay(u.departamento)}
              </td>

              <td className="p-3">
                {getCorreoDisplay(u.correo)}
              </td>

              <td className="p-3">
                {u.telefono && u.telefono !== 'No disponible' && u.telefono !== 'undefined' ? (
                  <div className="text-sm">{u.telefono}</div>
                ) : (
                  <span className="text-gray-400 text-sm">No disponible</span>
                )}
              </td>

              <td className="p-3">
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => onEdit(u)}
                    className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm transition-colors"
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => onDelete(u)}
                    className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {usuarios.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No se encontraron usuarios
        </div>
      )}

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
      )}

      {/* Información de debug */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
        <div className="font-semibold mb-2">Información del Sistema:</div>
        <div>• Total de usuarios: {usuarios.length}</div>
        <div>• Usuarios con ID válido: {usuariosConFotoValida}</div>
        <div>• Página {currentPage} de {totalPages}</div>
        <div className="text-xs text-gray-600 mt-1">
          Las fotos se cargan desde los dispositivos Hikvision. Los avatares con iniciales indican que no hay foto disponible.
        </div>
      </div>
    </div>
  );
}