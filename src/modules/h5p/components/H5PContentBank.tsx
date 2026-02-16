/**
 * H5P Content Bank Component
 * Visualiza contenido H5P disponible para reutilizar
 */

import { useState, useEffect } from 'react';
import { Search, Grid, List, Copy, Trash2, Star } from 'lucide-react';
import { H5PContentService } from '@shared/services/h5p/h5pContentService';
import type { H5PContentMeta } from '@shared/types/h5p';

interface H5PContentBankProps {
  courseId?: string;
  onSelectContent?: (content: H5PContentMeta) => void;
  isSelectable?: boolean;
}

type ViewMode = 'grid' | 'list';

export function H5PContentBank({
  courseId,
  onSelectContent,
  isSelectable = false
}: H5PContentBankProps) {
  const [contents, setContents] = useState<H5PContentMeta[]>([]);
  const [filteredContents, setFilteredContents] = useState<H5PContentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);

  const h5pService = new H5PContentService();

  useEffect(() => {
    loadContents();
  }, []);

  const loadContents = async () => {
    try {
      setLoading(true);
      // TODO: Implementar getReusableContents en H5PContentService
      // const items = await h5pService.getReusableContents();
      // setContents(items);
      // Extraer tags únicos
      // const tags = Array.from(new Set(items.flatMap(c => c.tags || [])));
      // setAllTags(tags);
      setLoading(false);
    } catch (error) {
      console.error('Error loading H5P contents:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = contents;

    if (searchTerm) {
      filtered = filtered.filter(
        c =>
          c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedTag) {
      filtered = filtered.filter(c => c.tags?.includes(selectedTag));
    }

    setFilteredContents(filtered);
  }, [contents, searchTerm, selectedTag]);

  const handleCopy = async (content: H5PContentMeta) => {
    // TODO: Copiar contenido a este curso
    console.log('Copying content:', content.id);
  };

  const handleDelete = async (contentId: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este contenido?')) {
      try {
        // TODO: Implementar deleteContent en H5PContentService
        // await h5pService.deleteContent(contentId);
        setContents(contents.filter(c => c.id !== contentId));
      } catch (error) {
        console.error('Error deleting content:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando banco de contenido...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Búsqueda */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar contenido H5P..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filtros por etiqueta */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedTag === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Todos
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedTag === tag
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Controles de vista */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {filteredContents.length} elemento{filteredContents.length !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Contenido */}
      {filteredContents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No se encontró contenido H5P</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContents.map(content => (
            <ContentCard
              key={content.id}
              content={content}
              onSelect={onSelectContent}
              onCopy={handleCopy}
              onDelete={handleDelete}
              isSelectable={isSelectable}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredContents.map(content => (
            <ContentListItem
              key={content.id}
              content={content}
              onSelect={onSelectContent}
              onCopy={handleCopy}
              onDelete={handleDelete}
              isSelectable={isSelectable}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContentCard({
  content,
  onSelect,
  onCopy,
  onDelete,
  isSelectable
}: {
  content: H5PContentMeta;
  onSelect?: (c: H5PContentMeta) => void;
  onCopy: (c: H5PContentMeta) => void;
  onDelete: (id: string) => void;
  isSelectable: boolean;
}) {
  return (
    <div
      onClick={() => isSelectable && onSelect?.(content)}
      className={`p-4 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-shadow ${
        isSelectable ? 'cursor-pointer hover:border-blue-300' : ''
      }`}
    >
      {content.previewImageUrl && (
        <img
          src={content.previewImageUrl}
          alt={content.title}
          className="w-full h-40 object-cover rounded mb-3"
        />
      )}

      <h3 className="font-semibold text-gray-900 line-clamp-2">{content.title}</h3>

      <div className="flex items-center gap-2 my-2 text-sm text-gray-600">
        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
          {content.contentType}
        </span>
        <span className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-500" />
          {content.usageCount}
        </span>
      </div>

      {content.description && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
          {content.description}
        </p>
      )}

      {content.tags && content.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {content.tags.slice(0, 2).map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
            >
              {tag}
            </span>
          ))}
          {content.tags.length > 2 && (
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
              +{content.tags.length - 2}
            </span>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onCopy(content)}
          className="flex-1 p-2 text-sm flex items-center justify-center gap-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          <Copy className="w-4 h-4" />
          Copiar
        </button>
        <button
          onClick={() => onDelete(content.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ContentListItem({
  content,
  onSelect,
  onCopy,
  onDelete,
  isSelectable
}: {
  content: H5PContentMeta;
  onSelect?: (c: H5PContentMeta) => void;
  onCopy: (c: H5PContentMeta) => void;
  onDelete: (id: string) => void;
  isSelectable: boolean;
}) {
  return (
    <div
      onClick={() => isSelectable && onSelect?.(content)}
      className={`p-4 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-shadow flex items-center justify-between ${
        isSelectable ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900">{content.title}</h3>
        <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
            {content.contentType}
          </span>
          <span>Usos: {content.usageCount}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onCopy(content)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <Copy className="w-5 h-5" />
        </button>
        <button
          onClick={() => onDelete(content.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
