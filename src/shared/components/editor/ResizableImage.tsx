import Image from '@tiptap/extension-image';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react';
import { useRef } from 'react';

type Align = 'left' | 'center' | 'right';

const alignStyle = (a: Align): string => {
  if (a === 'left') return 'float:left;margin:0 16px 8px 0;';
  if (a === 'right') return 'float:right;margin:0 0 8px 16px;';
  return 'display:block;margin:8px auto;';
};

const ResizableImageView = ({
  node,
  updateAttributes,
  selected,
  editor,
}: ReactNodeViewProps) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const width = (node.attrs as { width: number | null }).width;
  const align = ((node.attrs as { align?: Align }).align || 'center') as Align;
  const src = (node.attrs as { src: string }).src;
  const alt = (node.attrs as { alt?: string }).alt || '';
  const isEditable = editor.isEditable;

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = imgRef.current?.getBoundingClientRect().width ?? 0;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(60, Math.round(startWidth + delta));
      updateAttributes({ width: newWidth });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const justify =
    align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

  return (
    <NodeViewWrapper
      as="div"
      className="resizable-image"
      style={{
        display: 'flex',
        justifyContent: justify,
        margin: '8px 0',
      }}
    >
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          style={{
            width: width ? `${width}px` : 'auto',
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: 4,
            outline: selected ? '2px solid #dc2626' : 'none',
            outlineOffset: 2,
          }}
        />

        {isEditable && selected && (
          <>
            <div
              contentEditable={false}
              style={{
                position: 'absolute',
                top: -40,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: 2,
                padding: 4,
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                whiteSpace: 'nowrap',
                zIndex: 20,
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {(['left', 'center', 'right'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    updateAttributes({ align: a });
                  }}
                  title={a === 'left' ? 'Izquierda' : a === 'center' ? 'Centro' : 'Derecha'}
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 4,
                    background: align === a ? '#dc2626' : 'transparent',
                    color: align === a ? 'white' : '#374151',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {a === 'left' ? '◧' : a === 'center' ? '▬' : '◨'}
                </button>
              ))}
              <span style={{ width: 1, background: '#e5e7eb', margin: '0 2px' }} />
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const parent = imgRef.current?.parentElement?.parentElement?.parentElement;
                    const available = parent?.getBoundingClientRect().width ?? 600;
                    updateAttributes({ width: Math.round((available * pct) / 100) });
                  }}
                  title={`${pct}%`}
                  style={{
                    padding: '4px 6px',
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 4,
                    background: 'transparent',
                    color: '#374151',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {pct}%
                </button>
              ))}
              <span style={{ width: 1, background: '#e5e7eb', margin: '0 2px' }} />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  updateAttributes({ width: null });
                }}
                title="Tamaño original"
                style={{
                  padding: '4px 6px',
                  fontSize: 11,
                  borderRadius: 4,
                  background: 'transparent',
                  color: '#6b7280',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Auto
              </button>
            </div>

            <div
              contentEditable={false}
              onMouseDown={handleResizeStart}
              style={{
                position: 'absolute',
                right: -6,
                bottom: -6,
                width: 14,
                height: 14,
                background: '#dc2626',
                border: '2px solid white',
                borderRadius: 3,
                cursor: 'nwse-resize',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                zIndex: 20,
              }}
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const ResizableImage = Image.extend({
  addAttributes() {
    const parent = this.parent?.() || {};
    return {
      ...parent,
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const attr = el.getAttribute('width');
          if (attr) {
            const n = parseInt(attr, 10);
            if (!Number.isNaN(n)) return n;
          }
          const sw = el.style?.width;
          if (sw?.endsWith('px')) return parseInt(sw, 10);
          return null;
        },
        renderHTML: (attrs: { width?: number | null }) =>
          attrs.width ? { width: attrs.width } : {},
      },
      align: {
        default: 'center',
        parseHTML: (el: HTMLElement) =>
          (el.getAttribute('data-align') as Align) || 'center',
        renderHTML: (attrs: { align?: Align; width?: number | null }) => {
          const a = (attrs.align || 'center') as Align;
          let style = alignStyle(a);
          if (attrs.width) style += `width:${attrs.width}px;max-width:100%;`;
          return { 'data-align': a, style };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

export default ResizableImage;
