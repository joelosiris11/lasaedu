import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  sectionService,
  moduleService,
  lessonService,
  type DBSection,
} from '@shared/services/dataService';
import {
  ArrowLeft,
  Save,
  Calendar,
  Loader2,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';

interface DateRow {
  lessonId: string;
  lessonTitle: string;
  lessonType: string;
  moduleName: string;
  availableFrom: string;
  dueDate: string;
  lateSubmissionDeadline: string;
  timeLimit: string;
  existingOverrideId?: string;
}

export default function SectionDatesPage() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const navigate = useNavigate();

  const [section, setSection] = useState<DBSection | null>(null);
  const [dateRows, setDateRows] = useState<DateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!sectionId) return;
    const load = async () => {
      setLoading(true);
      try {
        const sec = await sectionService.getById(sectionId);
        if (!sec) return;
        setSection(sec);

        const [mods, overrides] = await Promise.all([
          moduleService.getByCourse(sec.courseId),
          sectionService.getLessonOverrides(sectionId),
        ]);

        const rows: DateRow[] = [];
        for (const mod of mods.sort((a, b) => a.order - b.order)) {
          const lessons = await lessonService.getByModule(mod.id);
          for (const lesson of lessons.sort((a, b) => a.order - b.order)) {
            if (lesson.type !== 'quiz' && lesson.type !== 'tarea') continue;
            const override = overrides.find(o => o.lessonId === lesson.id);
            const settings = lesson.settings || {};
            rows.push({
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              lessonType: lesson.type,
              moduleName: mod.title,
              availableFrom: override?.availableFrom || settings.availableFrom || '',
              dueDate: override?.dueDate || settings.dueDate || '',
              lateSubmissionDeadline: override?.lateSubmissionDeadline || settings.lateSubmissionDeadline || '',
              timeLimit: settings.timeLimit?.toString() || '',
              existingOverrideId: override?.id,
            });
          }
        }
        setDateRows(rows);
      } catch (err) {
        console.error('Error loading section dates:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sectionId]);

  const updateRow = (index: number, field: keyof DateRow, value: string) => {
    setSaved(false);
    setDateRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      if (row.lessonType === 'tarea') {
        if (field === 'dueDate' && value) {
          if (!row.lateSubmissionDeadline || new Date(row.lateSubmissionDeadline).getTime() <= new Date(row.dueDate).getTime()) {
            updated.lateSubmissionDeadline = value;
          }
        }
        if (field === 'lateSubmissionDeadline' && updated.dueDate && new Date(value).getTime() < new Date(updated.dueDate).getTime()) {
          updated.lateSubmissionDeadline = updated.dueDate;
        }
      }
      return updated;
    }));
  };

  const handleSave = async () => {
    if (!sectionId || !section) return;
    setSaving(true);
    try {
      const now = Date.now();
      const overrides = dateRows
        .filter(row => row.availableFrom || row.dueDate || row.lateSubmissionDeadline)
        .map(row => {
          const o: Record<string, any> = {
            sectionId,
            lessonId: row.lessonId,
            courseId: section.courseId,
            createdAt: now,
            updatedAt: now,
          };
          if (row.existingOverrideId) o.id = row.existingOverrideId;
          if (row.availableFrom) o.availableFrom = row.availableFrom;
          if (row.dueDate) o.dueDate = row.dueDate;
          if (row.lateSubmissionDeadline) o.lateSubmissionDeadline = row.lateSubmissionDeadline;
          return o;
        });

      await sectionService.saveLessonOverrides(sectionId, overrides as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving dates:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-red-600" />
              <h1 className="text-xl font-bold text-gray-900">Fechas de Entregas</h1>
            </div>
            {section && <p className="text-sm text-gray-500">{section.title}</p>}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4 mr-2 text-green-600" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saved ? 'Guardado' : 'Guardar'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurar fechas por lección</CardTitle>
          <p className="text-sm text-gray-500">
            Los campos vacíos heredarán las fechas configuradas en el template del curso.
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          {dateRows.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-gray-500">Este curso no tiene lecciones tipo quiz o tarea.</p>
              <p className="text-sm text-gray-400">
                Agrega lecciones evaluables al curso para configurar fechas por sección.
              </p>
            </div>
          ) : (
            <>
              {/* Quizzes */}
              {dateRows.some(r => r.lessonType === 'quiz') && (
                <div>
                  <h3 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs">Quiz</span>
                    Quizzes ({dateRows.filter(r => r.lessonType === 'quiz').length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">Lección</th>
                          <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[120px]">Módulo</th>
                          <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">Abre</th>
                          <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">Fecha de entrega</th>
                          <th className="pb-3 font-medium text-gray-700 min-w-[100px]">Tiempo (min)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dateRows.map((row, idx) => {
                          if (row.lessonType !== 'quiz') return null;
                          return (
                            <tr key={row.lessonId} className="border-b last:border-b-0">
                              <td className="py-2 pr-3"><span className="font-medium text-gray-900">{row.lessonTitle}</span></td>
                              <td className="py-2 pr-3 text-gray-500 text-xs">{row.moduleName}</td>
                              <td className="py-2 pr-3">
                                <input type="datetime-local" value={row.availableFrom} onChange={e => updateRow(idx, 'availableFrom', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                              </td>
                              <td className="py-2 pr-3">
                                <input type="datetime-local" value={row.dueDate} onChange={e => updateRow(idx, 'dueDate', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                              </td>
                              <td className="py-2">
                                <input type="number" min="1" value={row.timeLimit} onChange={e => updateRow(idx, 'timeLimit', e.target.value)} placeholder="Sin límite" className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tareas */}
              {dateRows.some(r => r.lessonType === 'tarea') && (
                <div>
                  <h3 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-xs">Tarea</span>
                    Tareas ({dateRows.filter(r => r.lessonType === 'tarea').length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">Lección</th>
                          <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[120px]">Módulo</th>
                          <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">Abre</th>
                          <th className="pb-3 pr-3 font-medium text-gray-700 min-w-[180px]">Fecha de entrega</th>
                          <th className="pb-3 font-medium text-gray-700 min-w-[180px]">Cierre definitivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dateRows.map((row, idx) => {
                          if (row.lessonType !== 'tarea') return null;
                          return (
                            <tr key={row.lessonId} className="border-b last:border-b-0">
                              <td className="py-2 pr-3"><span className="font-medium text-gray-900">{row.lessonTitle}</span></td>
                              <td className="py-2 pr-3 text-gray-500 text-xs">{row.moduleName}</td>
                              <td className="py-2 pr-3">
                                <input type="datetime-local" value={row.availableFrom} onChange={e => updateRow(idx, 'availableFrom', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                              </td>
                              <td className="py-2 pr-3">
                                <input type="datetime-local" value={row.dueDate} onChange={e => updateRow(idx, 'dueDate', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                              </td>
                              <td className="py-2">
                                <input type="datetime-local" value={row.lateSubmissionDeadline} min={row.dueDate || undefined} onChange={e => updateRow(idx, 'lateSubmissionDeadline', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
