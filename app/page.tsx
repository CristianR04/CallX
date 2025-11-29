"use client";
import { useState } from "react";

export default function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e: any) => {
    e.preventDefault();
    console.log({ usuario, password });
  };

  return (
    <div className="min-h-screen  flex items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200">

      {/* CONTENEDOR PRINCIPAL */}
      <div className="bg-white min-h-[500px] shadow-2xl rounded-xl overflow-hidden flex w-full max-w-4xl">

        {/* PANEL IZQUIERDO (IMAGEN) */}
        <div className="hidden md:block w-1/2 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT2n6eDAYcZUVN7yVv_PXiwggkq5Av_jAjbaXUfo7iQCy77uNSjv5Kh1O3uSxezukU86RU&usqp=CAU')"
          }}
        ></div>

        {/* PANEL DERECHO (FORMULARIO) */}
        <div className="w-full md:w-1/2 p-8">

          <h1 className="text-3xl font-bold text-center mb-6 text-green-700">
            Iniciar Sesión
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-black">

            {/* Usuario */}
            <div>
              <label className="text-sm font-medium">Usuario</label>
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 mt-1">
                <i className="bi bi-person text-gray-500"></i>
                <input
                  type="text"
                  className="w-full outline-none"
                  placeholder="Nombre de usuario"
                  value={usuario}
                  onChange={e => setUsuario(e.target.value)}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label className="text-sm font-medium">Contraseña</label>

              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 mt-1 relative">
                <i className="bi bi-lock-fill text-gray-500"></i>

                <input
                  type={showPass ? "text" : "password"}
                  className="w-full outline-none"
                  placeholder="•••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />

                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 text-gray-600 hover:text-gray-800"
                >
                  {showPass ? (
                    <i className="bi bi-eye-slash-fill text-xl"></i>
                  ) : (
                    <i className="bi bi-eye-fill text-xl"></i>
                  )}
                </button>
              </div>
            </div>

            {/* Olvidaste contraseña */}
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-green-700 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {/* Botón login */}
            <button
              type="submit"
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition shadow-md"
            >
              Ingresar
            </button>

            

          </form>

        </div>

      </div>
    </div>
  );
}
