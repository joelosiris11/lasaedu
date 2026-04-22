// Moodle file migrator.
//
// The SQL dump only carries file metadata (contenthash, component, filearea,
// contextid). The binaries live in moodledata/filedir/ on the Moodle server.
// This module supports three acquisition modes:
//
//   1. Local directory — set MOODLEDATA_DIR to a mirrored `filedir/` tree.
//   2. Remote pluginfile.php — set MOODLE_WWWROOT + MOODLE_WS_TOKEN.
//   3. None — files are skipped with a warning; lessons still import.
//
// Once acquired, the binary is uploaded to cloudteco via
//   POST {FILE_SERVER_URL}/upload/{storagePath}
// The response shape matches src/shared/services/fileUploadService.ts:91.

import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

export const EMPTY_CONTENTHASH = 'da39a3ee5e6b4b0d3255bfef95601890afd80709'; // sha1('')

// Component/filearea pairs we care about. Everything else in mdlsv_files is
// editor-only chrome (stamps, logos, previews, draft uploads, etc).
export const RELEVANT_COMPONENTS = new Set([
  'mod_resource',
  'mod_folder',
  'mod_assign',
  'mod_page',
  'mod_book',
  'mod_lesson',
  'mod_label',
  'mod_url',
  'mod_forum',
  'question',
  'qtype_multichoice',
  'qtype_match',
  'qtype_shortanswer',
  'qtype_essay',
  'qtype_truefalse',
]);

export class FileMigrator {
  constructor({
    moodledataDir,
    moodleWwwroot,
    moodleWsToken,
    fileServerUrl,
    fileServerToken,
    dryRun,
    logger,
  }) {
    this.moodledataDir = moodledataDir || '';
    this.moodleWwwroot = (moodleWwwroot || '').replace(/\/+$/, '');
    this.moodleWsToken = moodleWsToken || '';
    this.fileServerUrl = (fileServerUrl || '').replace(/\/+$/, '');
    this.fileServerToken = fileServerToken || '';
    this.dryRun = !!dryRun;
    this.logger = logger || console;
    // contenthash → cloudteco URL cache so dup files don't upload twice
    this.cache = new Map();
    this.warnings = [];
    this.stats = { uploaded: 0, cached: 0, skipped: 0, failed: 0 };
  }

  canMigrate() {
    return Boolean(this.fileServerUrl) && (Boolean(this.moodledataDir) || Boolean(this.moodleWwwroot && this.moodleWsToken));
  }

  // Returns the binary contents of the Moodle file or null if unavailable.
  async fetchBinary(fileRow) {
    const { contenthash, contextid, component, filearea, itemid, filepath, filename } = fileRow;
    if (!contenthash || contenthash === EMPTY_CONTENTHASH) return null;

    if (this.moodledataDir) {
      const hashPath = path.join(
        this.moodledataDir,
        contenthash.slice(0, 2),
        contenthash.slice(2, 4),
        contenthash,
      );
      try {
        return await fs.readFile(hashPath);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          this.logger.warn(`  ⚠ read ${hashPath} failed: ${err.message}`);
        }
        // fall through to other methods
      }
    }

    if (this.moodleWwwroot && this.moodleWsToken) {
      const safePath = (filepath || '/').replace(/\/+/g, '/');
      const url = `${this.moodleWwwroot}/webservice/pluginfile.php/${contextid}/${component}/${filearea}/${itemid}${safePath}${encodeURIComponent(filename)}?token=${this.moodleWsToken}`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          this.logger.warn(`  ⚠ pluginfile.php ${res.status} for ${filename}`);
          return null;
        }
        return Buffer.from(await res.arrayBuffer());
      } catch (err) {
        this.logger.warn(`  ⚠ fetch ${filename} failed: ${err.message}`);
        return null;
      }
    }

    return null;
  }

  // Uploads the buffer to cloudteco. Returns { url, filename, size, contentType } or null.
  async uploadToCloudteco(buf, storagePath, filename, mimetype) {
    if (this.dryRun) {
      return {
        url: `${this.fileServerUrl}/files/${storagePath}/${filename}`,
        filename,
        size: buf.length,
        contentType: mimetype || 'application/octet-stream',
      };
    }

    const form = new FormData();
    const blob = new Blob([buf], { type: mimetype || 'application/octet-stream' });
    form.append('file', blob, filename);

    const headers = {};
    if (this.fileServerToken) headers['Authorization'] = `Bearer ${this.fileServerToken}`;

    const res = await fetch(`${this.fileServerUrl}/upload/${storagePath}`, {
      method: 'POST',
      headers,
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`upload ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    return {
      url: data.url,
      filename: data.filename || filename,
      size: data.size ?? buf.length,
      contentType: data.contentType || mimetype || 'application/octet-stream',
    };
  }

  // Migrate a single file record. Returns a ResourceFile-like object or null
  // if we couldn't obtain the binary (caller should log a pending placeholder).
  async migrateFile(fileRow, { courseDocId, lessonDocId }) {
    const { contenthash, filename, filesize, mimetype } = fileRow;
    if (!contenthash) return null;
    if (contenthash === EMPTY_CONTENTHASH) return null; // directory marker
    if (!filename || filename === '.') return null; // directory marker

    if (this.cache.has(contenthash)) {
      this.stats.cached += 1;
      const cached = this.cache.get(contenthash);
      return { ...cached, name: filename };
    }

    if (!this.canMigrate()) {
      this.stats.skipped += 1;
      return null;
    }

    const buf = await this.fetchBinary(fileRow);
    if (!buf) {
      this.stats.skipped += 1;
      return null;
    }

    const storagePath = `courses/${courseDocId}/lessons/${lessonDocId}/document`;
    try {
      const uploaded = await this.uploadToCloudteco(buf, storagePath, filename, mimetype);
      this.cache.set(contenthash, uploaded);
      this.stats.uploaded += 1;
      return {
        id: `mdl_file_${fileRow.id}`,
        name: uploaded.filename,
        url: uploaded.url,
        size: uploaded.size ?? filesize ?? buf.length,
        contentType: uploaded.contentType,
      };
    } catch (err) {
      this.stats.failed += 1;
      this.warnings.push(`file upload failed for ${filename} (hash=${contenthash}): ${err.message}`);
      this.logger.warn(`  ⚠ upload ${filename} failed: ${err.message}`);
      return null;
    }
  }

  // Replace @@PLUGINFILE@@/... placeholders in HTML with the cloudteco URLs we
  // uploaded for that contextid/component/filearea/itemid tuple.
  //
  // Moodle emits the literal string `@@PLUGINFILE@@/<filepath><filename>`.
  // We resolve each one against a lookup built from the same file list the
  // caller already walked.
  rewritePluginfileHtml(html, fileLookup) {
    if (!html) return html;
    return String(html).replace(/@@PLUGINFILE@@(\/[^"')\s]+)/g, (match, relPath) => {
      const decoded = decodeURIComponent(relPath);
      const entry = fileLookup.get(decoded) || fileLookup.get(relPath);
      if (entry && entry.url) return entry.url;
      return match;
    });
  }
}
