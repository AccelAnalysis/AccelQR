import { Box, Flex, Button, Heading, Container, Menu, MenuButton, MenuList, MenuItem, Avatar, Text, HStack } from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ChevronDownIcon, HamburgerIcon } from '@chakra-ui/icons';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const allowRegistration = import.meta.env.DEV;

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
          <HStack spacing={3} display={{ base: 'none', md: 'flex' }}>
            {user ? (
              <>
                <RouterLink to="/">
                  <Button variant="ghost">Dashboard</Button>
                </RouterLink>
                <RouterLink to="/new">
                  <Button colorScheme="teal">Create QR Code</Button>
                </RouterLink>
                <Menu>
                  <MenuButton as={Button} variant="ghost" rightIcon={<ChevronDownIcon />}>
                    Tools
                  </MenuButton>
                  <MenuList>
                    <MenuItem as={RouterLink} to="/qr-image-by-shortcode">
                      QR Image Lookup
                    </MenuItem>
                  </MenuList>
                </Menu>
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
                {allowRegistration && (
                  <RouterLink to="/register">
                    <Button colorScheme="teal">Sign Up</Button>
                  </RouterLink>
                )}
              </>
            )}
          </HStack>
          <Box display={{ base: 'block', md: 'none' }}>
            <Menu>
              <MenuButton
                as={Button}
                variant="ghost"
                aria-label="Open navigation menu"
                leftIcon={<HamburgerIcon />}
              >
                Menu
              </MenuButton>
              <MenuList>
                {user ? (
                  <>
                    <MenuItem as={RouterLink} to="/">Dashboard</MenuItem>
                    <MenuItem as={RouterLink} to="/new">Create QR Code</MenuItem>
                    <MenuItem as={RouterLink} to="/qr-image-by-shortcode">QR Image Lookup</MenuItem>
                    <MenuItem onClick={handleLogout}>Logout</MenuItem>
                  </>
                ) : (
                  <>
                    <MenuItem as={RouterLink} to="/login">Login</MenuItem>
                    {allowRegistration && (
                      <MenuItem as={RouterLink} to="/register">Sign Up</MenuItem>
                    )}
                  </>
                )}
              </MenuList>
            </Menu>
          </Box>
        </Flex>
      </Container>
    </Box>
  );
};

export default Navbar;
