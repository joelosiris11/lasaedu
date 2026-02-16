/**
 * Servicio LTI (Learning Tools Interoperability)
 * Gestiona herramientas LTI, lanzamientos y registros
 *
 * Nota: La firma OAuth HMAC-SHA1 de LTI 1.1 requiere un backend en producción.
 * Esta implementación construye los parámetros de lanzamiento sin firma criptográfica.
 * Para producción, usar una Cloud Function que firme los parámetros.
 */

import { database } from '@app/config/firebase';
import { ref, get, set, push, remove, update, query, orderByChild, equalTo } from 'firebase/database';
import type { LTIToolConfig, LTILaunchParams, LTILaunchRecord } from '@shared/types/elearning-standards';

const PLATFORM_GUID = 'lasaedu.com';
const PLATFORM_NAME = 'LASA EDU';
const PLATFORM_FAMILY = 'lasaedu';
const PLATFORM_VERSION = '1.0';

export class LTIService {
  // =============================================
  // CRUD DE HERRAMIENTAS LTI
  // =============================================

  async createTool(data: Omit<LTIToolConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<LTIToolConfig> {
    const toolsRef = ref(database, 'ltiTools');
    const newRef = push(toolsRef);
    const now = Date.now();
    const tool: LTIToolConfig = {
      ...data,
      id: newRef.key!,
      createdAt: now,
      updatedAt: now
    };
    await set(newRef, tool);
    return tool;
  }

  async getTool(id: string): Promise<LTIToolConfig | null> {
    const snapshot = await get(ref(database, `ltiTools/${id}`));
    return snapshot.exists() ? (snapshot.val() as LTIToolConfig) : null;
  }

  async getTools(): Promise<LTIToolConfig[]> {
    const snapshot = await get(ref(database, 'ltiTools'));
    if (!snapshot.exists()) return [];
    return Object.values(snapshot.val()) as LTIToolConfig[];
  }

  async getActiveTools(): Promise<LTIToolConfig[]> {
    const q = query(ref(database, 'ltiTools'), orderByChild('isActive'), equalTo(true));
    const snapshot = await get(q);
    if (!snapshot.exists()) return [];
    return Object.values(snapshot.val()) as LTIToolConfig[];
  }

  async updateTool(id: string, data: Partial<LTIToolConfig>): Promise<void> {
    await update(ref(database, `ltiTools/${id}`), {
      ...data,
      updatedAt: Date.now()
    });
  }

  async deleteTool(id: string): Promise<void> {
    await remove(ref(database, `ltiTools/${id}`));
  }

  // =============================================
  // LANZAMIENTO LTI
  // =============================================

  buildLaunchParams(params: {
    tool: LTIToolConfig;
    userId: string;
    userName?: string;
    userEmail?: string;
    userRole: 'admin' | 'teacher' | 'student';
    courseId: string;
    courseTitle?: string;
    lessonId?: string;
    resourceLinkId: string;
  }): LTILaunchParams {
    const { tool, userId, userName, userEmail, userRole, courseId, courseTitle, resourceLinkId } = params;

    const ltiRole = this.mapRole(userRole);
    const nameParts = userName?.split(' ') || [];

    const launchParams: LTILaunchParams = {
      lti_message_type: 'basic-lti-launch-request',
      lti_version: 'LTI-1p0',
      resource_link_id: resourceLinkId,
      roles: ltiRole,
      oauth_consumer_key: tool.consumerKey,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: this.generateNonce(),
      oauth_version: '1.0',
      tool_consumer_instance_guid: PLATFORM_GUID,
      tool_consumer_instance_name: PLATFORM_NAME,
      tool_consumer_info_product_family_code: PLATFORM_FAMILY,
      tool_consumer_info_version: PLATFORM_VERSION,
    };

    // Datos del usuario según nivel de privacidad
    if (tool.privacyLevel !== 'anonymous') {
      launchParams.user_id = userId;
    }
    if (tool.privacyLevel === 'public' || tool.privacyLevel === 'name_only') {
      launchParams.lis_person_name_full = userName;
      launchParams.lis_person_name_given = nameParts[0];
      launchParams.lis_person_name_family = nameParts.slice(1).join(' ') || undefined;
    }
    if (tool.privacyLevel === 'public' || tool.privacyLevel === 'email_only') {
      launchParams.lis_person_contact_email_primary = userEmail;
    }

    // Contexto del curso
    launchParams.context_id = courseId;
    if (courseTitle) {
      launchParams.context_title = courseTitle;
      launchParams.context_label = courseTitle;
    }

    // Parámetros personalizados
    if (tool.customParameters) {
      for (const [key, value] of Object.entries(tool.customParameters)) {
        launchParams[`custom_${key}`] = value;
      }
    }

    // Nota: oauth_signature no se calcula en client-side
    // En producción, enviar estos params a una Cloud Function que firme con HMAC-SHA1
    launchParams.oauth_signature = 'PENDING_SERVER_SIGNATURE';

    return launchParams;
  }

  buildLaunchFormHTML(launchUrl: string, params: LTILaunchParams): string {
    const inputs = Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) =>
        `<input type="hidden" name="${this.escapeHtml(key)}" value="${this.escapeHtml(String(value))}" />`
      )
      .join('\n');

    return `
      <html>
        <body>
          <form id="lti-launch-form" action="${this.escapeHtml(launchUrl)}" method="POST">
            ${inputs}
          </form>
          <script>document.getElementById('lti-launch-form').submit();</script>
        </body>
      </html>
    `.trim();
  }

  // =============================================
  // REGISTROS DE LANZAMIENTO
  // =============================================

  async recordLaunch(data: Omit<LTILaunchRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<LTILaunchRecord> {
    const launchesRef = ref(database, 'ltiLaunchRecords');
    const newRef = push(launchesRef);
    const now = Date.now();
    const record: LTILaunchRecord = {
      ...data,
      id: newRef.key!,
      createdAt: now,
      updatedAt: now
    };
    await set(newRef, record);
    return record;
  }

  async getLaunchRecords(toolId: string): Promise<LTILaunchRecord[]> {
    const q = query(ref(database, 'ltiLaunchRecords'), orderByChild('toolId'), equalTo(toolId));
    const snapshot = await get(q);
    if (!snapshot.exists()) return [];
    return Object.values(snapshot.val()) as LTILaunchRecord[];
  }

  async getLaunchRecordsByUser(userId: string): Promise<LTILaunchRecord[]> {
    const q = query(ref(database, 'ltiLaunchRecords'), orderByChild('userId'), equalTo(userId));
    const snapshot = await get(q);
    if (!snapshot.exists()) return [];
    return Object.values(snapshot.val()) as LTILaunchRecord[];
  }

  async getLaunchRecordsByCourse(courseId: string): Promise<LTILaunchRecord[]> {
    const q = query(ref(database, 'ltiLaunchRecords'), orderByChild('courseId'), equalTo(courseId));
    const snapshot = await get(q);
    if (!snapshot.exists()) return [];
    return Object.values(snapshot.val()) as LTILaunchRecord[];
  }

  async updateLaunchGrade(recordId: string, grade: number): Promise<void> {
    await update(ref(database, `ltiLaunchRecords/${recordId}`), {
      gradeReceived: grade,
      gradeReceivedAt: Date.now(),
      status: 'completed',
      updatedAt: Date.now()
    });
  }

  async updateLaunchStatus(recordId: string, status: LTILaunchRecord['status'], errorMessage?: string): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      updatedAt: Date.now()
    };
    if (errorMessage) updates.errorMessage = errorMessage;
    await update(ref(database, `ltiLaunchRecords/${recordId}`), updates);
  }

  // =============================================
  // UTILIDADES PRIVADAS
  // =============================================

  private mapRole(role: 'admin' | 'teacher' | 'student'): string {
    switch (role) {
      case 'admin': return 'urn:lti:role:ims/lis/Administrator';
      case 'teacher': return 'urn:lti:role:ims/lis/Instructor';
      case 'student': return 'urn:lti:role:ims/lis/Learner';
    }
  }

  private generateNonce(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const ltiService = new LTIService();
