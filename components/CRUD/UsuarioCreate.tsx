"use client";

import { useState } from "react";
import { Usuario } from "@/lib/mockUsers";

export default function UsuarioCreate({ onCreate }: { onCreate: (u: Usuario) => void }) {
  
  // Obtener fecha actual (YYYY-MM-DD)
  const hoy = new Date();
  const fechaActual = hoy.toISOString().split("T")[0];

  // Obtener hora actual (HH:MM)
  const horaActual = hoy.toTimeString().slice(0, 5);

  const [form, setForm] = useState({
    nombre: "",
    empleadoId: "",
    hora: horaActual,
    fecha: fechaActual,
    tipo: "",
    foto: ""
  });

  const handleChange = (e: any) => {
    if (e.target.name === "foto") {
      const file = e.target.files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        setForm({ ...form, foto: url });
      }
    } else {
      setForm({ ...form, [e.target.name]: e.target.value });
    }
  };

  const crear = (e: any) => {
    e.preventDefault();

    const nuevo: Usuario = {
      id: Date.now(),
      ...form
    };

    onCreate(nuevo);

    // Recargar fecha y hora actual después de enviar
    const now = new Date();

    setForm({
      empleadoId: "",
      nombre: "",
      hora: now.toTimeString().slice(0, 5),
      fecha: now.toISOString().split("T")[0],
      tipo: "",
      foto: ""
    });
  };

  return (
    <form onSubmit={crear} className="bg-white shadow-md rounded-lg p-5 mt-4 grid grid-cols-2 gap-4">
      <h2 className="col-span-2 text-xl font-semibold mb-2">Crear Usuario</h2>

      {/* Campos */}
      {["empleadoId", "nombre", "tipo"].map((field) => (
        <input
          key={field}
          name={field}
          type="text"
          placeholder={field}
          value={(form as any)[field]}
          onChange={handleChange}
          className="border border-gray-500 placeholder-gray-600 p-2 rounded-md
                     text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      ))}

      {/* FECHA */}
      <input
        name="fecha"
        type="date"
        value={form.fecha}
        onChange={handleChange}
        max={new Date().toISOString().split("T")[0]}
        className="border border-gray-500 p-2 rounded-md text-black
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        required
      />

      {/* HORA */}
      <input
        name="hora"
        type="time"
        value={form.hora}
        onChange={handleChange}
        className="border border-gray-500 p-2 rounded-md text-black
                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        required
      />

      {/* FOTO */}
      <input
        type="file"
        name="foto"
        accept="image/*"
        onChange={handleChange}
        className="border border-gray-500 p-2 rounded-md 
          text-black file:bg-gray-200 file:mr-3 file:px-3 file:py-1 
          file:rounded-md file:border file:border-gray-400"
      />

      {/* PREVIEW */}
      {form.foto && (
        <img
          src={form.foto}
          className="col-span-2 w-32 h-32 object-cover rounded-md border border-gray-400"
        />
      )}

      <button className="col-span-2 bg-green-500 text-white py-2 rounded-md hover:bg-green-600">
        Crear
      </button>
    </form>
  );
}
