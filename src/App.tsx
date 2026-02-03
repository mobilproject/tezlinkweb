import { HashRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import './App.css';

import { LanguageProvider } from './contexts/LanguageContext';

function App() {
  return (
    <LanguageProvider>
      {/* Check deploy.yml: HashRouter is safer for shared hosting/FTP to prevent 404s on refresh */}
      <HashRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/map" element={<MapPage />} />
        </Routes>
      </HashRouter>
    </LanguageProvider>
  );
}

export default App;
