import { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Heading, 
  VStack, 
  FormControl, 
  FormLabel, 
  Input, 
  Button, 
  useToast, 
  Textarea, 
  Card, 
  CardBody, 
  CardHeader, 
  HStack, 
  Image, 
  Text, 
  Select,
  FormHelperText
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
      
      setGeneratedQR({
        id: response.data.id,
        short_code: response.data.short_code,
        image_url: response.data.image_url
      });
      
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
    <Box p={4}>
      <Heading as="h1" size="xl" mb={6}>Generate New QR Code</Heading>
      
      <Card maxW="800px" mx="auto">
        <CardHeader>
          <Heading size="md">QR Code Details</Heading>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit}>
            <VStack spacing={4}>
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
            <Box mt={8}>
              <Heading size="md" mb={4}>QR Code Generated Successfully!</Heading>
              <VStack spacing={4} align="center">
                {generatedQR.image_url ? (
                  <Image
                    src={generatedQR.image_url.startsWith('http') 
                      ? generatedQR.image_url 
                      : `${getBaseUrl()}${generatedQR.image_url}`}
                    alt={`QR Code for ${formData.name}`}
                    boxSize="200px"
                    onError={(e) => {
                      console.error('Error loading QR code image:', e);
                      // Fallback to generating a QR code URL if the image fails to load
                      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${getBaseUrl()}/r/${generatedQR.short_code}`)}`;
                      e.currentTarget.src = qrCodeUrl;
                    }}
                  />
                ) : (
                  <Box 
                    boxSize="200px" 
                    border="1px dashed" 
                    borderColor="gray.300"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    bg="gray.50"
                  >
                    <Text color="gray.500">QR Code will appear here</Text>
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
                >
                  {getBaseUrl()}/r/{generatedQR.short_code}
                </Box>
                <HStack spacing={4} mt={4}>
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
                  >
                    Copy Link
                  </Button>
                  <Button
                    colorScheme="blue"
                    onClick={() => {
                      window.open(`${getBaseUrl()}/dashboard/qrcodes/${generatedQR.id}`, '_blank');
                    }}
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
  );
};

export default QRCodeGenerator;
