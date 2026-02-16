/**
 * SCORM Runtime Environment (RTE)
 * Implementación de las APIs SCORM 1.2 y SCORM 2004
 * Se exponen en window.API y window.API_1484_11 respectivamente
 */

import type { SCORMRuntimeData, SCORMVersion, SCORMCompletionStatus } from '@shared/types/elearning-standards';

// =============================================
// SCORM 1.2 ERROR CODES
// =============================================

const SCORM12_ERRORS: Record<number, { message: string; diagnostic: string }> = {
  0: { message: 'No Error', diagnostic: 'No error occurred' },
  101: { message: 'General Exception', diagnostic: 'General exception' },
  201: { message: 'Invalid argument error', diagnostic: 'The argument is invalid' },
  202: { message: 'Element cannot have children', diagnostic: 'Element is a keyword' },
  203: { message: 'Element not an array', diagnostic: 'Cannot use count on a non-array' },
  301: { message: 'Not initialized', diagnostic: 'LMSInitialize has not been called' },
  401: { message: 'Not implemented error', diagnostic: 'Element is not implemented' },
  402: { message: 'Invalid set value', diagnostic: 'The value is out of range' },
  403: { message: 'Element is read only', diagnostic: 'Cannot set a read-only element' },
  404: { message: 'Element is write only', diagnostic: 'Cannot get a write-only element' },
  405: { message: 'Incorrect data type', diagnostic: 'The value type is incorrect' },
};

// Read-only elements in SCORM 1.2
const SCORM12_READ_ONLY = new Set([
  'cmi.core.student_id',
  'cmi.core.student_name',
  'cmi.core.credit',
  'cmi.core.entry',
  'cmi.core.total_time',
  'cmi.core.lesson_mode',
  'cmi.launch_data',
  'cmi.comments_from_lms',
  'cmi.student_data.mastery_score',
  'cmi.student_data.max_time_allowed',
  'cmi.student_data.time_limit_action',
]);

// Write-only elements in SCORM 1.2
const SCORM12_WRITE_ONLY = new Set([
  'cmi.core.session_time',
  'cmi.core.exit',
]);

// =============================================
// SCORM 1.2 API
// =============================================

export class SCORM12API {
  private runtimeData: SCORMRuntimeData;
  private lastError: number = 0;
  private initialized: boolean = false;
  private finished: boolean = false;
  private dirty: boolean = false;
  private onCommit: (data: SCORMRuntimeData) => Promise<void>;
  private onFinish: (data: SCORMRuntimeData) => Promise<void>;
  private sessionStartTime: number = 0;

  constructor(
    runtimeData: SCORMRuntimeData,
    onCommit: (data: SCORMRuntimeData) => Promise<void>,
    onFinish: (data: SCORMRuntimeData) => Promise<void>
  ) {
    this.runtimeData = runtimeData;
    this.onCommit = onCommit;
    this.onFinish = onFinish;
    this.initializeDefaultCMI();
  }

  private initializeDefaultCMI(): void {
    const cmi = this.runtimeData.cmiData;
    if (!cmi['cmi.core.lesson_status']) {
      cmi['cmi.core.lesson_status'] = 'not attempted';
    }
    if (!cmi['cmi.core.credit']) {
      cmi['cmi.core.credit'] = 'credit';
    }
    if (!cmi['cmi.core.lesson_mode']) {
      cmi['cmi.core.lesson_mode'] = 'normal';
    }
    if (!cmi['cmi.core.entry']) {
      cmi['cmi.core.entry'] = this.runtimeData.attemptCount > 1 ? 'resume' : 'ab-initio';
    }
    if (!cmi['cmi.core.total_time']) {
      cmi['cmi.core.total_time'] = '0000:00:00';
    }
    if (!cmi['cmi.suspend_data']) {
      cmi['cmi.suspend_data'] = this.runtimeData.suspendData || '';
    }
    if (!cmi['cmi.core.lesson_location']) {
      cmi['cmi.core.lesson_location'] = this.runtimeData.location || '';
    }
    if (!cmi['cmi.core.score.raw']) {
      cmi['cmi.core.score.raw'] = '';
    }
    if (!cmi['cmi.core.score.min']) {
      cmi['cmi.core.score.min'] = '';
    }
    if (!cmi['cmi.core.score.max']) {
      cmi['cmi.core.score.max'] = '';
    }
  }

  LMSInitialize(_param: string): string {
    if (this.initialized) {
      this.lastError = 101;
      return 'false';
    }
    if (this.finished) {
      this.lastError = 101;
      return 'false';
    }

    this.initialized = true;
    this.lastError = 0;
    this.sessionStartTime = Date.now();
    this.runtimeData.cmiData['cmi.core.entry'] =
      this.runtimeData.attemptCount > 1 && this.runtimeData.suspendData
        ? 'resume'
        : 'ab-initio';

    return 'true';
  }

  LMSFinish(_param: string): string {
    if (!this.initialized) {
      this.lastError = 301;
      return 'false';
    }
    if (this.finished) {
      this.lastError = 101;
      return 'false';
    }

    this.finished = true;
    this.initialized = false;
    this.lastError = 0;

    const sessionMs = Date.now() - this.sessionStartTime;
    this.runtimeData.sessionTime = sessionMs;
    this.runtimeData.totalTime += sessionMs;

    this.syncRuntimeFromCMI();

    this.onFinish(this.runtimeData).catch(err => {
      console.error('Error en LMSFinish callback:', err);
    });

    return 'true';
  }

  LMSGetValue(element: string): string {
    if (!this.initialized) {
      this.lastError = 301;
      return '';
    }

    if (SCORM12_WRITE_ONLY.has(element)) {
      this.lastError = 404;
      return '';
    }

    if (element === 'cmi.core.student_id') {
      this.lastError = 0;
      return this.runtimeData.userId;
    }

    if (element === 'cmi.core.student_name') {
      this.lastError = 0;
      return this.runtimeData.cmiData['cmi.core.student_name'] || '';
    }

    // Handle _count elements
    if (element.endsWith('._count')) {
      const prefix = element.replace('._count', '');
      let count = 0;
      for (const key of Object.keys(this.runtimeData.cmiData)) {
        const match = key.match(new RegExp(`^${prefix.replace('.', '\\.')}\\.(\\d+)\\.`));
        if (match) {
          const idx = parseInt(match[1], 10);
          if (idx >= count) count = idx + 1;
        }
      }
      this.lastError = 0;
      return String(count);
    }

    const value = this.runtimeData.cmiData[element];
    if (value !== undefined) {
      this.lastError = 0;
      return value;
    }

    this.lastError = 201;
    return '';
  }

  LMSSetValue(element: string, value: string): string {
    if (!this.initialized) {
      this.lastError = 301;
      return 'false';
    }

    if (SCORM12_READ_ONLY.has(element)) {
      this.lastError = 403;
      return 'false';
    }

    this.runtimeData.cmiData[element] = value;
    this.dirty = true;
    this.lastError = 0;
    return 'true';
  }

  LMSCommit(_param: string): string {
    if (!this.initialized) {
      this.lastError = 301;
      return 'false';
    }

    if (this.dirty) {
      this.syncRuntimeFromCMI();
      this.onCommit(this.runtimeData).catch(err => {
        console.error('Error en LMSCommit callback:', err);
      });
      this.dirty = false;
    }

    this.lastError = 0;
    return 'true';
  }

  LMSGetLastError(): string {
    return String(this.lastError);
  }

  LMSGetErrorString(errorCode: string): string {
    const code = parseInt(errorCode, 10);
    return SCORM12_ERRORS[code]?.message || 'Unknown error';
  }

  LMSGetDiagnostic(errorCode: string): string {
    const code = parseInt(errorCode, 10);
    return SCORM12_ERRORS[code]?.diagnostic || 'No diagnostic available';
  }

  private syncRuntimeFromCMI(): void {
    const cmi = this.runtimeData.cmiData;

    // SCORM 1.2 lesson_status puede ser: passed, completed, failed, incomplete, browsed, not attempted
    const status = cmi['cmi.core.lesson_status'] as string;
    if (status) {
      this.runtimeData.completionStatus = status as SCORMCompletionStatus;
    }

    if (status === 'passed' || status === 'completed') {
      this.runtimeData.successStatus = 'passed';
    } else if (status === 'failed') {
      this.runtimeData.successStatus = 'failed';
    }

    const scoreRaw = cmi['cmi.core.score.raw'];
    if (scoreRaw !== undefined && scoreRaw !== '') {
      this.runtimeData.scoreRaw = parseFloat(scoreRaw);
    }

    const scoreMin = cmi['cmi.core.score.min'];
    if (scoreMin !== undefined && scoreMin !== '') {
      this.runtimeData.scoreMin = parseFloat(scoreMin);
    }

    const scoreMax = cmi['cmi.core.score.max'];
    if (scoreMax !== undefined && scoreMax !== '') {
      this.runtimeData.scoreMax = parseFloat(scoreMax);
    }

    const suspendData = cmi['cmi.suspend_data'];
    if (suspendData !== undefined) {
      this.runtimeData.suspendData = suspendData;
    }

    const location = cmi['cmi.core.lesson_location'];
    if (location !== undefined) {
      this.runtimeData.location = location;
    }

    this.runtimeData.lastAccessedAt = Date.now();
    this.runtimeData.updatedAt = Date.now();
  }
}

// =============================================
// SCORM 2004 ERROR CODES
// =============================================

const SCORM2004_ERRORS: Record<number, { message: string; diagnostic: string }> = {
  0: { message: 'No Error', diagnostic: 'No error' },
  101: { message: 'General Exception', diagnostic: 'General exception' },
  102: { message: 'General Initialization Failure', diagnostic: 'Initialization failed' },
  103: { message: 'Already Initialized', diagnostic: 'Already initialized' },
  104: { message: 'Content Instance Terminated', diagnostic: 'Instance terminated' },
  111: { message: 'General Termination Failure', diagnostic: 'Termination failed' },
  112: { message: 'Termination Before Initialization', diagnostic: 'Not initialized' },
  113: { message: 'Termination After Termination', diagnostic: 'Already terminated' },
  122: { message: 'Retrieve Data Before Initialization', diagnostic: 'Not initialized' },
  123: { message: 'Retrieve Data After Termination', diagnostic: 'Already terminated' },
  132: { message: 'Store Data Before Initialization', diagnostic: 'Not initialized' },
  133: { message: 'Store Data After Termination', diagnostic: 'Already terminated' },
  142: { message: 'Commit Before Initialization', diagnostic: 'Not initialized' },
  143: { message: 'Commit After Termination', diagnostic: 'Already terminated' },
  201: { message: 'General Argument Error', diagnostic: 'Invalid argument' },
  301: { message: 'General Get Failure', diagnostic: 'Get failure' },
  351: { message: 'General Set Failure', diagnostic: 'Set failure' },
  391: { message: 'General Commit Failure', diagnostic: 'Commit failure' },
  401: { message: 'Undefined Data Model Element', diagnostic: 'Element not defined' },
  402: { message: 'Unimplemented Data Model Element', diagnostic: 'Not implemented' },
  403: { message: 'Data Model Element Value Not Initialized', diagnostic: 'Not initialized' },
  404: { message: 'Data Model Element Is Read Only', diagnostic: 'Read only' },
  405: { message: 'Data Model Element Is Write Only', diagnostic: 'Write only' },
  406: { message: 'Data Model Element Type Mismatch', diagnostic: 'Type mismatch' },
  407: { message: 'Data Model Element Value Out Of Range', diagnostic: 'Out of range' },
  408: { message: 'Data Model Dependency Not Established', diagnostic: 'Dependency missing' },
};

const SCORM2004_READ_ONLY = new Set([
  'cmi.completion_threshold',
  'cmi.credit',
  'cmi.entry',
  'cmi.launch_data',
  'cmi.learner_id',
  'cmi.learner_name',
  'cmi.max_time_allowed',
  'cmi.mode',
  'cmi.scaled_passing_score',
  'cmi.time_limit_action',
  'cmi.total_time',
]);

const SCORM2004_WRITE_ONLY = new Set([
  'cmi.exit',
  'cmi.session_time',
]);

// =============================================
// SCORM 2004 API
// =============================================

export class SCORM2004API {
  private runtimeData: SCORMRuntimeData;
  private lastError: number = 0;
  private initialized: boolean = false;
  private terminated: boolean = false;
  private dirty: boolean = false;
  private onCommit: (data: SCORMRuntimeData) => Promise<void>;
  private onFinish: (data: SCORMRuntimeData) => Promise<void>;
  private sessionStartTime: number = 0;

  constructor(
    runtimeData: SCORMRuntimeData,
    onCommit: (data: SCORMRuntimeData) => Promise<void>,
    onFinish: (data: SCORMRuntimeData) => Promise<void>
  ) {
    this.runtimeData = runtimeData;
    this.onCommit = onCommit;
    this.onFinish = onFinish;
    this.initializeDefaultCMI();
  }

  private initializeDefaultCMI(): void {
    const cmi = this.runtimeData.cmiData;
    if (!cmi['cmi.completion_status']) {
      cmi['cmi.completion_status'] = 'unknown';
    }
    if (!cmi['cmi.success_status']) {
      cmi['cmi.success_status'] = 'unknown';
    }
    if (!cmi['cmi.credit']) {
      cmi['cmi.credit'] = 'credit';
    }
    if (!cmi['cmi.mode']) {
      cmi['cmi.mode'] = 'normal';
    }
    if (!cmi['cmi.entry']) {
      cmi['cmi.entry'] = this.runtimeData.attemptCount > 1 ? 'resume' : 'ab-initio';
    }
    if (!cmi['cmi.total_time']) {
      cmi['cmi.total_time'] = 'PT0S';
    }
    if (!cmi['cmi.suspend_data']) {
      cmi['cmi.suspend_data'] = this.runtimeData.suspendData || '';
    }
    if (!cmi['cmi.location']) {
      cmi['cmi.location'] = this.runtimeData.location || '';
    }
  }

  Initialize(_param: string): string {
    if (this.initialized) {
      this.lastError = 103;
      return 'false';
    }
    if (this.terminated) {
      this.lastError = 104;
      return 'false';
    }

    this.initialized = true;
    this.lastError = 0;
    this.sessionStartTime = Date.now();

    return 'true';
  }

  Terminate(_param: string): string {
    if (!this.initialized) {
      this.lastError = 112;
      return 'false';
    }
    if (this.terminated) {
      this.lastError = 113;
      return 'false';
    }

    this.terminated = true;
    this.initialized = false;
    this.lastError = 0;

    const sessionMs = Date.now() - this.sessionStartTime;
    this.runtimeData.sessionTime = sessionMs;
    this.runtimeData.totalTime += sessionMs;

    this.syncRuntimeFromCMI();

    this.onFinish(this.runtimeData).catch(err => {
      console.error('Error en Terminate callback:', err);
    });

    return 'true';
  }

  GetValue(element: string): string {
    if (!this.initialized) {
      this.lastError = 122;
      return '';
    }
    if (this.terminated) {
      this.lastError = 123;
      return '';
    }

    if (SCORM2004_WRITE_ONLY.has(element)) {
      this.lastError = 405;
      return '';
    }

    if (element === 'cmi.learner_id') {
      this.lastError = 0;
      return this.runtimeData.userId;
    }

    if (element === 'cmi.learner_name') {
      this.lastError = 0;
      return this.runtimeData.cmiData['cmi.learner_name'] || '';
    }

    if (element.endsWith('._count')) {
      const prefix = element.replace('._count', '');
      let count = 0;
      for (const key of Object.keys(this.runtimeData.cmiData)) {
        const match = key.match(new RegExp(`^${prefix.replace('.', '\\.')}\\.(\\d+)\\.`));
        if (match) {
          const idx = parseInt(match[1], 10);
          if (idx >= count) count = idx + 1;
        }
      }
      this.lastError = 0;
      return String(count);
    }

    const value = this.runtimeData.cmiData[element];
    if (value !== undefined) {
      this.lastError = 0;
      return value;
    }

    this.lastError = 403;
    return '';
  }

  SetValue(element: string, value: string): string {
    if (!this.initialized) {
      this.lastError = 132;
      return 'false';
    }
    if (this.terminated) {
      this.lastError = 133;
      return 'false';
    }

    if (SCORM2004_READ_ONLY.has(element)) {
      this.lastError = 404;
      return 'false';
    }

    this.runtimeData.cmiData[element] = value;
    this.dirty = true;
    this.lastError = 0;
    return 'true';
  }

  Commit(_param: string): string {
    if (!this.initialized) {
      this.lastError = 142;
      return 'false';
    }
    if (this.terminated) {
      this.lastError = 143;
      return 'false';
    }

    if (this.dirty) {
      this.syncRuntimeFromCMI();
      this.onCommit(this.runtimeData).catch(err => {
        console.error('Error en Commit callback:', err);
      });
      this.dirty = false;
    }

    this.lastError = 0;
    return 'true';
  }

  GetLastError(): string {
    return String(this.lastError);
  }

  GetErrorString(errorCode: string): string {
    const code = parseInt(errorCode, 10);
    return SCORM2004_ERRORS[code]?.message || 'Unknown error';
  }

  GetDiagnostic(errorCode: string): string {
    const code = parseInt(errorCode, 10);
    return SCORM2004_ERRORS[code]?.diagnostic || 'No diagnostic available';
  }

  private syncRuntimeFromCMI(): void {
    const cmi = this.runtimeData.cmiData;

    const completionStatus = cmi['cmi.completion_status'];
    if (completionStatus === 'completed') {
      this.runtimeData.completionStatus = 'completed';
    } else if (completionStatus === 'incomplete') {
      this.runtimeData.completionStatus = 'incomplete';
    } else if (completionStatus === 'not attempted') {
      this.runtimeData.completionStatus = 'not attempted';
    }

    const successStatus = cmi['cmi.success_status'];
    if (successStatus === 'passed' || successStatus === 'failed') {
      this.runtimeData.successStatus = successStatus;
    }

    const scoreScaled = cmi['cmi.score.scaled'];
    if (scoreScaled !== undefined && scoreScaled !== '') {
      this.runtimeData.scoreScaled = parseFloat(scoreScaled);
    }

    const scoreRaw = cmi['cmi.score.raw'];
    if (scoreRaw !== undefined && scoreRaw !== '') {
      this.runtimeData.scoreRaw = parseFloat(scoreRaw);
    }

    const scoreMin = cmi['cmi.score.min'];
    if (scoreMin !== undefined && scoreMin !== '') {
      this.runtimeData.scoreMin = parseFloat(scoreMin);
    }

    const scoreMax = cmi['cmi.score.max'];
    if (scoreMax !== undefined && scoreMax !== '') {
      this.runtimeData.scoreMax = parseFloat(scoreMax);
    }

    if (cmi['cmi.suspend_data'] !== undefined) {
      this.runtimeData.suspendData = cmi['cmi.suspend_data'];
    }

    if (cmi['cmi.location'] !== undefined) {
      this.runtimeData.location = cmi['cmi.location'];
    }

    this.runtimeData.lastAccessedAt = Date.now();
    this.runtimeData.updatedAt = Date.now();
  }
}

// =============================================
// FACTORY
// =============================================

export function createSCORMAPI(
  version: SCORMVersion,
  runtimeData: SCORMRuntimeData,
  onCommit: (data: SCORMRuntimeData) => Promise<void>,
  onFinish: (data: SCORMRuntimeData) => Promise<void>
): SCORM12API | SCORM2004API {
  if (version === '2004') {
    return new SCORM2004API(runtimeData, onCommit, onFinish);
  }
  return new SCORM12API(runtimeData, onCommit, onFinish);
}

/**
 * Instala la API SCORM en el window para que el contenido iframe la encuentre
 */
export function installSCORMAPI(
  version: SCORMVersion,
  api: SCORM12API | SCORM2004API
): void {
  if (version === '1.2') {
    (window as any).API = api;
  } else {
    (window as any).API_1484_11 = api;
  }
}

/**
 * Limpia la API SCORM del window
 */
export function uninstallSCORMAPI(version: SCORMVersion): void {
  if (version === '1.2') {
    delete (window as any).API;
  } else {
    delete (window as any).API_1484_11;
  }
}
