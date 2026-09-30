import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Route benign WebAssembly / TensorFlow Lite informational logs from stderr to console.info
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const first = typeof args[0] === 'string' ? args[0] : '';
  if (
    first.startsWith('INFO: Created TensorFlow Lite') ||
    first.includes('XNNPACK delegate')
  ) {
    console.info(...args);
    return;
  }
  originalConsoleError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(<App />);
