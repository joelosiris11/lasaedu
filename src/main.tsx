import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from '@app/router'
import { seedDatabase } from '@shared/services/seedDatabase'

// Exponer seedDatabase en window para desarrollo
if (import.meta.env.DEV) {
  (window as any).seedDatabase = seedDatabase
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
