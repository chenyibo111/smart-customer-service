import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main>
      <h1>智客服</h1>
      <p>智能客服服务正在启动。</p>
    </main>
  </StrictMode>,
);
