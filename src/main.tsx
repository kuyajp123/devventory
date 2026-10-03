import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AppProviders } from './app/providers/AppProviders';
import App from './app/App';
import { QuickAccessApp } from './features/quick-access';
import { StandaloneMarkdownReaderApp } from './features/markdown-reader';
import { setupContextMenuPrevention } from './app/utils/context-menu';
import './index.css';

async function bootstrap() {
  setupContextMenuPrevention();

  if (import.meta.env.MODE === 'e2e') {
    const { installTauriBrowserMocks } =
      await import('./test/e2e/tauri-browser-mocks');
    installTauriBrowserMocks();
  }

  const windowLabel = getCurrentWindow().label;

  if (windowLabel === 'quick-panel') {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <QuickAccessApp />
      </StrictMode>,
    );
  } else if (windowLabel === 'markdown-reader') {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <StandaloneMarkdownReaderApp />
      </StrictMode>,
    );
  } else {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AppProviders>
          <App />
        </AppProviders>
      </StrictMode>,
    );
  }
}

void bootstrap();
