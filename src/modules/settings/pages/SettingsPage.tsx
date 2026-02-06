import { useState } from 'react';
import { useAuthStore } from '@app/store/authStore';
import { userService } from '@shared/services/dataService';
// import { firebaseDB } from '@shared/services/firebaseDataService';
import { 
  User,
  Lock,
  Bell,
  Palette,
  Shield,
  Save,
  Camera,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Eye,
  EyeOff,
  Check,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Label } from '@shared/components/ui/Label';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  bio?: string;
  avatar?: string;
  birthDate?: string;
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    marketing: boolean;
  };
  privacy: {
    showProfile: boolean;
    showProgress: boolean;
    showActivity: boolean;
  };
}

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'preferences'>('profile');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Profile form state
  const [profile, setProfile] = useState<UserProfile>({
    id: user?.id || '',
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    location: '',
    bio: '',
    avatar: user?.profile?.avatar || '',
    birthDate: '',
    language: 'es',
    timezone: 'America/Mexico_City',
    notifications: {
      email: true,
      push: true,
      sms: false,
      marketing: false
    },
    privacy: {
      showProfile: true,
      showProgress: true,
      showActivity: false
    }
  });

  // Security form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      // Update user in Firebase
      if (user?.id) {
        await userService.update(user.id, {
          name: profile.name,
          email: profile.email,
          profile: {
            phone: profile.phone,
            location: profile.location,
            bio: profile.bio,
            avatar: profile.avatar,
            birthDate: profile.birthDate
          }
        } as any);

        // Update auth store
        setUser({
          ...user,
          name: profile.name,
          email: profile.email,
          profile: {
            ...user.profile,
            avatar: profile.avatar,
            bio: profile.bio
          }
        });
      }

      showMessage('success', 'Perfil actualizado correctamente');
    } catch (error) {
      showMessage('error', 'Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('error', 'Las contraseñas no coinciden');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      showMessage('error', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setSaving(true);
    try {
      // Note: In Firebase Auth, password change should use updatePassword from firebase/auth
      // This is a placeholder - real implementation would use Firebase Auth
      showMessage('success', 'Para cambiar la contraseña, use la opción "Olvidé mi contraseña" en el login');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      showMessage('error', 'Error al cambiar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  const saveNotifications = async () => {
    setSaving(true);
    try {
      // Save notification preferences to Firebase
      if (user?.id) {
        await userService.update(user.id, {
          preferences: {
            notifications: profile.notifications
          }
        } as any);
      }
      showMessage('success', 'Preferencias de notificación guardadas');
    } catch (error) {
      showMessage('error', 'Error al guardar las preferencias');
    } finally {
      setSaving(false);
    }
  };

  const savePrivacy = async () => {
    setSaving(true);
    try {
      // Save privacy preferences to Firebase
      if (user?.id) {
        await userService.update(user.id, {
          preferences: {
            privacy: profile.privacy
          }
        } as any);
      }
      showMessage('success', 'Preferencias de privacidad guardadas');
    } catch (error) {
      showMessage('error', 'Error al guardar las preferencias');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Perfil', icon: User },
    { id: 'security' as const, label: 'Seguridad', icon: Lock },
    { id: 'notifications' as const, label: 'Notificaciones', icon: Bell },
    { id: 'preferences' as const, label: 'Preferencias', icon: Palette }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-600">Administra tu cuenta y preferencias</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <Check className="h-5 w-5 mr-2" />
          ) : (
            <AlertCircle className="h-5 w-5 mr-2" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        activeTab === tab.id
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-5 w-5 mr-3" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="md:col-span-3">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-6">Información del Perfil</h2>
                
                {/* Avatar */}
                <div className="flex items-center space-x-6 mb-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                      {profile.avatar ? (
                        <img src={profile.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        profile.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg border hover:bg-gray-50">
                      <Camera className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                  <div>
                    <h3 className="font-medium">{profile.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
                    <p className="text-xs text-gray-400">Miembro desde {new Date().getFullYear()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nombre completo</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        value={profile.name}
                        onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                        className="pl-10"
                        placeholder="Tu nombre"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Correo electrónico</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="email"
                        value={profile.email}
                        onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                        className="pl-10"
                        placeholder="tu@email.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Teléfono</Label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        value={profile.phone}
                        onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                        className="pl-10"
                        placeholder="+52 123 456 7890"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Ubicación</Label>
                    <div className="relative mt-1">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        value={profile.location}
                        onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
                        className="pl-10"
                        placeholder="Ciudad, País"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Fecha de nacimiento</Label>
                    <div className="relative mt-1">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="date"
                        value={profile.birthDate}
                        onChange={e => setProfile(p => ({ ...p, birthDate: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label>Biografía</Label>
                    <textarea
                      value={profile.bio}
                      onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows={3}
                      placeholder="Cuéntanos sobre ti..."
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button onClick={saveProfile} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-6">Seguridad de la Cuenta</h2>
                
                <div className="space-y-6">
                  {/* Change Password */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-4 flex items-center">
                      <Lock className="h-5 w-5 mr-2 text-gray-400" />
                      Cambiar Contraseña
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <Label>Contraseña actual</Label>
                        <div className="relative mt-1">
                          <Input
                            type={showPasswords.current ? 'text' : 'password'}
                            value={passwordForm.currentPassword}
                            onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(s => ({ ...s, current: !s.current }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <Label>Nueva contraseña</Label>
                        <div className="relative mt-1">
                          <Input
                            type={showPasswords.new ? 'text' : 'password'}
                            value={passwordForm.newPassword}
                            onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(s => ({ ...s, new: !s.new }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Mínimo 8 caracteres</p>
                      </div>
                      
                      <div>
                        <Label>Confirmar nueva contraseña</Label>
                        <div className="relative mt-1">
                          <Input
                            type={showPasswords.confirm ? 'text' : 'password'}
                            value={passwordForm.confirmPassword}
                            onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      
                      <Button onClick={changePassword} disabled={saving}>
                        {saving ? 'Actualizando...' : 'Actualizar Contraseña'}
                      </Button>
                    </div>
                  </div>

                  {/* Two Factor Auth */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium flex items-center">
                          <Shield className="h-5 w-5 mr-2 text-gray-400" />
                          Autenticación de dos factores
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Añade una capa extra de seguridad a tu cuenta
                        </p>
                      </div>
                      <Button variant="outline" disabled>
                        Configurar 2FA
                      </Button>
                    </div>
                  </div>

                  {/* Active Sessions */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-4">Sesiones Activas</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium text-sm">Este dispositivo</p>
                          <p className="text-xs text-gray-500">Chrome en macOS • Última actividad: Ahora</p>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Actual</span>
                      </div>
                    </div>
                    <Button variant="outline" className="mt-4 text-red-600 hover:text-red-700">
                      Cerrar todas las otras sesiones
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-6">Preferencias de Notificación</h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">Notificaciones por Email</p>
                      <p className="text-sm text-gray-500">Recibe actualizaciones en tu correo</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.notifications.email}
                        onChange={e => setProfile(p => ({
                          ...p,
                          notifications: { ...p.notifications, email: e.target.checked }
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">Notificaciones Push</p>
                      <p className="text-sm text-gray-500">Notificaciones en el navegador</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.notifications.push}
                        onChange={e => setProfile(p => ({
                          ...p,
                          notifications: { ...p.notifications, push: e.target.checked }
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">Notificaciones SMS</p>
                      <p className="text-sm text-gray-500">Mensajes de texto para alertas importantes</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.notifications.sms}
                        onChange={e => setProfile(p => ({
                          ...p,
                          notifications: { ...p.notifications, sms: e.target.checked }
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">Emails de Marketing</p>
                      <p className="text-sm text-gray-500">Novedades, ofertas y promociones</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.notifications.marketing}
                        onChange={e => setProfile(p => ({
                          ...p,
                          notifications: { ...p.notifications, marketing: e.target.checked }
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button onClick={saveNotifications} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Guardando...' : 'Guardar Preferencias'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-6">Preferencias de la Cuenta</h2>
                
                <div className="space-y-6">
                  {/* Language & Region */}
                  <div>
                    <h3 className="font-medium mb-4">Idioma y Región</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Idioma</Label>
                        <select
                          value={profile.language}
                          onChange={e => setProfile(p => ({ ...p, language: e.target.value }))}
                          className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="es">Español</option>
                          <option value="en">English</option>
                          <option value="pt">Português</option>
                        </select>
                      </div>
                      <div>
                        <Label>Zona horaria</Label>
                        <select
                          value={profile.timezone}
                          onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))}
                          className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
                          <option value="America/Bogota">Bogotá (GMT-5)</option>
                          <option value="America/Lima">Lima (GMT-5)</option>
                          <option value="America/Buenos_Aires">Buenos Aires (GMT-3)</option>
                          <option value="Europe/Madrid">Madrid (GMT+1)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Privacy */}
                  <div>
                    <h3 className="font-medium mb-4">Privacidad</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-3 border-b">
                        <div>
                          <p className="font-medium">Mostrar perfil público</p>
                          <p className="text-sm text-gray-500">Otros usuarios pueden ver tu perfil</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profile.privacy.showProfile}
                            onChange={e => setProfile(p => ({
                              ...p,
                              privacy: { ...p.privacy, showProfile: e.target.checked }
                            }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between py-3 border-b">
                        <div>
                          <p className="font-medium">Mostrar progreso en cursos</p>
                          <p className="text-sm text-gray-500">Tu progreso visible en el leaderboard</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profile.privacy.showProgress}
                            onChange={e => setProfile(p => ({
                              ...p,
                              privacy: { ...p.privacy, showProgress: e.target.checked }
                            }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between py-3">
                        <div>
                          <p className="font-medium">Mostrar actividad reciente</p>
                          <p className="text-sm text-gray-500">Otros pueden ver tu actividad</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profile.privacy.showActivity}
                            onChange={e => setProfile(p => ({
                              ...p,
                              privacy: { ...p.privacy, showActivity: e.target.checked }
                            }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <h3 className="font-medium text-red-800 mb-2">Zona de Peligro</h3>
                    <p className="text-sm text-red-600 mb-4">
                      Estas acciones son irreversibles. Procede con cuidado.
                    </p>
                    <div className="flex space-x-3">
                      <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-100">
                        Desactivar cuenta
                      </Button>
                      <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-100">
                        Eliminar cuenta
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button onClick={savePrivacy} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Guardando...' : 'Guardar Preferencias'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
