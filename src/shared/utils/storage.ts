const PREFIX = 'lasaedu_';

export const storage = {
  getToken: () => localStorage.getItem(`${PREFIX}token`),
  setToken: (token: string) => localStorage.setItem(`${PREFIX}token`, token),
  removeToken: () => localStorage.removeItem(`${PREFIX}token`),
  
  getRefreshToken: () => localStorage.getItem(`${PREFIX}refresh_token`),
  setRefreshToken: (token: string) => localStorage.setItem(`${PREFIX}refresh_token`, token),
  removeRefreshToken: () => localStorage.removeItem(`${PREFIX}refresh_token`),

  getUser: () => {
    const user = localStorage.getItem(`${PREFIX}user`);
    return user ? JSON.parse(user) : null;
  },
  setUser: (user: any) => localStorage.setItem(`${PREFIX}user`, JSON.stringify(user)),
  removeUser: () => localStorage.removeItem(`${PREFIX}user`),
  
  clear: () => {
    localStorage.removeItem(`${PREFIX}token`);
    localStorage.removeItem(`${PREFIX}refresh_token`);
    localStorage.removeItem(`${PREFIX}user`);
  }
};
