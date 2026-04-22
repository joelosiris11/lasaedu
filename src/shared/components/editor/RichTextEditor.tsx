import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ResizableImage } from './ResizableImage';
import Youtube from '@tiptap/extension-youtube';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Extension } from '@tiptap/core';

// Custom FontSize extension (layers on top of TextStyle).
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] } as { types: string[] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});
import { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Redo,
  Undo,
  Link as LinkIcon,
  Image as ImageIcon,
  Youtube as YoutubeIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Minus,
  Palette,
  Type,
  ChevronDown
} from 'lucide-react';
import { Button } from '../ui/Button';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Escribe tu contenido aquí...',
  className = ''
}: RichTextEditorProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showYoutubeDialog, setShowYoutubeDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        },
        // Disable starter-kit's bundled underline & link so our custom
        // configurations (openOnClick: false, our Underline) don't duplicate.
        underline: false,
        link: false,
      } as any),
      Underline,
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      FontFamily.configure({ types: ['textStyle'] }),
      FontSize,
      ResizableImage.configure({
        inline: false,
        allowBase64: true
      }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        modestBranding: true
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-red-600 underline hover:text-red-800'
        }
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Placeholder.configure({
        placeholder
      })
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg max-w-none focus:outline-none min-h-[200px] px-4 py-3'
      }
    }
  });

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const { from, to } = editor.state.selection;
    if (from === to) {
      // No selection — insert the URL as a linked text.
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
        .run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url })
        .run();
    }
    setLinkUrl('');
    setShowLinkDialog(false);
  };

  const addImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
      setShowImageDialog(false);
    }
  };

  const addYoutube = () => {
    if (youtubeUrl) {
      editor.chain().focus().setYoutubeVideo({ src: youtubeUrl }).run();
      setYoutubeUrl('');
      setShowYoutubeDialog(false);
    }
  };

  const ToolbarButton = ({
    onClick,
    active,
    disabled,
    children,
    title
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <Tooltip label={title} disabled={disabled}>
      <button
        type="button"
        // Prevent the button from stealing focus from the editor — otherwise
        // the text selection collapses before the command runs and toggles
        // like toggleBulletList end up with nothing to act on.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        disabled={disabled}
        aria-label={title}
        className={`p-2 rounded hover:bg-gray-100 transition-colors ${
          active ? 'bg-red-100 text-red-600' : 'text-gray-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {children}
      </button>
    </Tooltip>
  );

  return (
    <div className={`border rounded-lg overflow-hidden bg-white ${className}`}>
      {/* Toolbar */}
      <div className="border-b bg-gray-50 p-2 flex flex-wrap gap-1">
        {/* Undo/Redo */}
        <div className="flex border-r pr-2 mr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Deshacer"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Rehacer"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Text formatting */}
        <div className="flex border-r pr-2 mr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Negrita"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Cursiva"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="Subrayado"
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Tachado"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            title="Código"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Font + Size + Color */}
        <div className="flex border-r pr-2 mr-2 gap-1">
          <FontDropdown editor={editor} />
          <FontSizeDropdown editor={editor} />
          <ColorPicker editor={editor} />
        </div>

        {/* Alignment */}
        <div className="flex border-r pr-2 mr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            active={editor.isActive({ textAlign: 'left' })}
            title="Alinear izquierda"
          >
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            active={editor.isActive({ textAlign: 'center' })}
            title="Centrar"
          >
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            active={editor.isActive({ textAlign: 'right' })}
            title="Alinear derecha"
          >
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            active={editor.isActive({ textAlign: 'justify' })}
            title="Justificar"
          >
            <AlignJustify className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Lists */}
        <div className="flex border-r pr-2 mr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Lista con viñetas"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Lista numerada"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Block elements */}
        <div className="flex border-r pr-2 mr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            title="Cita"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Línea horizontal"
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Media */}
        <div className="flex">
          <ToolbarButton
            onClick={() => setShowLinkDialog(true)}
            active={editor.isActive('link')}
            title="Insertar enlace"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setShowImageDialog(true)}
            title="Insertar imagen"
          >
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setShowYoutubeDialog(true)}
            title="Insertar video de YouTube"
          >
            <YoutubeIcon className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Insertar Enlace</h3>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://ejemplo.com"
              className="w-full px-3 py-2 border rounded-lg mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={addLink}>Insertar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Image Dialog */}
      {showImageDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Insertar Imagen</h3>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://ejemplo.com/imagen.jpg"
              className="w-full px-3 py-2 border rounded-lg mb-4"
              autoFocus
            />
            {imageUrl && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Vista previa:</p>
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="max-h-40 rounded border"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowImageDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={addImage}>Insertar</Button>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Dialog */}
      {showYoutubeDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Insertar Video de YouTube</h3>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 py-2 border rounded-lg mb-4"
              autoFocus
            />
            <p className="text-sm text-gray-500 mb-4">
              Pega la URL completa del video de YouTube
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowYoutubeDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={addYoutube}>Insertar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tooltip ───────────────────────────────────────────────────────

function Tooltip({
  label,
  disabled,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="relative inline-flex group">
      {children}
      {!disabled && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {label}
          <span className="absolute left-1/2 -top-1 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
        </span>
      )}
    </span>
  );
}

// ─── Font family dropdown ──────────────────────────────────────────

const DEFAULT_FONT_LABEL = 'Sans Serif';

const FONTS: { label: string; value: string }[] = [
  { label: 'Sans Serif', value: 'Inter, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monoespaciada', value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  { label: 'Elegante', value: 'Playfair Display, Georgia, serif' },
  { label: 'Casual', value: '"Comic Sans MS", "Comic Sans", cursive' },
];

function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);
  return ref;
}

function FontDropdown({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  if (!editor) return null;
  const current = (editor.getAttributes('textStyle').fontFamily as string) || '';
  const currentLabel = FONTS.find(f => f.value === current)?.label || DEFAULT_FONT_LABEL;
  return (
    <div className="relative" ref={ref}>
      <Tooltip label="Fuente">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen(o => !o)}
          aria-label="Fuente"
          className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-gray-100 text-xs text-gray-700 border border-transparent hover:border-gray-200"
        >
          <Type className="h-3.5 w-3.5" />
          <span className="max-w-[90px] truncate">{currentLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </Tooltip>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[160px]">
          {FONTS.map(f => (
            <button
              key={f.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().setFontFamily(f.value).run();
                setOpen(false);
              }}
              style={{ fontFamily: f.value }}
              className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${current === f.value ? 'bg-red-50 text-red-700' : 'text-gray-700'}`}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { editor.chain().focus().unsetFontFamily().run(); setOpen(false); }}
            className="block w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 border-t border-gray-100"
          >
            Quitar fuente
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Font size dropdown ────────────────────────────────────────────

const DEFAULT_FONT_SIZE_LABEL = '16 px';

const FONT_SIZES: { label: string; value: string }[] = [
  { label: '12 px', value: '12px' },
  { label: '14 px', value: '14px' },
  { label: '16 px', value: '16px' },
  { label: '18 px', value: '18px' },
  { label: '20 px', value: '20px' },
  { label: '24 px', value: '24px' },
  { label: '30 px', value: '30px' },
  { label: '36 px', value: '36px' },
  { label: '48 px', value: '48px' },
];

function FontSizeDropdown({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  if (!editor) return null;
  const current = (editor.getAttributes('textStyle').fontSize as string) || '';
  const currentLabel = FONT_SIZES.find(f => f.value === current)?.label || (current || DEFAULT_FONT_SIZE_LABEL);
  return (
    <div className="relative" ref={ref}>
      <Tooltip label="Tamaño de fuente">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen(o => !o)}
          aria-label="Tamaño de fuente"
          className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-gray-100 text-xs text-gray-700 border border-transparent hover:border-gray-200"
        >
          <span className="max-w-[80px] truncate">{currentLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </Tooltip>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[140px] max-h-72 overflow-y-auto">
          {FONT_SIZES.map(f => (
            <button
              key={f.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                (editor as any).chain().focus().setFontSize(f.value).run();
                setOpen(false);
              }}
              className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${current === f.value ? 'bg-red-50 text-red-700' : 'text-gray-700'}`}
              style={{ fontSize: f.value }}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { (editor as any).chain().focus().unsetFontSize().run(); setOpen(false); }}
            className="block w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 border-t border-gray-100"
          >
            Quitar tamaño
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Color picker (hex) ────────────────────────────────────────────

function ColorPicker({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const current = (editor?.getAttributes('textStyle').color as string | undefined);
  const [hexInput, setHexInput] = useState(current || '#111827');
  useEffect(() => {
    if (open) setHexInput(current || '#111827');
  }, [open, current]);
  if (!editor) return null;

  const isValidHex = (s: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());

  const applyHex = () => {
    const v = hexInput.trim();
    if (isValidHex(v)) {
      editor.chain().focus().setColor(v).run();
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Tooltip label="Color del texto">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen(o => !o)}
          aria-label="Color del texto"
          className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-gray-100 text-gray-600 border border-transparent hover:border-gray-200"
        >
          <Palette className="h-4 w-4" style={{ color: current }} />
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </Tooltip>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-[220px] space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Selector de color</label>
            <input
              type="color"
              value={isValidHex(hexInput) ? hexInput : '#111827'}
              onChange={(e) => {
                setHexInput(e.target.value);
                editor.chain().focus().setColor(e.target.value).run();
              }}
              className="w-full h-9 cursor-pointer rounded border border-gray-200"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Código HEX</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyHex(); } }}
                placeholder="#111827"
                className={`flex-1 px-2 py-1.5 text-sm font-mono border rounded focus:outline-none focus:ring-2 focus:ring-red-500 ${isValidHex(hexInput) ? 'border-gray-300' : 'border-red-300'}`}
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={applyHex}
                disabled={!isValidHex(hexInput)}
                className="px-2 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aplicar
              </button>
            </div>
            {!isValidHex(hexInput) && (
              <p className="text-[10px] text-red-500 mt-1">Formato: #rgb o #rrggbb</p>
            )}
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { editor.chain().focus().unsetColor().run(); setOpen(false); }}
            className="w-full text-xs text-gray-600 hover:text-gray-900 hover:underline pt-2 border-t border-gray-100"
          >
            Quitar color
          </button>
        </div>
      )}
    </div>
  );
}
