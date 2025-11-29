"use client";

import Link from "next/link";
import Image from "next/image";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white shadow-sm flex text-black items-center h-16 justify-between px-4">

      {/* IZQUIERDA - LOGO + MENÚ */}
      <div className="flex items-center gap-2 h-full">

        {/* Logo */}
        <div className="relative h-12 w-12 m-4">
          <Image
            src="/Logo.png"
            alt="Mi imagen"
            fill
            className="object-contain"
          />
        </div>

        {/* Menú */}
        <div className="flex ml-2 gap-2 h-full">

          <div className="h-full flex items-center hover:bg-green-600 hover:text-white transition">
            <Link href="#" className="flex items-center gap-2 px-4 h-full">
              <i className="bi bi-people-fill"></i>
              <span>Personas</span>
            </Link>
          </div>

          <div className="h-full flex items-center hover:bg-green-600 hover:text-white transition">
            <Link href="#" className="flex items-center gap-2 px-4 h-full">
              <i className="bi bi-calendar-check-fill"></i>
              <span>Asistencias</span>
            </Link>
          </div>

          <div className="h-full flex items-center hover:bg-green-600 hover:text-white transition">
            <Link href="#" className="flex items-center gap-2 px-4 h-full">
              <i className="bi bi-shield-lock-fill"></i>
              <span>Control de Accesos</span>
            </Link>
          </div>

        </div>
      </div>

      {/* DERECHA - CERRAR SESIÓN */}
      <div className="h-full flex items-center hover:bg-red-600 hover:text-white transition">
            <Link href="#" className="px-4 py-2">
              
              <span>Cerrar sesion </span>
              <i className="bi bi-box-arrow-right"></i>
            </Link>
          </div>

    </nav>
  );
}
