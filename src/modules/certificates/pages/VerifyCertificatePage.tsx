import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { certificateService } from '@shared/services/dataService';
import {
  Award,
  CheckCircle,
  XCircle,
  User,
  BookOpen,
  Calendar,
  Shield,
  ArrowLeft,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';

interface CertificateVerification {
  isValid: boolean;
  isRevoked: boolean;
  certificate?: {
    id: string;
    studentName: string;
    courseName: string;
    instructorName: string;
    completionDate: string;
    grade?: number;
    credentialId: string;
    issuedAt: number;
  };
  error?: string;
}

export default function VerifyCertificatePage() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<CertificateVerification | null>(null);

  useEffect(() => {
    verifyCertificate();
  }, [certificateId]);

  const verifyCertificate = async () => {
    if (!certificateId) {
      setVerification({
        isValid: false,
        isRevoked: false,
        error: 'No se proporcionó un ID de certificado'
      });
      setLoading(false);
      return;
    }

    try {
      // Search by credential ID
      const certificates = await certificateService.getAll();
      const certificate = certificates.find(
        (c: any) => c.credentialId === certificateId || c.id === certificateId
      ) as any;

      if (!certificate) {
        setVerification({
          isValid: false,
          isRevoked: false,
          error: 'Certificado no encontrado en nuestros registros'
        });
      } else if (certificate.isRevoked) {
        setVerification({
          isValid: false,
          isRevoked: true,
          certificate: {
            id: certificate.id,
            studentName: certificate.studentName,
            courseName: certificate.courseName,
            instructorName: certificate.instructorName,
            completionDate: certificate.completionDate,
            grade: certificate.grade,
            credentialId: certificate.credentialId,
            issuedAt: certificate.issuedAt
          },
          error: 'Este certificado ha sido revocado'
        });
      } else {
        setVerification({
          isValid: true,
          isRevoked: false,
          certificate: {
            id: certificate.id,
            studentName: certificate.studentName,
            courseName: certificate.courseName,
            instructorName: certificate.instructorName,
            completionDate: certificate.completionDate,
            grade: certificate.grade,
            credentialId: certificate.credentialId,
            issuedAt: certificate.issuedAt
          }
        });
      }
    } catch (error) {
      console.error('Error verifying certificate:', error);
      setVerification({
        isValid: false,
        isRevoked: false,
        error: 'Error al verificar el certificado. Por favor intente nuevamente.'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | number) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verificando certificado...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-lg mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Verificación de Certificado</h1>
          <p className="text-gray-600 mt-2">
            Sistema de verificación de credenciales de LasaEdu
          </p>
        </div>

        {/* Verification Result */}
        <Card className="shadow-xl">
          <CardContent className="p-0">
            {/* Status Banner */}
            <div className={`p-6 text-center ${
              verification?.isValid
                ? 'bg-green-500'
                : verification?.isRevoked
                  ? 'bg-red-500'
                  : 'bg-yellow-500'
            }`}>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
                {verification?.isValid ? (
                  <CheckCircle className="w-10 h-10 text-white" />
                ) : verification?.isRevoked ? (
                  <XCircle className="w-10 h-10 text-white" />
                ) : (
                  <AlertTriangle className="w-10 h-10 text-white" />
                )}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {verification?.isValid
                  ? 'Certificado Válido'
                  : verification?.isRevoked
                    ? 'Certificado Revocado'
                    : 'Certificado No Encontrado'
                }
              </h2>
              <p className="text-white/90">
                {verification?.isValid
                  ? 'Este certificado es auténtico y fue emitido por LasaEdu'
                  : verification?.error
                }
              </p>
            </div>

            {/* Certificate Details */}
            {verification?.certificate && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-blue-600" />
                  Detalles del Certificado
                </h3>

                <div className="space-y-4">
                  <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                    <User className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Otorgado a</p>
                      <p className="font-semibold text-gray-900">
                        {verification.certificate.studentName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                    <BookOpen className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Curso completado</p>
                      <p className="font-semibold text-gray-900">
                        {verification.certificate.courseName}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                      <Calendar className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Fecha de emisión</p>
                        <p className="font-semibold text-gray-900">
                          {formatDate(verification.certificate.completionDate)}
                        </p>
                      </div>
                    </div>

                    {verification.certificate.grade && (
                      <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                        <Award className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Calificación</p>
                          <p className="font-semibold text-gray-900">
                            {verification.certificate.grade}%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                    <User className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Instructor</p>
                      <p className="font-semibold text-gray-900">
                        {verification.certificate.instructorName}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm text-gray-500 mb-1">ID de Verificación</p>
                    <p className="font-mono text-sm bg-gray-100 px-3 py-2 rounded">
                      {verification.certificate.credentialId}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t p-6 bg-gray-50">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-500 text-center sm:text-left">
                  <p>Verificación realizada el {new Date().toLocaleDateString('es-ES')}</p>
                  <p>Sistema de Certificación LasaEdu - T-Eco Group</p>
                </div>
                <Link to="/login">
                  <Button variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Ir a LasaEdu
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Section */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p className="mb-2">
            ¿Tienes preguntas sobre la verificación de certificados?
          </p>
          <p>
            Contacta al soporte de LasaEdu o visita nuestra{' '}
            <a href="/help" className="text-blue-600 hover:underline">
              página de ayuda
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
