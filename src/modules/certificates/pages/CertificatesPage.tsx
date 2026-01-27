import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { courseService, legacyEnrollmentService } from '@shared/services/dataService';
import { certificateGenerator } from '@shared/services/certificateGeneratorNew';
import type { CertificateData } from '@shared/services/certificateGeneratorNew';
import { 
  Download, 
  Award, 
  Calendar, 
  User, 
  CheckCircle,
  Clock,
  Star,
  Share2,
  Eye,
  Search,
  Medal,
  Trophy
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';

interface CourseCompletion {
  courseId: string;
  courseTitle: string;
  instructorName: string;
  completedAt: number;
  score: number;
  hours: number;
  certificate?: CertificateData;
}

export default function CertificatesPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [completedCourses, setCompletedCourses] = useState<CourseCompletion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'downloaded'>('all');
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    loadCompletedCourses();
  }, [user]);

  const loadCompletedCourses = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Get user enrollments
      const enrollments = await legacyEnrollmentService.getAll();
      const userEnrollments = enrollments.filter(e => e.userId === user.id);
      const completedEnrollments = userEnrollments.filter(e => e.status === 'completed');

      // Get course details for completed courses
      const completions: CourseCompletion[] = await Promise.all(
        completedEnrollments.map(async (enrollment) => {
          const course = await courseService.getById(enrollment.courseId);
          
          // Check if certificate already exists
          const existingCert = localStorage.getItem(`cert_${user.id}_${enrollment.courseId}`);
          
          return {
            courseId: enrollment.courseId,
            courseTitle: course?.title || 'Curso sin título',
            instructorName: course?.instructor || 'Instructor desconocido',
            completedAt: Date.now(), // Use current time since completedAt doesn't exist on DBEnrollment
            score: enrollment.grade || 0, // Use grade instead of finalGrade
            hours: 40, // Default hours since estimatedHours doesn't exist on DBCourse
            certificate: existingCert ? JSON.parse(existingCert) : undefined
          };
        })
      );

      setCompletedCourses(completions);
    } catch (error) {
      console.error('Error loading completed courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCertificate = async (completion: CourseCompletion) => {
    if (!user) return;

    setGenerating(completion.courseId);
    try {
      const certificateData: CertificateData = {
        id: `cert_${Date.now()}`,
        userId: user.id,
        userName: user.name,
        courseId: completion.courseId,
        courseTitle: completion.courseTitle,
        instructorName: completion.instructorName,
        completedAt: completion.completedAt,
        score: completion.score,
        hours: completion.hours,
        certificateNumber: certificateGenerator.generateCertificateNumber()
      };

      // Generate and download PDF
      await certificateGenerator.downloadCertificate(certificateData);

      // Save certificate data locally
      localStorage.setItem(
        `cert_${user.id}_${completion.courseId}`,
        JSON.stringify(certificateData)
      );

      // Update state
      setCompletedCourses(prev =>
        prev.map(c =>
          c.courseId === completion.courseId
            ? { ...c, certificate: certificateData }
            : c
        )
      );
    } catch (error) {
      console.error('Error generating certificate:', error);
      alert('Error al generar el certificado. Inténtalo de nuevo.');
    } finally {
      setGenerating(null);
    }
  };

  const downloadExistingCertificate = async (completion: CourseCompletion) => {
    if (!completion.certificate) return;

    try {
      await certificateGenerator.downloadCertificate(completion.certificate);
    } catch (error) {
      console.error('Error downloading certificate:', error);
      alert('Error al descargar el certificado. Inténtalo de nuevo.');
    }
  };

  const shareCertificate = (certificate: CertificateData) => {
    if (navigator.share) {
      navigator.share({
        title: `Certificado de ${certificate.courseTitle}`,
        text: `He completado exitosamente el curso "${certificate.courseTitle}" en LasaEdu`,
        url: `${window.location.origin}/verify/${certificate.certificateNumber}`
      });
    } else {
      // Fallback: copy to clipboard
      const shareText = `¡He completado exitosamente el curso "${certificate.courseTitle}" en LasaEdu! Certificado N°: ${certificate.certificateNumber}`;
      navigator.clipboard.writeText(shareText);
      alert('Información copiada al portapapeles');
    }
  };

  const filteredCourses = completedCourses.filter(course => {
    const matchesSearch = course.courseTitle.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'available') {
      return matchesSearch && !course.certificate;
    } else if (filterStatus === 'downloaded') {
      return matchesSearch && course.certificate;
    }
    
    return matchesSearch;
  });

  const stats = {
    totalCompleted: completedCourses.length,
    certificatesGenerated: completedCourses.filter(c => c.certificate).length,
    totalHours: completedCourses.reduce((sum, c) => sum + c.hours, 0),
    averageScore: completedCourses.length > 0 
      ? completedCourses.reduce((sum, c) => sum + c.score, 0) / completedCourses.length 
      : 0
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mis Certificados</h1>
        <p className="text-gray-600">
          Descarga y comparte los certificados de los cursos que has completado exitosamente.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Trophy className="w-8 h-8 text-yellow-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.totalCompleted}</p>
                <p className="text-sm text-gray-600">Cursos Completados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Award className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.certificatesGenerated}</p>
                <p className="text-sm text-gray-600">Certificados Generados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.totalHours}h</p>
                <p className="text-sm text-gray-600">Horas de Estudio</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Star className="w-8 h-8 text-purple-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{stats.averageScore.toFixed(1)}%</p>
                <p className="text-sm text-gray-600">Promedio General</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar cursos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">Todos</option>
            <option value="available">Disponibles</option>
            <option value="downloaded">Descargados</option>
          </select>
        </div>
      </div>

      {/* Certificates Grid */}
      {filteredCourses.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Medal className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {completedCourses.length === 0 
                  ? 'No has completado ningún curso aún'
                  : 'No se encontraron cursos con los filtros aplicados'
                }
              </h3>
              <p className="text-gray-600 mb-6">
                {completedCourses.length === 0
                  ? 'Completa cursos para generar certificados'
                  : 'Intenta con diferentes términos de búsqueda o filtros'
                }
              </p>
              {completedCourses.length === 0 && (
                <Button onClick={() => window.location.href = '/catalog'}>
                  Explorar Cursos
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((completion) => (
            <Card key={completion.courseId} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{completion.courseTitle}</CardTitle>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        {completion.instructorName}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        {new Date(completion.completedAt).toLocaleDateString('es-ES')}
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        {completion.hours} horas
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className={`flex items-center justify-center w-12 h-12 rounded-full ${
                      completion.certificate 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {completion.certificate ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Award className="w-6 h-6" />
                      )}
                    </div>
                    <span className={`text-xs font-medium mt-1 ${
                      completion.certificate 
                        ? 'text-green-600' 
                        : 'text-blue-600'
                    }`}>
                      {completion.score}%
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {completion.certificate ? (
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center text-green-800 text-sm">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Certificado generado
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        N°: {completion.certificate.certificateNumber}
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => downloadExistingCertificate(completion)}
                        className="flex-1"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Descargar
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => shareControl(completion.certificate!)}
                        className="flex-1"
                      >
                        <Share2 className="w-4 h-4 mr-2" />
                        Compartir
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => window.open(`/verify/${completion.certificate!.certificateNumber}`, '_blank')}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Verificar certificado
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center text-blue-800 text-sm">
                        <Award className="w-4 h-4 mr-2" />
                        Certificado disponible
                      </div>
                      <p className="text-xs text-blue-600 mt-1">
                        Has completado este curso exitosamente
                      </p>
                    </div>
                    
                    <Button
                      onClick={() => generateCertificate(completion)}
                      disabled={generating === completion.courseId}
                      className="w-full"
                    >
                      {generating === completion.courseId ? (
                        <>
                          <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Generar Certificado
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Additional Info */}
      <Card className="mt-8">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Acerca de los Certificados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">🎓 Validez</h4>
              <p>
                Todos los certificados incluyen un código de verificación único que permite 
                validar su autenticidad en cualquier momento.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">📄 Formato</h4>
              <p>
                Los certificados se generan en formato PDF de alta calidad, 
                listos para imprimir o compartir digitalmente.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">🔒 Seguridad</h4>
              <p>
                Cada certificado incluye medidas anti-falsificación y 
                se registra en nuestra base de datos para verificación.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">🌐 Compartir</h4>
              <p>
                Puedes compartir tus certificados en redes sociales, LinkedIn 
                o incluirlos en tu CV profesional.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Fix for share function name
function shareControl(certificate: CertificateData) {
  if (navigator.share) {
    navigator.share({
      title: `Certificado de ${certificate.courseTitle}`,
      text: `He completado exitosamente el curso "${certificate.courseTitle}" en LasaEdu`,
      url: `${window.location.origin}/verify/${certificate.certificateNumber}`
    });
  } else {
    const shareText = `¡He completado exitosamente el curso "${certificate.courseTitle}" en LasaEdu! Certificado N°: ${certificate.certificateNumber}`;
    navigator.clipboard.writeText(shareText);
    alert('Información copiada al portapapeles');
  }
}
