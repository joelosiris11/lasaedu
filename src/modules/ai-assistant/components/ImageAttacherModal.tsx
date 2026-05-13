import { useEffect, useState } from 'react';
import {
  X as XIcon,
  Search,
  Sparkles,
  Loader2,
  ImageIcon,
  Check,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { searchStockImages } from '../services/unsplash';
import { generateImageWithGemini } from '../services/gemini';
import type { AttachedImage, StockImage } from '../types';

type Tab = 'unsplash' | 'gemini';
type AspectRatio = '1:1' | '4:3' | '16:9' | '3:4' | '9:16';

interface Props {
  open: boolean;
  onClose: () => void;
  onAttach: (image: AttachedImage) => void;
}

// Picker the admin opens from the chat composer to attach a specific image to
// the next message. Two flows: search Unsplash (real photos, free) or generate
// with Gemini Flash (custom illustration). Whichever they pick is added to the
// message envelope so the AI is forced to reuse that exact URL.
export default function ImageAttacherModal({ open, onClose, onAttach }: Props) {
  const [tab, setTab] = useState<Tab>('unsplash');

  // Unsplash state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockImage[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<StockImage | null>(null);

  // Gemini state
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<AspectRatio>('16:9');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ url: string; prompt: string } | null>(null);

  // Reset transient state every time the modal opens so the admin doesn't see
  // stale results from a previous session.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    setSearching(false);
    setSearchError(null);
    setSelectedStock(null);
    setPrompt('');
    setAspect('16:9');
    setGenerating(false);
    setGenError(null);
    setGenerated(null);
    setTab('unsplash');
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setSelectedStock(null);
    try {
      const list = await searchStockImages({ query: q, perPage: 9 });
      setResults(list);
      if (list.length === 0) setSearchError('Sin resultados para esa búsqueda.');
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  };

  const runGenerate = async () => {
    const p = prompt.trim();
    if (!p) return;
    setGenerating(true);
    setGenError(null);
    setGenerated(null);
    try {
      const out = await generateImageWithGemini({ prompt: p, aspectRatio: aspect });
      setGenerated({ url: out.url, prompt: out.prompt });
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const attachStock = () => {
    if (!selectedStock) return;
    onAttach({
      url: selectedStock.url,
      source: 'unsplash',
      description: selectedStock.description,
      author: selectedStock.author,
      authorUrl: selectedStock.authorUrl,
    });
    onClose();
  };

  const attachGenerated = () => {
    if (!generated) return;
    onAttach({
      url: generated.url,
      source: 'gemini',
      description: generated.prompt,
      prompt: generated.prompt,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-red-600" />
            <h2 className="text-sm font-semibold text-gray-900">
              Adjuntar imagen al mensaje
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            aria-label="Cerrar"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-gray-200">
          <TabButton
            active={tab === 'unsplash'}
            onClick={() => setTab('unsplash')}
            icon={<Search className="h-4 w-4" />}
            label="Buscar en Unsplash"
          />
          <TabButton
            active={tab === 'gemini'}
            onClick={() => setTab('gemini')}
            icon={<Sparkles className="h-4 w-4" />}
            label="Generar con Gemini Flash"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'unsplash' ? (
            <UnsplashTab
              query={query}
              setQuery={setQuery}
              onSearch={runSearch}
              searching={searching}
              error={searchError}
              results={results}
              selected={selectedStock}
              onSelect={setSelectedStock}
            />
          ) : (
            <GeminiTab
              prompt={prompt}
              setPrompt={setPrompt}
              aspect={aspect}
              setAspect={setAspect}
              onGenerate={runGenerate}
              generating={generating}
              error={genError}
              generated={generated}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          <div className="text-[11px] text-gray-500">
            La URL se enviará al modelo y la imagen aparecerá pegada a tu mensaje.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
            {tab === 'unsplash' ? (
              <Button
                type="button"
                onClick={attachStock}
                disabled={!selectedStock}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adjuntar imagen
              </Button>
            ) : (
              <Button
                type="button"
                onClick={attachGenerated}
                disabled={!generated}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adjuntar imagen
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-red-600 text-red-700 bg-red-50/40'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

interface UnsplashTabProps {
  query: string;
  setQuery: (v: string) => void;
  onSearch: () => void;
  searching: boolean;
  error: string | null;
  results: StockImage[];
  selected: StockImage | null;
  onSelect: (img: StockImage) => void;
}

function UnsplashTab({
  query,
  setQuery,
  onSearch,
  searching,
  error,
  results,
  selected,
  onSelect,
}: UnsplashTabProps) {
  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ej. classroom, mathematics, business meeting…"
          className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          autoFocus
        />
        <Button
          type="submit"
          disabled={!query.trim() || searching}
          className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
        >
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </form>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {results.map((img) => {
            const isSelected = selected?.url === img.url;
            return (
              <button
                key={img.url}
                type="button"
                onClick={() => onSelect(img)}
                className={`group relative overflow-hidden rounded-md border-2 transition ${
                  isSelected
                    ? 'border-red-500 ring-2 ring-red-500/30'
                    : 'border-transparent hover:border-red-300'
                }`}
              >
                <img
                  src={img.thumbUrl}
                  alt={img.description || 'Imagen Unsplash'}
                  className="h-32 w-full object-cover"
                  loading="lazy"
                />
                {isSelected && (
                  <div className="absolute right-1 top-1 rounded-full bg-red-600 text-white p-0.5 shadow">
                    <Check className="h-3 w-3" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-[10px] text-white truncate">
                  © {img.author}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        !searching && (
          <div className="rounded-md border border-dashed border-gray-200 p-6 text-center text-xs text-gray-500">
            Escribe algo y presiona buscar para ver fotos libres de Unsplash.
          </div>
        )
      )}
    </div>
  );
}

interface GeminiTabProps {
  prompt: string;
  setPrompt: (v: string) => void;
  aspect: AspectRatio;
  setAspect: (v: AspectRatio) => void;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
  generated: { url: string; prompt: string } | null;
}

function GeminiTab({
  prompt,
  setPrompt,
  aspect,
  setAspect,
  onGenerate,
  generating,
  error,
  generated,
}: GeminiTabProps) {
  const ratios: AspectRatio[] = ['16:9', '4:3', '1:1', '3:4', '9:16'];
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Prompt para Gemini Flash
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Describe la imagen que quieres. Mejor en inglés: estilo, sujeto, ambiente, composición."
          className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          autoFocus
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-700">Aspecto:</label>
        {ratios.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setAspect(r)}
            className={`px-2.5 py-1 rounded-md border text-[11px] font-medium ${
              aspect === r
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-red-300'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div>
        <Button
          type="button"
          onClick={onGenerate}
          disabled={!prompt.trim() || generating}
          className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              Generando…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Generar imagen
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {generated && (
        <div className="rounded-md border-2 border-red-500 ring-2 ring-red-500/30 overflow-hidden">
          <img src={generated.url} alt={generated.prompt} className="w-full" />
          <div className="bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
            Generada · "{generated.prompt}"
          </div>
        </div>
      )}
    </div>
  );
}
