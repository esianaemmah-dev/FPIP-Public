import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/chat.css';
import './styles/overlay.css';
import './styles/studio.css';
import './styles/admin.css';
import './styles/platform.css';
import './styles/polish.css';
import './styles/discovery.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found.');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
