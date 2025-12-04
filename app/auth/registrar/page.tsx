"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    documento: "",
    nombre: "",
    users: "",
    passward: "",
    confirmPassward: "",
    fecha_registro: new Date().toISOString().split('T')[0],
    rol: "TI", // ← Valor por defecto: TI
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  // Solo 2 roles: Administrador y TI
  const rolesDisponibles = [
    { 
      value: "Administrador", 
      label: "Admin", 
      icon: "bi-shield-check",
      desc: "Administrador",
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-50",
      borderColor: "border-green-200"
    },
    { 
      value: "TI", 
      label: "TI", 
      icon: "bi-cpu",
      desc: "Tecnología",
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200"
    },
    
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.documento.trim()) {
      newErrors.documento = "El documento es requerido";
    } else if (!/^\d{8,15}$/.test(formData.documento)) {
      newErrors.documento = "Documento inválido (8-15 dígitos)";
    }

    if (!formData.nombre.trim()) {
      newErrors.nombre = "El nombre completo es requerido";
    } else if (formData.nombre.length < 5) {
      newErrors.nombre = "Nombre muy corto (mínimo 5 caracteres)";
    }

    if (!formData.users.trim()) {
      newErrors.users = "El nombre de usuario es requerido";
    } else if (!/^[a-zA-Z0-9._-]+$/.test(formData.users)) {
      newErrors.users = "Solo letras, números, puntos, guiones y guiones bajos";
    }

    if (!formData.passward) {
      newErrors.passward = "La contraseña es requerida";
    } else if (formData.passward.length < 6) {
      newErrors.passward = "Mínimo 6 caracteres";
    }

    if (formData.passward !== formData.confirmPassward) {
      newErrors.confirmPassward = "Las contraseñas no coinciden";
    }

    // Validar rol (debe ser TI o Administrador)
    if (!formData.rol || !["TI", "Administrador"].includes(formData.rol)) {
      newErrors.rol = "Selecciona un tipo de usuario";
    }

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccess("");

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documento: formData.documento,
          nombre: formData.nombre,
          users: formData.users,
          passward: formData.passward,
          fecha_registro: formData.fecha_registro, 
          rol: formData.rol,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.includes("ya existe")) {
          setErrors({ users: "Este nombre de usuario ya está registrado" });
        } else if (data.error?.includes("documento")) {
          setErrors({ documento: "Este documento ya está registrado" });
        } else {
          setErrors({ general: data.error || "Error en el registro" });
        }
      } else {
        setSuccess(`✅ ¡${formData.rol} registrado exitosamente! Redirigiendo...`);
        
        // Limpiar formulario
        setFormData({
          documento: "",
          nombre: "",
          users: "",
          passward: "",
          confirmPassward: "",
          fecha_registro: new Date().toISOString().split('T')[0],
          rol: "TI",
        });
        
        // Redirigir después de 2 segundos
        setTimeout(() => {
          router.push("/");
        }, 2000);
      }
    } catch (error) {
      console.error("Error en registro:", error);
      setErrors({ general: "Error de conexión con el servidor" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-900 to-green-900">
      {/* IMAGEN A LA IZQUIERDA */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <div
          className="absolute inset-0 bg-contain bg-no-repeat bg-center"
          style={{
            backgroundImage: "url('/Logo.png')",
          }}
        >
          <div className="absolute inset-0 bg-black/60"></div>
        </div>
        
        {/* Texto sobre la imagen */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <h1 className="text-5xl font-bold mb-6 text-center">
           <span className="text-green-400">CallX</span>
          </h1>
          <p className="text-xl text-gray-300 text-center max-w-lg mb-12">
            Sistema integral de gestión y monitoreo de eventos
          </p>
          
          <div className="flex gap-4">
            <div className="flex items-center gap-3 p-3 bg-blue-500/20 rounded-lg backdrop-blur-sm">
              <i className="bi bi-cpu text-xl text-blue-300"></i>
              <div>
                <h3 className="font-medium">TI</h3>
                <p className="text-xs text-gray-300">Tecnología</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-green-500/20 rounded-lg backdrop-blur-sm">
              <i className="bi bi-shield-check text-xl text-green-300"></i>
              <div>
                <h3 className="font-medium">Admin</h3>
                <p className="text-xs text-gray-300">Administrador</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FORMULARIO DE REGISTRO */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-4 lg:p-12">
        <div className="bg-white/95 backdrop-blur-sm w-full max-w-2xl p-8 lg:p-12 rounded-2xl shadow-2xl border border-white/20">
          
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-600 to-emerald-500 flex items-center justify-center">
                <i className="bi bi-person-plus text-white text-xl"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Crear Cuenta</h1>
                <p className="text-gray-600 text-sm">Registro de nuevo usuario</p>
              </div>
            </div>
          </div>

          {/* Mensajes de error/success */}
          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill text-red-500"></i>
                <p className="text-red-700 text-sm">{errors.general}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg animate-fadeIn">
              <div className="flex items-center gap-2">
                <i className="bi bi-check-circle-fill text-green-500"></i>
                <p className="text-green-700 text-sm">{success}</p>
              </div>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Documento */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Documento
                </label>
                <input
                  type="text"
                  name="documento"
                  value={formData.documento}
                  onChange={handleChange}
                  className={`block w-full px-3 py-2.5 border ${
                    errors.documento ? 'border-red-300' : 'border-gray-300'
                  } rounded-lg bg-white/50 focus:ring-2 focus:ring-green-500 text-black focus:border-transparent transition text-sm`}
                  placeholder="1234567"
                  disabled={loading}
                  maxLength={15}
                />
                {errors.documento && (
                  <p className="text-red-500 text-xs mt-1">{errors.documento}</p>
                )}
              </div>

              {/* Nombre Completo */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  className={`block w-full px-3 py-2.5 border ${
                    errors.nombre ? 'border-red-300' : 'border-gray-300'
                  } rounded-lg bg-white/50 focus:ring-2 text-black focus:ring-green-500 focus:border-transparent transition text-sm`}
                  placeholder="Nombre Completo"
                  disabled={loading}
                />
                {errors.nombre && (
                  <p className="text-red-500 text-xs mt-1">{errors.nombre}</p>
                )}
              </div>

              {/* Nombre de Usuario */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Usuario
                </label>
                <input
                  type="text"
                  name="users"
                  value={formData.users}
                  onChange={handleChange}
                  className={`block w-full px-3 py-2.5 border ${
                    errors.users ? 'border-red-300' : 'border-gray-300'
                  } rounded-lg bg-white/50 focus:ring-2 text-black focus:ring-green-500 focus:border-transparent transition text-sm`}
                  placeholder="usuario"
                  disabled={loading}
                />
                {errors.users && (
                  <p className="text-red-500 text-xs mt-1">{errors.users}</p>
                )}
              </div>

              {/* Contraseña */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Contraseña
                </label>
                <input
                  type="password"
                  name="passward"
                  value={formData.passward}
                  onChange={handleChange}
                  className={`block w-full px-3 py-2.5 border ${
                    errors.passward ? 'border-red-300' : 'border-gray-300'
                  } rounded-lg bg-white/50 focus:ring-2 text-black focus:ring-green-500 focus:border-transparent transition text-sm`}
                  placeholder="••••••••"
                  disabled={loading}
                />
                {errors.passward && (
                  <p className="text-red-500 text-xs mt-1">{errors.passward}</p>
                )}
              </div>

              {/* Confirmar Contraseña */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Confirmar Contraseña
                </label>
                <input
                  type="password"
                  name="confirmPassward"
                  value={formData.confirmPassward}
                  onChange={handleChange}
                  className={`block w-full px-3 py-2.5 border ${
                    errors.confirmPassward ? 'border-red-300' : 'border-gray-300'
                  } rounded-lg bg-white/50 text-black focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm`}
                  placeholder="••••••••"
                  disabled={loading}
                />
                {errors.confirmPassward && (
                  <p className="text-red-500 text-xs mt-1">{errors.confirmPassward}</p>
                )}
              </div>

              {/* SELECTOR DE ROL - BOTONES COMPACTOS */}
              <div className="space-y-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Usuario
                </label>
                
                {/* Dos botones pequeños lado a lado */}
                <div className="flex gap-3">
                  {rolesDisponibles.map((rolOption) => (
                    <div key={rolOption.value} className="flex-1">
                      <input
                        type="radio"
                        id={`rol-${rolOption.value}`}
                        name="rol"
                        value={rolOption.value}
                        checked={formData.rol === rolOption.value}
                        onChange={handleChange}
                        className="sr-only peer"
                        disabled={loading}
                      />
                      <label
                        htmlFor={`rol-${rolOption.value}`}
                        className={`
                          block p-3 border rounded-lg cursor-pointer transition-all duration-200
                          peer-checked:border-2 peer-checked:shadow-sm
                          hover:border-gray-400
                          ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                          ${errors.rol ? 'border-red-300' : 'border-gray-300'}
                          ${rolOption.bgColor}
                          ${formData.rol === rolOption.value 
                            ? `border-2 ${rolOption.value === 'TI' ? 'border-blue-500' : 'border-green-500'} bg-white` 
                            : ''
                          }
                        `}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            formData.rol === rolOption.value 
                              ? rolOption.value === 'TI' ? 'bg-blue-100' : 'bg-green-100'
                              : 'bg-white'
                          }`}>
                            <i className={`bi ${rolOption.icon} ${
                              formData.rol === rolOption.value 
                                ? rolOption.value === 'TI' ? 'text-blue-600' : 'text-green-600'
                                : rolOption.value === 'TI' ? 'text-blue-500' : 'text-green-500'
                            }`}></i>
                          </div>
                          
                          <div className="text-center">
                            <span className={`font-medium text-sm ${
                              formData.rol === rolOption.value 
                                ? rolOption.value === 'TI' ? 'text-blue-700' : 'text-green-700'
                                : 'text-gray-800'
                            }`}>
                              {rolOption.label}
                            </span>
                            <p className={`text-xs ${
                              formData.rol === rolOption.value 
                                ? rolOption.value === 'TI' ? 'text-blue-600' : 'text-green-600'
                                : 'text-gray-600'
                            }`}>
                              {rolOption.desc}
                            </p>
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
                
                {errors.rol && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <i className="bi bi-exclamation-circle"></i>
                    {errors.rol}
                  </p>
                )}
              </div>
            </div>

            {/* Botón de Registro */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium rounded-lg hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 shadow hover:shadow-md flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Registrando como {formData.rol}...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-person-plus"></i>
                    <span>Registrar como {formData.rol}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          
        </div>
      </div>

      {/* Bootstrap Icons */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css"
      />
      
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}