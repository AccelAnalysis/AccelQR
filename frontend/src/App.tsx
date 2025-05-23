import { ChakraProvider, Box, Container } from '@chakra-ui/react';
import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import QRCodeGenerator from './pages/QRCodeGenerator';
import QRCodeDetail from './pages/QRCodeDetail';
import Navbar from './components/Navbar';

function App() {
  useEffect(() => {
    document.title = 'AccelQR - Dynamic QR Code Tracker';
  }, []);

  return (
    <ChakraProvider>
      <Router>
        <Box minH="100vh" bg="gray.50">
          <Navbar />
          <Container maxW="container.xl" py={8}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new" element={<QRCodeGenerator />} />
              <Route path="/qrcodes/:id" element={<QRCodeDetail />} />
            </Routes>
          </Container>
        </Box>
      </Router>
    </ChakraProvider>
  );
}

export default App;
