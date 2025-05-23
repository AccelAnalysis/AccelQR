import { useState, useEffect } from 'react';
import { 
  Box, 
  Heading, 
  Button, 
  Text, 
  Badge, 
  HStack, 
  VStack,
  Spinner, 
  useToast, 
  Card, 
  CardHeader, 
  CardBody, 
  SimpleGrid, 
  Flex 
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import axios from 'axios';
import FolderSidebar from '../components/FolderSidebar';

interface QRCode {
  id: number;
  name: string;
  short_code: string;
  target_url: string;
  created_at: string;
  scan_count: number;
  folder: string | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const Dashboard = () => {
  const [qrcodes, setQRCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const toast = useToast();

  const fetchQRCodes = async (folder: string | null = null) => {
    try {
      const params = folder ? { folder } : {};
      const response = await axios.get(`${API_URL}/qrcodes`, { params });
      setQRCodes(response.data);
    } catch (error) {
      console.error('Error fetching QR codes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load QR codes',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQRCodes(activeFolder === 'Uncategorized' ? 'Uncategorized' : activeFolder || undefined);
  }, [activeFolder]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleFolderSelect = (folder: string | null) => {
    setActiveFolder(folder);
  };

  return (
    <Flex>
      <FolderSidebar activeFolder={activeFolder} onSelectFolder={handleFolderSelect} />
      <Box flex={1} p={8}>
        <HStack justify="space-between" mb={8}>
          <Heading as="h1" size="xl">
            {activeFolder === 'Uncategorized' 
              ? 'Uncategorized QR Codes'
              : activeFolder 
                ? `Folder: ${activeFolder}` 
                : 'All QR Codes'}
          </Heading>
          <Button as={RouterLink} to="/new" leftIcon={<FiPlus />} colorScheme="blue">
            New QR Code
          </Button>
        </HStack>

        {loading ? (
          <Box textAlign="center" py={10}>
            <Spinner size="xl" />
            <Text mt={4}>Loading QR codes...</Text>
          </Box>
        ) : qrcodes.length === 0 ? (
          <Box textAlign="center" py={10}>
            <Text fontSize="lg" mb={4}>
              {activeFolder 
                ? `No QR codes found in this folder` 
                : 'No QR codes found'}
            </Text>
            <Button as={RouterLink} to="/new" colorScheme="blue">
              Create your first QR code
            </Button>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {qrcodes.map((qr) => (
              <Card key={qr.id} as={RouterLink} to={`/qrcodes/${qr.id}`} _hover={{ transform: 'translateY(-4px)', boxShadow: 'lg' }} transition="all 0.2s">
                <CardHeader>
                  <VStack align="stretch" spacing={2}>
                    <HStack justify="space-between">
                      <Heading size="md">{qr.name}</Heading>
                      <Badge colorScheme={qr.scan_count > 0 ? 'green' : 'gray'}>{qr.scan_count} scans</Badge>
                    </HStack>
                    {qr.folder && (
                      <Badge alignSelf="flex-start" colorScheme="blue" variant="subtle">
                        {qr.folder}
                      </Badge>
                    )}
                  </VStack>
                </CardHeader>
                <CardBody>
                  <Text color="gray.600" noOfLines={1}>{qr.target_url}</Text>
                  <Text fontSize="sm" color="gray.500" mt={2}>Created: {formatDate(qr.created_at)}</Text>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Box>
    </Flex>

  );
};

export default Dashboard;
