import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataInit, dataClear } from '@shared/services/dataInit';

type Status = 'idle' | 'running' | 'done' | 'error';

export default function DataInitPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [clearFirst, setClearFirst] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const captureConsole = () => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const addLog = (prefix: string, args: unknown[]) => {
      const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      setLogs(prev => [...prev, `${prefix}${msg}`]);
      setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    console.log = (...args) => { originalLog(...args); addLog('', args); };
    console.warn = (...args) => { originalWarn(...args); addLog('⚠️ ', args); };
    console.error = (...args) => { originalError(...args); addLog('❌ ', args); };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  };

  const handleInit = async () => {
    setStatus('running');
    setLogs([]);
    const restore = captureConsole();

    try {
      await dataInit(clearFirst);
      setStatus('done');
    } catch (err: any) {
      console.error('Error:', err.message || err);
      setStatus('error');
    } finally {
      restore();
    }
  };

  const handleClearOnly = async () => {
    setStatus('running');
    setLogs([]);
    const restore = captureConsole();

    try {
      await dataClear();
      setStatus('done');
    } catch (err: any) {
      console.error('Error:', err.message || err);
      setStatus('error');
    } finally {
      restore();
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Data Init</h1>
        <p className="text-gray-400 mb-6">
          Inicializa la base de datos con usuarios, cursos, módulos, evaluaciones, notas y más.
        </p>

        {/* Controls */}
        {status !== 'running' && (
          <div className="flex flex-col gap-4 mb-6">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={clearFirst}
                onChange={e => setClearFirst(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800"
              />
              Borrar datos existentes antes de inicializar
            </label>

            <div className="flex gap-3">
              <button
                onClick={handleInit}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Inicializar datos
              </button>
              <button
                onClick={handleClearOnly}
                className="px-6 py-3 bg-red-600/80 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Solo borrar datos
              </button>
              {status === 'done' && (
                <button
                  onClick={() => navigate('/login')}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Ir al Login
                </button>
              )}
            </div>
          </div>
        )}

        {status === 'running' && (
          <div className="flex items-center gap-3 mb-6 text-blue-400">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="font-medium">Ejecutando...</span>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 font-mono text-sm max-h-[60vh] overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="py-0.5 whitespace-pre-wrap break-words">
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}

        {/* Credentials table */}
        {status === 'done' && logs.some(l => l.includes('completado')) && (
          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">Credenciales</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">Password</th>
                  <th className="text-left py-2">Rol</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['admin@lasaedu.com', 'password123', 'Admin'],
                  ['teacher@lasaedu.com', 'password123', 'Teacher (2 cursos)'],
                  ['teacher2@lasaedu.com', 'password123', 'Teacher (1 curso)'],
                  ['student@lasaedu.com', 'password123', 'Student'],
                  ['laura@lasaedu.com', 'password123', 'Student'],
                  ['pedro@lasaedu.com', 'password123', 'Student'],
                  ['support@lasaedu.com', 'password123', 'Support'],
                ].map(([email, pass, role]) => (
                  <tr key={email} className="border-b border-gray-800/50">
                    <td className="py-2 text-blue-400">{email}</td>
                    <td className="py-2 text-gray-500">{pass}</td>
                    <td className="py-2">{role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
