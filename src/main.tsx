import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from '@app/router'
import { useAuthStore } from '@app/store/authStore'

// Kick off hub-auth bootstrap before first render. Either fills the auth
// store with a hub session or redirects the browser to lasaHUB.
useAuthStore.getState().initializeAuth();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
