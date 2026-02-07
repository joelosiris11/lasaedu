import { jsPDF } from 'jspdf';

export interface CertificateData {
  id: string;
  userId: string;
  userName: string;
  courseId: string;
  courseTitle: string;
  instructorName: string;
  completedAt: number;
  score?: number;
  hours?: number;
  certificateNumber: string;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  type: 'completion' | 'achievement' | 'participation';
  layout: {
    format: 'A4' | 'Letter' | 'landscape';
    orientation: 'portrait' | 'landscape';
    backgroundColor: string;
    borderColor?: string;
    borderWidth?: number;
  };
  elements: CertificateElement[];
  createdBy: string;
  createdAt: number;
}

export interface CertificateElement {
  id: string;
  type: 'text' | 'image' | 'signature' | 'qr' | 'date' | 'border';
  content: string;
  position: { x: number; y: number };
  size: { width?: number; height?: number };
  style: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: 'normal' | 'bold';
    color?: string;
    align?: 'left' | 'center' | 'right';
  };
}

export interface CertificateRecord {
  id: string;
  certificateData: CertificateData;
  templateId: string;
  generatedAt: number;
  downloadCount: number;
  isRevoked: boolean;
  verificationCode: string;
  pdfUrl?: string;
}

class CertificateGeneratorService {
  private defaultTemplate: CertificateTemplate = {
    id: 'default',
    name: 'Certificado Estándar',
    type: 'completion',
    layout: {
      format: 'A4',
      orientation: 'landscape',
      backgroundColor: '#ffffff',
      borderColor: '#2563eb',
      borderWidth: 2
    },
    elements: [
      {
        id: 'title',
        type: 'text',
        content: 'CERTIFICADO DE FINALIZACIÓN',
        position: { x: 50, y: 40 },        size: { width: 200, height: 40 },        style: {
          fontSize: 28,
          fontFamily: 'helvetica',
          fontWeight: 'bold',
          color: '#1e40af',
          align: 'center'
        }
      },
      {
        id: 'subtitle',
        type: 'text',
        content: 'Se otorga el presente certificado a:',
        position: { x: 50, y: 70 },        size: { width: 200, height: 20 },        style: {
          fontSize: 14,
          fontFamily: 'helvetica',
          color: '#374151',
          align: 'center'
        }
      },
      {
        id: 'student_name',
        type: 'text',
        content: '{userName}',
        position: { x: 50, y: 100 },        size: { width: 200, height: 30 },        style: {
          fontSize: 24,
          fontFamily: 'helvetica',
          fontWeight: 'bold',
          color: '#111827',
          align: 'center'
        }
      },
      {
        id: 'course_text',
        type: 'text',
        content: 'Por completar exitosamente el curso:',
        position: { x: 50, y: 130 },        size: { width: 200, height: 20 },        style: {
          fontSize: 14,
          fontFamily: 'helvetica',
          color: '#374151',
          align: 'center'
        }
      },
      {
        id: 'course_name',
        type: 'text',
        content: '{courseTitle}',
        position: { x: 50, y: 150 },        size: { width: 200, height: 25 },        style: {
          fontSize: 18,
          fontFamily: 'helvetica',
          fontWeight: 'bold',
          color: '#1e40af',
          align: 'center'
        }
      },
      {
        id: 'completion_date',
        type: 'text',
        content: 'Fecha de finalización: {completedDate}',
        position: { x: 50, y: 180 },        size: { width: 200, height: 20 },        style: {
          fontSize: 12,
          fontFamily: 'helvetica',
          color: '#6b7280',
          align: 'center'
        }
      },
      {
        id: 'instructor',
        type: 'text',
        content: 'Instructor: {instructorName}',
        position: { x: 200, y: 220 },        size: { width: 200, height: 20 },        style: {
          fontSize: 12,
          fontFamily: 'helvetica',
          color: '#374151',
          align: 'center'
        }
      },
      {
        id: 'certificate_number',
        type: 'text',
        content: 'N° Certificado: {certificateNumber}',
        position: { x: 20, y: 270 },        size: { width: 200, height: 15 },        style: {
          fontSize: 10,
          fontFamily: 'helvetica',
          color: '#9ca3af',
          align: 'left'
        }
      },
      {
        id: 'verification',
        type: 'text',
        content: 'Verificación: {verificationCode}',
        position: { x: 200, y: 270 },        size: { width: 120, height: 15 },        style: {
          fontSize: 10,
          fontFamily: 'helvetica',
          color: '#9ca3af',
          align: 'right'
        }
      }
    ],
    createdBy: 'system',
    createdAt: Date.now()
  };

  generateCertificateNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `CERT-${timestamp}-${random}`.toUpperCase();
  }

  generateVerificationCode(): string {
    return Math.random().toString(36).substring(2, 12).toUpperCase();
  }

  private replaceTemplateVariables(
    content: string, 
    data: CertificateData, 
    verificationCode: string
  ): string {
    const completedDate = new Date(data.completedAt).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return content
      .replace('{userName}', data.userName)
      .replace('{courseTitle}', data.courseTitle)
      .replace('{instructorName}', data.instructorName)
      .replace('{completedDate}', completedDate)
      .replace('{certificateNumber}', data.certificateNumber)
      .replace('{verificationCode}', verificationCode)
      .replace('{score}', data.score?.toString() || '0')
      .replace('{hours}', data.hours?.toString() || '0');
  }

  async generateCertificatePDF(
    certificateData: CertificateData,
    template: CertificateTemplate = this.defaultTemplate
  ): Promise<Blob> {
    const verificationCode = this.generateVerificationCode();
    
    // Create PDF document
    const pdf = new jsPDF({
      orientation: template.layout.orientation === 'landscape' ? 'l' : 'p',
      unit: 'mm',
      format: template.layout.format.toLowerCase() as 'a4' | 'letter'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Set background color
    if (template.layout.backgroundColor !== '#ffffff') {
      pdf.setFillColor(template.layout.backgroundColor);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    }

    // Draw border if specified
    if (template.layout.borderColor && template.layout.borderWidth) {
      pdf.setDrawColor(template.layout.borderColor);
      pdf.setLineWidth(template.layout.borderWidth);
      pdf.rect(
        template.layout.borderWidth / 2,
        template.layout.borderWidth / 2,
        pageWidth - template.layout.borderWidth,
        pageHeight - template.layout.borderWidth
      );
    }

    // Process each template element
    for (const element of template.elements) {
      const content = this.replaceTemplateVariables(
        element.content,
        certificateData,
        verificationCode
      );

      const x = (element.position.x / 100) * pageWidth;
      const y = (element.position.y / 100) * pageHeight;

      switch (element.type) {
        case 'text':
          // Set font
          pdf.setFont(
            element.style.fontFamily || 'helvetica',
            element.style.fontWeight || 'normal'
          );
          pdf.setFontSize(element.style.fontSize || 12);
          
          // Set color
          if (element.style.color) {
            const color = this.hexToRgb(element.style.color);
            pdf.setTextColor(color.r, color.g, color.b);
          }

          // Add text with alignment
          const align = element.style.align || 'left';
          if (align === 'center') {
            pdf.text(content, pageWidth / 2, y, { align: 'center' });
          } else if (align === 'right') {
            pdf.text(content, pageWidth - 20, y, { align: 'right' });
          } else {
            pdf.text(content, x, y);
          }
          break;

        case 'qr':
          // Generate QR code for verification
          const qrData = `${window.location.origin}/verify/${verificationCode}`;
          // Note: In a real implementation, you'd use a QR code library like qrcode
          pdf.text(`QR: ${qrData}`, x, y);
          break;

        case 'image':
          // Note: In a real implementation, you'd load and insert actual images
          pdf.text('[LOGO]', x, y);
          break;

        case 'signature':
          // Note: In a real implementation, you'd insert signature images
          pdf.text('[SIGNATURE]', x, y);
          break;
      }
    }

    return pdf.output('blob');
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : { r: 0, g: 0, b: 0 };
  }

  async downloadCertificate(
    certificateData: CertificateData,
    template?: CertificateTemplate
  ): Promise<void> {
    const pdfBlob = await this.generateCertificatePDF(certificateData, template);
    
    // Create download link
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `certificado-${certificateData.certificateNumber}.pdf`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
  }

  validateCertificate(_verificationCode: string): Promise<CertificateRecord | null> {
    // In a real implementation, this would query the database
    return Promise.resolve(null);
  }

  // Template management
  createTemplate(template: Omit<CertificateTemplate, 'id' | 'createdAt'>): CertificateTemplate {
    return {
      ...template,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
  }

  // Bulk certificate generation
  async generateBulkCertificates(
    certificates: CertificateData[],
    template?: CertificateTemplate
  ): Promise<Blob[]> {
    const pdfs: Blob[] = [];
    
    for (const cert of certificates) {
      const pdf = await this.generateCertificatePDF(cert, template);
      pdfs.push(pdf);
    }
    
    return pdfs;
  }

  // Analytics
  getCertificateStats(_courseId: string): Promise<{
    totalGenerated: number;
    totalDownloads: number;
    conversionRate: number;
    topPerformers: { userName: string; score: number }[];
  }> {
    // Implementation would query database for stats
    return Promise.resolve({
      totalGenerated: 0,
      totalDownloads: 0,
      conversionRate: 0,
      topPerformers: []
    });
  }
}

export const certificateGenerator = new CertificateGeneratorService();
export default certificateGenerator;