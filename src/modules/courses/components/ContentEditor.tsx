import React, { useState, useRef, useEffect } from 'react';
import { 
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Image,
  Video,
  Save,
  Eye,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Code,
  Loader2
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/Card';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import { fileUploadService } from '@shared/services/fileUploadService';
import VideoPlayer from '@shared/components/media/VideoPlayer';

interface ContentEditorProps {
  initialContent?: string;
  onSave: (content: ContentBlock[]) => void;
  onContentChange?: (content: ContentBlock[]) => void;
  lessonType: 'text' | 'video' | 'audio' | 'pdf' | 'mixed';
  courseId?: string;
  lessonId?: string;
}

interface ContentBlock {
  id: string;
  type: 'text' | 'heading' | 'image' | 'video' | 'audio' | 'file' | 'code' | 'quote';
  content: string;
  metadata?: {
    level?: 1 | 2 | 3 | 4 | 5 | 6; // For headings
    alt?: string; // For images
    caption?: string;
    url?: string;
    duration?: number; // For video/audio
    size?: number; // For files
    language?: string; // For code blocks
    source?: 'youtube' | 'vimeo' | 'url' | 'upload'; // For video sources
  };
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    alignment?: 'left' | 'center' | 'right';
    color?: string;
  };
  order: number;
}

const TOOLBAR_ITEMS = [
  { icon: Bold, action: 'bold', tooltip: 'Negrita' },
  { icon: Italic, action: 'italic', tooltip: 'Cursiva' },
  { icon: Underline, action: 'underline', tooltip: 'Subrayado' },
  { icon: List, action: 'bulletList', tooltip: 'Lista con viñetas' },
  { icon: ListOrdered, action: 'orderedList', tooltip: 'Lista numerada' },
  { icon: Link, action: 'link', tooltip: 'Enlace' },
  { icon: Quote, action: 'quote', tooltip: 'Cita' },
  { icon: Code, action: 'code', tooltip: 'Código' },
  { icon: AlignLeft, action: 'alignLeft', tooltip: 'Alinear izquierda' },
  { icon: AlignCenter, action: 'alignCenter', tooltip: 'Centrar' },
  { icon: AlignRight, action: 'alignRight', tooltip: 'Alinear derecha' }
];

export default function ContentEditor({
  initialContent,
  onSave,
  onContentChange,
  lessonType: _lessonType,
  courseId,
  lessonId
}: ContentEditorProps) {
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([
    {
      id: '1',
      type: 'text',
      content: '',
      order: 0
    }
  ]);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('1');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showMediaDialog, setShowMediaDialog] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | 'file'>('image');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mediaInputMode, setMediaInputMode] = useState<'upload' | 'url'>('url');
  const [mediaUrl, setMediaUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect video source type
  const isYouTubeUrl = (url: string) => {
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  const isVimeoUrl = (url: string) => {
    return url.includes('vimeo.com');
  };

  const handleAddMediaByUrl = () => {
    if (!mediaUrl.trim()) return;

    const newBlock: ContentBlock = {
      id: generateId(),
      type: mediaType,
      content: mediaUrl,
      metadata: {
        caption: '',
        source: isYouTubeUrl(mediaUrl) ? 'youtube' : isVimeoUrl(mediaUrl) ? 'vimeo' : 'url'
      },
      order: contentBlocks.length
    };

    setContentBlocks(prev => [...prev, newBlock]);
    setMediaUrl('');
    setShowMediaDialog(false);
  };
  useEffect(() => {
    if (initialContent) {
      try {
        const parsed = JSON.parse(initialContent);
        setContentBlocks(parsed);
      } catch {
        // If not JSON, treat as plain text
        setContentBlocks([{
          id: '1',
          type: 'text',
          content: initialContent,
          order: 0
        }]);
      }
    }
  }, [initialContent]);

  useEffect(() => {
    if (onContentChange) {
      onContentChange(contentBlocks);
    }
  }, [contentBlocks, onContentChange]);

  const generateId = () => Date.now().toString();

  const addBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: generateId(),
      type,
      content: '',
      order: contentBlocks.length,
      ...(type === 'heading' && { metadata: { level: 2 } })
    };
    setContentBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    setContentBlocks(prev => 
      prev.map(block => 
        block.id === id ? { ...block, ...updates } : block
      )
    );
  };

  const deleteBlock = (id: string) => {
    if (contentBlocks.length <= 1) return;
    setContentBlocks(prev => prev.filter(block => block.id !== id));
    if (selectedBlockId === id) {
      setSelectedBlockId(contentBlocks[0]?.id || '');
    }
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const currentIndex = contentBlocks.findIndex(block => block.id === id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === contentBlocks.length - 1)
    ) {
      return;
    }

    const newBlocks = [...contentBlocks];
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    [newBlocks[currentIndex], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[currentIndex]];
    
    // Update order
    newBlocks.forEach((block, index) => {
      block.order = index;
    });

    setContentBlocks(newBlocks);
  };

  const applyFormatting = (action: string) => {
    const selectedBlock = contentBlocks.find(block => block.id === selectedBlockId);
    if (!selectedBlock) return;

    let updates: Partial<ContentBlock> = {};

    switch (action) {
      case 'bold':
        updates.formatting = { 
          ...selectedBlock.formatting, 
          bold: !selectedBlock.formatting?.bold 
        };
        break;
      case 'italic':
        updates.formatting = { 
          ...selectedBlock.formatting, 
          italic: !selectedBlock.formatting?.italic 
        };
        break;
      case 'underline':
        updates.formatting = { 
          ...selectedBlock.formatting, 
          underline: !selectedBlock.formatting?.underline 
        };
        break;
      case 'alignLeft':
      case 'alignCenter':
      case 'alignRight':
        updates.formatting = { 
          ...selectedBlock.formatting, 
          alignment: action.replace('align', '').toLowerCase() as 'left' | 'center' | 'right'
        };
        break;
    }

    if (Object.keys(updates).length > 0) {
      updateBlock(selectedBlockId, updates);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    
    try {
      let uploadResult;
      
      switch (mediaType) {
        case 'image':
          uploadResult = await fileUploadService.uploadImage(
            file, 
            courseId, 
            lessonId,
            (progress) => setUploadProgress(progress.percent)
          );
          break;
        case 'video':
          uploadResult = await fileUploadService.uploadVideo(
            file, 
            courseId, 
            lessonId,
            (progress) => setUploadProgress(progress.percent)
          );
          break;
        case 'audio':
          uploadResult = await fileUploadService.uploadAudio(
            file, 
            courseId, 
            lessonId,
            (progress) => setUploadProgress(progress.percent)
          );
          break;
        case 'file':
          uploadResult = await fileUploadService.uploadDocument(
            file, 
            courseId, 
            lessonId,
            (progress) => setUploadProgress(progress.percent)
          );
          break;
        default:
          throw new Error('Tipo de archivo no soportado');
      }
      
      // Get duration for video/audio files
      let duration: number | undefined;
      if (mediaType === 'video' || mediaType === 'audio') {
        try {
          duration = await fileUploadService.getMediaDuration(file);
        } catch (error) {
          console.warn('Could not get media duration:', error);
        }
      }

      const newBlock: ContentBlock = {
        id: generateId(),
        type: mediaType,
        content: uploadResult.url,
        metadata: {
          caption: uploadResult.filename,
          size: uploadResult.size,
          ...(mediaType === 'video' || mediaType === 'audio' ? { duration } : {}),
          ...(mediaType === 'image' ? { alt: uploadResult.filename } : {})
        },
        order: contentBlocks.length
      };

      setContentBlocks(prev => [...prev, newBlock]);
      setShowMediaDialog(false);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error al subir el archivo. Intenta de nuevo.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSave = () => {
    onSave(contentBlocks);
  };

  const renderBlock = (block: ContentBlock) => {
    const formatStyle = {
      fontWeight: block.formatting?.bold ? 'bold' : 'normal',
      fontStyle: block.formatting?.italic ? 'italic' : 'normal',
      textDecoration: block.formatting?.underline ? 'underline' : 'none',
      textAlign: block.formatting?.alignment || 'left' as const
    };

    switch (block.type) {
      case 'heading':
        const level = block.metadata?.level || 2;
        const HeadingElement = level === 1 ? 'h1' : level === 2 ? 'h2' : level === 3 ? 'h3' : level === 4 ? 'h4' : level === 5 ? 'h5' : 'h6';
        return React.createElement(HeadingElement, { 
          style: formatStyle, 
          className: "font-bold mb-2"
        }, block.content);
      
      case 'text':
        return (
          <p style={formatStyle} className="mb-2">
            {block.content}
          </p>
        );
      
      case 'quote':
        return (
          <blockquote className="border-l-4 border-blue-500 pl-4 italic mb-4" style={formatStyle}>
            {block.content}
          </blockquote>
        );
      
      case 'code':
        return (
          <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4">
            <code>{block.content}</code>
          </pre>
        );
      
      case 'image':
        return (
          <div className="mb-4">
            <img 
              src={block.content} 
              alt={block.metadata?.alt} 
              className="max-w-full h-auto rounded-lg"
            />
            {block.metadata?.caption && (
              <p className="text-sm text-gray-600 mt-2 text-center">
                {block.metadata.caption}
              </p>
            )}
          </div>
        );
      
      case 'video':
        // Use VideoPlayer for YouTube/Vimeo, native video for uploads
        const source = block.metadata?.source;
        if (source === 'youtube' || source === 'vimeo') {
          return (
            <div className="mb-4">
              <VideoPlayer
                url={block.content}
                title={block.metadata?.caption}
              />
              {block.metadata?.caption && (
                <p className="text-sm text-gray-600 mt-2 text-center">
                  {block.metadata.caption}
                </p>
              )}
            </div>
          );
        }
        return (
          <div className="mb-4">
            <video
              src={block.content}
              controls
              className="w-full rounded-lg"
              poster={block.metadata?.url}
            />
            {block.metadata?.caption && (
              <p className="text-sm text-gray-600 mt-2 text-center">
                {block.metadata.caption}
              </p>
            )}
          </div>
        );
      
      case 'audio':
        return (
          <div className="mb-4">
            <audio src={block.content} controls className="w-full" />
            {block.metadata?.caption && (
              <p className="text-sm text-gray-600 mt-2">
                {block.metadata.caption}
              </p>
            )}
          </div>
        );
      
      default:
        return <div>Unsupported block type</div>;
    }
  };

  if (isPreviewMode) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Vista Previa del Contenido</CardTitle>
          <Button 
            variant="outline" 
            onClick={() => setIsPreviewMode(false)}
          >
            <Type className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </CardHeader>
        <CardContent className="prose max-w-none">
          {contentBlocks
            .sort((a, b) => a.order - b.order)
            .map(block => (
              <div key={block.id}>
                {renderBlock(block)}
              </div>
            ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Editor de Contenido</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsPreviewMode(true)}
            >
              <Eye className="w-4 h-4 mr-2" />
              Vista Previa
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-1 p-2 border rounded-lg bg-gray-50">
          {TOOLBAR_ITEMS.map(({ icon: Icon, action, tooltip }) => (
            <Button
              key={action}
              variant="ghost"
              size="sm"
              onClick={() => applyFormatting(action)}
              title={tooltip}
              className="p-2"
            >
              <Icon className="w-4 h-4" />
            </Button>
          ))}
          
          <div className="border-l border-gray-300 mx-2" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addBlock('heading')}
            title="Agregar título"
          >
            <Type className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMediaType('image');
              setShowMediaDialog(true);
            }}
            title="Agregar imagen"
          >
            <Image className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMediaType('video');
              setShowMediaDialog(true);
            }}
            title="Agregar video"
          >
            <Video className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {contentBlocks
          .sort((a, b) => a.order - b.order)
          .map((block, index) => (
            <div
              key={block.id}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedBlockId === block.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
              onClick={() => setSelectedBlockId(block.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">
                  {block.type === 'text' && 'Párrafo'}
                  {block.type === 'heading' && `Título ${block.metadata?.level || 2}`}
                  {block.type === 'image' && 'Imagen'}
                  {block.type === 'video' && 'Video'}
                  {block.type === 'audio' && 'Audio'}
                  {block.type === 'quote' && 'Cita'}
                  {block.type === 'code' && 'Código'}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveBlock(block.id, 'up');
                    }}
                    disabled={index === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveBlock(block.id, 'down');
                    }}
                    disabled={index === contentBlocks.length - 1}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBlock(block.id);
                    }}
                    className="text-red-500"
                    disabled={contentBlocks.length <= 1}
                  >
                    ✕
                  </Button>
                </div>
              </div>

              {block.type === 'text' || block.type === 'heading' || block.type === 'quote' || block.type === 'code' ? (
                <textarea
                  value={block.content}
                  onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                  className="w-full min-h-[100px] p-2 border rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Escribe tu contenido aquí..."
                />
              ) : (
                <div className="preview-area">
                  {renderBlock(block)}
                </div>
              )}
            </div>
          ))}
        
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => addBlock('text')}
            className="flex items-center gap-2"
          >
            <Type className="w-4 h-4" />
            Agregar párrafo
          </Button>
        </div>
      </CardContent>

      {/* Media Upload Dialog */}
      {showMediaDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-[450px]">
            <CardHeader>
              <CardTitle>
                Agregar {mediaType === 'image' ? 'Imagen' : mediaType === 'video' ? 'Video' : 'Audio'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tabs for URL vs Upload */}
              {(mediaType === 'image' || mediaType === 'video') && (
                <div className="flex border-b">
                  <button
                    onClick={() => setMediaInputMode('url')}
                    className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                      mediaInputMode === 'url'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {mediaType === 'video' ? 'URL de YouTube/Vimeo' : 'URL de imagen'}
                  </button>
                  <button
                    onClick={() => setMediaInputMode('upload')}
                    className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                      mediaInputMode === 'upload'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Subir archivo
                  </button>
                </div>
              )}

              {/* URL Input */}
              {mediaInputMode === 'url' && (mediaType === 'image' || mediaType === 'video') ? (
                <div className="space-y-4">
                  <div>
                    <Label>
                      {mediaType === 'video' ? 'URL del video' : 'URL de la imagen'}
                    </Label>
                    <Input
                      type="url"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder={
                        mediaType === 'video'
                          ? 'https://www.youtube.com/watch?v=...'
                          : 'https://ejemplo.com/imagen.jpg'
                      }
                    />
                    {mediaType === 'video' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Soporta YouTube y Vimeo
                      </p>
                    )}
                  </div>

                  {/* Preview for images */}
                  {mediaType === 'image' && mediaUrl && (
                    <div className="border rounded-lg p-2">
                      <p className="text-xs text-gray-500 mb-2">Vista previa:</p>
                      <img
                        src={mediaUrl}
                        alt="Preview"
                        className="max-h-32 rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowMediaDialog(false);
                        setMediaUrl('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleAddMediaByUrl} disabled={!mediaUrl.trim()}>
                      Insertar
                    </Button>
                  </div>
                </div>
              ) : (
                /* File Upload */
                <div className="space-y-4">
                  <div>
                    <Label>Subir archivo</Label>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      accept={
                        mediaType === 'image' ? 'image/*' :
                        mediaType === 'video' ? 'video/*' :
                        mediaType === 'audio' ? 'audio/*' :
                        '.pdf,.doc,.docx'
                      }
                      disabled={uploading}
                    />
                    {uploading && (
                      <div className="mt-2">
                        <div className="bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Subiendo... {Math.round(uploadProgress)}%
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowMediaDialog(false)}
                      disabled={uploading}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Subiendo...
                        </>
                      ) : (
                        'Seleccionar archivo'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}