/**
 * Página de reportes xAPI
 * Muestra statements xAPI con filtros y estadísticas
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, BarChart3, Users, BookOpen } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@shared/components/ui/Card';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import { xapiService } from '@shared/services/xapi/xapiService';
import XAPIStatementViewer from '../components/XAPIStatementViewer';
import type { XAPIStatement } from '@shared/types/elearning-standards';

export default function XAPIReportsPage() {
  const navigate = useNavigate();
  const [statements, setStatements] = useState<XAPIStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');

  useEffect(() => {
    loadStatements();
  }, []);

  const loadStatements = async () => {
    try {
      setLoading(true);
      const result = await xapiService.getStatements();
      setStatements(result);
    } catch (err) {
      console.error('Error cargando statements xAPI:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const result = await xapiService.getStatements({
        userId: userFilter || undefined,
        courseId: courseFilter || undefined,
      });
      setStatements(result);
    } catch (err) {
      console.error('Error buscando statements:', err);
    } finally {
      setLoading(false);
    }
  };

  // Estadísticas
  const stats = useMemo(() => {
    const uniqueUsers = new Set(statements.map(s => s.actor.account?.name || s.actor.name));
    const verbCounts = new Map<string, number>();
    statements.forEach(s => {
      const verb = s.verb.display?.['es'] || s.verb.display?.['en-US'] || s.verb.id;
      verbCounts.set(verb, (verbCounts.get(verb) || 0) + 1);
    });

    const topVerbs = Array.from(verbCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      totalStatements: statements.length,
      uniqueUsers: uniqueUsers.size,
      topVerbs,
    };
  }, [statements]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Reportes xAPI</h1>
          <p className="text-gray-500">Análisis de actividad de aprendizaje</p>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalStatements}</p>
              <p className="text-sm text-gray-500">Total Statements</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
              <p className="text-sm text-gray-500">Usuarios Activos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.topVerbs.length}</p>
              <p className="text-sm text-gray-500">Tipos de Actividad</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Verbos más usados */}
      {stats.topVerbs.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Actividades Más Frecuentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topVerbs.map(([verb, count]) => (
                <div key={verb} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-32 truncate">{verb}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(count / stats.totalStatements) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-12 text-right">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros de búsqueda */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label htmlFor="user-filter">ID de Usuario</Label>
              <Input
                id="user-filter"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="Filtrar por usuario"
              />
            </div>
            <div>
              <Label htmlFor="course-filter">ID de Curso</Label>
              <Input
                id="course-filter"
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                placeholder="Filtrar por curso"
              />
            </div>
            <Button onClick={handleSearch}>Buscar</Button>
            <Button variant="outline" onClick={() => { setUserFilter(''); setCourseFilter(''); loadStatements(); }}>
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statements */}
      <Card>
        <CardHeader>
          <CardTitle>Statements xAPI</CardTitle>
        </CardHeader>
        <CardContent>
          <XAPIStatementViewer statements={statements} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}
