/**
 * Visor de statements xAPI
 * Muestra statements en formato legible con filtros
 */

import { useState, useMemo } from 'react';
import { Activity, Filter, Clock, User, Target } from 'lucide-react';
import type { XAPIStatement } from '@shared/types/elearning-standards';

interface XAPIStatementViewerProps {
  statements: XAPIStatement[];
  loading?: boolean;
}

export default function XAPIStatementViewer({ statements, loading }: XAPIStatementViewerProps) {
  const [verbFilter, setVerbFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const uniqueVerbs = useMemo(() => {
    const verbs = new Map<string, string>();
    statements.forEach(s => {
      const display = s.verb.display?.['es'] || s.verb.display?.['en-US'] || s.verb.id;
      verbs.set(s.verb.id, display);
    });
    return Array.from(verbs.entries());
  }, [statements]);

  const filtered = useMemo(() => {
    let result = [...statements];

    if (verbFilter) {
      result = result.filter(s => s.verb.id === verbFilter);
    }
    if (dateFrom) {
      result = result.filter(s => s.timestamp >= new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      result = result.filter(s => s.timestamp <= endDate.toISOString());
    }

    return result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [statements, verbFilter, dateFrom, dateTo]);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVerbDisplay = (s: XAPIStatement) =>
    s.verb.display?.['es'] || s.verb.display?.['en-US'] || s.verb.id.split('/').pop() || '';

  const getObjectName = (s: XAPIStatement) =>
    s.object.definition?.name?.['es'] || s.object.id.split('/').pop() || '';

  const getActorName = (s: XAPIStatement) =>
    s.actor.name || s.actor.account?.name || 'Desconocido';

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Activity className="h-8 w-8 mx-auto mb-3 animate-pulse" />
        <p>Cargando statements...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <Filter className="h-4 w-4 text-gray-500" />

        <select
          value={verbFilter}
          onChange={(e) => setVerbFilter(e.target.value)}
          className="h-9 px-3 border border-gray-300 rounded-md text-sm"
        >
          <option value="">Todos los verbos</option>
          {uniqueVerbs.map(([id, display]) => (
            <option key={id} value={id}>{display}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 px-3 border border-gray-300 rounded-md text-sm"
          placeholder="Desde"
        />

        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-9 px-3 border border-gray-300 rounded-md text-sm"
          placeholder="Hasta"
        />

        <span className="text-sm text-gray-500">
          {filtered.length} de {statements.length} statements
        </span>
      </div>

      {/* Lista de statements */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No hay statements para mostrar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  {/* Actor + Verbo + Objeto */}
                  <p className="text-sm">
                    <span className="inline-flex items-center gap-1 font-medium text-gray-800">
                      <User className="h-3.5 w-3.5" />
                      {getActorName(s)}
                    </span>
                    {' '}
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {getVerbDisplay(s)}
                    </span>
                    {' '}
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <Target className="h-3.5 w-3.5" />
                      {getObjectName(s)}
                    </span>
                  </p>

                  {/* Resultado */}
                  {s.result && (
                    <div className="flex gap-3 text-xs text-gray-500">
                      {s.result.score?.raw !== undefined && (
                        <span>Puntuación: {s.result.score.raw}{s.result.score.max ? `/${s.result.score.max}` : ''}</span>
                      )}
                      {s.result.success !== undefined && (
                        <span className={s.result.success ? 'text-green-600' : 'text-red-600'}>
                          {s.result.success ? 'Aprobado' : 'Reprobado'}
                        </span>
                      )}
                      {s.result.completion !== undefined && (
                        <span>{s.result.completion ? 'Completado' : 'Incompleto'}</span>
                      )}
                      {s.result.duration && (
                        <span>Duración: {s.result.duration}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <span className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(s.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
