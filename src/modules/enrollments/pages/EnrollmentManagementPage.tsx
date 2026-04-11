import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { dataService, sectionService } from '@shared/services/dataService';
import type { DBUser, DBCourse, DBEnrollment, DBSection } from '@shared/services/dataService';
import {
  Users,
  UserPlus,
  Search,
  Clock,
  Award,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  X,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';

interface EnrollmentData extends Omit<DBEnrollment, 'progress'> {
  user?: DBUser;
  course?: DBCourse;
  progress: number;
}

interface EnrollmentStats {
  total: number;
  pending: number;
  active: number;
  completed: number;
  dropped: number;
}

export default function EnrollmentManagementPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<EnrollmentData[]>([]);
  const [students, setStudents] = useState<DBUser[]>([]);
  const [courses, setCourses] = useState<DBCourse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [selectedEnrollments, setSelectedEnrollments] = useState<Set<string>>(new Set());

  // Modal state
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [modalCourseId, setModalCourseId] = useState('');
  const [modalSectionId, setModalSectionId] = useState('');
  const [modalSections, setModalSections] = useState<DBSection[]>([]);
  const [modalSelectedStudents, setModalSelectedStudents] = useState<Set<string>>(new Set());
  const [modalSearch, setModalSearch] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [enrollmentsData, usersData, coursesData] = await Promise.all([
        dataService.enrollments.getAll(),
        dataService.users.getAll(),
        dataService.courses.getAll()
      ]);

      let filteredCourses = coursesData;
      if (isTeacher) {
        filteredCourses = coursesData.filter(c => c.instructorId === user.id);
      }

      const managedCourseIds = new Set(filteredCourses.map(c => c.id));
      const usersMap = new Map(usersData.map(u => [u.id, u]));
      const coursesMap = new Map(coursesData.map(c => [c.id, c]));

      const filteredEnrollments = enrollmentsData.filter(e =>
        isAdmin || managedCourseIds.has(e.courseId)
      );

      const enrichedEnrollments: EnrollmentData[] = filteredEnrollments.map(enrollment => ({
        ...enrollment,
        user: usersMap.get(enrollment.userId),
        course: coursesMap.get(enrollment.courseId)
      }));

      const studentUsers = usersData.filter(u => u.role === 'student');

      setEnrollments(enrichedEnrollments);
      setStudents(studentUsers);
      setCourses(filteredCourses);
    } catch (error) {
      console.error('Error loading enrollment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateEnrollmentStatus = async (enrollmentId: string, status: string) => {
    try {
      const enrollment = enrollments.find(e => e.id === enrollmentId);
      if (!enrollment) return;

      await dataService.enrollments.update(enrollmentId, {
        ...enrollment,
        status: status as 'active' | 'completed' | 'paused' | 'cancelled',
        lastUpdated: Date.now()
      } as any);

      setEnrollments(prev =>
        prev.map(e => e.id === enrollmentId ? { ...e, status: status as any } : e)
      );
    } catch (error) {
      console.error('Error updating enrollment:', error);
      alert('Error al actualizar la inscripción');
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selectedEnrollments.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedEnrollments).map(id => updateEnrollmentStatus(id, status))
      );
      setSelectedEnrollments(new Set());
    } catch (error) {
      console.error('Error in bulk update:', error);
      alert('Error en la actualización masiva');
    }
  };

  // --- Multi-student enrollment ---
  const enrolledStudentIdsForCourse = useMemo(() => {
    if (!modalCourseId) return new Set<string>();
    return new Set(
      enrollments.filter(e => e.courseId === modalCourseId).map(e => e.userId)
    );
  }, [modalCourseId, enrollments]);

  const modalFilteredStudents = useMemo(() => {
    if (!modalSearch) return students;
    const q = modalSearch.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [students, modalSearch]);

  const handleOpenEnrollModal = () => {
    setModalCourseId('');
    setModalSectionId('');
    setModalSections([]);
    setModalSelectedStudents(new Set());
    setModalSearch('');
    setShowEnrollModal(true);
  };

  const handleModalCourseChange = async (courseId: string) => {
    setModalCourseId(courseId);
    setModalSectionId('');
    setModalSelectedStudents(new Set());
    if (courseId) {
      const sections = await sectionService.getByCourse(courseId);
      setModalSections(sections.filter(s => s.status === 'activa'));
      if (sections.length === 1) {
        setModalSectionId(sections[0].id);
      }
    } else {
      setModalSections([]);
    }
  };

  const toggleModalStudent = (studentId: string) => {
    const next = new Set(modalSelectedStudents);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }
    setModalSelectedStudents(next);
  };

  const selectAllAvailable = () => {
    const available = modalFilteredStudents.filter(s => !enrolledStudentIdsForCourse.has(s.id));
    if (modalSelectedStudents.size === available.length) {
      setModalSelectedStudents(new Set());
    } else {
      setModalSelectedStudents(new Set(available.map(s => s.id)));
    }
  };

  const handleBulkEnroll = async () => {
    if (!modalCourseId || modalSelectedStudents.size === 0) return;
    // Enforce section selection when course has active sections
    if (modalSections.length > 0 && !modalSectionId) return;
    setEnrolling(true);
    try {
      const now = Date.now();
      const promises = Array.from(modalSelectedStudents).map(userId =>
        dataService.enrollments.create({
          userId,
          courseId: modalCourseId,
          sectionId: modalSectionId || undefined,
          status: 'active' as const,
          enrolledAt: new Date().toISOString(),
          progress: 0,
          completedLessons: [] as string[],
          completedModules: [] as string[],
          totalTimeSpent: 0,
          createdAt: now,
          updatedAt: now,
        })
      );
      await Promise.all(promises);

      const course = courses.find(c => c.id === modalCourseId);
      if (course) {
        await dataService.courses.update(modalCourseId, {
          studentsCount: (course.studentsCount || 0) + modalSelectedStudents.size
        });
      }

      // Update section studentsCount
      if (modalSectionId) {
        const section = modalSections.find(s => s.id === modalSectionId);
        if (section) {
          await sectionService.update(modalSectionId, {
            studentsCount: (section.studentsCount || 0) + modalSelectedStudents.size
          });
        }
      }

      await loadData();
      setShowEnrollModal(false);
    } catch (error) {
      console.error('Error enrolling students:', error);
      alert('Error al inscribir estudiantes');
    } finally {
      setEnrolling(false);
    }
  };

  const exportEnrollmentData = () => {
    if (filteredEnrollments.length === 0) return;
    const csvData = filteredEnrollments.map(enrollment => ({
      'ID': enrollment.id,
      'Estudiante': enrollment.user?.name || 'N/A',
      'Email': enrollment.user?.email || 'N/A',
      'Curso': enrollment.course?.title || 'N/A',
      'Estado': enrollment.status,
      'Progreso': `${enrollment.progress || 0}%`,
      'Fecha Inscripción': new Date(enrollment.enrolledAt).toLocaleDateString('es-ES'),
      'Última Actualización': new Date(enrollment.updatedAt || enrollment.enrolledAt).toLocaleDateString('es-ES')
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inscripciones_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filter logic
  const filteredEnrollments = enrollments.filter(enrollment => {
    const matchesSearch =
      enrollment.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.user?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.course?.title.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || enrollment.status === statusFilter;
    const matchesCourse = courseFilter === 'all' || enrollment.courseId === courseFilter;

    return matchesSearch && matchesStatus && matchesCourse;
  });

  const stats: EnrollmentStats = enrollments.reduce(
    (acc, enrollment) => {
      acc.total++;
      acc[enrollment.status as keyof Omit<EnrollmentStats, 'total'>]++;
      return acc;
    },
    { total: 0, pending: 0, active: 0, completed: 0, dropped: 0 }
  );

  const handleSelectAll = () => {
    if (selectedEnrollments.size === filteredEnrollments.length) {
      setSelectedEnrollments(new Set());
    } else {
      setSelectedEnrollments(new Set(filteredEnrollments.map(e => e.id)));
    }
  };

  const handleSelectEnrollment = (enrollmentId: string) => {
    const newSelected = new Set(selectedEnrollments);
    if (newSelected.has(enrollmentId)) {
      newSelected.delete(enrollmentId);
    } else {
      newSelected.add(enrollmentId);
    }
    setSelectedEnrollments(newSelected);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-red-600' },
          { label: 'Pendientes', value: stats.pending, icon: Clock, color: 'text-red-400' },
          { label: 'Activas', value: stats.active, icon: CheckCircle, color: 'text-red-500' },
          { label: 'Completadas', value: stats.completed, icon: Award, color: 'text-red-600' },
          { label: 'Abandonadas', value: stats.dropped, icon: XCircle, color: 'text-red-300' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center">
                <s.icon className={`w-7 h-7 ${s.color} mr-3 flex-shrink-0`} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar por estudiante, email o curso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="active">Activas</option>
          <option value="completed">Completadas</option>
          <option value="dropped">Abandonadas</option>
        </select>

        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">Todos los cursos</option>
          {courses.map(course => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>

        <Button onClick={handleOpenEnrollModal} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Inscribir
        </Button>

        <Button onClick={exportEnrollmentData} variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          CSV
        </Button>
      </div>

      {/* Bulk Actions */}
      {selectedEnrollments.size > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-800 font-medium">
                {selectedEnrollments.size} seleccionadas
              </span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => bulkUpdateStatus('active')} variant="outline">
                  Activar
                </Button>
                <Button size="sm" onClick={() => bulkUpdateStatus('dropped')} variant="outline">
                  Suspender
                </Button>
                <Button size="sm" onClick={() => setSelectedEnrollments(new Set())} variant="ghost">
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enrollments Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedEnrollments.size === filteredEnrollments.length && filteredEnrollments.length > 0}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Curso</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progreso</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEnrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedEnrollments.has(enrollment.id)}
                        onChange={() => handleSelectEnrollment(enrollment.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                          <span className="text-sm font-medium text-red-600">
                            {enrollment.user?.name?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {enrollment.user?.name || 'Desconocido'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {enrollment.user?.email || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                        {enrollment.course?.title || 'Eliminado'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        enrollment.status === 'completed' ? 'bg-green-100 text-green-700' :
                        enrollment.status === 'active' ? 'bg-red-100 text-red-700' :
                        enrollment.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        enrollment.status === 'dropped' ? 'bg-gray-100 text-gray-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {enrollment.status === 'completed' ? 'Completada' :
                         enrollment.status === 'active' ? 'Activa' :
                         enrollment.status === 'pending' ? 'Pendiente' :
                         enrollment.status === 'dropped' ? 'Abandonada' :
                         enrollment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-red-500 h-1.5 rounded-full"
                            style={{ width: `${enrollment.progress || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{enrollment.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(enrollment.enrolledAt).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={enrollment.status}
                        onChange={(e) => updateEnrollmentStatus(enrollment.id, e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1.5"
                      >
                        <option value="pending">Pendiente</option>
                        <option value="active">Activa</option>
                        <option value="completed">Completada</option>
                        <option value="dropped">Abandonada</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredEnrollments.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No se encontraron inscripciones</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enrollment Modal - Course first, then multi-select students */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Inscribir Estudiantes</h3>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Step 1: Select course */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Curso
                </label>
                <select
                  value={modalCourseId}
                  onChange={(e) => handleModalCourseChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                >
                  <option value="">Selecciona un curso</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>

              {/* Step 1.5: Select section */}
              {modalCourseId && modalSections.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sección
                  </label>
                  <select
                    value={modalSectionId}
                    onChange={(e) => setModalSectionId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                  >
                    <option value="">Selecciona una sección</option>
                    {modalSections.map(section => (
                      <option key={section.id} value={section.id}>
                        {section.title} ({section.studentsCount} estudiantes)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalCourseId && modalSections.length > 0 && !modalSectionId && (
                <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                  Selecciona una sección para inscribir estudiantes.
                </p>
              )}

              {/* Step 2: Student list (only visible after course+section selected) */}
              {modalCourseId && (modalSections.length === 0 || modalSectionId) && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Estudiantes
                    </label>
                    <button
                      type="button"
                      onClick={selectAllAvailable}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      {modalSelectedStudents.size > 0 &&
                       modalSelectedStudents.size === modalFilteredStudents.filter(s => !enrolledStudentIdsForCourse.has(s.id)).length
                        ? 'Deseleccionar todos'
                        : 'Seleccionar todos'}
                    </button>
                  </div>

                  {/* Search students */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                    <input
                      type="text"
                      placeholder="Buscar estudiante..."
                      value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>

                  {/* Student list */}
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                    {modalFilteredStudents.length === 0 ? (
                      <div className="text-center py-6 text-sm text-gray-500">
                        No se encontraron estudiantes
                      </div>
                    ) : (
                      modalFilteredStudents.map((student) => {
                        const alreadyEnrolled = enrolledStudentIdsForCourse.has(student.id);
                        const isSelected = modalSelectedStudents.has(student.id);

                        return (
                          <label
                            key={student.id}
                            className={`flex items-center px-3 py-2.5 cursor-pointer transition-colors ${
                              alreadyEnrolled
                                ? 'bg-gray-50 opacity-60 cursor-not-allowed'
                                : isSelected
                                ? 'bg-red-50'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={alreadyEnrolled}
                              onChange={() => !alreadyEnrolled && toggleModalStudent(student.id)}
                              className="rounded border-gray-300 text-red-600 focus:ring-red-500 mr-3"
                            />
                            <div className="w-7 h-7 bg-red-50 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                              <span className="text-xs font-medium text-red-600">
                                {student.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {student.name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{student.email}</p>
                            </div>
                            {alreadyEnrolled && (
                              <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                                Ya inscrito
                              </span>
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>

                  {modalSelectedStudents.size > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      {modalSelectedStudents.size} estudiante{modalSelectedStudents.size !== 1 ? 's' : ''} seleccionado{modalSelectedStudents.size !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <Button
                variant="outline"
                onClick={() => setShowEnrollModal(false)}
                disabled={enrolling}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBulkEnroll}
                disabled={!modalCourseId || modalSelectedStudents.size === 0 || enrolling || (modalSections.length > 0 && !modalSectionId)}
              >
                {enrolling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Inscribiendo...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Inscribir {modalSelectedStudents.size > 0 ? `(${modalSelectedStudents.size})` : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
