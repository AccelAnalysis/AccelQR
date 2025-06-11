import { ChakraProvider, Box, Container } from '@chakra-ui/react';
import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import QRCodeGenerator from './pages/QRCodeGenerator';
import QRCodeDetail from './pages/QRCodeDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

function AppContent() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = 'AccelQR - Dynamic QR Code Tracker';
  }, []);

  return (
    <Box minH="100vh" bg="gray.50">
      <Navbar />
      <Container maxW="container.xl" py={8}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
          
          {/* Protected Routes */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/new" 
            element={
              <ProtectedRoute>
                <QRCodeGenerator />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/qrcodes/:id" 
            element={
              <ProtectedRoute>
                <QRCodeDetail />
              </ProtectedRoute>
            } 
          />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>
    </Box>
  );
}

function App() {
  return (
    <ChakraProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ChakraProvider>
  );
}

export default App;
