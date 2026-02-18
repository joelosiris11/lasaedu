/**
 * Validacion de archivos por extension y magic bytes.
 * Previene subida de archivos malignos disfrazados con extension falsa.
 */

export interface FileValidationOptions {
  allowedExtensions?: string[];
  maxFileSize?: number;       // bytes
  maxFiles?: number;
}

interface MagicByteSignature {
  bytes: number[];
  offset?: number;
  /** Second signature check (e.g. WebP needs RIFF + WEBP) */
  secondary?: { bytes: number[]; offset: number };
}

interface FileTypeDefinition {
  extensions: string[];
  mimeTypes: string[];
  magicBytes?: MagicByteSignature[];
}

export const ALLOWED_FILE_TYPES: Record<string, FileTypeDefinition> = {
  pdf: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    magicBytes: [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  },
  docx: {
    extensions: ['.docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    magicBytes: [{ bytes: [0x50, 0x4B, 0x03, 0x04] }], // PK ZIP
  },
  pptx: {
    extensions: ['.pptx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    magicBytes: [{ bytes: [0x50, 0x4B, 0x03, 0x04] }],
  },
  xlsx: {
    extensions: ['.xlsx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    magicBytes: [{ bytes: [0x50, 0x4B, 0x03, 0x04] }],
  },
  odt: {
    extensions: ['.odt'],
    mimeTypes: ['application/vnd.oasis.opendocument.text'],
    magicBytes: [{ bytes: [0x50, 0x4B, 0x03, 0x04] }],
  },
  ods: {
    extensions: ['.ods'],
    mimeTypes: ['application/vnd.oasis.opendocument.spreadsheet'],
    magicBytes: [{ bytes: [0x50, 0x4B, 0x03, 0x04] }],
  },
  odp: {
    extensions: ['.odp'],
    mimeTypes: ['application/vnd.oasis.opendocument.presentation'],
    magicBytes: [{ bytes: [0x50, 0x4B, 0x03, 0x04] }],
  },
  zip: {
    extensions: ['.zip'],
    mimeTypes: ['application/zip', 'application/x-zip-compressed'],
    magicBytes: [{ bytes: [0x50, 0x4B, 0x03, 0x04] }],
  },
  rar: {
    extensions: ['.rar'],
    mimeTypes: ['application/x-rar-compressed', 'application/vnd.rar'],
    magicBytes: [{ bytes: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07] }], // Rar!..
  },
  jpeg: {
    extensions: ['.jpg', '.jpeg'],
    mimeTypes: ['image/jpeg'],
    magicBytes: [{ bytes: [0xFF, 0xD8, 0xFF] }],
  },
  png: {
    extensions: ['.png'],
    mimeTypes: ['image/png'],
    magicBytes: [{ bytes: [0x89, 0x50, 0x4E, 0x47] }], // .PNG
  },
  gif: {
    extensions: ['.gif'],
    mimeTypes: ['image/gif'],
    magicBytes: [{ bytes: [0x47, 0x49, 0x46, 0x38] }], // GIF8
  },
  webp: {
    extensions: ['.webp'],
    mimeTypes: ['image/webp'],
    magicBytes: [{
      bytes: [0x52, 0x49, 0x46, 0x46], // RIFF
      secondary: { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // WEBP at offset 8
    }],
  },
  csv: {
    extensions: ['.csv'],
    mimeTypes: ['text/csv', 'application/csv'],
    // No magic bytes - extension-only validation
  },
  txt: {
    extensions: ['.txt'],
    mimeTypes: ['text/plain'],
    // No magic bytes - extension-only validation
  },
};

const ALL_ALLOWED_EXTENSIONS = Object.values(ALLOWED_FILE_TYPES)
  .flatMap(t => t.extensions);

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

function getTypeForExtension(ext: string): FileTypeDefinition | null {
  for (const typeDef of Object.values(ALLOWED_FILE_TYPES)) {
    if (typeDef.extensions.includes(ext)) return typeDef;
  }
  return null;
}

/**
 * Validate magic bytes of a file buffer against expected signature.
 */
function checkMagicBytes(header: Uint8Array, signature: MagicByteSignature): boolean {
  const offset = signature.offset ?? 0;
  for (let i = 0; i < signature.bytes.length; i++) {
    if (header[offset + i] !== signature.bytes[i]) return false;
  }
  if (signature.secondary) {
    const sec = signature.secondary;
    for (let i = 0; i < sec.bytes.length; i++) {
      if (header[sec.offset + i] !== sec.bytes[i]) return false;
    }
  }
  return true;
}

/**
 * Validate file magic bytes. Returns true if valid or if the type has no magic bytes defined.
 */
export async function validateFileMagicBytes(file: File): Promise<{ valid: boolean; error?: string }> {
  const ext = getExtension(file.name);
  const typeDef = getTypeForExtension(ext);

  if (!typeDef) {
    return { valid: false, error: `Extension "${ext}" no reconocida` };
  }

  // Types without magic bytes (csv, txt) pass automatically
  if (!typeDef.magicBytes || typeDef.magicBytes.length === 0) {
    return { valid: true };
  }

  // Read first 16 bytes
  const slice = file.slice(0, 16);
  const buffer = await slice.arrayBuffer();
  const header = new Uint8Array(buffer);

  const matches = typeDef.magicBytes.some(sig => checkMagicBytes(header, sig));
  if (!matches) {
    return {
      valid: false,
      error: `El archivo "${file.name}" no coincide con el formato ${ext.toUpperCase()}. El contenido real no corresponde a la extension.`,
    };
  }

  return { valid: true };
}

/**
 * Full file validation: extension + size + magic bytes.
 */
export async function validateFile(
  file: File,
  options?: FileValidationOptions
): Promise<{ valid: boolean; error?: string }> {
  const ext = getExtension(file.name);

  // 1. Extension check
  const allowedExts = options?.allowedExtensions ?? ALL_ALLOWED_EXTENSIONS;
  if (!allowedExts.includes(ext)) {
    return {
      valid: false,
      error: `Extension "${ext}" no permitida. Extensiones permitidas: ${allowedExts.join(', ')}`,
    };
  }

  // 2. Size check
  if (options?.maxFileSize && file.size > options.maxFileSize) {
    const maxMB = (options.maxFileSize / (1024 * 1024)).toFixed(1);
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `El archivo pesa ${fileMB}MB. Maximo permitido: ${maxMB}MB`,
    };
  }

  // 3. Magic bytes check
  const magicResult = await validateFileMagicBytes(file);
  if (!magicResult.valid) {
    return magicResult;
  }

  return { valid: true };
}

/**
 * Generate accept string for <input type="file" accept="...">.
 */
export function getAcceptString(extensions?: string[]): string {
  const exts = extensions ?? ALL_ALLOWED_EXTENSIONS;
  return exts.join(',');
}
