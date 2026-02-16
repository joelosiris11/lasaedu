import { describe, it, expect, beforeEach } from 'vitest';
import { SCORM12API, SCORM2004API, createSCORMAPI } from '../scormRTE';
import type { SCORMRuntimeData } from '@shared/types/elearning-standards';

function createRuntimeData(overrides?: Partial<SCORMRuntimeData>): SCORMRuntimeData {
  return {
    id: 'runtime-1',
    userId: 'user-1',
    packageId: 'pkg-1',
    lessonId: 'lesson-1',
    courseId: 'course-1',
    version: '1.2',
    cmiData: {},
    sessionTime: 0,
    totalTime: 0,
    completionStatus: 'not attempted',
    successStatus: 'unknown',
    attemptCount: 1,
    firstAccessedAt: Date.now(),
    lastAccessedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

const noopCommit = async () => {};
const noopFinish = async () => {};

describe('SCORM12API', () => {
  let api: SCORM12API;
  let runtimeData: SCORMRuntimeData;

  beforeEach(() => {
    runtimeData = createRuntimeData();
    api = new SCORM12API(runtimeData, noopCommit, noopFinish);
  });

  describe('LMSInitialize', () => {
    it('retorna "true" en la primera inicialización', () => {
      expect(api.LMSInitialize('')).toBe('true');
    });

    it('retorna "false" si ya está inicializado', () => {
      api.LMSInitialize('');
      expect(api.LMSInitialize('')).toBe('false');
      expect(api.LMSGetLastError()).toBe('101');
    });
  });

  describe('LMSFinish', () => {
    it('retorna "false" si no está inicializado', () => {
      expect(api.LMSFinish('')).toBe('false');
      expect(api.LMSGetLastError()).toBe('301');
    });

    it('retorna "true" después de inicializar', () => {
      api.LMSInitialize('');
      expect(api.LMSFinish('')).toBe('true');
    });

    it('retorna "false" si se llama dos veces', () => {
      api.LMSInitialize('');
      api.LMSFinish('');
      expect(api.LMSFinish('')).toBe('false');
    });
  });

  describe('LMSGetValue / LMSSetValue', () => {
    beforeEach(() => {
      api.LMSInitialize('');
    });

    it('puede establecer y obtener valores CMI', () => {
      api.LMSSetValue('cmi.core.lesson_status', 'completed');
      expect(api.LMSGetValue('cmi.core.lesson_status')).toBe('completed');
    });

    it('retorna "" para elementos no definidos', () => {
      expect(api.LMSGetValue('cmi.nonexistent')).toBe('');
      expect(api.LMSGetLastError()).toBe('201');
    });

    it('retorna el student_id del runtimeData', () => {
      expect(api.LMSGetValue('cmi.core.student_id')).toBe('user-1');
    });

    it('no permite escribir en elementos read-only', () => {
      expect(api.LMSSetValue('cmi.core.student_id', 'hacked')).toBe('false');
      expect(api.LMSGetLastError()).toBe('403');
    });

    it('no permite leer elementos write-only', () => {
      expect(api.LMSGetValue('cmi.core.session_time')).toBe('');
      expect(api.LMSGetLastError()).toBe('404');
    });

    it('falla si no está inicializado', () => {
      const uninitApi = new SCORM12API(createRuntimeData(), noopCommit, noopFinish);
      expect(uninitApi.LMSGetValue('cmi.core.lesson_status')).toBe('');
      expect(uninitApi.LMSGetLastError()).toBe('301');
    });
  });

  describe('LMSCommit', () => {
    it('retorna "true" cuando está inicializado', () => {
      api.LMSInitialize('');
      api.LMSSetValue('cmi.core.lesson_status', 'completed');
      expect(api.LMSCommit('')).toBe('true');
    });

    it('retorna "false" si no está inicializado', () => {
      expect(api.LMSCommit('')).toBe('false');
    });
  });

  describe('Error handling', () => {
    it('LMSGetErrorString retorna mensaje legible', () => {
      expect(api.LMSGetErrorString('0')).toBe('No Error');
      expect(api.LMSGetErrorString('301')).toBe('Not initialized');
    });

    it('LMSGetDiagnostic retorna diagnóstico', () => {
      expect(api.LMSGetDiagnostic('403')).toBe('Cannot set a read-only element');
    });

    it('retorna mensaje por defecto para código desconocido', () => {
      expect(api.LMSGetErrorString('9999')).toBe('Unknown error');
    });
  });
});

describe('SCORM2004API', () => {
  let api: SCORM2004API;
  let runtimeData: SCORMRuntimeData;

  beforeEach(() => {
    runtimeData = createRuntimeData({ version: '2004' });
    api = new SCORM2004API(runtimeData, noopCommit, noopFinish);
  });

  describe('Initialize / Terminate', () => {
    it('inicializa correctamente', () => {
      expect(api.Initialize('')).toBe('true');
    });

    it('falla al re-inicializar', () => {
      api.Initialize('');
      expect(api.Initialize('')).toBe('false');
      expect(api.GetLastError()).toBe('103');
    });

    it('termina correctamente', () => {
      api.Initialize('');
      expect(api.Terminate('')).toBe('true');
    });

    it('falla al terminar sin inicializar', () => {
      expect(api.Terminate('')).toBe('false');
      expect(api.GetLastError()).toBe('112');
    });

    it('falla al terminar dos veces', () => {
      api.Initialize('');
      api.Terminate('');
      expect(api.Terminate('')).toBe('false');
      // Después de Terminate, initialized=false, así que el chequeo !initialized se activa primero
      expect(api.GetLastError()).toBe('112');
    });
  });

  describe('GetValue / SetValue', () => {
    beforeEach(() => {
      api.Initialize('');
    });

    it('puede establecer y obtener completion_status', () => {
      api.SetValue('cmi.completion_status', 'completed');
      expect(api.GetValue('cmi.completion_status')).toBe('completed');
    });

    it('retorna learner_id del runtimeData', () => {
      expect(api.GetValue('cmi.learner_id')).toBe('user-1');
    });

    it('no permite escribir en elementos read-only', () => {
      expect(api.SetValue('cmi.learner_id', 'hacked')).toBe('false');
      expect(api.GetLastError()).toBe('404');
    });

    it('no permite leer elementos write-only', () => {
      expect(api.GetValue('cmi.exit')).toBe('');
      expect(api.GetLastError()).toBe('405');
    });

    it('falla GetValue si ya terminó', () => {
      api.Terminate('');
      expect(api.GetValue('cmi.completion_status')).toBe('');
      // Después de Terminate, initialized=false, se detecta como "before init"
      expect(api.GetLastError()).toBe('122');
    });

    it('falla SetValue si ya terminó', () => {
      api.Terminate('');
      expect(api.SetValue('cmi.completion_status', 'completed')).toBe('false');
      expect(api.GetLastError()).toBe('132');
    });
  });

  describe('Commit', () => {
    it('retorna "true" cuando está inicializado', () => {
      api.Initialize('');
      api.SetValue('cmi.completion_status', 'completed');
      expect(api.Commit('')).toBe('true');
    });

    it('falla si no está inicializado', () => {
      expect(api.Commit('')).toBe('false');
      expect(api.GetLastError()).toBe('142');
    });

    it('falla si ya terminó', () => {
      api.Initialize('');
      api.Terminate('');
      expect(api.Commit('')).toBe('false');
      expect(api.GetLastError()).toBe('142');
    });
  });

  describe('Error handling', () => {
    it('GetErrorString retorna mensaje correcto', () => {
      expect(api.GetErrorString('0')).toBe('No Error');
      expect(api.GetErrorString('103')).toBe('Already Initialized');
      expect(api.GetErrorString('404')).toBe('Data Model Element Is Read Only');
    });

    it('GetDiagnostic retorna diagnóstico correcto', () => {
      expect(api.GetDiagnostic('112')).toBe('Not initialized');
    });
  });
});

describe('createSCORMAPI', () => {
  it('crea SCORM12API para versión 1.2', () => {
    const api = createSCORMAPI('1.2', createRuntimeData(), noopCommit, noopFinish);
    expect(api).toBeInstanceOf(SCORM12API);
  });

  it('crea SCORM2004API para versión 2004', () => {
    const api = createSCORMAPI('2004', createRuntimeData({ version: '2004' }), noopCommit, noopFinish);
    expect(api).toBeInstanceOf(SCORM2004API);
  });
});
