import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ChainProvider } from './context/ChainContext';
import Landing from './pages/Landing';
import Integrate from './pages/integrate/Integrate';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"         element={<Landing />} />
      <Route path="/integrate" element={<Integrate />} />
      <Route path="*"         element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ChainProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ChainProvider>
    </ThemeProvider>
  );
}
