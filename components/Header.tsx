import { useState, useEffect } from 'react';

interface HeaderProps {
  eventosCount: number;
  onRefresh: () => void;
  isRefreshing?: boolean;
  selectedPeriodo: 'hoy' | '7dias' | '30dias' | 'personalizado';
  onPeriodoChange: (periodo: 'hoy' | '7dias' | '30dias' | 'personalizado') => void;
  onFechasChange: (inicio: string, fin: string) => void;
  fechaInicio: string;
  fechaFin: string;
}

export function Header({
  eventosCount,
  onRefresh,
  isRefreshing = false,
  selectedPeriodo,
  onPeriodoChange,
  onFechasChange,
  fechaInicio,
  fechaFin
}: HeaderProps) {

  const [localFechaInicio, setLocalFechaInicio] = useState(fechaInicio);
  const [localFechaFin, setLocalFechaFin] = useState(fechaFin);

  // Sincronizar con las props cuando cambien
  useEffect(() => {
    setLocalFechaInicio(fechaInicio);
    setLocalFechaFin(fechaFin);
  }, [fechaInicio, fechaFin]);

  const getPeriodoButtonClass = (periodo: 'hoy' | '7dias' | '30dias' | 'personalizado') => {
    const isSelected = selectedPeriodo === periodo;
    return `px-4 py-2 text-sm font-medium rounded-lg transition-all ${isSelected
      ? 'bg-blue-600 text-white shadow-md'
      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
      }`;
  };

  const handleFechaInicioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevaInicio = e.target.value;
    setLocalFechaInicio(nuevaInicio);
    // Solo actualizar en el padre SIN buscar - pasar fechaFin actual
    onFechasChange(nuevaInicio, fechaFin);
  };

  const handleFechaFinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevaFin = e.target.value;
    setLocalFechaFin(nuevaFin);

    if (fechaInicio && nuevaFin) {
      onPeriodoChange('personalizado');
      // Solo actualizar estado, no buscar
      onFechasChange(fechaInicio, nuevaFin);
    }
  };

  // Formatear fecha para mostrar
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6 mt-6">
      {/* Título Principal */}
      <div className="text-center mb-1">
        <h1 className="text-2xl font-bold text-gray-800">Reporte de Accesos Biométricos</h1>
        <p className="text-gray-600 mt-1">Sistema de Control de Ingresos y Salidas</p>
      </div>

      {/* Panel de Filtros */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Periodos Rápidos */}
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-green-800 uppercase tracking-wide">Periodos Rápidos</h3>
            <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => onPeriodoChange('hoy')}
              disabled={isRefreshing}
              className={`px-2 py-2 text-xs font-medium rounded transition-all ${selectedPeriodo === 'hoy'
                ? 'bg-green-700 text-white'
                : 'bg-white text-gray-700 hover:bg-green-100 border border-green-300'
                } disabled:opacity-50`}
            >
              Hoy
            </button>
            <button
              onClick={() => onPeriodoChange('7dias')}
              disabled={isRefreshing}
              className={`px-2 py-2 text-xs font-medium rounded transition-all ${selectedPeriodo === '7dias'
                ? 'bg-green-700 text-white'
                : 'bg-white text-gray-700 hover:bg-green-100 border border-green-300'
                } disabled:opacity-50`}
            >
              7 Días
            </button>
            <button
              onClick={() => onPeriodoChange('30dias')}
              disabled={isRefreshing}
              className={`px-2 py-2 text-xs font-medium rounded transition-all ${selectedPeriodo === '30dias'
                ? 'bg-green-700 text-white'
                : 'bg-white text-gray-700 hover:bg-green-100 border border-green-300'
                } disabled:opacity-50`}
            >
              30 Días
            </button>
          </div>
        </div>

        {/* Rango de Fechas */}
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Rango de Fechas</h3>
            <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">Inicio</label>
              <input
                type="date"
                value={localFechaInicio}
                onChange={handleFechaInicioChange}
                className="w-full px-2 py-1 bg-white border border-blue-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">Fin</label>
              <input
                type="date"
                value={localFechaFin}
                onChange={handleFechaFinChange}
                className="w-full px-2 py-1 bg-white border border-blue-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                min={localFechaInicio}
              />
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-purple-800 uppercase tracking-wide">Resumen</h3>
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-700 mb-1">{eventosCount}</div>
            <div className="text-sm text-purple-600 font-medium">Eventos Encontrados</div>
          </div>
        </div>
      </div>

      {/* Barra de Estado */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Periodo activo:</span>
              <span className="font-semibold text-gray-800">
                {selectedPeriodo === 'hoy' && 'Hoy'}
                {selectedPeriodo === '7dias' && 'Últimos 7 días'}
                {selectedPeriodo === '30dias' && 'Últimos 30 días'}
                {selectedPeriodo === 'personalizado' && `Personalizado (${formatDisplayDate(fechaInicio)} a ${formatDisplayDate(fechaFin)})`}
              </span>
            </div>

            {selectedPeriodo === 'personalizado' && fechaInicio && fechaFin && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Rango:</span>
                <span className="font-medium text-blue-700">
                  {formatDisplayDate(fechaInicio)} - {formatDisplayDate(fechaFin)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-600">Estado:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${isRefreshing
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-green-100 text-green-800'
              }`}>
              {isRefreshing ? 'Procesando...' : 'Listo'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}