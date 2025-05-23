import { Box, Flex, Button, Heading, Container } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

const Navbar = () => {
  return (
    <Box bg="white" boxShadow="sm" mb={8}>
      <Container maxW="container.xl">
        <Flex py={4} alignItems="center">
          <RouterLink to="/" style={{ textDecoration: 'none' }}>
            <Heading size="lg" color="teal.500">AccelQR</Heading>
          </RouterLink>
          <Box flex={1} />
          <Box>
            <RouterLink to="/">
              <Button variant="ghost" mr={2}>
                Dashboard
              </Button>
            </RouterLink>
            <RouterLink to="/new">
              <Button colorScheme="teal">
                Create QR Code
              </Button>
            </RouterLink>
          </Box>
        </Flex>
      </Container>
    </Box>
  );
};

export default Navbar;
