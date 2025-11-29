"use client";

import { useEffect, useState } from "react";
import UsuariosList from "@/components/CRUD/UsuarioList";
import UsuarioCreate from "@/components/CRUD/UsuarioCreate";
import UsuarioEdit from "@/components/CRUD/UsuarioEdit";
import UsuarioDelete from "@/components/CRUD/UsuarioDelete";
import Navbar from "@/components/navbar";

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
}

interface ApiResponse {
  success: boolean;
  message?: string;
  timestamp: string;
  devices: string[];
  raw: any[]; // La nueva estructura del endpoint
  users?: Usuario[]; // Campo opcional por si cambia
}

interface Estadisticas {
  dispositivosConectados: number;
  totalDispositivos: number;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [estadisticas, setEstadisticas] = useState<Estadisticas>({
    dispositivosConectados: 0,
    totalDispositivos: 0
  });

  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<Usuario | null>(null);

  // Función para extraer usuarios de la estructura raw
  const extraerUsuariosDeRaw = (rawData: any[]): Usuario[] => {
    if (!Array.isArray(rawData)) {
      console.warn('⚠️ rawData no es un array:', rawData);
      return [];
    }

    const todosLosUsuarios: Usuario[] = [];

    rawData.forEach(dispositivo => {
      if (!dispositivo || !dispositivo.rawResponses) return;

      const deviceIp = dispositivo.deviceIp || 'Desconocido';
      
      dispositivo.rawResponses.forEach((lote: any) => {
        if (!lote || !lote.raw || !lote.raw.UserInfoSearch) return;

        const usuariosLote = lote.raw.UserInfoSearch.UserInfo;
        
        if (Array.isArray(usuariosLote)) {
          usuariosLote.forEach((user: any) => {
            if (user && user.employeeNo) {
              todosLosUsuarios.push({
                id: user.employeeNo,
                nombre: user.name || 'Sin nombre',
                tipoUsuario: user.userType || 'Desconocido',
                numeroEmpleado: user.employeeNo,
                correo: user.email || 'No disponible',
                telefono: user.phone || 'No disponible',
                fechaCreacion: user.createTime || 'No disponible',
                fechaModificacion: user.modifyTime || 'No disponible',
                estado: user.userVerifyMode === 0 ? 'Activo' : 'Inactivo',
                departamento: user.deptName || 'No asignado',
                dispositivo: deviceIp,
                cedula: user.customInfo || 'No disponible',
                genero: user.gender || 'No especificado'
              });
            }
          });
        }
      });
    });

    console.log(`✅ Extraídos ${todosLosUsuarios.length} usuarios de raw data`);
    return todosLosUsuarios;
  };

  // Cargar usuarios desde el endpoint Hikvision
  useEffect(() => {
    async function cargar() {
      try {
        console.log("🔄 Iniciando carga de usuarios...");
        const res = await fetch("/api/users", { 
          cache: "no-store",
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!res.ok) {
          console.error("❌ Error HTTP cargando usuarios:", res.status);
          return;
        }

        const data: ApiResponse = await res.json();
        console.log("📦 Respuesta de la API:", data);
        
        if (data.success) {
          let usuariosExtraidos: Usuario[] = [];
          
          // Manejar ambas estructuras posibles
          if (Array.isArray(data.users)) {
            // Estructura antigua
            usuariosExtraidos = data.users;
          } else if (Array.isArray(data.raw)) {
            // Nueva estructura con raw
            usuariosExtraidos = extraerUsuariosDeRaw(data.raw);
          }
          
          const usuariosUnicos = eliminarDuplicados(usuariosExtraidos);
          setUsuarios(usuariosUnicos);
          
          // Calcular estadísticas de dispositivos
          const dispositivosExitosos = Array.isArray(data.raw) 
            ? data.raw.filter(d => !d.error).length 
            : 0;
          const totalDispositivos = Array.isArray(data.raw) 
            ? data.raw.length 
            : (data.devices ? data.devices.length : 0);

          setEstadisticas({
            dispositivosConectados: dispositivosExitosos,
            totalDispositivos: totalDispositivos
          });

          console.log(`🎯 Carga completada: ${usuariosUnicos.length} usuarios únicos`);
        } else {
          console.error("❌ Error en la respuesta del servidor:", data.message);
        }
      } catch (error) {
        console.error("❌ Error en fetch:", error);
      } finally {
        setCargando(false);
      }
    }

    cargar();
  }, []);

  // Función para eliminar duplicados - CON VALIDACIÓN
  const eliminarDuplicados = (listaUsuarios: Usuario[] | null | undefined): Usuario[] => {
    // Validación exhaustiva
    if (!listaUsuarios) {
      console.warn('⚠️ listaUsuarios es null o undefined');
      return [];
    }
    
    if (!Array.isArray(listaUsuarios)) {
      console.warn('⚠️ listaUsuarios no es un array:', typeof listaUsuarios);
      return [];
    }

    const usuariosUnicos: Usuario[] = [];
    const empleadosVistos = new Set<string>();
    
    listaUsuarios.forEach(usuario => {
      // Validar que el usuario tenga las propiedades necesarias
      if (!usuario || typeof usuario !== 'object') {
        console.warn('⚠️ Usuario inválido encontrado:', usuario);
        return;
      }
      
      const claveUnica = usuario.numeroEmpleado || usuario.id;
      if (claveUnica && !empleadosVistos.has(claveUnica)) {
        empleadosVistos.add(claveUnica);
        usuariosUnicos.push(usuario);
      }
    });
    
    console.log(`✅ Eliminados ${listaUsuarios.length - usuariosUnicos.length} duplicados`);
    return usuariosUnicos;
  };

  // Crear usuario localmente
  const crearUsuario = (user: Usuario) => {
    setUsuarios(prev => {
      const nuevosUsuarios = [...prev, user];
      return eliminarDuplicados(nuevosUsuarios);
    });
  };

  // Editar usuario local
  const actualizarUsuario = (user: Usuario) => {
    setUsuarios(prev => 
      eliminarDuplicados(prev.map(u => (u.id === user.id ? user : u)))
    );
    setUsuarioEditando(null);
  };

  // Eliminar usuario local
  const eliminarUsuario = () => {
    if (!usuarioAEliminar) return;
    setUsuarios(prev => prev.filter(u => u.id !== usuarioAEliminar.id));
    setUsuarioAEliminar(null);
  };

  if (cargando) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando usuarios desde múltiples dispositivos...</p>
        </div>
      </div>
    );
  }

  return (
  <>
    <Navbar />

    <div className="p-6">
      <div className="mb-6 p-4 bg-blue-50 rounded-lg mt-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Gestión de Usuarios</h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span className="flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            {usuarios.length} usuarios únicos
          </span>
          <span className="flex items-center">
            <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
            {estadisticas.dispositivosConectados}/{estadisticas.totalDispositivos} dispositivos conectados
          </span>
        </div>
      </div>

      {/* Crear */}
      <div className="mb-6">
        <UsuarioCreate onCreate={crearUsuario} />
      </div>

      {/* Editar */}
      {usuarioEditando && (
        <div className="mb-6">
          <UsuarioEdit
            usuario={usuarioEditando}
            onEdit={actualizarUsuario}
            onCancel={() => setUsuarioEditando(null)}
          />
        </div>
      )}

      {/* Lista */}
      <div className="mb-6">
        <UsuariosList
          usuarios={usuarios}
          onEdit={(u: Usuario) => setUsuarioEditando(u)}
          onDelete={(u: Usuario) => setUsuarioAEliminar(u)}
        />
      </div>

      {/* Eliminar */}
      <UsuarioDelete
        usuario={usuarioAEliminar}
        onCancel={() => setUsuarioAEliminar(null)}
        onConfirm={eliminarUsuario}
      />
    </div>
  </>
);

}