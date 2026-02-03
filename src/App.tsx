import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import './App.css';

import { LanguageProvider } from './contexts/LanguageContext';

function App() {
  return (
    <LanguageProvider>
      {/* Explicitly set basename for production to '/taxi/' to match deployment URL */}
      <BrowserRouter basename={import.meta.env.PROD ? '/taxi/' : '/'}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/map" element={<MapPage />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
