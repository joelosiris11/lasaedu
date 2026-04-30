import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Plus, Minus, Maximize2, Hand } from 'lucide-react';

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;

interface Props {
  children: ReactNode;
  /** Altura del viewport — cualquier valor CSS válido. */
  height?: string;
}

/**
 * PanZoom casero — sin dependencias externas. Soporta:
 *
 *  - Arrastrar para panear.
 *  - Rueda con Ctrl/⌘ → zoom.
 *  - Pinch en touchpad de Mac → zoom (el browser emite `wheel + ctrlKey`).
 *  - Pinch en touchpad de Windows con Chrome → idem.
 *  - Pinch en pantallas táctiles → zoom (TouchEvent).
 *  - Doble click → zoom in.
 *  - Scroll vertical sin Ctrl → pasa al scroll de la página normal.
 *
 * Clave: registramos el listener de `wheel` con `{ passive: false }` para
 * poder llamar `preventDefault()` y evitar el zoom de la página entera.
 * React's onWheel es passive por defecto en navegadores modernos — por eso
 * no funciona directamente con JSX.
 */
export function PanZoom({ children, height = 'min(70vh, 700px)' }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [dragging, setDragging] = useState(false);

  // ref mutable con el estado actual para los listeners no-React
  const stateRef = useRef({ scale, tx, ty });
  stateRef.current = { scale, tx, ty };

  // ── Fit to screen ──
  const fit = useCallback(() => {
    const vp = viewportRef.current;
    const content = contentRef.current;
    if (!vp || !content) return;

    // Medir sin la transform
    const prev = content.style.transform;
    content.style.transform = 'translate(0px, 0px) scale(1)';
    const cw = content.scrollWidth;
    const ch = content.scrollHeight;
    content.style.transform = prev;
    if (cw === 0 || ch === 0) return;

    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const padding = 48;
    const next = Math.min((vw - padding) / cw, (vh - padding) / ch, 1);
    const clamped = Math.max(MIN_SCALE, next);

    setScale(clamped);
    setTx((vw - cw * clamped) / 2);
    setTy((vh - ch * clamped) / 2);
  }, []);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
  }, [fit]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(vp);
    return () => ro.disconnect();
  }, [fit]);

  // ── Zoom centrado en un punto ──
  const applyZoom = useCallback((nextScale: number, centerX: number, centerY: number) => {
    const prev = stateRef.current;
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    if (clamped === prev.scale) return;
    // Mantener el punto bajo el cursor fijo en el espacio del contenido.
    const pointX = (centerX - prev.tx) / prev.scale;
    const pointY = (centerY - prev.ty) / prev.scale;
    setScale(clamped);
    setTx(centerX - pointX * clamped);
    setTy(centerY - pointY * clamped);
  }, []);

  // ── Wheel / pinch-touchpad (no-pasivo) ──
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const handleWheel = (e: WheelEvent) => {
      // Chrome/Safari/Firefox emiten wheel+ctrlKey para pinch en touchpad.
      // Windows con Ctrl+scroll también. Mac con ⌘+scroll → metaKey.
      const isZoomGesture = e.ctrlKey || e.metaKey;
      if (!isZoomGesture) return; // scroll normal sigue funcionando

      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      // Sensibilidad: pinch emite deltaY pequeños, rueda emite grandes.
      // Normalizamos a un factor exponencial.
      const factor = Math.exp(-e.deltaY * 0.01);
      applyZoom(stateRef.current.scale * factor, cx, cy);
    };
    vp.addEventListener('wheel', handleWheel, { passive: false });
    return () => vp.removeEventListener('wheel', handleWheel);
  }, [applyZoom]);

  // ── Pinch con dos dedos (pantallas táctiles) ──
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    let startDist = 0;
    let startScale = 1;
    let centerX = 0;
    let centerY = 0;

    const dist = (t1: Touch, t2: Touch) => {
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      return Math.hypot(dx, dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const rect = vp.getBoundingClientRect();
      startDist = dist(e.touches[0], e.touches[1]);
      startScale = stateRef.current.scale;
      centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || startDist === 0) return;
      e.preventDefault();
      const d = dist(e.touches[0], e.touches[1]);
      applyZoom(startScale * (d / startDist), centerX, centerY);
    };
    const handleTouchEnd = () => { startDist = 0; };

    vp.addEventListener('touchstart', handleTouchStart, { passive: true });
    vp.addEventListener('touchmove', handleTouchMove, { passive: false });
    vp.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      vp.removeEventListener('touchstart', handleTouchStart);
      vp.removeEventListener('touchmove', handleTouchMove);
      vp.removeEventListener('touchend', handleTouchEnd);
    };
  }, [applyZoom]);

  // ── Pan con drag ──
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.org-node-action, .org-node-toggle, .org-node[role="button"]')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, tx: stateRef.current.tx, ty: stateRef.current.ty };
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    setTx(dragStart.current.tx + (e.clientX - dragStart.current.x));
    setTy(dragStart.current.ty + (e.clientY - dragStart.current.y));
  }, []);

  const onPointerUp = useCallback(() => {
    dragStart.current = null;
    setDragging(false);
  }, []);

  // Doble click → zoom in sobre el punto
  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const target = e.target as HTMLElement;
    if (target.closest('.org-node, .org-node-action, .org-node-toggle')) return;
    const rect = vp.getBoundingClientRect();
    applyZoom(stateRef.current.scale * 1.5, e.clientX - rect.left, e.clientY - rect.top);
  }, [applyZoom]);

  // ── Botones ──
  const zoomBy = useCallback((factor: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    applyZoom(stateRef.current.scale * factor, vp.clientWidth / 2, vp.clientHeight / 2);
  }, [applyZoom]);

  return (
    <div
      className="relative rounded-xl border border-gray-200 bg-white overflow-hidden"
      style={{ height }}
    >
      <div
        ref={viewportRef}
        className={`absolute inset-0 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <div
          ref={contentRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transformOrigin: '0 0',
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            willChange: 'transform',
          }}
        >
          {children}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm p-1 z-10">
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.25)}
          className="h-7 w-7 inline-flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded"
          title="Alejar"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="text-[11px] text-gray-600 tabular-nums px-1 min-w-[2.5rem] text-center select-none">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => zoomBy(1.25)}
          className="h-7 w-7 inline-flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded"
          title="Acercar"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <button
          type="button"
          onClick={fit}
          className="h-7 inline-flex items-center gap-1 px-2 text-[11px] text-gray-700 hover:bg-gray-50 rounded"
          title="Ajustar a pantalla"
        >
          <Maximize2 className="h-3 w-3" />
          Fit
        </button>
      </div>

      <div className="absolute bottom-3 left-3 text-[11px] text-gray-400 inline-flex items-center gap-1 pointer-events-none select-none">
        <Hand className="h-3 w-3" />
        Arrastra · Ctrl/⌘ + rueda · pinch en touchpad
      </div>
    </div>
  );
}

export default PanZoom;
