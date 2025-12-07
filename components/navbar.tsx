"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    nombre?: string;
    username?: string;
    role?: string;
  } | null>(null);
  const [loadingLogout, setLoadingLogout] = useState(false);
  const router = useRouter();

  // Verificar sesión al cargar
  useEffect(() => {
    const checkSession = async () => {
      try {
        // 1. Primero intentar obtener de localStorage
        const storedUser = localStorage.getItem('auth-user');
        if (storedUser) {
          setUserInfo(JSON.parse(storedUser));
          return;
        }

        // 2. Si no hay en localStorage, intentar con API de session
        try {
          const response = await fetch('/api/auth/session');
          if (response.ok) {
            const data = await response.json();
            if (data.user) {
              setUserInfo(data.user);
              localStorage.setItem('auth-user', JSON.stringify(data.user));
            }
          }
        } catch (sessionError) {
          console.log("API de session no disponible, usando localStorage");
        }
      } catch (error) {
        console.log("No hay sesión activa");
      }
    };

    checkSession();
  }, []);

  // Función SIMPLIFICADA para cerrar sesión - SIN API
  const handleLogout = async () => {
    setLoadingLogout(true);
    setOpen(false); // Cerrar el dropdown inmediatamente
    
    console.log("🔐 Iniciando logout...");
    
    try {
      // PASO 1: Limpiar localStorage inmediatamente
      localStorage.removeItem('auth-user');
      
      // PASO 2: Limpiar cookies de sesión
      // Eliminar cookies de NextAuth si existen
      const cookiesToClear = [
        'next-auth.session-token',
        '__Secure-next-auth.session-token',
        'next-auth.csrf-token',
        '__Host-next-auth.csrf-token',
        'auth-token',
        'session'
      ];
      
      cookiesToClear.forEach(cookieName => {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      });
      
      // PASO 3: Actualizar estado local
      setUserInfo(null);
      
      // PASO 4: Redirigir inmediatamente a la página principal
      console.log("🔄 Redirigiendo a página principal...");
      
      // Forzar redirección con window.location (más confiable)
      setTimeout(() => {
        window.location.href = '/';
      }, 300);
      
    } catch (error) {
      console.error("Error durante logout:", error);
      
      // Fallback: limpiar y redirigir de todas formas
      localStorage.removeItem('auth-user');
      setUserInfo(null);
      window.location.href = '/';
      
    } finally {
      setLoadingLogout(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white shadow-md border-b border-gray-100 flex text-black items-center h-16 justify-between px-4 md:px-6">
      
      {/* LADO IZQUIERDO - Logo y Menú */}
      <div className="flex items-center gap-4 h-full">
        {/* Logo */}
        <div className="relative h-10 w-10 md:h-12 md:w-12">
          <Image 
            src="/Logo.png" 
            alt="Logo Calix" 
            fill 
            className="object-contain" 
            priority
          />
        </div>

        {/* Menú principal */}
        <div className="hidden md:flex ml-2 gap-1 h-full">
          <div className="h-full flex items-center hover:bg-green-50 hover:text-green-700 transition rounded-lg px-4">
            <Link href="#" className="flex items-center gap-2">
              <i className="bi bi-people-fill"></i>
              <span className="font-medium">Personas</span>
            </Link>
          </div>

          <div className="h-full flex items-center hover:bg-green-50 hover:text-green-700 transition rounded-lg px-4">
            <Link href="/eventos" className="flex items-center gap-2">
              <i className="bi bi-calendar-check-fill"></i>
              <span className="font-medium">Asistencias</span>
            </Link>
          </div>

          <div className="h-full flex items-center hover:bg-green-50 hover:text-green-700 transition rounded-lg px-4">
            <Link href="#" className="flex items-center gap-2">
              <i className="bi bi-shield-lock-fill"></i>
              <span className="font-medium">Control de Accesos</span>
            </Link>
          </div>
        </div>
      </div>

      {/* LADO DERECHO - Info de Usuario y Menú */}
      <div className="flex items-center gap-4">
        
        {/* TARJETA DE USUARIO */}
        {userInfo ? (
          <div className="flex items-center gap-3 p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100 shadow-sm">
            {/* Avatar */}
            <div className="relative">
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
                {userInfo.nombre?.charAt(0) || "U"}
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
            
            {/* Información */}
            <div className="hidden lg:block">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900 text-sm">
                  {userInfo.nombre?.split(' ')[0] || "Usuario"}
                </p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  userInfo.role === 'Administrador' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {userInfo.role || "Usuario"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Sesión activa
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200">
            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
              <i className="bi bi-person text-gray-500"></i>
            </div>
            <div className="hidden md:block">
              <p className="font-medium text-gray-700 text-sm">Invitado</p>
            </div>
          </div>
        )}

        {/* Separador */}
        <div className="h-6 w-px bg-gray-300"></div>

        {/* Botón del menú */}
        <button
          onClick={() => setOpen(!open)}
          className="group relative p-2 rounded-xl bg-gradient-to-br from-green-600 to-green-400 
                    text-white overflow-hidden transition-all duration-300 
                    hover:shadow-lg hover:shadow-green-500/25 
                    active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500/50">
          {/* Efecto de fondo animado */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-green-400 
                          opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          </div>
          
          {/* Ícono hamburger animado - más compacto */}
          <div className="relative z-10 flex flex-col items-center justify-center w-5 h-5">
            <div className={`w-4 h-0.5 bg-white mb-1 transition-all duration-300 
                            ${open ? 'rotate-45 translate-y-1.5' : ''}`}></div>
            <div className={`w-4 h-0.5 bg-white transition-all duration-300 
                            ${open ? 'opacity-0' : ''}`}></div>
            <div className={`w-4 h-0.5 bg-white mt-1 transition-all duration-300 
                            ${open ? '-rotate-45 -translate-y-1.5' : ''}`}></div>
          </div>
        </button>

        {/* Menú desplegable */}
        <div
          className={`
            absolute right-4 top-16 w-56 bg-white shadow-xl rounded-xl py-2 z-50 border border-gray-200
            transition-all duration-300 transform
            ${open ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-2 scale-95 pointer-events-none"}
          `}
        >
          <div className="px-4 py-3 border-b">
            <p className="font-medium text-gray-900">Opciones</p>
          </div>

          <div className="py-2">
            <Link
              href="/auth/registrar"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
              onClick={() => setOpen(false)}
            >
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <i className="bi bi-person-plus text-green-600"></i>
              </div>
              <div>
                <p className="font-medium text-gray-900">Registrar Usuarios</p>
              </div>
            </Link>

            {/* BOTÓN DE LOGOUT SIMPLIFICADO */}
            <button
              onClick={handleLogout}
              disabled={loadingLogout}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition"
            >
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                {loadingLogout ? (
                  <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <i className="bi bi-box-arrow-right text-red-600"></i>
                )}
              </div>
              <div>
                <p className="font-medium text-red-700">
                  {loadingLogout ? "Saliendo..." : "Cerrar Sesión"}
                </p>
                <p className="text-xs text-gray-500">
                  Salir del sistema
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Bootstrap Icons */}
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" />
    </nav>
  );
}