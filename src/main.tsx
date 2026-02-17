import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from '@app/router'
import { seedDatabase } from '@shared/services/seedDatabase'
import { dataInit, dataClear } from '@shared/services/dataInit'

// Exponer funciones de datos en window para desarrollo
if (import.meta.env.DEV) {
  (window as any).seedDatabase = seedDatabase;
  (window as any).dataInit = dataInit;
  (window as any).dataClear = dataClear;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
