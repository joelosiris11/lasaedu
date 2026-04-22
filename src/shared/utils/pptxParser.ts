import JSZip from 'jszip';

export interface PptxSlide {
  index: number;          // 1-based
  title: string;          // first text frame if detectable, else empty
  texts: string[];        // paragraphs (in order) across all text frames
  notes: string;          // speaker notes text (joined)
  imageUrls: string[];    // object URLs for images referenced by this slide
}

export interface PptxDeck {
  slides: PptxSlide[];
  totalImages: number;
  /** Object URLs allocated for images — caller should revoke on unmount. */
  objectUrls: string[];
}

const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

function textFromSpTree(spTree: Element | null): { paragraphs: string[]; firstTitle: string } {
  const paragraphs: string[] = [];
  let firstTitle = '';

  if (!spTree) return { paragraphs, firstTitle };

  // Walk each <p:sp> shape
  const shapes = Array.from(spTree.getElementsByTagNameNS(NS_P, 'sp'));
  for (const sp of shapes) {
    // Detect placeholder type (title vs body)
    const ph = sp.getElementsByTagNameNS(NS_P, 'ph')[0];
    const phType = ph?.getAttribute('type') || '';

    // Collect paragraphs <a:p> with runs <a:r>/<a:t>
    const aps = Array.from(sp.getElementsByTagNameNS(NS_A, 'p'));
    const shapeParas: string[] = [];
    for (const p of aps) {
      const runs = Array.from(p.getElementsByTagNameNS(NS_A, 't'));
      const line = runs.map(r => r.textContent || '').join('').trim();
      if (line) shapeParas.push(line);
    }

    if (!shapeParas.length) continue;

    if (!firstTitle && (phType === 'title' || phType === 'ctrTitle')) {
      firstTitle = shapeParas[0];
      paragraphs.push(...shapeParas.slice(1));
    } else {
      paragraphs.push(...shapeParas);
    }
  }

  // Fallback: if no placeholder-tagged title was found, use first non-empty line
  if (!firstTitle && paragraphs.length) {
    firstTitle = paragraphs.shift() || '';
  }

  return { paragraphs, firstTitle };
}

function extractText(doc: Document): { paragraphs: string[]; firstTitle: string } {
  // Try <p:cSld><p:spTree>
  const cSlds = doc.getElementsByTagNameNS(NS_P, 'cSld');
  const spTree = cSlds[0]?.getElementsByTagNameNS(NS_P, 'spTree')[0] ?? null;
  return textFromSpTree(spTree);
}

function extractNotesText(doc: Document): string {
  const { paragraphs } = extractText(doc);
  return paragraphs.join('\n').trim();
}

interface Rel {
  id: string;
  type: string;
  target: string;
}

function parseRels(xml: string): Rel[] {
  const doc = parseXml(xml);
  const rels = Array.from(doc.getElementsByTagName('Relationship'));
  return rels.map(r => ({
    id: r.getAttribute('Id') || '',
    type: r.getAttribute('Type') || '',
    target: r.getAttribute('Target') || '',
  }));
}

function normalizePath(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const baseDir = base.substring(0, base.lastIndexOf('/'));
  const parts = `${baseDir}/${target}`.split('/');
  const stack: string[] = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') stack.pop();
    else stack.push(p);
  }
  return stack.join('/');
}

async function loadImageBlobUrl(zip: JSZip, path: string, out: string[]): Promise<string | null> {
  const file = zip.file(path);
  if (!file) return null;
  const blob = await file.async('blob');
  const mime = guessImageMime(path);
  const typed = mime ? new Blob([blob], { type: mime }) : blob;
  const url = URL.createObjectURL(typed);
  out.push(url);
  return url;
}

function guessImageMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'bmp': return 'image/bmp';
    default: return '';
  }
}

export async function parsePptx(fileOrUrl: Blob | string): Promise<PptxDeck> {
  const buffer = fileOrUrl instanceof Blob
    ? await fileOrUrl.arrayBuffer()
    : await fetch(fileOrUrl).then(r => {
        if (!r.ok) throw new Error(`No se pudo descargar el archivo (${r.status})`);
        return r.arrayBuffer();
      });

  const zip = await JSZip.loadAsync(buffer);
  const objectUrls: string[] = [];

  // Read presentation rels to get ordered list of slides
  const presRelsFile = zip.file('ppt/_rels/presentation.xml.rels');
  if (!presRelsFile) {
    throw new Error('El archivo no parece ser un PPTX valido (falta presentation.xml.rels).');
  }
  const presRels = parseRels(await presRelsFile.async('text'));

  // Parse presentation.xml to get slide order via sldIdLst → rId → target
  const presFile = zip.file('ppt/presentation.xml');
  if (!presFile) throw new Error('Archivo invalido: falta ppt/presentation.xml');
  const presDoc = parseXml(await presFile.async('text'));
  const sldIds = Array.from(presDoc.getElementsByTagNameNS(NS_P, 'sldId'));

  const orderedSlidePaths: string[] = [];
  for (const s of sldIds) {
    const rid = s.getAttributeNS(NS_R, 'id');
    if (!rid) continue;
    const rel = presRels.find(r => r.id === rid);
    if (!rel) continue;
    orderedSlidePaths.push(normalizePath('ppt/presentation.xml', rel.target));
  }

  const slides: PptxSlide[] = [];

  for (let i = 0; i < orderedSlidePaths.length; i++) {
    const slidePath = orderedSlidePaths[i];
    const slideFile = zip.file(slidePath);
    if (!slideFile) continue;

    const slideXml = await slideFile.async('text');
    const slideDoc = parseXml(slideXml);
    const { paragraphs, firstTitle } = extractText(slideDoc);

    // Resolve slide rels for images and notes
    const relName = slidePath.replace(/ppt\/slides\/(.+)\.xml$/, 'ppt/slides/_rels/$1.xml.rels');
    const relFile = zip.file(relName);
    const rels = relFile ? parseRels(await relFile.async('text')) : [];

    const imageUrls: string[] = [];
    for (const rel of rels) {
      if (rel.type.endsWith('/image')) {
        const path = normalizePath(slidePath, rel.target);
        const url = await loadImageBlobUrl(zip, path, objectUrls);
        if (url) imageUrls.push(url);
      }
    }

    // Speaker notes
    let notes = '';
    const notesRel = rels.find(r => r.type.endsWith('/notesSlide'));
    if (notesRel) {
      const notesPath = normalizePath(slidePath, notesRel.target);
      const notesFile = zip.file(notesPath);
      if (notesFile) {
        const notesDoc = parseXml(await notesFile.async('text'));
        notes = extractNotesText(notesDoc);
      }
    }

    slides.push({
      index: i + 1,
      title: firstTitle,
      texts: paragraphs,
      notes,
      imageUrls,
    });
  }

  return {
    slides,
    totalImages: objectUrls.length,
    objectUrls,
  };
}
