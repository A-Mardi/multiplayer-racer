import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/space-grotesk/500.css';
import './base.css';
import './app.css';
createRoot(document.getElementById('root')!).render(<App />);
