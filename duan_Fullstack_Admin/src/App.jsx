import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import AdminRoutes from './routes/AdminRoutes';

function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <AdminRoutes />
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

export default App;
