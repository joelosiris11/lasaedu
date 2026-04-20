// Converts legacy ContentBlock[] content to a single HTML string for the
// WYSIWYG editor. Used when loading lessons that were authored with the old
// block-based editor.

export interface LegacyContentBlock {
  id: string;
  type: 'text' | 'heading' | 'image' | 'video' | 'audio' | 'file' | 'code' | 'quote';
  content: string;
  metadata?: {
    level?: 1 | 2 | 3 | 4 | 5 | 6;
    alt?: string;
    caption?: string;
    source?: string;
    layout?: 'none' | 'left' | 'right' | 'top' | 'bottom';
    body?: string;
  };
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    alignment?: 'left' | 'center' | 'right' | 'justify';
    color?: string;
  };
  order: number;
}

const escape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const wrapInline = (text: string, f?: LegacyContentBlock['formatting']): string => {
  let out = text;
  if (!f) return out;
  if (f.bold) out = `<strong>${out}</strong>`;
  if (f.italic) out = `<em>${out}</em>`;
  if (f.underline) out = `<u>${out}</u>`;
  return out;
};

const buildStyle = (f?: LegacyContentBlock['formatting']): string => {
  if (!f) return '';
  const parts: string[] = [];
  if (f.alignment) parts.push(`text-align: ${f.alignment}`);
  if (f.color) parts.push(`color: ${f.color}`);
  return parts.length ? ` style="${parts.join('; ')}"` : '';
};

const blockToHtml = (block: LegacyContentBlock): string => {
  const style = buildStyle(block.formatting);
  const content = block.content || '';

  switch (block.type) {
    case 'heading': {
      const level = block.metadata?.level || 2;
      return `<h${level}${style}>${wrapInline(escape(content), block.formatting)}</h${level}>`;
    }
    case 'text': {
      if (/<[a-z][^>]*>/i.test(content)) {
        return `<div${style}>${content}</div>`;
      }
      const paragraphs = content.split(/\n{2,}/).map(p => p.replace(/\n/g, '<br>'));
      return paragraphs.map(p => `<p${style}>${wrapInline(escape(p).replace(/&lt;br&gt;/g, '<br>'), block.formatting)}</p>`).join('\n');
    }
    case 'quote':
      return `<blockquote${style}>${wrapInline(escape(content), block.formatting)}</blockquote>`;
    case 'code':
      return `<pre><code>${escape(content)}</code></pre>`;
    case 'image': {
      const alt = escape(block.metadata?.alt || '');
      const cap = block.metadata?.caption ? `<p style="text-align: center; font-size: 0.875rem; color: #6b7280">${escape(block.metadata.caption)}</p>` : '';
      const img = `<img src="${content}" alt="${alt}">`;
      const body = block.metadata?.body;
      const layout = block.metadata?.layout;
      if (body && layout && layout !== 'none') {
        const textHtml = `<p>${escape(body).replace(/\n/g, '<br>')}</p>`;
        if (layout === 'top') return `${img}${cap}${textHtml}`;
        if (layout === 'bottom') return `${textHtml}${img}${cap}`;
        // left/right: we can't do side-by-side in plain HTML without flex/grid,
        // fall back to stacked.
        return `${img}${cap}${textHtml}`;
      }
      return `${img}${cap}`;
    }
    case 'video': {
      const src = content;
      if (src.includes('youtube.com') || src.includes('youtu.be')) {
        return `<div data-youtube-video><iframe src="${src}" frameborder="0" allowfullscreen></iframe></div>`;
      }
      return `<p><a href="${src}" target="_blank" rel="noopener noreferrer">${escape(block.metadata?.caption || src)}</a></p>`;
    }
    case 'audio':
      return `<p><audio src="${content}" controls></audio></p>`;
    case 'file':
      return `<p><a href="${content}" target="_blank" rel="noopener noreferrer">${escape(block.metadata?.caption || 'Archivo')}</a></p>`;
    default:
      return `<p>${wrapInline(escape(content), block.formatting)}</p>`;
  }
};

export function blocksToHtml(blocks: LegacyContentBlock[]): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  const sorted = [...blocks].sort((a, b) => (a.order || 0) - (b.order || 0));
  return sorted.map(blockToHtml).join('\n');
}
