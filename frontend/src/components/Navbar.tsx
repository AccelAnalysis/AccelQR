import { Box, Flex, Button, Heading, Container, Menu, MenuButton, MenuList, MenuItem, Avatar, Text, HStack } from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ChevronDownIcon } from '@chakra-ui/icons';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  return (
    <Box bg="white" boxShadow="sm" mb={8}>
      <Container maxW="container.xl">
        <Flex py={4} alignItems="center">
          <RouterLink to="/" style={{ textDecoration: 'none' }}>
            <Heading size="lg" color="teal.500">AccelQR</Heading>
          </RouterLink>
          <Box flex={1} />
          <HStack spacing={4}>
            {user ? (
              <>
                <RouterLink to="/">
                  <Button variant="ghost">Dashboard</Button>
                </RouterLink>
                <RouterLink to="/new">
                  <Button colorScheme="teal">Create QR Code</Button>
                </RouterLink>
                <Menu>
                  <MenuButton
                    as={Button}
                    variant="ghost"
                    rightIcon={<ChevronDownIcon />}
                    px={2}
                  >
                    <HStack spacing={2}>
                      <Avatar size="sm" name={user.email} />
                      <Text display={{ base: 'none', md: 'block' }}>{user.email}</Text>
                    </HStack>
                  </MenuButton>
                  <MenuList>
                    <MenuItem onClick={handleLogout}>Logout</MenuItem>
                  </MenuList>
                </Menu>
              </>
            ) : (
              <>
                <RouterLink to="/login">
                  <Button variant="ghost">Login</Button>
                </RouterLink>
                <RouterLink to="/register">
                  <Button colorScheme="teal">Sign Up</Button>
                </RouterLink>
              </>
            )}
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
};

export default Navbar;
