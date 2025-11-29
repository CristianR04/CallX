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
  foto?: string;
}

interface UsuarioEditProps {
  usuario: Usuario;
  onEdit: (usuario: Usuario) => void;
  onCancel: () => void;
}

export default function UsuarioEdit({
  usuario,
  onEdit,
  onCancel
}: UsuarioEditProps) {
  const [form, setForm] = useState<Usuario>(usuario);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.target.name === "foto" && e.target instanceof HTMLInputElement) {
      const file = e.target.files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        setForm({ ...form, foto: url });
      }
    } else {
      setForm({ ...form, [e.target.name]: e.target.value });
    }
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    onEdit(form);
  };

  return (
    <form
      onSubmit={guardar}
      className="bg-white shadow-md rounded-lg p-5 mt-6 grid grid-cols-2 gap-4">
      <h2 className="col-span-2 text-xl font-semibold">Editar Usuario</h2>

      {/* Cédula */}
      <input
        name="cedula"
        placeholder="Cédula"
        value={form.cedula || ""}
        onChange={handleChange}
        className="border border-gray-600 placeholder-gray-500 text-black p-2 rounded-md
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"/>

      {/* Nombre completo */}
      <input
        name="nombre"
        placeholder="Nombre completo"
        value={form.nombre}
        onChange={handleChange}
        className="border border-gray-600 placeholder-gray-500 text-black p-2 rounded-md
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        required/>

      {/* Número de empleado */}
      <input
        name="numeroEmpleado"
        placeholder="Número de empleado"
        value={form.numeroEmpleado}
        onChange={handleChange}
        className="border border-gray-600 placeholder-gray-500 text-black p-2 rounded-md
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        required/>

      {/* Correo */}
      <input
        name="correo"
        type="email"
        placeholder="Correo electrónico"
        value={form.correo || ""}
        onChange={handleChange}
        className="border border-gray-600 placeholder-gray-500 text-black p-2 rounded-md
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"/>

      {/* Teléfono */}
      <input
        name="telefono"
        placeholder="Teléfono"
        value={form.telefono || ""}
        onChange={handleChange}
        className="border border-gray-600 placeholder-gray-500 text-black p-2 rounded-md
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"/>

      {/* Género */}
      <select
        name="genero"
        value={form.genero || ""}
        onChange={handleChange}
        className="border border-gray-600 text-black p-2 rounded-md
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        <option value="">Seleccionar género</option>
        <option value="Masculino">Masculino</option>
        <option value="Femenino">Femenino</option>
        <option value="Otro">Otro</option>
      </select>

      {/* Departamento */}
      <input
        name="departamento"
        placeholder="Departamento"
        value={form.departamento || ""}
        onChange={handleChange}
        className="border border-gray-600 placeholder-gray-500 text-black p-2 rounded-md
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"/>

      {/* Estado */}
      <select
        name="estado"
        value={form.estado || ""}
        onChange={handleChange}
        className="border border-gray-600 text-black p-2 rounded-md
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        <option value="">Seleccionar estado</option>
        <option value="Activo">Activo</option>
        <option value="Inactivo">Inactivo</option>
      </select>

      {/* Foto (subida nueva) */}
      <div className="col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Foto de perfil
        </label>
        <input
          type="file"
          name="foto"
          accept="image/*"
          onChange={handleChange}
          className="border border-gray-600 text-black p-2 rounded-md w-full
                     file:bg-gray-200 file:mr-3 file:px-3 file:py-1 
                     file:rounded-md file:border file:border-gray-400"/>
      </div>

      {/* Vista previa */}
      {form.foto && (
        <div className="col-span-2 flex justify-center">
          <img
            src={form.foto}
            alt="Vista previa"
            className="w-32 h-32 object-cover rounded-md border border-gray-400"/>
        </div>
      )}

      {/* Botones */}
      <div className="col-span-2 flex gap-3 mt-2">
        <button 
          type="submit"
          className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors">
          Guardar
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-300 py-2 px-4 text-black rounded-md hover:bg-gray-400 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}