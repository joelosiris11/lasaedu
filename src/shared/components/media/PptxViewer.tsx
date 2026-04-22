import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, List, Maximize2, Minimize2 } from 'lucide-react';
import { parsePptx, type PptxDeck, type PptxSlide } from '@shared/utils/pptxParser';

interface PptxViewerProps {
  url: string;
  name?: string;
  /** Height of the slide canvas in px. */
  height?: number;
}

function SlideCard({ slide }: { slide: PptxSlide }) {
  return (
    <div className="w-full h-full bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 overflow-auto">
      {slide.title && (
        <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">
          {slide.title}
        </h3>
      )}

      {slide.imageUrls.length > 0 && (
        <div className={`mb-4 grid gap-3 ${slide.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {slide.imageUrls.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Slide ${slide.index} image ${i + 1}`}
              className="w-full h-auto max-h-80 object-contain rounded bg-gray-50"
              loading="lazy"
            />
          ))}
        </div>
      )}

      {slide.texts.length > 0 && (
        <ul className="space-y-2 text-gray-800">
          {slide.texts.map((line, i) => (
            <li key={i} className="text-sm md:text-base leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      )}

      {!slide.title && !slide.texts.length && !slide.imageUrls.length && (
        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
          (Slide sin contenido de texto o imagenes detectable)
        </div>
      )}

      {slide.notes && (
        <details className="mt-5 pt-4 border-t border-gray-100">
          <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700">
            Notas del presentador
          </summary>
          <p className="mt-2 text-xs text-gray-600 whitespace-pre-wrap">{slide.notes}</p>
        </details>
      )}
    </div>
  );
}

export default function PptxViewer({ url, name, height = 520 }: PptxViewerProps) {
  const [deck, setDeck] = useState<PptxDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [current, setCurrent] = useState(0);
  const [showOutline, setShowOutline] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setDeck(null);
    setCurrent(0);

    parsePptx(url)
      .then(d => {
        if (cancelled) {
          d.objectUrls.forEach(URL.revokeObjectURL);
          return;
        }
        objectUrlsRef.current = d.objectUrls;
        setDeck(d);
      })
      .catch(e => {
        if (!cancelled) setError(e?.message || 'No se pudo leer el archivo PPTX');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      objectUrlsRef.current.forEach(URL.revokeObjectURL);
      objectUrlsRef.current = [];
    };
  }, [url]);

  useEffect(() => {
    if (!deck) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setCurrent(c => Math.min(deck.slides.length - 1, c + 1));
      else if (e.key === 'ArrowLeft') setCurrent(c => Math.max(0, c - 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deck]);

  const canvasHeight = expanded ? Math.min(800, window.innerHeight - 200) : height;

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-gray-50 text-gray-500"
        style={{ height }}
      >
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <p className="text-sm">Leyendo {name || 'presentacion'}...</p>
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="p-6 bg-red-50 text-sm text-red-700 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">No se pudo leer el PPTX</p>
          <p className="text-xs text-red-600 mt-1">{error || 'Archivo vacio o sin diapositivas.'}</p>
        </div>
      </div>
    );
  }

  if (!deck.slides.length) {
    return (
      <div className="p-6 bg-gray-50 text-sm text-gray-600">
        Esta presentacion no contiene diapositivas.
      </div>
    );
  }

  const slide = deck.slides[current];

  return (
    <div className="bg-gray-100">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200">
        <button
          type="button"
          onClick={() => setCurrent(c => Math.max(0, c - 1))}
          disabled={current === 0}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Slide anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-600 tabular-nums">
          {current + 1} / {deck.slides.length}
        </span>
        <button
          type="button"
          onClick={() => setCurrent(c => Math.min(deck.slides.length - 1, c + 1))}
          disabled={current === deck.slides.length - 1}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Slide siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setShowOutline(v => !v)}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${
            showOutline ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <List className="w-3.5 h-3.5" /> Indice
        </button>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 rounded hover:bg-gray-100"
        >
          {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {expanded ? 'Reducir' : 'Expandir'}
        </button>
      </div>

      <div className="flex">
        {/* Outline / thumbnails */}
        {showOutline && (
          <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 overflow-auto" style={{ maxHeight: canvasHeight }}>
            <ul className="divide-y divide-gray-100">
              {deck.slides.map((s, i) => (
                <li key={s.index}>
                  <button
                    type="button"
                    onClick={() => setCurrent(i)}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                      i === current ? 'bg-red-50 border-l-2 border-red-500' : ''
                    }`}
                  >
                    <p className="text-[10px] text-gray-400 font-mono">#{s.index}</p>
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {s.title || s.texts[0] || '(sin titulo)'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Slide canvas */}
        <div className="flex-1 p-4 overflow-auto" style={{ height: canvasHeight }}>
          <SlideCard slide={slide} />
        </div>
      </div>
    </div>
  );
}
