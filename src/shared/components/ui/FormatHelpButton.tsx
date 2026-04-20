import { useState } from 'react';
import { HelpCircle, X, Copy, Check } from 'lucide-react';

const PROMPT_PLACEHOLDER = '{pega aquí tu texto}';

const buildPrompt = (userText: string) => `Eres un editor de contenido educativo. Tu trabajo es reformatear el texto de abajo para que se lea claro y profesional en una plataforma de lecciones online. La salida se pegará directamente en un editor web, así que debe ser HTML listo para renderizar.

### Reglas estrictas
1. NO traduzcas. Devuelve el texto en el mismo idioma del original.
2. NO agregues, resumas, parafrasees ni elimines información. El contenido final debe decir exactamente lo mismo que el original.
3. NO inventes datos, fuentes, ejemplos ni conclusiones.
4. NO escribas introducción, disclaimers, comentarios ni "Aquí está tu texto:". Empieza directo con la primera etiqueta HTML.
5. NO envuelvas la respuesta en \`\`\`html ... \`\`\` ni en ningún bloque de código. Devuelve HTML plano.
6. NO uses Markdown (nada de \`##\`, \`**\`, \`-\`, \`>\`). Usa SOLO las etiquetas HTML listadas abajo.
7. NO uses \`style=\`, \`class=\`, \`id=\`, ni atributos decorativos. Solo etiquetas semánticas.
8. Corrige solo errores obvios de ortografía/puntuación. Deja el estilo y la voz del autor.

### Etiquetas permitidas
- \`<h2>\`, \`<h3>\` para secciones y sub-secciones (no uses \`<h1>\`, ese es el título de la lección).
- \`<p>\` para cada párrafo.
- \`<strong>\` para términos clave (máximo 2–3 por párrafo).
- \`<em>\` para énfasis suave, términos en otro idioma o nombres de obras.
- \`<ul><li>\` para listas sin orden; \`<ol><li>\` para pasos u orden.
- \`<blockquote>\` para definiciones formales o frases destacables.
- \`<code>\` para inline; \`<pre><code>\` para bloques de código.
- \`<br>\` solo si es absolutamente necesario (prefiere cerrar el \`<p>\` y abrir otro).

### Reglas de estructura
- Cada párrafo va envuelto en su propio \`<p>\`.
- Párrafos cortos (3–5 líneas). No concatenes ideas dispares.
- Usa \`<h2>\` / \`<h3>\` solo si el texto original tiene secciones claras; no inventes.
- Anida \`<strong>\` y \`<em>\` dentro de \`<p>\`, \`<li>\`, etc.

### Salida
HTML plano, sin declaraciones (\`<!DOCTYPE>\`), sin \`<html>\`, sin \`<body>\`. Solo las etiquetas del contenido, una detrás de otra.

### Texto a formatear
"""
${userText.trim() || PROMPT_PLACEHOLDER}
"""`;

type CopyState = 'idle' | 'copied' | 'error';

async function copyToClipboard(text: string): Promise<boolean> {
  // Primary: Clipboard API (requires secure context)
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to fallback */
    }
  }
  // Fallback: hidden textarea + execCommand
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function FormatHelpButton() {
  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [userText, setUserText] = useState('');

  const finalPrompt = buildPrompt(userText);

  const copyPrompt = async () => {
    const ok = await copyToClipboard(finalPrompt);
    setCopyState(ok ? 'copied' : 'error');
    setTimeout(() => setCopyState('idle'), 2000);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Cómo dar formato al texto"
        className="p-2 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Cómo dar formato al texto</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto flex-1 space-y-5 text-sm text-gray-700">
              <section>
                <h4 className="font-semibold text-gray-900 mb-2">Atajos de Markdown</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Row syntax="# Título" desc="Título grande (H1)" />
                  <Row syntax="## Subtítulo" desc="Sección (H2)" />
                  <Row syntax="### Sub-sección" desc="Sub-sección (H3)" />
                  <Row syntax="**texto**" desc="Negrita" />
                  <Row syntax="*texto*" desc="Cursiva" />
                  <Row syntax="~~texto~~" desc="Tachado" />
                  <Row syntax="- ítem" desc="Lista con viñetas" />
                  <Row syntax="1. ítem" desc="Lista numerada" />
                  <Row syntax="> cita" desc="Bloque de cita" />
                  <Row syntax="[texto](url)" desc="Enlace" />
                  <Row syntax="![alt](url)" desc="Imagen por URL" />
                  <Row syntax="`código`" desc="Código inline" />
                </div>
              </section>

              <section>
                <h4 className="font-semibold text-gray-900 mb-2">Tips para una lección clara</h4>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>Empieza con un H2 que resuma el objetivo.</li>
                  <li>Divide en secciones cortas — cada idea, un párrafo.</li>
                  <li>Usa negrita solo para términos clave (no para oraciones enteras).</li>
                  <li>Las listas se leen mejor que los párrafos largos.</li>
                  <li>Agrega citas para destacar definiciones importantes.</li>
                </ul>
              </section>

              <section>
                <h4 className="font-semibold text-gray-900 mb-2">Prompt para cualquier IA</h4>
                <p className="text-xs text-gray-500 mb-2">
                  Pega tu texto aquí abajo y al copiar, el prompt llevará tu texto ya incluido. Si lo dejas vacío, copia el prompt con un marcador para que pegues el texto a mano.
                </p>
                <textarea
                  value={userText}
                  onChange={(e) => setUserText(e.target.value)}
                  placeholder="Pega aquí tu texto..."
                  className="w-full min-h-[120px] p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y mb-3"
                />
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">
                    {userText.trim()
                      ? `Se copiará el prompt con tu texto (${userText.trim().length} caracteres).`
                      : 'Se copiará el prompt con el marcador de texto.'}
                  </span>
                  <button
                    type="button"
                    onClick={copyPrompt}
                    className={`flex items-center gap-1 text-xs font-medium ${
                      copyState === 'error'
                        ? 'text-red-600 hover:text-red-800'
                        : 'text-blue-600 hover:text-blue-800'
                    }`}
                  >
                    {copyState === 'copied' ? (
                      <><Check className="h-3.5 w-3.5" /> Copiado</>
                    ) : copyState === 'error' ? (
                      <><Copy className="h-3.5 w-3.5" /> No se pudo copiar — selecciona manualmente</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5" /> Copiar prompt</>
                    )}
                  </button>
                </div>
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer hover:text-gray-700">Ver prompt completo</summary>
                  <pre className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto">
                    {finalPrompt}
                  </pre>
                </details>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ syntax, desc }: { syntax: string; desc: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs font-mono whitespace-nowrap">{syntax}</code>
      <span className="text-xs text-gray-600">{desc}</span>
    </div>
  );
}
