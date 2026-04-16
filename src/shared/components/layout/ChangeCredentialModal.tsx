import { useState } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { authService } from '@modules/auth/services/authService';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';
import { KeyRound, Loader2, X } from 'lucide-react';

export function ChangeCredentialModal() {
  const { dismissChangePassword } = useAuthStore();
  const [newValue, setNewValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newValue.length < 6) {
      setError('Debe tener al menos 6 caracteres');
      return;
    }
    if (newValue !== confirm) {
      setError('Las claves no coinciden');
      return;
    }

    setSaving(true);
    try {
      await authService.changeOwnCredential(newValue);
      setSuccess(true);
      setTimeout(() => dismissChangePassword(), 1500);
    } catch (err: any) {
      console.error('Error changing credential:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('Tu sesión expiró. Cierra sesión y vuelve a entrar para cambiar tu clave.');
      } else {
        setError(err.message || 'Error al cambiar clave');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-sm w-full shadow-xl">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold">Cambiar clave</h2>
          </div>
          <button
            onClick={dismissChangePassword}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Omitir por ahora"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center py-4">
              <div className="text-green-600 font-medium">Clave actualizada correctamente</div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Por seguridad, debes cambiar tu clave de acceso temporal.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div>
                  <Label htmlFor="newCred">Nueva clave</Label>
                  <Input
                    id="newCred"
                    type="password"
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmCred">Confirmar clave</Label>
                  <Input
                    id="confirmCred"
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <Button type="submit" className="flex-1" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Cambiar
                  </Button>
                  <Button type="button" variant="outline" onClick={dismissChangePassword}>
                    Omitir
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
