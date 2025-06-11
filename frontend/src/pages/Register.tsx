import React, { useState } from 'react';
import { Box, Button, Container, FormControl, FormLabel, Input, VStack, Heading, useToast, Text, Link as ChakraLink } from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
    
    try {
      await register(email, password);
      toast({
        title: 'Registration successful',
        description: 'You have been registered and logged in',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Registration failed',
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
            Create an Account
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
              placeholder="Create a password"
            />
          </FormControl>

          <FormControl id="confirmPassword" isRequired>
            <FormLabel>Confirm Password</FormLabel>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
            />
          </FormControl>

          <Button
            type="submit"
            colorScheme="blue"
            width="100%"
            isLoading={isLoading}
            loadingText="Creating account..."
          >
            Register
          </Button>
          
          <Text>
            Already have an account?{' '}
            <ChakraLink as={Link} to="/login" color="blue.500">
              Log in
            </ChakraLink>
          </Text>
        </VStack>
      </Box>
    </Container>
  );
};

export default Register;
