import { useState, useEffect } from "react";
import { Evento } from "@/app/page";
import { Pagination } from "@/components/Pagination";

interface TablaEventosProps {
  eventos: Evento[];
  isLoading: boolean;
}

export function EventosTable({ eventos, isLoading }: TablaEventosProps) {
  const ITEMS_PER_PAGE = 6;

  const [currentPage, setCurrentPage] = useState(1);
  const [paginatedEventos, setPaginatedEventos] = useState<Evento[]>([]);
  const totalPages = Math.ceil(eventos.length / ITEMS_PER_PAGE);

  // Recalcular paginación cada vez que llegan nuevos eventos
  useEffect(() => {
    setCurrentPage(1); // Reiniciar a página 1
  }, [eventos]);

  // Cortar los eventos según la página seleccionada
  useEffect(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    setPaginatedEventos(eventos.slice(startIndex, endIndex));
  }, [currentPage, eventos]);

  return (
    <div className="overflow-x-auto rounded-lg shadow-lg bg-white">

      {/* Tabla */}
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Nombre</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Hora</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Fecha</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Tipo</th>
            {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Foto</th> */}
          </tr>
        </thead>

        {isLoading ? (
          <tbody>
            <tr>
              <td colSpan={6} className="text-center py-10 text-gray-500">
                Cargando eventos...
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedEventos.map((evento, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {/* Documento */}
                <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                  {evento.empleadoId}
                </td>
                {/* Nombre */}
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800">
                  {evento.nombre}
                </td>
                
                {/* Hora */}
                <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                  {new Date(evento.hora).toLocaleTimeString("es-CO")}
                </td>
                
                {/* Fecha */}
                <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                  {evento.fecha}
                </td>

                {/* Tipo */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {evento.tipo}
                  </span>
                </td>
                {/* Foto */}
                {/* <td className="px-6 py-4 whitespace-nowrap">
                  {evento.foto ? (
                    <img
                      src={evento.foto}
                      alt="Foto acceso"
                      className="w-12 h-12 rounded-lg object-cover shadow-sm border"
                    />
                  ) : (
                    <span className="text-gray-400 text-sm">Sin foto</span>
                  )}
                </td> */}

              </tr>
            ))}
          </tbody>
        )}
      </table>

      {/* PAGINACIÓN */}
      {!isLoading && totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      )}
    </div>
  );
}
