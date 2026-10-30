import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import { setupPWAAutoUpdate } from './pwa';
import './index.css';

// Automatically detect new builds, claim clients, and reload with fresh bundle
setupPWAAutoUpdate();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
