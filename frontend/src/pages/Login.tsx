import React, { useState } from 'react';
import { Box, Button, Container, FormControl, FormLabel, Input, VStack, Heading, useToast } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await login(email, password);
      toast({
        title: 'Login successful',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Login failed',
        description: error.response?.data?.msg || 'An error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxW="container.sm" py={10}>
      <Box p={8} borderWidth={1} borderRadius={8} boxShadow="lg">
        <VStack spacing={6} as="form" onSubmit={handleSubmit}>
          <Heading as="h1" size="lg" mb={6}>
            Login to QR Code Manager
          </Heading>
          
          <FormControl id="email" isRequired>
            <FormLabel>Email address</FormLabel>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </FormControl>

          <FormControl id="password" isRequired>
            <FormLabel>Password</FormLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </FormControl>

          <Button
            type="submit"
            colorScheme="blue"
            width="100%"
            isLoading={isLoading}
            loadingText="Logging in..."
          >
            Login
          </Button>
          
          <Button
            variant="link"
            onClick={() => navigate('/register')}
            mt={2}
          >
            Don't have an account? Register
          </Button>
        </VStack>
      </Box>
    </Container>
  );
};

export default Login;
