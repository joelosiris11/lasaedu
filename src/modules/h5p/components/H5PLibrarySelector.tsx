/**
 * H5PLibrarySelector
 * Modal/Dropdown para seleccionar contenido H5P de la biblioteca
 */

import React, { useState, useEffect } from 'react';
import { Search, Plus, BookOpen, Grid, List } from 'lucide-react';
import type { H5PContentMeta } from '@shared/types';

interface H5PLibrarySelectorProps {
  isOpen: boolean;
  onSelect: (contentId: string, content: H5PContentMeta) => void;
  onClose: () => void;
  onUpload?: () => void;
  contentType?: string;
}

export const H5PLibrarySelector: React.FC<H5PLibrarySelectorProps> = ({
  isOpen,
  onSelect,
  onClose,
  onUpload,
  contentType
}) => {
  const [search, setSearch] = useState('');
  const [contents, setContents] = useState<H5PContentMeta[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'reusable'>('reusable');

  useEffect(() => {
    if (isOpen) {
      loadContents();
    }
  }, [isOpen, selectedFilter]);

  const loadContents = async () => {
    setLoading(true);
    try {
      // TODO: Cargar desde h5pContentService basado en filter
      // const data = selectedFilter === 'reusable' 
      //   ? await h5pContentService.getReusableContents()
      //   : await h5pContentService.getAllContent();
      // setContents(data);
    } catch (error) {
      console.error('Error cargando contenidos H5P:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContents = contents.filter(content => {
    const matchesSearch = search === '' ||
      content.title.toLowerCase().includes(search.toLowerCase()) ||
      (content.description || '').toLowerCase().includes(search.toLowerCase());

    const matchesType = !contentType || content.contentType === contentType;

    return matchesSearch && matchesType;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Seleccionar Contenido H5P</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className="border-b p-4 space-y-4">
          <div className="flex gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por título o descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* View Toggle */}
            <div className="flex gap-2 border rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedFilter('reusable')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedFilter === 'reusable'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Reutilizable
            </button>
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            {onUpload && (
              <button
                onClick={onUpload}
                className="ml-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Subir Nuevo
              </button>
            )}
          </div>
        </div>

        {/* Content Grid/List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-gray-500">Cargando contenidos...</div>
            </div>
          ) : filteredContents.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-full text-gray-500">
              <BookOpen className="w-12 h-12 mb-4 opacity-50" />
              <p>No se encontraron contenidos H5P</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContents.map((content) => (
                <div
                  key={content.id}
                  className="border rounded-lg p-4 hover:shadow-lg transition cursor-pointer"
                  onClick={() => onSelect(content.id, content)}
                >
                  {content.previewImageUrl && (
                    <img
                      src={content.previewImageUrl}
                      alt={content.title}
                      className="w-full h-32 object-cover rounded mb-3"
                    />
                  )}
                  <h3 className="font-semibold text-gray-900 mb-2">{content.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{content.description}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {content.tags?.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500">
                    {content.contentType} • {content.usageCount} usos
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredContents.map((content) => (
                <div
                  key={content.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => onSelect(content.id, content)}
                >
                  <div className="flex gap-4">
                    {content.previewImageUrl && (
                      <img
                        src={content.previewImageUrl}
                        alt={content.title}
                        className="w-24 h-24 object-cover rounded flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{content.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{content.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{content.contentType}</span>
                        <span>{content.usageCount} usos</span>
                        <span>{Math.round(content.fileSize / 1024)} KB</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
