import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider, applyThemeClass, readStoredTheme } from './lib/theme'

// Applied synchronously, before the first paint, so a returning user with
// a Black & White theme saved never sees a flash of the colorful palette.
applyThemeClass(readStoredTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)