import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { YBProvider, zhCN } from '@chenyibo111/ui';
import { AppRouter } from './app/router.js';
import '@chenyibo111/tokens/styles.css';
import '@chenyibo111/ui/styles.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <YBProvider locale={zhCN}>
      <AppRouter />
    </YBProvider>
  </StrictMode>,
);
