import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { useState } from 'react';
import {
  Bold,
  Italic,
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
  Heading1,
  Heading2,
  Heading3,
  Minus
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
        }
      }),
      Image.configure({
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
          class: 'text-blue-600 underline hover:text-blue-800'
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
    if (linkUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: linkUrl })
        .run();
      setLinkUrl('');
      setShowLinkDialog(false);
    }
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded hover:bg-gray-100 transition-colors ${
        active ? 'bg-gray-200 text-blue-600' : 'text-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
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

        {/* Headings */}
        <div className="flex border-r pr-2 mr-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="Título 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Título 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="Título 3"
          >
            <Heading3 className="h-4 w-4" />
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
