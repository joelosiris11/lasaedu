import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { courseService, evaluationService, enrollmentService } from '@shared/services/dataService';
import { firebaseDB } from '@shared/services/firebaseDataService';
import { 
  BookOpen,
  Search,
  Download,
  User,
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  BarChart3
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';

interface Course {
  id: string;
  title: string;
  instructorId: string;
}

interface Evaluation {
  id: string;
  title: string;
  courseId: string;
  type: 'quiz' | 'tarea' | 'examen' | 'proyecto';
  maxPoints: number;
  weight: number; // percentage weight in final grade
}

interface Submission {
  id: string;
  evaluationId: string;
  userId: string;
  userName: string;
  score: number;
  totalPoints: number;
  percentage: number;
  submittedAt: string;
  gradedAt?: string;
  feedback?: string;
}

interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  studentName: string;
  status: string;
}

interface StudentGrade {
  studentId: string;
  studentName: string;
  evaluations: {
    evaluationId: string;
    score: number | null;
    maxPoints: number;
    percentage: number | null;
    status: 'pending' | 'submitted' | 'graded';
  }[];
  totalScore: number;
  totalMaxPoints: number;
  overallPercentage: number;
  trend: 'up' | 'down' | 'stable';
}

export default function GradesPage() {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      loadCourseGrades(selectedCourseId);
    }
  }, [selectedCourseId]);

  const loadCourses = async () => {
    try {
      const allCourses = await courseService.getAll();

      let filteredCourses: Course[];
      if (isAdmin) {
        filteredCourses = allCourses.map(c => ({ id: c.id, title: c.title, instructorId: c.instructorId || '' }));
      } else if (isTeacher) {
        filteredCourses = allCourses
          .filter(c => c.instructorId === user?.id)
          .map(c => ({ id: c.id, title: c.title, instructorId: c.instructorId || '' }));
      } else {
        // For students, get courses they're enrolled in
        const enrollments = await enrollmentService.getByUser(user?.id || '');
        const enrolledCourseIds = enrollments.map(e => e.courseId);
        filteredCourses = allCourses
          .filter(c => enrolledCourseIds.includes(c.id))
          .map(c => ({ id: c.id, title: c.title, instructorId: c.instructorId || '' }));
      }

      setCourses(filteredCourses);
      if (filteredCourses.length > 0) {
        setSelectedCourseId(filteredCourses[0].id);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCourseGrades = async (courseId: string) => {
    try {
      // Get evaluations for this course
      const allEvaluations = await evaluationService.getAll();
      const filteredEvals = allEvaluations.filter(e => e.courseId === courseId);
      const courseEvaluations = filteredEvals.map(e => ({
        id: e.id,
        title: e.title,
        courseId: e.courseId,
        type: e.type as 'quiz' | 'tarea' | 'examen' | 'proyecto',
        maxPoints: 100,
        weight: 100 / (filteredEvals.length || 1)
      }));
      setEvaluations(courseEvaluations);

      // Get students enrolled in this course
      let students: { id: string; name: string }[];

      if (isStudent) {
        // If student, only show their own grades
        students = [{ id: user?.id || '', name: user?.name || '' }];
      } else {
        const enrollments = await enrollmentService.getByCourse(courseId);
        students = enrollments.map(e => ({
          id: e.userId,
          name: 'Estudiante' // Would need to fetch user names separately
        }));
      }

      // Get all submissions from Firebase
      const allSubmissions = await firebaseDB.getAll<Submission>('submissions');

      // Calculate grades for each student
      const grades: StudentGrade[] = students.map(student => {
        const studentEvaluations = courseEvaluations.map(evaluation => {
          const submission = allSubmissions.find(
            s => s.evaluationId === evaluation.id && s.userId === student.id
          );
          
          return {
            evaluationId: evaluation.id,
            score: submission?.score ?? null,
            maxPoints: evaluation.maxPoints,
            percentage: submission?.percentage ?? null,
            status: submission 
              ? (submission.gradedAt ? 'graded' as const : 'submitted' as const)
              : 'pending' as const
          };
        });

        const gradedEvaluations = studentEvaluations.filter(e => e.score !== null);
        const totalScore = gradedEvaluations.reduce((sum, e) => sum + (e.score || 0), 0);
        const totalMaxPoints = gradedEvaluations.reduce((sum, e) => sum + e.maxPoints, 0);
        const overallPercentage = totalMaxPoints > 0 
          ? Math.round((totalScore / totalMaxPoints) * 100) 
          : 0;

        // Calculate trend (simplified - comparing last 2 submissions)
        const scores = gradedEvaluations.map(e => e.percentage || 0);
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (scores.length >= 2) {
          const lastTwo = scores.slice(-2);
          if (lastTwo[1] > lastTwo[0] + 5) trend = 'up';
          else if (lastTwo[1] < lastTwo[0] - 5) trend = 'down';
        }

        return {
          studentId: student.id,
          studentName: student.name,
          evaluations: studentEvaluations,
          totalScore,
          totalMaxPoints,
          overallPercentage,
          trend
        };
      });

      setStudentGrades(grades);
    } catch (error) {
      console.error('Error loading grades:', error);
    }
  };

  const filteredGrades = studentGrades.filter(grade =>
    grade.studentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGradeColor = (percentage: number | null) => {
    if (percentage === null) return 'text-gray-400';
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-blue-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getGradeBadge = (percentage: number) => {
    if (percentage >= 90) return { label: 'A', color: 'bg-green-100 text-green-800' };
    if (percentage >= 80) return { label: 'B', color: 'bg-blue-100 text-blue-800' };
    if (percentage >= 70) return { label: 'C', color: 'bg-yellow-100 text-yellow-800' };
    if (percentage >= 60) return { label: 'D', color: 'bg-orange-100 text-orange-800' };
    return { label: 'F', color: 'bg-red-100 text-red-800' };
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const exportGrades = () => {
    const course = courses.find(c => c.id === selectedCourseId);
    const headers = ['Estudiante', ...evaluations.map(e => e.title), 'Total', 'Promedio'];
    
    const rows = studentGrades.map(grade => [
      grade.studentName,
      ...grade.evaluations.map(e => e.score !== null ? `${e.score}/${e.maxPoints}` : '-'),
      `${grade.totalScore}/${grade.totalMaxPoints}`,
      `${grade.overallPercentage}%`
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calificaciones_${course?.title || 'curso'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Statistics
  const stats = {
    students: studentGrades.length,
    avgScore: studentGrades.length > 0 
      ? Math.round(studentGrades.reduce((sum, g) => sum + g.overallPercentage, 0) / studentGrades.length)
      : 0,
    passing: studentGrades.filter(g => g.overallPercentage >= 60).length,
    evaluationsCount: evaluations.length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isStudent ? 'Mis Calificaciones' : 'Libro de Calificaciones'}
          </h1>
          <p className="text-gray-600">
            {isStudent 
              ? 'Revisa tu progreso académico en cada curso'
              : 'Gestiona y visualiza las calificaciones de tus estudiantes'
            }
          </p>
        </div>
        {!isStudent && studentGrades.length > 0 && (
          <Button variant="outline" onClick={exportGrades}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        )}
      </div>

      {/* Course Selector */}
      {courses.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seleccionar Curso
                </label>
                <select
                  value={selectedCourseId}
                  onChange={e => setSelectedCourseId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>
              {!isStudent && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buscar Estudiante
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Nombre del estudiante..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {!isStudent && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold">{stats.students}</p>
                <p className="text-sm text-gray-600">Estudiantes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold">{stats.avgScore}%</p>
                <p className="text-sm text-gray-600">Promedio</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Award className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold">{stats.passing}</p>
                <p className="text-sm text-gray-600">Aprobados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold">{stats.evaluationsCount}</p>
                <p className="text-sm text-gray-600">Evaluaciones</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grades Table */}
      {courses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Sin cursos</h3>
            <p className="text-gray-600">
              {isStudent 
                ? 'No estás inscrito en ningún curso aún'
                : 'No tienes cursos asignados'
              }
            </p>
          </CardContent>
        </Card>
      ) : filteredGrades.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Sin estudiantes</h3>
            <p className="text-gray-600">
              {searchTerm 
                ? 'No se encontraron estudiantes con ese nombre'
                : 'No hay estudiantes inscritos en este curso'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Estudiante
                  </th>
                  {evaluations.map(evaluation => (
                    <th 
                      key={evaluation.id} 
                      className="px-4 py-3 text-center text-sm font-medium text-gray-600"
                    >
                      <div className="flex flex-col items-center">
                        <span className="truncate max-w-[100px]">{evaluation.title}</span>
                        <span className="text-xs text-gray-400 capitalize">
                          {evaluation.type}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                    Total
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                    Promedio
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                    Tendencia
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredGrades.map((grade, index) => (
                  <tr 
                    key={grade.studentId}
                    className={`border-b hover:bg-gray-50 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                          <span className="text-indigo-600 font-medium text-sm">
                            {grade.studentName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium">{grade.studentName}</span>
                      </div>
                    </td>
                    {grade.evaluations.map(evaluation => (
                      <td 
                        key={evaluation.evaluationId}
                        className="px-4 py-3 text-center"
                      >
                        {evaluation.score !== null ? (
                          <span className={`font-medium ${getGradeColor(evaluation.percentage)}`}>
                            {evaluation.score}/{evaluation.maxPoints}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center font-medium">
                      {grade.totalScore}/{grade.totalMaxPoints}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        getGradeBadge(grade.overallPercentage).color
                      }`}>
                        {getGradeBadge(grade.overallPercentage).label} ({grade.overallPercentage}%)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getTrendIcon(grade.trend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Student View - Detailed Breakdown */}
      {isStudent && studentGrades.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Detalle de Calificaciones</h3>
            <div className="space-y-4">
              {evaluations.map(evaluation => {
                const studentEval = studentGrades[0]?.evaluations.find(
                  e => e.evaluationId === evaluation.id
                );
                
                return (
                  <div 
                    key={`detail-${evaluation.id}`}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <h4 className="font-medium">{evaluation.title}</h4>
                      <p className="text-sm text-gray-600 capitalize">{evaluation.type}</p>
                    </div>
                    <div className="text-right">
                      {studentEval?.score !== null ? (
                        <>
                          <p className={`text-lg font-bold ${getGradeColor(studentEval?.percentage ?? null)}`}>
                            {studentEval?.score}/{studentEval?.maxPoints}
                          </p>
                          <p className="text-sm text-gray-600">
                            {studentEval?.percentage}%
                          </p>
                        </>
                      ) : (
                        <p className="text-gray-400">Pendiente</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
