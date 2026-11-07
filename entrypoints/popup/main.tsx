import { createRoot } from 'react-dom/client';
import '../../assets/tailwind.css';
import { initTheme } from '../../lib/theme';
import { App } from './App';

initTheme();

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
