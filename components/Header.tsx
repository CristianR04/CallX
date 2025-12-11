// components/Header.tsx
import { useState, useEffect } from 'react';

interface HeaderEventosProps {
  estadisticas: {
    usuariosPorDepartamento: Record<string, number>;
  };
  departamentoFiltro: string | null;
  onFiltroChange: (departamento: string | null) => void;
  eventosCount: number;
  onRefresh: () => void;
  isRefreshing?: boolean;
  selectedPeriodo: 'hoy' | '7dias' | '30dias' | 'personalizado';
  onPeriodoChange: (periodo: 'hoy' | '7dias' | '30dias' | 'personalizado') => void;
  onFechasChange: (inicio: string, fin: string) => void;
  fechaInicio: string;
  fechaFin: string;
  // ELIMINAMOS las props de Excel
}

export function HeaderEventos({
  estadisticas,
  departamentoFiltro,
  onFiltroChange,
  eventosCount,
  onRefresh,
  isRefreshing = false,
  selectedPeriodo,
  onPeriodoChange,
  onFechasChange,
  fechaInicio,
  fechaFin,
  // ELIMINAMOS las props de Excel
}: HeaderEventosProps) {

  const [localFechaInicio, setLocalFechaInicio] = useState(fechaInicio);
  const [localFechaFin, setLocalFechaFin] = useState(fechaFin);

  // Sincronizar con las props cuando cambien
  useEffect(() => {
    setLocalFechaInicio(fechaInicio);
    setLocalFechaFin(fechaFin);
  }, [fechaInicio, fechaFin]);

  const handleFechaInicioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevaInicio = e.target.value;
    setLocalFechaInicio(nuevaInicio);
    onFechasChange(nuevaInicio, fechaFin);
  };

  const handleFechaFinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevaFin = e.target.value;
    setLocalFechaFin(nuevaFin);
    if (fechaInicio && nuevaFin) {
      onPeriodoChange('personalizado');
      onFechasChange(fechaInicio, nuevaFin);
    }
  };

  // Colores para departamentos
  const getDepartamentoColor = (depto: string) => {
    const coloresDepartamentos: Record<string, string> = {
      "TI": "from-purple-600 to-purple-500 border-purple-500/50",
      "Teams Leaders": "from-blue-600 to-blue-500 border-blue-500/50",
      "Campana 5757": "from-emerald-600 to-emerald-500 border-emerald-500/50",
      "Campana SAV": "from-yellow-600 to-yellow-500 border-yellow-500/50",
      "Campana REFI": "from-red-600 to-red-500 border-red-500/50",
      "Campana PL": "from-indigo-600 to-indigo-500 border-indigo-500/50",
      "Campana PARLO": "from-pink-600 to-pink-500 border-pink-500/50",
      "Administrativo": "from-slate-600 to-slate-500 border-slate-500/50",
      "No asignado": "from-gray-600 to-gray-500 border-gray-500/50"
    };
    return coloresDepartamentos[depto] || "from-gray-600 to-gray-500 border-gray-500/50";
  };

  return (
    <>
      <div className="p-4 pt-20">
        <div className="mb-4 p-6 pt-2 pb-1 bg-gradient-to-r from-slate-600 via-emerald-600 to-slate-700 rounded-lg shadow-lg border border-slate-500/30">

          {/* PRIMERA FILA: Título y estadísticas */}
          <div className="mb-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-white">Reporte de Accesos Biométricos</h1>
              </div>

              {/* CONTENEDOR DE BOTONES DERECHOS - SOLO BOTÓN ACTUALIZAR */}
              <div className="flex items-center gap-2">
                {/* Botón de actualizar */}
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {isRefreshing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Actualizar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* SEGUNDA FILA: Los tres elementos en una fila */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-1">

            {/* COLUMNA 1: Filtro por período */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-500/30 p-4 lg:col-span-1">
              <div className="flex items-center justify-between mb-1 p-1">
                <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Período
                </h3>
              </div>

              {/* Indicador de período activo */}
              <div className="mb-2 p-3 bg-slate-900/50 rounded border border-slate-600/50">
                <div className="flex items-center gap-2">
                  <div className="text-xs text-slate-400">Período activo:</div>
                  <div className="text-sm font-medium text-white truncate">
                    {selectedPeriodo === 'hoy' && 'Hoy'}
                    {selectedPeriodo === '7dias' && 'Últimos 7 días'}
                    {selectedPeriodo === '30dias' && 'Últimos 30 días'}
                    {selectedPeriodo === 'personalizado' && `Personalizado`}
                  </div>
                </div>
              </div>

              {/* Botones de período */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => onPeriodoChange('hoy')}
                  disabled={isRefreshing}
                  className={`px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${selectedPeriodo === 'hoy'
                    ? 'bg-emerald-700 text-white shadow-md'
                    : 'bg-slate-700/70 text-slate-200 hover:bg-slate-600/70 border border-slate-500/30'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => onPeriodoChange('7dias')}
                  disabled={isRefreshing}
                  className={`px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${selectedPeriodo === '7dias'
                    ? 'bg-emerald-700 text-white shadow-md'
                    : 'bg-slate-700/70 text-slate-200 hover:bg-slate-600/70 border border-slate-500/30'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  7 Días
                </button>
                <button
                  onClick={() => onPeriodoChange('30dias')}
                  disabled={isRefreshing}
                  className={`px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${selectedPeriodo === '30dias'
                    ? 'bg-emerald-700 text-white shadow-md'
                    : 'bg-slate-700/70 text-slate-200 hover:bg-slate-600/70 border border-slate-500/30'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  30 Días
                </button>
              </div>
            </div>

            {/* COLUMNA 2: Rango personalizado - OCUPA 3 COLUMNAS */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-500/30 p-3 lg:col-span-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Rango Personalizado
                </h3>
                <button
                  onClick={() => onPeriodoChange('personalizado')}
                  disabled={!fechaInicio || !fechaFin}
                  className={`text-sm px-4 py-2 rounded-lg flex items-center gap-2 ${selectedPeriodo === 'personalizado' && fechaInicio && fechaFin
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Aplicar
                </button>
              </div>

              {/* Fechas a los lados - CON MÁS ESPACIO */}
              <div className="flex items-center gap-6 mb-4">
                {/* Fecha Inicio */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <label className="text-sm font-medium text-slate-300">Fecha Inicio</label>
                  </div>
                  <input
                    type="date"
                    value={localFechaInicio}
                    onChange={handleFechaInicioChange}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-base focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-white shadow-sm"
                  />
                </div>

                {/* Flecha separadora más grande */}
                <div className="pt-8">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>

                {/* Fecha Fin */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <label className="text-sm font-medium text-slate-300">Fecha Fin</label>
                  </div>
                  <input
                    type="date"
                    value={localFechaFin}
                    onChange={handleFechaFinChange}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-base focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-white shadow-sm"
                    min={localFechaInicio}
                  />
                </div>
              </div>

              {/* Botón rápido de aplicar para móvil */}
              <div className="lg:hidden">
                <button
                  onClick={() => onPeriodoChange('personalizado')}
                  disabled={!fechaInicio || !fechaFin}
                  className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${selectedPeriodo === 'personalizado' && fechaInicio && fechaFin
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Aplicar Rango Personalizado
                </button>
              </div>
            </div>

            {/* COLUMNA 3: Resumen */}
            <div className="bg-gradient-to-br from-purple-900/60 to-purple-800/60 rounded-lg border border-purple-500/30 p-4 shadow-lg lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-purple-200 uppercase tracking-wide">Resumen</h3>
                <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-white mb-3">{eventosCount}</div>
                <div className="text-sm text-purple-200 font-medium">
                  Eventos {departamentoFiltro ? 'Filtrados' : 'Encontrados'}
                </div>
                {departamentoFiltro && (
                  <div className="mt-2 text-xs text-purple-300">
                    Filtro: {departamentoFiltro}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TERCERA FILA: Filtros por Departamento */}
          <div className="pt-4 border-t border-slate-500/50">
            <div className="flex items-start md:items-center gap-3 mb-3 flex-col md:flex-row">
              {/* Título y contador */}
              <div className="flex items-center text-sm font-medium text-slate-200">
                <svg className="w-4 h-4 mr-2 text-emerald-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                </svg>
                <span className="whitespace-nowrap">Filtro por Departamento</span>
                <span className="ml-2 px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded-full border border-slate-600">
                  {Object.keys(estadisticas.usuariosPorDepartamento).length}
                </span>
              </div>

              {/* Botón Todos */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => onFiltroChange(null)}
                  className={`transition-all duration-200 px-3 py-1.5 rounded-lg border flex-shrink-0 shadow-sm text-xs font-medium ${!departamentoFiltro
                    ? 'bg-gradient-to-br from-emerald-700 to-emerald-600 border-emerald-500/50 text-white'
                    : 'bg-gradient-to-br from-slate-700/80 to-slate-800/80 hover:from-slate-600/80 hover:to-slate-700/80 border-slate-600/40 hover:border-slate-500/50 text-slate-200'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                    </svg>
                    Todos
                  </div>
                </button>
              </div>

              {/* Botones de departamentos */}
              <div className="overflow-x-auto flex-1">
                <div className="flex gap-1.5 min-w-min">
                  {Object.keys(estadisticas.usuariosPorDepartamento)
                    .sort((a, b) => a.localeCompare(b))
                    .map((depto) => {
                      const colorClase = getDepartamentoColor(depto);
                      const isActive = departamentoFiltro === depto;
                      const count = estadisticas.usuariosPorDepartamento[depto] || 0;

                      return (
                        <button
                          key={depto}
                          onClick={() => onFiltroChange(isActive ? null : depto)}
                          className={`transition-all duration-200 px-3 py-1.5 rounded-lg border flex-shrink-0 shadow-sm ${isActive
                            ? `bg-gradient-to-br ${colorClase} text-white font-medium`
                            : 'bg-gradient-to-br from-slate-700/80 to-slate-800/80 hover:from-slate-600/80 hover:to-slate-700/80 border-slate-600/40 hover:border-slate-500/50 text-slate-200'
                            }`}
                          title={`Filtrar por ${depto} (${count} usuarios)\nClick para ${isActive ? 'quitar filtro' : 'aplicar filtro'}`}
                        >
                          <div className="text-xs font-medium flex items-center gap-1.5">
                            <span className="truncate max-w-[100px]">{depto}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[20px] flex items-center justify-center ${isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-900/50 text-slate-300'
                              }`}>
                              {count}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}