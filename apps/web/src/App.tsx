// apps/web/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login/LoginPage';
import TablesPage from './pages/Tables/TablesPage';
import TableConfigPage from './pages/TableConfig/TableConfigPage';
import OrderPage from './pages/Order/OrderPage';
import ConfirmationPage from './pages/Confirmation/ConfirmationPage';
import CleaningPage from './pages/Cleaning/CleaningPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/tables" element={<ProtectedRoute><TablesPage /></ProtectedRoute>} />
        <Route path="/tables/:id/configure" element={<ProtectedRoute><TableConfigPage /></ProtectedRoute>} />
        <Route path="/sessions/:sessionId/order" element={<ProtectedRoute><OrderPage /></ProtectedRoute>} />
        <Route path="/sessions/:sessionId/confirmed" element={<ProtectedRoute><ConfirmationPage /></ProtectedRoute>} />
        <Route path="/tables/:tableId/cleaning" element={<ProtectedRoute><CleaningPage /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/tables" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
