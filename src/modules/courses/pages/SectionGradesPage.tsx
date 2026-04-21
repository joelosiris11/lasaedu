import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  sectionService,
  lessonService,
  moduleService,
  gradeService,
  taskSubmissionService,
  type DBSection,
} from '@shared/services/dataService';
import { firebaseDB } from '@shared/services/firebaseDataService';
import {
  ArrowLeft,
  Users,
  Loader2,
  ClipboardList,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';

interface StudentRow {
  userId: string;
  userName: string;
  grades: Map<string, number>; // lessonId -> score percentage
  avgGrade: number;
}

export default function SectionGradesPage() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const navigate = useNavigate();

  const [section, setSection] = useState<DBSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [gradedLessons, setGradedLessons] = useState<{ id: string; title: string; type: string }[]>([]);

  useEffect(() => {
    if (!sectionId) return;
    const load = async () => {
      setLoading(true);
      try {
        const sec = await sectionService.getById(sectionId);
        if (!sec) return;
        setSection(sec);

        // Get enrollments for this section
        const enrollments = await sectionService.getEnrollments(sectionId);
        if (enrollments.length === 0) {
          setStudents([]);
          setLoading(false);
          return;
        }

        // Get gradeable lessons
        const mods = await moduleService.getByCourse(sec.courseId);
        const lessons: { id: string; title: string; type: string }[] = [];
        for (const mod of mods.sort((a, b) => a.order - b.order)) {
          const modLessons = await lessonService.getByModule(mod.id);
          for (const l of modLessons.sort((a, b) => a.order - b.order)) {
            if (l.type === 'quiz' || l.type === 'tarea') {
              lessons.push({ id: l.id, title: l.title, type: l.type });
            }
          }
        }
        setGradedLessons(lessons);

        // Get grades and submissions for this course
        const [allGrades, allSubmissions] = await Promise.all([
          gradeService.getByCourse(sec.courseId),
          taskSubmissionService.getAll(),
        ]);

        // Get user names
        const userIds = enrollments.map(e => e.userId);
        const users = await Promise.all(userIds.map(id => firebaseDB.getUserById(id)));
        const userMap = new Map(users.filter(Boolean).map(u => [u!.id, u!.name]));

        // Build student rows
        const rows: StudentRow[] = enrollments.map(enrollment => {
          const grades = new Map<string, number>();

          for (const lesson of lessons) {
            // Check grades collection
            const grade = allGrades.find(
              g => g.studentId === enrollment.userId && g.lessonId === lesson.id &&
                (!g.sectionId || g.sectionId === sectionId)
            );
            if (grade) {
              grades.set(lesson.id, grade.percentage);
              continue;
            }
            // Check submissions
            const sub = allSubmissions.find(
              s => s.studentId === enrollment.userId && s.lessonId === lesson.id &&
                (!s.sectionId || s.sectionId === sectionId) && s.grade
            );
            if (sub?.grade) {
              grades.set(lesson.id, Math.round((sub.grade.score / sub.grade.maxScore) * 100));
            }
          }

          const gradeValues = Array.from(grades.values());
          const avgGrade = gradeValues.length > 0
            ? Math.round(gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length)
            : 0;

          return {
            userId: enrollment.userId,
            userName: userMap.get(enrollment.userId) || 'Unknown',
            grades,
            avgGrade,
          };
        });

        setStudents(rows.sort((a, b) => a.userName.localeCompare(b.userName)));
      } catch (err) {
        console.error('Error loading section grades:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sectionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-red-600" />
            <h1 className="text-xl font-bold text-gray-900">Calificaciones</h1>
          </div>
          {section && <p className="text-sm text-gray-500">{section.title}</p>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {students.length} Estudiantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No hay estudiantes inscritos en esta sección.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium text-gray-700 sticky left-0 bg-white min-w-[160px]">
                      Estudiante
                    </th>
                    {gradedLessons.map(lesson => (
                      <th key={lesson.id} className="pb-3 px-2 font-medium text-gray-700 text-center min-w-[80px]">
                        <span className="text-xs block truncate max-w-[100px]" title={lesson.title}>
                          {lesson.title}
                        </span>
                        <span className={`text-[10px] ${lesson.type === 'quiz' ? 'text-purple-500' : 'text-orange-500'}`}>
                          {lesson.type}
                        </span>
                      </th>
                    ))}
                    <th className="pb-3 pl-4 font-medium text-gray-700 text-center">Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => (
                    <tr key={student.userId} className="border-b last:border-b-0">
                      <td className="py-2.5 pr-4 font-medium text-gray-900 sticky left-0 bg-white">
                        {student.userName}
                      </td>
                      {gradedLessons.map(lesson => {
                        const score = student.grades.get(lesson.id);
                        return (
                          <td key={lesson.id} className="py-2.5 px-2 text-center">
                            {score !== undefined ? (
                              <span className={`inline-flex items-center justify-center w-10 h-6 rounded text-xs font-medium ${
                                score >= 70 ? 'bg-green-100 text-green-700' :
                                score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {score}%
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2.5 pl-4 text-center">
                        <span className={`inline-flex items-center justify-center w-12 h-6 rounded text-xs font-bold ${
                          student.avgGrade >= 70 ? 'bg-green-100 text-green-700' :
                          student.avgGrade >= 50 ? 'bg-yellow-100 text-yellow-700' :
                          student.avgGrade > 0 ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {student.avgGrade > 0 ? `${student.avgGrade}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
