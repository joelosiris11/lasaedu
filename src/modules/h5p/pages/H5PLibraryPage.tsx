/**
 * H5P Library Page
 * Página dedicada para explorar y gestionar la biblioteca de contenidos H5P
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Search, Grid, List, Download, Copy, Share2, Trash2, Star, 
  BookOpen, ArrowLeft, Filter, Plus 
} from 'lucide-react';
import type { H5PContentMeta } from '@shared/types';


export const H5PLibraryPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [contents, setContents] = useState<H5PContentMeta[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'reusable' | 'recent'>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'name'>('newest');
  const [loading, setLoading] = useState(false);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);

  useEffect(() => {
    loadContents();
  }, [selectedFilter, sortBy]);

  const loadContents = async () => {
    setLoading(true);
    try {
      // TODO: Cargar desde h5pContentService
      // const data = await h5pContentService.getAllContent();
      // setContents(data);
    } catch (error) {
      console.error('Error cargando contenidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContents = contents
    .filter(content => {
      const matchesSearch = search === '' ||
        content.title.toLowerCase().includes(search.toLowerCase()) ||
        (content.description || '').toLowerCase().includes(search.toLowerCase());

      const matchesFilter = 
        selectedFilter === 'all' ||
        (selectedFilter === 'reusable' && content.isPublished) ||
        (selectedFilter === 'recent' && Date.now() - content.updatedAt < 7 * 24 * 60 * 60 * 1000);

      const matchesType = !contentTypeFilter || content.contentType === contentTypeFilter;

      return matchesSearch && matchesFilter && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return b.createdAt - a.createdAt;
      if (sortBy === 'popular') return (b.usageCount || 0) - (a.usageCount || 0);
      return a.title.localeCompare(b.title);
    });

  const handleCopy = async (contentId: string) => {
    try {
      // TODO: Usar h5pContentService.copyContent(contentId, courseId!)
      alert('Contenido copiado a este curso');
      loadContents();
    } catch (error) {
      console.error('Error copiando contenido:', error);
      alert('Error al copiar contenido');
    }
  };

  const handleDelete = async (contentId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este contenido?')) return;

    try {
      // TODO: Usar h5pContentService.deleteContent(contentId)
      alert('Contenido eliminado');
      loadContents();
    } catch (error) {
      console.error('Error eliminando contenido:', error);
      alert('Error al eliminar contenido');
    }
  };

  const uniqueContentTypes = Array.from(
    new Set(contents.map(c => c.contentType))
  ).sort();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate(`/course/${courseId}/lessons`)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Biblioteca H5P</h1>
              <p className="text-gray-600">Explora y gestiona contenidos interactivos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar Filters */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg p-4 sticky top-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtros
              </h3>

              {/* Filter by Category */}
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-700 block mb-3">
                  Categoría
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedFilter('all')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition ${
                      selectedFilter === 'all'
                        ? 'bg-blue-100 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setSelectedFilter('reusable')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition ${
                      selectedFilter === 'reusable'
                        ? 'bg-blue-100 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Reutilizable
                  </button>
                  <button
                    onClick={() => setSelectedFilter('recent')}
                    className={`w-full text-left px-3 py-2 rounded-lg transition ${
                      selectedFilter === 'recent'
                        ? 'bg-blue-100 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Reciente
                  </button>
                </div>
              </div>

              {/* Filter by Type */}
              {uniqueContentTypes.length > 0 && (
                <div className="mb-6">
                  <label className="text-sm font-medium text-gray-700 block mb-3">
                    Tipo de Contenido
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    <button
                      onClick={() => setContentTypeFilter('')}
                      className={`w-full text-left px-3 py-2 rounded-lg transition text-sm ${
                        contentTypeFilter === ''
                          ? 'bg-blue-100 text-blue-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Todos
                    </button>
                    {uniqueContentTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => setContentTypeFilter(type)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition text-sm ${
                          contentTypeFilter === type
                            ? 'bg-blue-100 text-blue-600 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sort */}
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-700 block mb-3">
                  Ordenar por
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="newest">Más reciente</option>
                  <option value="popular">Más popular</option>
                  <option value="name">Nombre (A-Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Area */}
          <div className="flex-1">
            {/* Search and View Toggle */}
            <div className="mb-6 flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar contenido..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

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

              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Subir Contenido
              </button>
            </div>

            {/* Content Grid/List */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="text-gray-500">Cargando contenidos...</div>
              </div>
            ) : filteredContents.length === 0 ? (
              <div className="bg-white rounded-lg p-12 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-4">No se encontraron contenidos H5P</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContents.map((content) => (
                  <div
                    key={content.id}
                    className="bg-white rounded-lg overflow-hidden hover:shadow-lg transition"
                  >
                    {content.previewImageUrl && (
                      <img
                        src={content.previewImageUrl}
                        alt={content.title}
                        className="w-full h-32 object-cover"
                      />
                    )}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">{content.title}</h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{content.description}</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {content.tags?.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 mb-3">
                        {content.contentType} • {content.usageCount} usos
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopy(content.id)}
                          className="flex-1 px-2 py-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 flex items-center justify-center gap-1 text-sm"
                        >
                          <Copy className="w-4 h-4" />
                          Copiar
                        </button>
                        <button
                          onClick={() => handleDelete(content.id)}
                          className="px-2 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredContents.map((content) => (
                  <div
                    key={content.id}
                    className="bg-white rounded-lg p-4 flex items-center justify-between hover:shadow transition"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{content.title}</h3>
                      <p className="text-sm text-gray-600">{content.description}</p>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-sm text-gray-500">
                        {content.contentType} • {content.usageCount} usos
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopy(content.id)}
                          className="px-3 py-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(content.id)}
                          className="px-3 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
