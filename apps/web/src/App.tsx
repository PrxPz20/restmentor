import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login/LoginPage';
import TablesPage from './pages/Tables/TablesPage';
import TableConfigPage from './pages/TableConfig/TableConfigPage';
import OrderPage from './pages/Order/OrderPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('accessToken');
  if (!token) return <Navigate to="/login" replace />;
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
        <Route path="/" element={<Navigate to="/tables" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
