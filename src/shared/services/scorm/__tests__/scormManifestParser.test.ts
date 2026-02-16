import { describe, it, expect } from 'vitest';
import { SCORMManifestParser } from '../scormManifestParser';

const parser = new SCORMManifestParser();

const SCORM_12_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="test-course-12" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org-1">
    <organization identifier="org-1">
      <title>Curso de Prueba SCORM 1.2</title>
      <item identifier="item-1" identifierref="res-1">
        <title>Lección 1</title>
      </item>
      <item identifier="item-2" identifierref="res-2">
        <title>Lección 2</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res-1" type="webcontent" adlcp:scormtype="sco" href="lesson1/index.html">
      <file href="lesson1/index.html" />
    </resource>
    <resource identifier="res-2" type="webcontent" adlcp:scormtype="sco" href="lesson2/index.html">
      <file href="lesson2/index.html" />
    </resource>
  </resources>
</manifest>`;

const SCORM_2004_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="test-course-2004" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="org-2004">
    <organization identifier="org-2004">
      <title>Curso SCORM 2004</title>
      <item identifier="item-a" identifierref="res-a">
        <title>Módulo A</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res-a" type="webcontent" adlcp:scormType="sco" href="module_a/start.html">
      <file href="module_a/start.html" />
      <file href="module_a/styles.css" />
    </resource>
  </resources>
</manifest>`;

describe('SCORMManifestParser', () => {
  describe('parseManifest', () => {
    it('parsea correctamente un manifiesto SCORM 1.2', () => {
      const { version, manifest } = parser.parseManifest(SCORM_12_MANIFEST);

      expect(version).toBe('1.2');
      expect(manifest.identifier).toBe('test-course-12');
      expect(manifest.defaultOrganization).toBe('org-1');
      expect(manifest.organizations).toHaveLength(1);
      expect(manifest.organizations[0].title).toBe('Curso de Prueba SCORM 1.2');
      expect(manifest.organizations[0].items).toHaveLength(2);
      expect(manifest.resources).toHaveLength(2);
    });

    it('parsea correctamente un manifiesto SCORM 2004', () => {
      const { version, manifest } = parser.parseManifest(SCORM_2004_MANIFEST);

      expect(version).toBe('2004');
      expect(manifest.identifier).toBe('test-course-2004');
      expect(manifest.organizations[0].title).toBe('Curso SCORM 2004');
      expect(manifest.organizations[0].items).toHaveLength(1);
      expect(manifest.resources[0].files).toHaveLength(2);
    });

    it('lanza error con XML inválido', () => {
      expect(() => parser.parseManifest('<invalid>')).toThrow();
    });

    it('lanza error sin elemento manifest', () => {
      expect(() => parser.parseManifest('<?xml version="1.0"?><root></root>')).toThrow(
        'No se encontró el elemento <manifest>'
      );
    });
  });

  describe('detectVersion', () => {
    it('detecta SCORM 1.2 por namespace', () => {
      const { version } = parser.parseManifest(SCORM_12_MANIFEST);
      expect(version).toBe('1.2');
    });

    it('detecta SCORM 2004 por namespace adlcp_v1p3', () => {
      const { version } = parser.parseManifest(SCORM_2004_MANIFEST);
      expect(version).toBe('2004');
    });
  });

  describe('parseOrganizations', () => {
    it('extrae items con sus identificadores', () => {
      const { manifest } = parser.parseManifest(SCORM_12_MANIFEST);
      const items = manifest.organizations[0].items;

      expect(items[0].identifier).toBe('item-1');
      expect(items[0].title).toBe('Lección 1');
      expect(items[0].resourceIdentifier).toBe('res-1');
      expect(items[1].identifier).toBe('item-2');
    });
  });

  describe('parseResources', () => {
    it('extrae recursos con tipo y href', () => {
      const { manifest } = parser.parseManifest(SCORM_12_MANIFEST);

      expect(manifest.resources[0].identifier).toBe('res-1');
      expect(manifest.resources[0].type).toBe('webcontent');
      expect(manifest.resources[0].href).toBe('lesson1/index.html');
    });

    it('extrae archivos de un recurso', () => {
      const { manifest } = parser.parseManifest(SCORM_2004_MANIFEST);

      expect(manifest.resources[0].files).toContain('module_a/start.html');
      expect(manifest.resources[0].files).toContain('module_a/styles.css');
    });
  });

  describe('getLaunchUrl', () => {
    it('retorna la URL del primer SCO', () => {
      const { manifest } = parser.parseManifest(SCORM_12_MANIFEST);
      const url = parser.getLaunchUrl(manifest);
      expect(url).toBe('lesson1/index.html');
    });

    it('retorna la URL correcta para SCORM 2004', () => {
      const { manifest } = parser.parseManifest(SCORM_2004_MANIFEST);
      const url = parser.getLaunchUrl(manifest);
      expect(url).toBe('module_a/start.html');
    });

    it('lanza error si no hay organizaciones', () => {
      expect(() => parser.getLaunchUrl({
        identifier: 'test',
        organizations: [],
        defaultOrganization: '',
        resources: []
      })).toThrow('No se encontraron organizaciones');
    });
  });

  describe('metadata', () => {
    it('extrae schema y schemaVersion', () => {
      const { manifest } = parser.parseManifest(SCORM_12_MANIFEST);

      expect(manifest.metadata?.schema).toBe('ADL SCORM');
      expect(manifest.metadata?.schemaVersion).toBe('1.2');
    });
  });
});
