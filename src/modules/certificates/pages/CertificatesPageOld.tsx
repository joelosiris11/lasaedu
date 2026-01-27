import { useState, useEffect } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { localDB } from '@shared/utils/localDB';
import { downloadCertificate as downloadPDFCertificate } from '@shared/services/certificateGenerator';
import { 
  Award,
  Download,
  Eye,
  Search,
  CheckCircle,
  Clock,
  Share2
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';

interface Certificate {
  id: string;
  courseId: string;
  courseName: string;
  studentId: string;
  studentName: string;
  instructorName: string;
  issuedAt: string;
  expiresAt?: string;
  verificationCode: string;
  grade: number;
  completionDate: string;
  hoursCompleted: number;
  status: 'pending' | 'issued' | 'revoked';
}

interface Course {
  id: string;
  title: string;
  duration: string;
}

export default function CertificatesPage() {
  const { user } = useAuthStore();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadCertificates();
  }, []);

  const loadCertificates = async () => {
    try {
      const allCertificates = localDB.getCollection<Certificate>('certificates');
      
      // Filter based on role
      let filtered: Certificate[];
      if (isStudent) {
        filtered = allCertificates.filter(c => c.studentId === user?.id);
      } else if (isAdmin) {
        filtered = allCertificates;
      } else {
        // Teachers see certificates from their courses
        const teacherCourses = localDB.getCollection<Course>('courses')
          .filter((c: any) => c.instructorId === user?.id)
          .map(c => c.id);
        filtered = allCertificates.filter(c => teacherCourses.includes(c.courseId));
      }
      
      setCertificates(filtered);
    } catch (error) {
      console.error('Error loading certificates:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCertificateCode = () => {
    return `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  };

  // Generate sample certificates if none exist
  useEffect(() => {
    if (!loading && certificates.length === 0 && isStudent) {
      // Check if student has completed any courses
      const enrollments = localDB.getCollection<any>('enrollments')
        .filter(e => e.studentId === user?.id && e.status === 'completado');
      
      enrollments.forEach(enrollment => {
        const course = localDB.getById<Course>('courses', enrollment.courseId);
        if (course) {
          const newCert: Certificate = {
            id: `cert_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            courseId: enrollment.courseId,
            courseName: course.title,
            studentId: user?.id || '',
            studentName: user?.name || '',
            instructorName: 'Instructor',
            issuedAt: new Date().toISOString(),
            verificationCode: generateCertificateCode(),
            grade: Math.round(70 + Math.random() * 30),
            completionDate: new Date().toISOString(),
            hoursCompleted: parseInt(course.duration) || 20,
            status: 'issued'
          };
          localDB.add('certificates', newCert);
        }
      });
      loadCertificates();
    }
  }, [loading, certificates.length]);

  const filteredCertificates = certificates.filter(cert => {
    const matchesSearch = cert.courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cert.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cert.verificationCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || cert.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const downloadCertificate = async (certificate: Certificate) => {
    // Usar el generador de certificados PDF con el logo de T-Eco Group
    await downloadPDFCertificate({
      studentName: certificate.studentName,
      courseName: certificate.courseName,
      completionDate: new Date(certificate.completionDate).toLocaleDateString('es-ES', {
        year: 'numeric', month: 'long', day: 'numeric'
      }),
      instructorName: certificate.instructorName,
      hoursCompleted: certificate.hoursCompleted,
      credentialId: certificate.verificationCode,
      grade: certificate.grade
    });
  };

  const shareCertificate = (certificate: Certificate) => {
    const url = `${window.location.origin}/verify/${certificate.verificationCode}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Enlace copiado al portapapeles');
    });
  };

  const getStatusBadge = (status: Certificate['status']) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Pendiente', icon: Clock },
      issued: { color: 'bg-green-100 text-green-800', text: 'Emitido', icon: CheckCircle },
      revoked: { color: 'bg-red-100 text-red-800', text: 'Revocado', icon: Clock }
    };
    const badge = badges[status];
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.text}
      </span>
    );
  };

  // Stats
  const stats = {
    total: certificates.length,
    issued: certificates.filter(c => c.status === 'issued').length,
    pending: certificates.filter(c => c.status === 'pending').length
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
            {isStudent ? 'Mis Certificados' : 'Gestión de Certificados'}
          </h1>
          <p className="text-gray-600">
            {isStudent 
              ? 'Descarga y comparte tus certificados de cursos completados'
              : 'Administra los certificados emitidos en la plataforma'
            }
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Award className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-gray-600">Total Certificados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold">{stats.issued}</p>
              <p className="text-sm text-gray-600">Emitidos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-sm text-gray-600">Pendientes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por curso, estudiante o código..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos los estados</option>
              <option value="issued">Emitidos</option>
              <option value="pending">Pendientes</option>
              <option value="revoked">Revocados</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Certificates Grid */}
      {filteredCertificates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Sin certificados</h3>
            <p className="text-gray-600">
              {isStudent 
                ? 'Completa cursos para obtener certificados'
                : 'No hay certificados que coincidan con tu búsqueda'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCertificates.map(certificate => (
            <Card key={certificate.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                {/* Certificate Preview */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6 mb-4 text-center border-2 border-indigo-100">
                  <Award className="h-12 w-12 text-indigo-600 mx-auto mb-2" />
                  <h3 className="font-bold text-lg text-indigo-900 mb-1 truncate">
                    {certificate.courseName}
                  </h3>
                  <p className="text-sm text-indigo-600">
                    {certificate.studentName}
                  </p>
                </div>

                {/* Certificate Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Calificación</span>
                    <span className="font-medium text-green-600">{certificate.grade}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Horas</span>
                    <span className="font-medium">{certificate.hoursCompleted}h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Fecha</span>
                    <span className="font-medium">
                      {new Date(certificate.issuedAt).toLocaleDateString('es-ES')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Estado</span>
                    {getStatusBadge(certificate.status)}
                  </div>
                </div>

                {/* Verification Code */}
                <div className="bg-gray-50 rounded p-2 mb-4">
                  <p className="text-xs text-gray-500 text-center">Código de verificación</p>
                  <p className="text-sm font-mono font-medium text-center">
                    {certificate.verificationCode}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedCertificate(certificate);
                      setShowPreview(true);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => downloadCertificate(certificate)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => shareCertificate(certificate)}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Certificate Preview Modal */}
      {showPreview && selectedCertificate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              {/* Certificate Content */}
              <div className="border-4 border-double border-indigo-800 p-8 text-center">
                <div className="mb-6">
                  <Award className="h-16 w-16 text-indigo-600 mx-auto" />
                </div>
                
                <h1 className="text-3xl font-serif font-bold text-indigo-900 mb-2">
                  CERTIFICADO DE FINALIZACIÓN
                </h1>
                <p className="text-gray-600 mb-8">LasaEdu - Plataforma de Aprendizaje</p>
                
                <p className="text-lg text-gray-700 mb-2">Se certifica que</p>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  {selectedCertificate.studentName}
                </h2>
                
                <p className="text-lg text-gray-700 mb-2">
                  ha completado satisfactoriamente el curso
                </p>
                <h3 className="text-2xl font-semibold text-indigo-800 mb-6">
                  "{selectedCertificate.courseName}"
                </h3>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <p className="text-3xl font-bold text-green-600">
                      {selectedCertificate.grade}%
                    </p>
                    <p className="text-sm text-gray-600">Calificación</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-indigo-600">
                      {selectedCertificate.hoursCompleted}h
                    </p>
                    <p className="text-sm text-gray-600">Horas Completadas</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-800">
                      {new Date(selectedCertificate.issuedAt).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-sm text-gray-600">Fecha de Emisión</p>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600">Instructor</p>
                  <p className="font-medium">{selectedCertificate.instructorName}</p>
                </div>
                
                <div className="mt-6 bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-500">Código de Verificación</p>
                  <p className="font-mono font-bold">{selectedCertificate.verificationCode}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Verifica en: lasaedu.com/verify/{selectedCertificate.verificationCode}
                  </p>
                </div>
              </div>
              
              {/* Modal Actions */}
              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Cerrar
                </Button>
                <Button onClick={() => downloadCertificate(selectedCertificate)}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
