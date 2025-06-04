import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCopy, FiExternalLink, FiDownload } from 'react-icons/fi';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  Text,
  Textarea,
  useToast,
  VStack,
  Image,
  FormHelperText,
} from '@chakra-ui/react';
import axios from 'axios';
import { ENDPOINTS, API_URL } from '../config';

const getBaseUrl = () => {
  // Extract the base URL from API_URL (remove /api suffix if present)
  const apiUrl = API_URL.replace('/api', '');
  // Ensure it doesn't end with a slash
  return apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
};

const QRCodeGenerator = () => {
  const [formData, setFormData] = useState({
    name: '',
    target_url: '',
    description: '',
    folder: ''
  });
  
  const [folders, setFolders] = useState<string[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [loading, setLoading] = useState(false);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [generatedQR, setGeneratedQR] = useState<{
    id: number;
    short_code: string;
    image_url: string;
  } | null>(null);
  
  const toast = useToast();

  const fetchFolders = useCallback(async () => {
    try {
      const response = await axios.get(ENDPOINTS.FOLDERS);
      setFolders(response.data);
      setIsLoadingFolders(false);
    } catch (error) {
      console.error('Error fetching folders:', error);
      toast({
        title: 'Error',
        description: 'Failed to load folders',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setIsLoadingFolders(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    if (generatedQR) {
      console.log('Generated QR data:', generatedQR);
    }
  }, [generatedQR]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!formData.name || !formData.target_url) {
      toast({
        title: 'Error',
        description: 'Name and Target URL are required',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setLoading(false);
      return;
    }
    
    try {
      const response = await axios.post(ENDPOINTS.QR_CODES, {
        ...formData,
        folder: formData.folder || null
      });
      
      const qrData = {
        id: response.data.id,
        short_code: response.data.short_code,
        image_url: response.data.image_url
      };
      setGeneratedQR(qrData);
      
      // Set QR code image URL
      if (response.data.image_url) {
        setQrCodeImage(
          response.data.image_url.startsWith('http')
            ? response.data.image_url
            : `${getBaseUrl()}${response.data.image_url}`
        );
      } else {
        // Fallback to QR code generation API
        setQrCodeImage(
          `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
            `${getBaseUrl()}/r/${response.data.short_code}`
          )}`
        );
      }
      
      toast({
        title: 'Success',
        description: 'QR Code generated successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Reset form
      setFormData({
        name: '',
        target_url: '',
        description: '',
        folder: ''
      });
      
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate QR code',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minH="100vh" p={{ base: 4, md: 6 }} display="flex" flexDirection="column">
      <Box maxW="1400px" mx="auto" w="100%" flex="1" display="flex" flexDirection="column">
        <Heading as="h1" size="xl" mb={6} fontSize={{ base: '2xl', md: '3xl' }}>Generate New QR Code</Heading>
        
        <Card w="100%" mx="auto" flex="1" display="flex" flexDirection="column">
          <CardHeader>
            <Heading size="md">QR Code Details</Heading>
          </CardHeader>
          <CardBody flex="1" display="flex" flexDirection="column">
            <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <VStack spacing={4} flex="1">
                <FormControl isRequired>
                  <FormLabel>Name</FormLabel>
                  <Input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter a name for this QR code"
                  />
                </FormControl>
                
                <FormControl isRequired>
                  <FormLabel>Target URL</FormLabel>
                  <Input
                    name="target_url"
                    type="url"
                    value={formData.target_url}
                    onChange={handleChange}
                    placeholder="https://example.com"
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Enter a description (optional)"
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel>Folder</FormLabel>
                  <Select
                    name="folder"
                    value={formData.folder}
                    onChange={handleChange}
                    placeholder="Select a folder (optional)"
                    isDisabled={isLoadingFolders}
                  >
                    {folders.map((folder) => (
                      <option key={folder} value={folder}>
                        {folder}
                      </option>
                    ))}
                  </Select>
                  {isLoadingFolders && (
                    <FormHelperText>Loading folders...</FormHelperText>
                  )}
                </FormControl>
                
                <Button
                  type="submit"
                  colorScheme="blue"
                  isLoading={loading}
                  loadingText="Generating..."
                  mt={4}
                >
                  Generate QR Code
                </Button>
              </VStack>
            </form>
            
            {generatedQR && (
              <Box mt={8} w="100%">
                <Heading size="md" mb={4} textAlign="center">QR Code Generated Successfully!</Heading>
                <VStack spacing={6} align="center" w="100%">
                  {qrCodeImage && (
                    <Box position="relative">
                      <Box 
                        p={4} 
                        borderWidth="1px" 
                        borderRadius="md" 
                        borderColor="gray.200" 
                        bg="white"
                        w="100%"
                        maxW={{ base: '300px', sm: '350px', md: '400px' }}
                        mx="auto"
                      >
                        <Image 
                          src={qrCodeImage} 
                          alt="Generated QR Code" 
                          width="100%"
                          height="auto"
                          style={{ aspectRatio: '1/1' }}
                        />
                      </Box>
                      <Button
                        position="absolute"
                        bottom="-8"
                        left="50%"
                        transform="translateX(-50%)"
                        size="sm"
                        leftIcon={<FiDownload />}
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = qrCodeImage;
                          link.download = `qr-code-${generatedQR.short_code}.png`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        width="fit-content"
                      >
                        Download
                      </Button>
                    </Box>
                  )}
                  <Text>Scan this QR code or share the link below:</Text>
                  <Box 
                    p={3} 
                    bg="gray.100" 
                    borderRadius="md" 
                    w="100%" 
                    textAlign="center"
                    fontFamily="mono"
                    maxW="100%"
                    overflowX="auto"
                  >
                    {getBaseUrl()}/r/{generatedQR.short_code}
                  </Box>
                  <HStack spacing={4} mt={4} justify="center" flexWrap="wrap">
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${getBaseUrl()}/r/${generatedQR.short_code}`
                        );
                        toast({
                          title: 'Copied!',
                          status: 'success',
                          duration: 2000,
                          isClosable: true,
                        });
                      }}
                      size={{ base: 'md', md: 'lg' }}
                      px={6}
                      leftIcon={<FiCopy />}
                    >
                      Copy Link
                    </Button>
                    <Button
                      colorScheme="blue"
                      onClick={() => {
                        window.open(`${getBaseUrl()}/dashboard/qrcodes/${generatedQR.id}`, '_blank');
                      }}
                      size={{ base: 'md', md: 'lg' }}
                      px={6}
                      rightIcon={<FiExternalLink />}
                    >
                      View Details
                    </Button>
                  </HStack>
                </VStack>
              </Box>
            )}
          </CardBody>
        </Card>
      </Box>
    </Box>
  );
};

export default QRCodeGenerator;
