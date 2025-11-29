import { useState, useEffect } from "react";
import { Evento } from "@/app/eventos/page";
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

  useEffect(() => {
    setCurrentPage(1);
  }, [eventos]);

  useEffect(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    setPaginatedEventos(eventos.slice(startIndex, endIndex));
  }, [currentPage, eventos]);

  const formatFecha = (fechaStr: string) => {
    if (!fechaStr) return '-';
    try {
      if (fechaStr.includes('T')) {
        const fecha = new Date(fechaStr);
        if (isNaN(fecha.getTime())) return '-';
        const day = fecha.getDate().toString().padStart(2, '0');
        const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const year = fecha.getFullYear();
        return `${day}-${month}-${year}`;
      }
      
      if (fechaStr.includes('-') && fechaStr.length === 10) {
        const [year, month, day] = fechaStr.split('-');
        return `${day}-${month}-${year}`;
      }
      
      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) return '-';
      const day = fecha.getDate().toString().padStart(2, '0');
      const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const year = fecha.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return '-';
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg shadow-lg bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Nombre</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Fecha</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Hora Entrada</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Hora Salida</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Campaña</th>
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
                <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                  {evento.empleadoId}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800">
                  {evento.nombre}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                  {formatFecha(evento.fecha)}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                  {evento.horaEntrada || '-'}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                  {evento.horaSalida || '-'}
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    {evento.campaña || 'Sin grupo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>

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