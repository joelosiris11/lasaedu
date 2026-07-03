/**
 * Operaciones de admin sobre usuarios contra el backend self-host (JWT).
 * Reemplaza la versión vieja basada en Firebase Auth
 * (createUserWithEmailAndPassword / auth.currentUser.getIdToken), que fallaba
 * con "Debes iniciar sesión como admin" al no haber sesión de Firebase.
 * El JWT lo adjunta apiFetch automáticamente desde tokenStore.
 */
import { apiFetch } from '@shared/services/apiClient';
import { userService } from '@shared/services/dataService';
import type { DBUser } from '@shared/services/firebaseDataService';

/**
 * Admin crea un usuario (Auth + registro en la DB) desde el panel.
 * El endpoint crea lo mínimo; luego completamos perfil y el flag de
 * cambio-de-clave. Devuelve el DBUser resultante.
 */
export async function adminCreateUser(data: {
  firstName: string;
  lastName: string;
  email: string;
  role: DBUser['role'];
  phone?: string;
  address?: string;
  birthDate?: string;
  password: string;
}): Promise<DBUser> {
  const name = `${data.firstName} ${data.lastName}`.trim();
  const res = await apiFetch<{ user: { id: string } }>('/auth/admin/create-user', {
    method: 'POST',
    body: { email: data.email, name, role: data.role, password: data.password },
  });
  const id = res.user.id;
  await userService.update(id, {
    firstName: data.firstName,
    lastName: data.lastName,
    name,
    mustChangePassword: true,
    profile: {
      phone: data.phone || '',
      address: data.address || '',
      birthDate: data.birthDate || '',
    },
  } as Partial<DBUser>);
  return (await userService.getById(id)) as DBUser;
}

/**
 * Admin resetea la clave de un usuario y lo marca para cambiarla al entrar.
 * La nueva clave queda usable de inmediato (no hay ida-y-vuelta por correo).
 */
export async function adminResetPassword(
  user: DBUser,
  newPassword: string,
): Promise<{ method: 'direct' | 'email' }> {
  await apiFetch('/auth/admin/reset-password', {
    method: 'POST',
    body: { userId: user.id, email: user.email, newPassword },
  });
  return { method: 'direct' };
}
