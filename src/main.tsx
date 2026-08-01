import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers/AppProviders';
import App from './app/App';
import './index.css';

async function bootstrap() {
  if (import.meta.env.MODE === 'e2e') {
    const { installTauriBrowserMocks } =
      await import('./test/e2e/tauri-browser-mocks');
    installTauriBrowserMocks();
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  );
}

void bootstrap();
