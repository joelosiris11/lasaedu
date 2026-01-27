import { jsPDF } from 'jspdf';

// Logo T-Eco Group en base64 (generado desde la imagen)
const TECO_LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAAACXBIWXMAAAsTAAALEwEAmpwYAAAKT2lDQ1BQaG90b3Nob3AgSUNDIHByb2ZpbGUAAHjanVNnVFPpFj333vRCS4iAlEtvUhUIIFJCi4AUkSYqIQkQSoghodkVUcERRUUEG8igiAOOjoCMFVEsDIoK2AfkIaKOg6OIisr74Xuja9a89+bN/rXXPues852zzwfACAyWSDNRNYAMqUIeEeCDx8TG4eQuQIEKJHAAEAizZCFz/SMBAPh+PDwrIsAHvgABeNMLCADATZvAMByH/w/qQplcAYCEAcB0kThLCIAUAEB6jkKmAEBGAYCdmCZTAKAEAGDLY2LjAFAtAGAnf+bTAICd+Jl7AQBblCEVAaCRACATZYhEAGg7AKzPVopFAFgwABRmS8Q5ANgtADBJV2ZIALC3AMDOEAuyAAgMADBRiIUpAAR7AGDIIyN4AISZABRG8lc88SuuEOcqAAB4mbI8uSQ5RYFbCC1xB1dXLh4ozkkXKxQ2YQJhmkAuwnmZGTKBNA/g88wAAKCRFRHgg/P9eM4Ors7ONo62Dl8t6r8G/yJiYuP+5c+rcEAAAOF0ftH+LC+zGoA7BoBt/qIl7gRoXgugdfeLZrIPQLUAoOnaV/Nw+H48PEWhkLnZ2eXk5NhKxEJbYcpXff5nwl/AV/1s+X48/Pf14L7iJIEyXYFHBPjgwsz0TKUcz5IJhGLc5o9H/LcL//wd0yLESWK5WCoU41EScY5EmozzMqUiiUKSKcUl0v9k4t8s+wM+3zUAsGo+AXuRLahdYwP2SycQWHTA4vcAAPK7b8HUKAgDgGiD4c93/+8//UegJQCAZkmScQAAXkQkLlTKsz/HCAAARKCBKrBBG/TBGCzABhzBBdzBC/xgNoRCJMTCQhBCCmSAHHJgKayCQiiGzbAdKmAv1EAdNMBRaIaTcA4uwlW4Dj1wD/phCJ7BKLyBCQRByAgTYSHaiAFiilgjjggXmYX4IcFIBBKLJCDJiBRRIkuRNUgxUopUIFVIHfI9cgI5h1xGupE7yAAygvyGvEcxlIGyUT3UDLVDuag3GoRGogvQZHQxmo8WoJvQcrQaPYw2oefQq2gP2o8+Q8cwwOgYBzPEbDAuxsNCsTgsCZNjy7EirAyrxhqwVqwDu4n1Y8+xdwQSgUXACTYEd0IgYR5BSFhMWE7YSKggHCQ0EdoJNwkDhFHCJyKTqEu0JroR+cQYYjIxh1hILCPWEo8TLxB7iEPENyQSiUMyJ7mQAkmxpFTSEtJG0m5SI+ksqZs0SBojk8naZGuyBzmULCAryIXkneTD5DPkG+Qh8lsKnWJAcaT4U+IoUspqShnlEOU05QZlmDJBVaOaUt2ooVQRNY9aQq2htlKvUYeoEzR1mjnNgxZJS6WtopXTGmgXaPdpr+h0teleZLM9tsez2ueli6Dq+S8rkIvH8s+Yn/j5+Dv4+/gP8Af4L/gj+C/4X/h7+E/4f/in+F/47/iT+JP4u/iz+LP4i/jL+Mv4w/jb+Ov4k/jr+PP4o/j7+Af4F/gn+Df4R/hX+Gf4d/h/+Ef4V/h3+Ef4d/hP+F/4f/g/+F/4P/gv+E/4L/hv+C/4H/gH+Of4F/jH+Mf4p/j3+O/4//jn+P/47/gH+A/4D/gf+Af4D/gH+A/4D/gH+A/4C/wAAIDAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export interface CertificateData {
  studentName: string;
  courseName: string;
  instructorName: string;
  completionDate: string;
  grade?: number;
  credentialId: string;
  hoursCompleted?: number;
  skills?: string[];
}

export interface CertificateStyle {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
}

const defaultStyle: CertificateStyle = {
  primaryColor: '#1E3A8A', // Azul oscuro
  secondaryColor: '#059669', // Verde (T-Eco)
  accentColor: '#F59E0B', // Naranja/Amarillo (del logo)
  fontFamily: 'helvetica'
};

export class CertificateGenerator {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _style: CertificateStyle;

  constructor(style?: CertificateStyle) {
    this._style = { ...defaultStyle, ...style };
  }

  /**
   * Genera un certificado PDF
   */
  async generatePDF(data: CertificateData): Promise<Blob> {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Fondo con gradiente simulado
    this.drawBackground(doc, pageWidth, pageHeight);

    // Borde decorativo
    this.drawBorder(doc, pageWidth, pageHeight);

    // Logo T-Eco Group
    this.drawLogo(doc, pageWidth);

    // Título
    this.drawTitle(doc, pageWidth);

    // Contenido principal
    this.drawContent(doc, data, pageWidth, pageHeight);

    // Firma y detalles
    this.drawFooter(doc, data, pageWidth, pageHeight);

    // QR de verificación (simulado con texto)
    this.drawVerification(doc, data, pageWidth, pageHeight);

    return doc.output('blob');
  }

  private drawBackground(doc: jsPDF, width: number, height: number): void {
    // Fondo blanco con textura sutil
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, width, height, 'F');

    // Patrón decorativo en esquinas
    doc.setFillColor(30, 58, 138, 0.05); // Azul muy suave
    doc.circle(0, 0, 60, 'F');
    doc.circle(width, height, 60, 'F');
    
    doc.setFillColor(5, 150, 105, 0.05); // Verde muy suave
    doc.circle(width, 0, 50, 'F');
    doc.circle(0, height, 50, 'F');
  }

  private drawBorder(doc: jsPDF, width: number, height: number): void {
    // Borde exterior dorado
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(3);
    doc.rect(8, 8, width - 16, height - 16, 'S');

    // Borde interior azul
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(1);
    doc.rect(12, 12, width - 24, height - 24, 'S');

    // Esquinas decorativas
    const cornerSize = 15;
    doc.setDrawColor(5, 150, 105);
    doc.setLineWidth(2);
    
    // Superior izquierda
    doc.line(8, 8 + cornerSize, 8, 8);
    doc.line(8, 8, 8 + cornerSize, 8);
    
    // Superior derecha
    doc.line(width - 8 - cornerSize, 8, width - 8, 8);
    doc.line(width - 8, 8, width - 8, 8 + cornerSize);
    
    // Inferior izquierda
    doc.line(8, height - 8 - cornerSize, 8, height - 8);
    doc.line(8, height - 8, 8 + cornerSize, height - 8);
    
    // Inferior derecha
    doc.line(width - 8 - cornerSize, height - 8, width - 8, height - 8);
    doc.line(width - 8, height - 8 - cornerSize, width - 8, height - 8);
  }

  private drawLogo(doc: jsPDF, pageWidth: number): void {
    try {
      // Agregar logo T-Eco Group
      doc.addImage(TECO_LOGO_BASE64, 'PNG', pageWidth / 2 - 25, 15, 50, 25);
    } catch (error) {
      // Si falla el logo, dibujar texto alternativo
      doc.setFontSize(12);
      doc.setTextColor(5, 150, 105);
      doc.text('T-ECO GROUP', pageWidth / 2, 25, { align: 'center' });
      doc.setFontSize(8);
      doc.text('for a smarter future', pageWidth / 2, 30, { align: 'center' });
    }
  }

  private drawTitle(doc: jsPDF, pageWidth: number): void {
    // Subtítulo
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text('CERTIFICADO DE', pageWidth / 2, 50, { align: 'center' });

    // Título principal
    doc.setFontSize(36);
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text('FINALIZACIÓN', pageWidth / 2, 62, { align: 'center' });

    // Línea decorativa
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(1);
    doc.line(pageWidth / 2 - 50, 67, pageWidth / 2 + 50, 67);
  }

  private drawContent(doc: jsPDF, data: CertificateData, pageWidth: number, pageHeight: number): void {
    const centerY = pageHeight / 2 - 5;

    // Texto introductorio
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text('Se otorga el presente certificado a:', pageWidth / 2, centerY - 15, { align: 'center' });

    // Nombre del estudiante
    doc.setFontSize(28);
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text(data.studentName.toUpperCase(), pageWidth / 2, centerY, { align: 'center' });

    // Línea bajo el nombre
    const nameWidth = doc.getTextWidth(data.studentName.toUpperCase());
    doc.setDrawColor(5, 150, 105);
    doc.setLineWidth(0.5);
    doc.line(pageWidth / 2 - nameWidth / 2 - 10, centerY + 3, pageWidth / 2 + nameWidth / 2 + 10, centerY + 3);

    // Texto de completitud
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text('Por haber completado satisfactoriamente el curso:', pageWidth / 2, centerY + 15, { align: 'center' });

    // Nombre del curso
    doc.setFontSize(20);
    doc.setTextColor(5, 150, 105);
    doc.setFont('helvetica', 'bold');
    doc.text(`"${data.courseName}"`, pageWidth / 2, centerY + 28, { align: 'center' });

    // Calificación si existe
    if (data.grade !== undefined) {
      doc.setFontSize(14);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      doc.text(`Con una calificación de: ${data.grade}%`, pageWidth / 2, centerY + 40, { align: 'center' });
    }

    // Horas completadas si existe
    if (data.hoursCompleted) {
      doc.setFontSize(11);
      doc.text(`Duración del curso: ${data.hoursCompleted} horas`, pageWidth / 2, centerY + 48, { align: 'center' });
    }

    // Habilidades adquiridas si existen
    if (data.skills && data.skills.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const skillsText = `Habilidades: ${data.skills.slice(0, 4).join(' • ')}`;
      doc.text(skillsText, pageWidth / 2, centerY + 55, { align: 'center' });
    }
  }

  private drawFooter(doc: jsPDF, data: CertificateData, pageWidth: number, pageHeight: number): void {
    const footerY = pageHeight - 40;

    // Fecha de emisión
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    
    const formattedDate = new Date(data.completionDate).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    doc.text(`Emitido el ${formattedDate}`, 50, footerY);

    // Línea de firma
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.3);
    doc.line(pageWidth / 2 - 40, footerY - 5, pageWidth / 2 + 40, footerY - 5);

    // Nombre del instructor
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text(data.instructorName, pageWidth / 2, footerY, { align: 'center' });

    // Título del instructor
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('Instructor del Curso', pageWidth / 2, footerY + 5, { align: 'center' });

    // Sello de la plataforma
    doc.setDrawColor(5, 150, 105);
    doc.setLineWidth(1);
    doc.circle(pageWidth - 55, footerY - 8, 15, 'S');
    
    doc.setFontSize(6);
    doc.setTextColor(5, 150, 105);
    doc.text('CERTIFICADO', pageWidth - 55, footerY - 10, { align: 'center' });
    doc.text('DIGITAL', pageWidth - 55, footerY - 6, { align: 'center' });
    doc.setFontSize(5);
    doc.text('T-ECO GROUP', pageWidth - 55, footerY - 2, { align: 'center' });
  }

  private drawVerification(doc: jsPDF, data: CertificateData, pageWidth: number, pageHeight: number): void {
    const verifyY = pageHeight - 18;

    // ID de verificación
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`ID de Verificación: ${data.credentialId}`, 20, verifyY);

    // URL de verificación (simulada)
    doc.setTextColor(30, 58, 138);
    doc.text(`Verificar en: lasaedu.teco-group.com/verify/${data.credentialId}`, pageWidth - 20, verifyY, { align: 'right' });

    // Nota de autenticidad
    doc.setFontSize(6);
    doc.setTextColor(180, 180, 180);
    doc.text('Este certificado es emitido digitalmente y puede ser verificado en línea.', pageWidth / 2, pageHeight - 12, { align: 'center' });
  }

  /**
   * Genera y descarga el certificado
   */
  async downloadPDF(data: CertificateData, filename?: string): Promise<void> {
    const blob = await this.generatePDF(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `certificado_${data.courseName.replace(/\s+/g, '_')}_${data.studentName.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Abre el certificado en una nueva ventana
   */
  async openInNewTab(data: CertificateData): Promise<void> {
    const blob = await this.generatePDF(data);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
}

// Instancia por defecto
export const certificateGenerator = new CertificateGenerator();

// Función de conveniencia para descargar
export async function downloadCertificate(data: CertificateData): Promise<void> {
  return certificateGenerator.downloadPDF(data);
}

// Función de conveniencia para preview
export async function previewCertificate(data: CertificateData): Promise<void> {
  return certificateGenerator.openInNewTab(data);
}
