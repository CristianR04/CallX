"use client";

import { useState, useEffect } from "react";
import { useHideFrom } from "@/lib/hooks/useRole";
import { Usuario } from "@/types/usuario"; // Importar tipo compartido

// Eliminar la definición local de Usuario ya que ahora se importa

interface UsuarioListProps {
  usuarios: Usuario[];
  onEdit: (usuario: Usuario) => void;
  onDelete: (usuario: Usuario) => void;
  currentUserRol?: string;
  allowedDepartment?: string | null;
  allowedDepartments?: string[]; // 🔥 NUEVO: Array de departamentos permitidos
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

// Componente de Paginación CORREGIDO
export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange 
}: PaginationProps) {
  
  const getPageNumbers = (): (number | string)[] => {
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
    <div className="bg-white rounded-lg shadow px-4 py-3 mt-4 mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  currentPage === page
                    ? "bg-emerald-600 text-white shadow-sm"
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
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

// Componente principal de lista de usuarios
export default function UsuarioList({ 
  usuarios, 
  onEdit, 
  onDelete,
  currentUserRol,
  allowedDepartment,  // Para compatibilidad
  allowedDepartments = []  // 🔥 NUEVO: Array de departamentos
}: UsuarioListProps) {
  const { shouldHide } = useHideFrom();
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);

  // Calcular usuarios de la página actual
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  
  // 🔥 Determinar departamentos permitidos (usar allowedDepartments si está disponible)
  const departamentosPermitidos = allowedDepartments.length > 0 
    ? allowedDepartments 
    : (allowedDepartment ? [allowedDepartment] : []);

  // 🔥 Filtrar usuarios VISIBLES según los departamentos del Team Leader
  const usuariosVisibles = currentUserRol === 'Team Leader' && departamentosPermitidos.length > 0
    ? usuarios.filter(usuario => {
        const usuarioDepto = usuario.departamento || "No asignado";
        return departamentosPermitidos.includes(usuarioDepto);
      })
    : usuarios;

  const currentUsers = usuariosVisibles.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(usuariosVisibles.length / usersPerPage);

  // Resetear a página 1 cuando cambia la lista
  useEffect(() => {
    setCurrentPage(1);
  }, [usuarios]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Función para verificar si se puede editar/eliminar un usuario específico
  const canUserModifyUsuario = (usuario: Usuario): boolean => {
    // Si es TI o Administrador, puede gestionar todos
    if (currentUserRol === 'TI' || currentUserRol === 'Administrador') {
      return true;
    }
    
    // Si es Team Leader, solo puede gestionar usuarios de sus departamentos
    if (currentUserRol === 'Team Leader') {
      if (departamentosPermitidos.length === 0) return false;
      
      // Verificar que el usuario pertenezca a uno de los departamentos del Team Leader
      const usuarioDepto = usuario.departamento || "No asignado";
      return departamentosPermitidos.includes(usuarioDepto);
    }
    
    // Para otros roles, no puede gestionar
    return false;
  };

  // Función para formatear el departamento
  const getDepartamentoDisplay = (departamento: string | undefined) => {
    if (!departamento || departamento === 'No asignado') {
      return <span className="text-gray-400 text-sm">No asignado</span>;
    }

    const coloresDepartamentos: Record<string, string> = {
      "TI": "bg-purple-100 text-purple-800 border border-purple-200",
      "Teams Leaders": "bg-blue-100 text-blue-800 border border-blue-200",
      "Campana 5757": "bg-emerald-100 text-emerald-800 border border-emerald-200",
      "Campana SAV": "bg-yellow-100 text-yellow-800 border border-yellow-200",
      "Campana REFI": "bg-red-100 text-red-800 border border-red-200",
      "Campana PL": "bg-indigo-100 text-indigo-800 border border-indigo-200",
      "Campana PARLO": "bg-pink-100 text-pink-800 border border-pink-200",
      "Administrativo": "bg-gray-100 text-gray-800 border border-gray-200"
    };

    const estilo = coloresDepartamentos[departamento] || "bg-gray-100 text-gray-800 border border-gray-200";

    return (
      <span className={`px-2.5 py-1 ${estilo} rounded-lg text-xs font-medium whitespace-nowrap`}>
        {departamento}
      </span>
    );
  };

  // 🔥 Obtener el mensaje cuando no hay usuarios
  const getEmptyMessage = () => {
    if (currentUserRol === 'Team Leader' && departamentosPermitidos.length > 0) {
      if (departamentosPermitidos.length === 1) {
        return `No se encontraron usuarios en ${departamentosPermitidos[0]}`;
      } else {
        return `No se encontraron usuarios en ${departamentosPermitidos.join(', ')}`;
      }
    }
    return "No se encontraron usuarios";
  };

  return (
    <div className="mt-6 mx-20 max-w-full">

      <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gradient-to-r from-slate-700 to-slate-800 text-white text-sm">
              <th className="py-2.5 px-3 text-left font-semibold first:rounded-tl-lg">Foto</th>
              <th className="py-2.5 px-3 text-left font-semibold">ID Empleado</th>
              <th className="py-2.5 px-3 text-left font-semibold">Nombre</th>
              <th className="py-2.5 px-3 text-left font-semibold">Departamento</th>
              {!shouldHide(['TI', 'Team Leader']) && (
                <th className="py-2.5 px-3 text-left font-semibold last:rounded-tr-lg">Acciones</th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {currentUsers.length > 0 ? (
              currentUsers.map((usuario, index) => {
                const canModifyThisUser = canUserModifyUsuario(usuario);
                
                return (
                  <tr
                    key={usuario.employeeNo || usuario.id || `usuario-${index}`}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex justify-center">
                        <div className="relative">
                          {usuario.fotoPath && usuario.fotoPath !== usuario.numeroEmpleado ? (
                            <img
                              src={`/api/foto/${encodeURIComponent(usuario.fotoPath)}`}
                              alt={`Foto de ${usuario.nombre}`}
                              className="w-[75px] h-[100px] rounded-lg object-cover border"
                              title={usuario.nombre}
                              loading="lazy"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const initialsDiv = document.createElement('div');
                                initialsDiv.className = 'w-[75px] h-[100px] rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-medium';
                                initialsDiv.textContent = usuario.nombre ? usuario.nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'U';
                                target.parentNode?.appendChild(initialsDiv);
                              }}
                            />
                          ) : (
                            <div className="w-[75px] h-[100px] rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-medium">
                              {usuario.nombre ? usuario.nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'U'}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-medium text-gray-900 font-mono text-sm">
                        {usuario.employeeNo || usuario.numeroEmpleado || usuario.id || "N/A"}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-medium text-gray-900 text-sm">{usuario.nombre || "Sin nombre"}</div>
                      {usuario.genero && usuario.genero !== 'No especificado' && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          <span className="inline-flex items-center">
                            <svg className="w-3 h-3 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            {usuario.genero}
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-3">
                      {getDepartamentoDisplay(usuario.departamento)}
                    </td>
                    
                    {!shouldHide(['TI', 'Team Leader']) && (
                      <td className="py-2.5 px-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => onEdit(usuario)}
                            disabled={!canModifyThisUser}
                            className={`px-3 py-1.5 rounded-md text-xs transition-all duration-200 flex items-center gap-1.5 shadow-sm ${
                              canModifyThisUser
                                ? 'bg-slate-600 text-white hover:bg-slate-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                            title={!canModifyThisUser ? 
                              (currentUserRol === 'Team Leader' 
                                ? "Solo puedes editar usuarios de tus campañas" 
                                : "No tienes permisos para editar")
                              : "Editar usuario"
                            }
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Editar
                          </button>

                          <button
                            onClick={() => onDelete(usuario)}
                            disabled={!canModifyThisUser}
                            className={`px-3 py-1.5 rounded-md text-xs transition-all duration-200 flex items-center gap-1.5 shadow-sm ${
                              canModifyThisUser
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                            title={!canModifyThisUser ? 
                              (currentUserRol === 'Team Leader' 
                                ? "Solo puedes eliminar usuarios de tus campañas" 
                                : "No tienes permisos para eliminar")
                              : "Eliminar usuario"
                            }
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <div className="text-gray-500">
                    <svg className="w-14 h-14 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-10a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-700">
                      {getEmptyMessage()}
                    </h3>
                    <p className="mt-2 text-sm">
                      {currentUserRol === 'Team Leader'
                        ? "Los usuarios se filtran automáticamente por tus campañas asignadas"
                        : "Los usuarios se cargan desde los dispositivos Hikvision"
                      }
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {currentUsers.length > 0 && totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
      )}
    </div>
  );
}