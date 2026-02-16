/**
 * Parser de manifiestos SCORM (imsmanifest.xml)
 * Soporta SCORM 1.2 y SCORM 2004
 * Usa DOMParser nativo del browser
 */

import type {
  SCORMVersion,
  SCORMManifest,
  SCORMOrganization,
  SCORMItem,
  SCORMResource
} from '@shared/types/elearning-standards';

const SCORM_12_NAMESPACE = 'http://www.imsproject.org/xsd/imscp_rootv1p1p2';
const SCORM_2004_NAMESPACE = 'http://www.adlnet.org/xsd/adlcp_v1p3';

export class SCORMManifestParser {
  parseManifest(xmlString: string): { version: SCORMVersion; manifest: SCORMManifest } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`Error al parsear el manifiesto XML: ${parseError.textContent}`);
    }

    const manifestEl = doc.querySelector('manifest');
    if (!manifestEl) {
      throw new Error('No se encontró el elemento <manifest> en el XML');
    }

    const version = this.detectVersion(doc);
    const { organizations, defaultOrg } = this.parseOrganizations(doc);
    const resources = this.parseResources(doc);
    const metadata = this.parseMetadata(doc);

    const manifest: SCORMManifest = {
      identifier: manifestEl.getAttribute('identifier') || 'unknown',
      version: manifestEl.getAttribute('version') || undefined,
      organizations,
      defaultOrganization: defaultOrg,
      resources,
      metadata
    };

    return { version, manifest };
  }

  private detectVersion(doc: Document): SCORMVersion {
    const root = doc.documentElement;
    const allNamespaces = root.attributes;

    for (let i = 0; i < allNamespaces.length; i++) {
      const attr = allNamespaces[i];
      if (attr.value.includes('adlcp_v1p3') || attr.value.includes('adlseq')) {
        return '2004';
      }
    }

    const schemaVersion = doc.querySelector('schemaversion');
    if (schemaVersion) {
      const text = schemaVersion.textContent?.trim() || '';
      if (text.startsWith('2004') || text === 'CAM 1.3') {
        return '2004';
      }
      if (text === '1.2') {
        return '1.2';
      }
    }

    const xmlns = root.getAttribute('xmlns');
    if (xmlns?.includes('imscp_rootv1p1p2')) {
      return '1.2';
    }

    return '1.2';
  }

  private parseOrganizations(doc: Document): {
    organizations: SCORMOrganization[];
    defaultOrg: string;
  } {
    const orgsEl = doc.querySelector('organizations');
    const defaultOrg = orgsEl?.getAttribute('default') || '';
    const orgElements = doc.querySelectorAll('organizations > organization');
    const organizations: SCORMOrganization[] = [];

    orgElements.forEach(orgEl => {
      organizations.push({
        identifier: orgEl.getAttribute('identifier') || '',
        title: this.getDirectChildText(orgEl, 'title') || 'Sin título',
        items: this.parseItems(orgEl)
      });
    });

    return { organizations, defaultOrg };
  }

  private parseItems(parent: Element): SCORMItem[] {
    const items: SCORMItem[] = [];
    const itemElements = parent.querySelectorAll(':scope > item');

    itemElements.forEach(itemEl => {
      const item: SCORMItem = {
        identifier: itemEl.getAttribute('identifier') || '',
        title: this.getDirectChildText(itemEl, 'title') || 'Sin título',
        resourceIdentifier: itemEl.getAttribute('identifierref') || undefined,
        children: this.parseItems(itemEl)
      };

      const completionThreshold = itemEl.querySelector('completionThreshold');
      if (completionThreshold) {
        item.sequencing = {
          completionThreshold: parseFloat(
            completionThreshold.getAttribute('minProgressMeasure') || '1.0'
          )
        };
      }

      items.push(item);
    });

    return items;
  }

  private parseResources(doc: Document): SCORMResource[] {
    const resources: SCORMResource[] = [];
    const resourceElements = doc.querySelectorAll('resources > resource');

    resourceElements.forEach(resEl => {
      const files: string[] = [];
      resEl.querySelectorAll('file').forEach(fileEl => {
        const href = fileEl.getAttribute('href');
        if (href) files.push(href);
      });

      const dependencies: string[] = [];
      resEl.querySelectorAll('dependency').forEach(depEl => {
        const id = depEl.getAttribute('identifierref');
        if (id) dependencies.push(id);
      });

      resources.push({
        identifier: resEl.getAttribute('identifier') || '',
        type: resEl.getAttribute('type') || 'webcontent',
        href: resEl.getAttribute('href') || undefined,
        scormType: (resEl.getAttribute('adlcp:scormtype') ||
          resEl.getAttribute('adlcp:scormType') ||
          resEl.getAttributeNS(SCORM_2004_NAMESPACE, 'scormType') ||
          resEl.getAttributeNS(SCORM_12_NAMESPACE, 'scormtype') ||
          'sco') as 'sco' | 'asset',
        files,
        dependencies: dependencies.length > 0 ? dependencies : undefined
      });
    });

    return resources;
  }

  private parseMetadata(doc: Document): SCORMManifest['metadata'] {
    const metaEl = doc.querySelector('manifest > metadata');
    if (!metaEl) return undefined;

    return {
      schema: this.getDirectChildText(metaEl, 'schema') || undefined,
      schemaVersion: this.getDirectChildText(metaEl, 'schemaversion') || undefined
    };
  }

  private getDirectChildText(parent: Element, tagName: string): string | null {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      if (child.localName === tagName || child.tagName === tagName) {
        return child.textContent?.trim() || null;
      }
    }
    return null;
  }

  getLaunchUrl(manifest: SCORMManifest): string {
    const defaultOrg = manifest.organizations.find(
      o => o.identifier === manifest.defaultOrganization
    ) || manifest.organizations[0];

    if (!defaultOrg) {
      throw new Error('No se encontraron organizaciones en el manifiesto');
    }

    const firstScoItem = this.findFirstScoItem(defaultOrg.items, manifest.resources);
    if (!firstScoItem) {
      throw new Error('No se encontró un SCO válido en el manifiesto');
    }

    const resource = manifest.resources.find(
      r => r.identifier === firstScoItem.resourceIdentifier
    );

    if (!resource?.href) {
      throw new Error(`No se encontró el recurso para el item: ${firstScoItem.identifier}`);
    }

    return resource.href;
  }

  private findFirstScoItem(
    items: SCORMItem[],
    resources: SCORMResource[]
  ): SCORMItem | null {
    for (const item of items) {
      if (item.resourceIdentifier) {
        const resource = resources.find(r => r.identifier === item.resourceIdentifier);
        if (resource && resource.scormType === 'sco') {
          return item;
        }
      }
      if (item.children.length > 0) {
        const found = this.findFirstScoItem(item.children, resources);
        if (found) return found;
      }
    }
    return null;
  }
}

export const scormManifestParser = new SCORMManifestParser();
