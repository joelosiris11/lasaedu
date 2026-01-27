/**
 * Export Service - Servicio de exportación de datos
 * Soporta: CSV, Excel (XLSX), PDF
 */

import { jsPDF } from 'jspdf';

// Types
interface ExportOptions {
  filename: string;
  title?: string;
  subtitle?: string;
  includeDate?: boolean;
}

interface TableColumn {
  key: string;
  header: string;
  width?: number;
}

// ============================================
// CSV EXPORT
// ============================================

export function exportToCSV<T extends object>(
  data: T[],
  columns: TableColumn[],
  options: ExportOptions
): void {
  if (data.length === 0) {
    console.warn('No hay datos para exportar');
    return;
  }

  // Create CSV header
  const headers = columns.map(col => `"${col.header}"`).join(',');
  
  // Create CSV rows
  const rows = data.map(item => 
    columns.map(col => {
      const value = (item as Record<string, unknown>)[col.key];
      // Handle different types
      if (value === null || value === undefined) return '""';
      if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
      if (typeof value === 'number') return value.toString();
      if (typeof value === 'boolean') return value ? 'Sí' : 'No';
      if (Array.isArray(value)) return `"${value.join(', ')}"`;
      return `"${String(value)}"`;
    }).join(',')
  ).join('\n');

  // Combine with BOM for Excel compatibility
  const BOM = '\uFEFF';
  const csvContent = BOM + headers + '\n' + rows;
  
  // Download
  downloadFile(csvContent, `${options.filename}.csv`, 'text/csv;charset=utf-8');
}

// ============================================
// EXCEL EXPORT (Simple XLSX using CSV-like format)
// ============================================

export function exportToExcel<T extends object>(
  data: T[],
  columns: TableColumn[],
  options: ExportOptions
): void {
  // For a proper XLSX, you'd use a library like xlsx or exceljs
  // Here we create a simple XML-based Excel file
  
  const escapeXml = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:Bold="1" ss:Size="14"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(options.title || 'Datos')}">
    <Table>`;

  // Title row
  if (options.title) {
    xml += `
      <Row>
        <Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXml(options.title)}</Data></Cell>
      </Row>`;
  }

  // Subtitle/Date row
  if (options.subtitle || options.includeDate) {
    const subtitle = options.subtitle || '';
    const dateStr = options.includeDate ? `Generado: ${new Date().toLocaleDateString('es-ES')}` : '';
    xml += `
      <Row>
        <Cell><Data ss:Type="String">${escapeXml(subtitle)} ${dateStr}</Data></Cell>
      </Row>
      <Row></Row>`;
  }

  // Header row
  xml += `
      <Row>`;
  columns.forEach(col => {
    xml += `
        <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col.header)}</Data></Cell>`;
  });
  xml += `
      </Row>`;

  // Data rows
  data.forEach(item => {
    xml += `
      <Row>`;
    columns.forEach(col => {
      const value = (item as Record<string, unknown>)[col.key];
      let type = 'String';
      let displayValue = '';
      
      if (value === null || value === undefined) {
        displayValue = '';
      } else if (typeof value === 'number') {
        type = 'Number';
        displayValue = value.toString();
      } else if (typeof value === 'boolean') {
        displayValue = value ? 'Sí' : 'No';
      } else if (Array.isArray(value)) {
        displayValue = value.join(', ');
      } else {
        displayValue = String(value);
      }
      
      xml += `
        <Cell><Data ss:Type="${type}">${escapeXml(displayValue)}</Data></Cell>`;
    });
    xml += `
      </Row>`;
  });

  xml += `
    </Table>
  </Worksheet>
</Workbook>`;

  downloadFile(xml, `${options.filename}.xls`, 'application/vnd.ms-excel');
}

// ============================================
// PDF EXPORT
// ============================================

export function exportToPDF<T extends object>(
  data: T[],
  columns: TableColumn[],
  options: ExportOptions
): void {
  const doc = new jsPDF({
    orientation: columns.length > 5 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // Colors
  const primaryColor: [number, number, number] = [0, 71, 171]; // Blue
  const headerBg: [number, number, number] = [240, 240, 240];

  // Header with logo placeholder
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LasaEdu', margin, 12);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Gestión de Aprendizaje', margin, 18);

  y = 35;

  // Title
  if (options.title) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(options.title, margin, y);
    y += 8;
  }

  // Subtitle and date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  
  if (options.subtitle) {
    doc.text(options.subtitle, margin, y);
    y += 5;
  }
  
  if (options.includeDate !== false) {
    doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, margin, y);
    y += 5;
  }

  y += 5;

  // Calculate column widths
  const tableWidth = pageWidth - (margin * 2);
  const defaultColWidth = tableWidth / columns.length;
  const colWidths = columns.map(col => col.width || defaultColWidth);
  
  // Normalize widths to fit table
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const normalizedWidths = colWidths.map(w => (w / totalWidth) * tableWidth);

  // Table header
  doc.setFillColor(...headerBg);
  doc.rect(margin, y, tableWidth, 8, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  
  let x = margin;
  columns.forEach((col, i) => {
    const text = doc.splitTextToSize(col.header, normalizedWidths[i] - 4);
    doc.text(text[0], x + 2, y + 5);
    x += normalizedWidths[i];
  });

  y += 10;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  data.forEach((item, rowIndex) => {
    // Check for page break
    if (y > pageHeight - 20) {
      doc.addPage();
      y = margin;
      
      // Repeat header on new page
      doc.setFillColor(...headerBg);
      doc.rect(margin, y, tableWidth, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      
      x = margin;
      columns.forEach((col, i) => {
        doc.text(col.header, x + 2, y + 5);
        x += normalizedWidths[i];
      });
      
      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    // Alternate row colors
    if (rowIndex % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 2, tableWidth, 7, 'F');
    }

    x = margin;
    columns.forEach((col, i) => {
      const value = (item as Record<string, unknown>)[col.key];
      let displayValue = '';
      
      if (value === null || value === undefined) {
        displayValue = '-';
      } else if (typeof value === 'boolean') {
        displayValue = value ? 'Sí' : 'No';
      } else if (Array.isArray(value)) {
        displayValue = value.join(', ');
      } else {
        displayValue = String(value);
      }
      
      // Truncate if too long
      const maxChars = Math.floor(normalizedWidths[i] / 2);
      if (displayValue.length > maxChars) {
        displayValue = displayValue.substring(0, maxChars - 3) + '...';
      }
      
      doc.text(displayValue, x + 2, y + 3);
      x += normalizedWidths[i];
    });

    // Row border
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y + 5, margin + tableWidth, y + 5);
    
    y += 7;
  });

  // Footer
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save
  doc.save(`${options.filename}.pdf`);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// ============================================
// PRE-BUILT EXPORT FUNCTIONS
// ============================================

// Export grades
export interface GradeExportData {
  studentName: string;
  studentEmail: string;
  courseName: string;
  evaluationName: string;
  evaluationType: string;
  grade: number;
  maxGrade: number;
  percentage: number;
  status: string;
  submittedAt: string;
  gradedAt: string;
}

export function exportGrades(
  data: GradeExportData[],
  format: 'csv' | 'excel' | 'pdf',
  courseName?: string
): void {
  const columns: TableColumn[] = [
    { key: 'studentName', header: 'Estudiante', width: 25 },
    { key: 'studentEmail', header: 'Email', width: 30 },
    { key: 'courseName', header: 'Curso', width: 25 },
    { key: 'evaluationName', header: 'Evaluación', width: 25 },
    { key: 'evaluationType', header: 'Tipo', width: 15 },
    { key: 'grade', header: 'Nota', width: 10 },
    { key: 'maxGrade', header: 'Máximo', width: 10 },
    { key: 'percentage', header: '%', width: 10 },
    { key: 'status', header: 'Estado', width: 15 },
    { key: 'submittedAt', header: 'Entregado', width: 20 },
    { key: 'gradedAt', header: 'Calificado', width: 20 }
  ];

  const options: ExportOptions = {
    filename: `calificaciones_${courseName || 'todos'}_${Date.now()}`,
    title: 'Reporte de Calificaciones',
    subtitle: courseName ? `Curso: ${courseName}` : 'Todos los cursos',
    includeDate: true
  };

  switch (format) {
    case 'csv':
      exportToCSV(data, columns, options);
      break;
    case 'excel':
      exportToExcel(data, columns, options);
      break;
    case 'pdf':
      exportToPDF(data, columns, options);
      break;
  }
}

// Export users
export interface UserExportData {
  name: string;
  email: string;
  role: string;
  status: string;
  coursesEnrolled: number;
  coursesCompleted: number;
  lastLogin: string;
  createdAt: string;
}

export function exportUsers(
  data: UserExportData[],
  format: 'csv' | 'excel' | 'pdf'
): void {
  const columns: TableColumn[] = [
    { key: 'name', header: 'Nombre', width: 30 },
    { key: 'email', header: 'Email', width: 35 },
    { key: 'role', header: 'Rol', width: 15 },
    { key: 'status', header: 'Estado', width: 15 },
    { key: 'coursesEnrolled', header: 'Cursos Inscritos', width: 15 },
    { key: 'coursesCompleted', header: 'Cursos Completados', width: 15 },
    { key: 'lastLogin', header: 'Último Acceso', width: 20 },
    { key: 'createdAt', header: 'Registrado', width: 20 }
  ];

  const options: ExportOptions = {
    filename: `usuarios_${Date.now()}`,
    title: 'Reporte de Usuarios',
    subtitle: `Total: ${data.length} usuarios`,
    includeDate: true
  };

  switch (format) {
    case 'csv':
      exportToCSV(data, columns, options);
      break;
    case 'excel':
      exportToExcel(data, columns, options);
      break;
    case 'pdf':
      exportToPDF(data, columns, options);
      break;
  }
}

// Export course progress
export interface ProgressExportData {
  studentName: string;
  studentEmail: string;
  courseName: string;
  progress: number;
  lessonsCompleted: number;
  totalLessons: number;
  evaluationsCompleted: number;
  totalEvaluations: number;
  averageGrade: number;
  timeSpent: string;
  lastAccess: string;
  status: string;
}

export function exportProgress(
  data: ProgressExportData[],
  format: 'csv' | 'excel' | 'pdf',
  courseName?: string
): void {
  const columns: TableColumn[] = [
    { key: 'studentName', header: 'Estudiante', width: 25 },
    { key: 'studentEmail', header: 'Email', width: 30 },
    { key: 'courseName', header: 'Curso', width: 25 },
    { key: 'progress', header: 'Progreso %', width: 12 },
    { key: 'lessonsCompleted', header: 'Lecciones', width: 12 },
    { key: 'evaluationsCompleted', header: 'Evaluaciones', width: 12 },
    { key: 'averageGrade', header: 'Promedio', width: 12 },
    { key: 'timeSpent', header: 'Tiempo', width: 15 },
    { key: 'lastAccess', header: 'Último Acceso', width: 18 },
    { key: 'status', header: 'Estado', width: 15 }
  ];

  const options: ExportOptions = {
    filename: `progreso_${courseName || 'todos'}_${Date.now()}`,
    title: 'Reporte de Progreso',
    subtitle: courseName ? `Curso: ${courseName}` : 'Todos los cursos',
    includeDate: true
  };

  switch (format) {
    case 'csv':
      exportToCSV(data, columns, options);
      break;
    case 'excel':
      exportToExcel(data, columns, options);
      break;
    case 'pdf':
      exportToPDF(data, columns, options);
      break;
  }
}

// Export attendance/activity
export interface AttendanceExportData {
  studentName: string;
  date: string;
  courseName: string;
  lessonName: string;
  duration: string;
  completed: boolean;
  activities: number;
}

export function exportAttendance(
  data: AttendanceExportData[],
  format: 'csv' | 'excel' | 'pdf'
): void {
  const columns: TableColumn[] = [
    { key: 'studentName', header: 'Estudiante', width: 30 },
    { key: 'date', header: 'Fecha', width: 20 },
    { key: 'courseName', header: 'Curso', width: 25 },
    { key: 'lessonName', header: 'Lección', width: 30 },
    { key: 'duration', header: 'Duración', width: 15 },
    { key: 'completed', header: 'Completado', width: 15 },
    { key: 'activities', header: 'Actividades', width: 15 }
  ];

  const options: ExportOptions = {
    filename: `asistencia_${Date.now()}`,
    title: 'Reporte de Actividad',
    includeDate: true
  };

  switch (format) {
    case 'csv':
      exportToCSV(data, columns, options);
      break;
    case 'excel':
      exportToExcel(data, columns, options);
      break;
    case 'pdf':
      exportToPDF(data, columns, options);
      break;
  }
}

// Generic export function
export function exportData<T extends object>(
  data: T[],
  columns: TableColumn[],
  format: 'csv' | 'excel' | 'pdf',
  options: ExportOptions
): void {
  switch (format) {
    case 'csv':
      exportToCSV(data, columns, options);
      break;
    case 'excel':
      exportToExcel(data, columns, options);
      break;
    case 'pdf':
      exportToPDF(data, columns, options);
      break;
  }
}
