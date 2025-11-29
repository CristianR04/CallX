"use client";

import { useState } from "react";

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
  department_id?: number;
}

interface UsuarioCreateModalProps {
  onCreate: (usuario: Usuario) => void;
}

// Departamentos actualizados según la imagen con sus IDs
const DEPARTAMENTOS = [
  { id: "1", nombre: "TI" },
  { id: "2", nombre: "Teams Leaders" },
  { id: "3", nombre: "Campana 5757" },
  { id: "4", nombre: "Campana SAV" },
  { id: "5", nombre: "Campana REFI" },
  { id: "6", nombre: "Campana PL" },
  { id: "7", nombre: "Campana PARLO" },
  { id: "8", nombre: "Administrativo" }
];

export default function UsuarioCreateModal({ onCreate }: UsuarioCreateModalProps) {
  const [open, setOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    cedula: "",
    genero: "",
    numeroEmpleado: "",
    correo: "",
    telefono: "",
    departamento: "",
    estado: "Activo"
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar que se haya seleccionado un departamento
      if (!form.departamento) {
        alert("El departamento es requerido");
        setLoading(false);
        return;
      }

      // Preparar datos para Hikvision
      const hikvisionData = {
        ...form
        // El groupId se calculará automáticamente en el backend basado en el nombre del departamento
      };

      // Enviar a Hikvision
      const response = await fetch('/api/hikvision/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(hikvisionData),
      });

      // CORRECCIÓN: Cambiar 'result' por 'response' aquí
      const result = await response.json(); // Esta línea estaba mal - tenía 'result' en lugar de 'response'

      if (!result.success) {
        // Mostrar detalles del error por dispositivo
        const errorDetails = result.results
          .filter((r: any) => !r.success)
          .map((r: any) => `Dispositivo ${r.deviceIp}: ${r.error}`)
          .join('\n');
        
        throw new Error(`Error en creación:\n${errorDetails}`);
      }

      // Crear usuario local con department_id
      const nuevoUsuario: Usuario = {
        id: Date.now().toString(),
        cedula: form.cedula,
        nombre: form.nombre,
        genero: form.genero,
        numeroEmpleado: form.numeroEmpleado || form.cedula,
        correo: form.correo,
        telefono: form.telefono,
        departamento: form.departamento,
        department_id: result.userData.department_id, // ID numérico del departamento
        estado: form.estado,
        fechaCreacion: new Date().toISOString()
      };

      onCreate(nuevoUsuario);

      // Resetear formulario
      setForm({
        nombre: "",
        cedula: "",
        genero: "",
        numeroEmpleado: "",
        correo: "",
        telefono: "",
        departamento: "",
        estado: "Activo"
      });
      setOpen(false);

      // Mostrar resultado
      const successfulDevices = result.results.filter((r: any) => r.success).length;
      const totalDevices = result.results.length;
      
      if (successfulDevices === totalDevices) {
        alert("Usuario creado exitosamente en todos los dispositivos");
      } else {
        alert(`Usuario creado parcialmente: ${result.message}`);
      }

    } catch (error: unknown) {
      console.error('Error:', error);
      let errorMessage = 'Error desconocido al crear usuario';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      alert(`Error al crear usuario: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group absolute top-24 right-10 
                  flex items-center gap-2 
                  w-11 hover:w-40 h-11 
                  bg-green-600 hover:bg-green-700
                  text-white rounded-full shadow-md 
                  transition-all duration-300 overflow-hidden"
      >
        <i className="bi bi-plus-lg text-xl ml-3"></i>
        <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 
                        transition-opacity duration-300">
          <strong>Crear usuario</strong>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-[90%] max-w-2xl p-6 relative animate-fadeIn max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-gray-600 hover:text-black text-xl"
              disabled={loading}
            >
              <i className="bi bi-x-lg"></i>
            </button>

            <h2 className="text-xl font-semibold mb-4">Crear Nuevo Usuario</h2>

            <form onSubmit={crear} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <h3 className="text-lg font-medium text-gray-700 mb-3">Información Básica</h3>
              </div>

              <input
                name="cedula"
                type="text"
                placeholder="Cédula *"
                value={form.cedula}
                onChange={handleChange}
                className="border border-gray-500 p-2 rounded-md text-black"
                required
                disabled={loading}
              />

              <input
                name="numeroEmpleado"
                type="text"
                placeholder="Número de empleado *"
                value={form.numeroEmpleado}
                onChange={handleChange}
                className="border border-gray-500 p-2 rounded-md text-black"
                required
                disabled={loading}
              />

              <input
                name="nombre"
                type="text"
                placeholder="Nombre completo *"
                value={form.nombre}
                onChange={handleChange}
                className="border border-gray-500 p-2 rounded-md text-black md:col-span-2"
                required
                disabled={loading}
              />

              {/* Selección de departamento */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Departamento *
                </label>
                <select
                  name="departamento"
                  value={form.departamento}
                  onChange={handleChange}
                  className="border border-gray-500 p-2 rounded-md text-black w-full"
                  required
                  disabled={loading}
                >
                  <option value="">Seleccionar departamento</option>
                  {DEPARTAMENTOS.map(depto => (
                    <option key={depto.id} value={depto.nombre}>
                      {depto.nombre} (ID: {depto.id})
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  El ID del departamento se asignará automáticamente
                </p>
              </div>

              <select
                name="genero"
                value={form.genero}
                onChange={handleChange}
                className="border border-gray-500 p-2 rounded-md text-black"
                required
                disabled={loading}
              >
                <option value="">Seleccionar género *</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>

              <select
                name="estado"
                value={form.estado}
                onChange={handleChange}
                className="border border-gray-500 p-2 rounded-md text-black"
                disabled={loading}
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>

              {/* Información de contacto */}
              <div className="md:col-span-2 mt-4">
                <h3 className="text-lg font-medium text-gray-700 mb-3">Información de Contacto</h3>
              </div>

              <input
                name="correo"
                type="email"
                placeholder="Correo electrónico"
                value={form.correo}
                onChange={handleChange}
                className="border border-gray-500 p-2 rounded-md text-black"
                disabled={loading}
              />

              <input
                name="telefono"
                type="tel"
                placeholder="Teléfono"
                value={form.telefono}
                onChange={handleChange}
                className="border border-gray-500 p-2 rounded-md text-black"
                disabled={loading}
              />

              {/* Botón de crear */}
              <div className="md:col-span-2 mt-4">
                <button
                  type="submit"
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  disabled={loading}
                  className="w-full bg-green-500 text-white py-3 rounded-md font-medium transition-all duration-500 ease-in-out relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isHovering ? '#16a34a' : '#22c55e'
                  }}
                >
                  <div 
                    className={`absolute inset-y-0 left-0 bg-green-600 rounded-l-full transition-all duration-500 ease-in-out ${
                      isHovering ? 'w-full' : 'w-0'
                    }`}
                  />
                  <span className="relative z-10">
                    {loading ? 'Creando Usuario...' : 'Crear Usuario'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}