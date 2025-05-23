import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

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
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        const response = await axios.get(`${API_URL}/folders`);
        setFolders(response.data);
      } catch (error) {
        console.error('Error fetching folders:', error);
        toast({
          title: 'Error',
          description: 'Failed to load folders',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoadingFolders(false);
      }
    };

    fetchFolders();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.target_url) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    
    try {
      const response = await axios.post(`${API_URL}/qrcodes`, {
        name: formData.name,
        target_url: formData.target_url,
        description: formData.description,
        folder: formData.folder || null
      });

      // Get the local IP address for the QR code
      const localIp = window.location.hostname === 'localhost' ? '10.255.161.20' : window.location.hostname;
      
      setGeneratedQR({
        id: response.data.id,
        short_code: response.data.short_code,
        image_url: `http://${localIp}:5001/api/qrcodes/${response.data.short_code}/image`
      });

      toast({
        title: 'Success',
        description: 'QR Code generated successfully!',
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
        description: 'Failed to generate QR code. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const downloadQRCode = () => {
    if (!generatedQR) return;
    
    const link = document.createElement('a');
    link.href = generatedQR.image_url;
    link.download = `qrcode-${generatedQR.short_code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box maxW="3xl" mx="auto">
      <Heading size="lg" mb={6}>Create New AccelQR Code</Heading>
      
      <Card variant="outline" mb={8}>
        <CardHeader>
          <Heading size="md">QR Code Details</Heading>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit}>
            <VStack spacing={6}>
              <FormControl isRequired>
                <FormLabel>QR Code Name</FormLabel>
                <Input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., My Website"
                />
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Destination URL</FormLabel>
                <Input
                  type="url"
                  name="target_url"
                  value={formData.target_url}
                  onChange={handleChange}
                  placeholder="https://example.com"
                />
              </FormControl>
              
              <FormControl id="description" mb={6}>
                <FormLabel>Description (optional)</FormLabel>
                <Textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter a description for this QR code"
                />
              </FormControl>
              
              <FormControl id="folder" mb={6}>
                <FormLabel>Folder (optional)</FormLabel>
                <Select
                  name="folder"
                  value={formData.folder}
                  onChange={handleChange}
                  placeholder="Select a folder"
                  isDisabled={isLoadingFolders}
                >
                  {folders.map((folder) => (
                    <option key={folder} value={folder}>
                      {folder}
                    </option>
                  ))}
                </Select>
                <FormHelperText>
                  Select an existing folder or leave empty to create a new one
                </FormHelperText>
              </FormControl>
              
              {!isLoadingFolders && !folders.some(f => f === formData.folder) && formData.folder && (
                <FormControl id="newFolder" mb={6}>
                  <FormLabel>New Folder Name</FormLabel>
                  <Input
                    value={formData.folder}
                    onChange={(e) => setFormData(prev => ({ ...prev, folder: e.target.value }))}
                    placeholder="Enter a name for the new folder"
                  />
                </FormControl>
              )}
              
              <Button
                type="submit"
                colorScheme="teal"
                size="lg"
                width="full"
                isLoading={loading}
                loadingText="Generating..."
              >
                Generate QR Code
              </Button>
            </VStack>
          </form>
        </CardBody>
      </Card>

      {generatedQR && (
        <Card variant="outline">
          <CardHeader>
            <Heading size="md">Your QR Code is Ready!</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={6}>
              <Box p={4} borderWidth={1} borderRadius="md">
                <Image
                  src={generatedQR.image_url}
                  alt={`QR Code for ${formData.name}`}
                  boxSize="200px"
                  mx="auto"
                />
              </Box>
              
              <VStack spacing={2} w="full">
                <Text fontWeight="medium">Short URL:</Text>
                <HStack w="full">
                  <Input
                    value={`${window.location.origin}/r/${generatedQR.short_code}`}
                    isReadOnly
                    pr="4.5rem"
                  />
                  <Button
                    onClick={() => copyToClipboard(`${window.location.origin}/r/${generatedQR.short_code}`)}
                  >
                    Copy
                  </Button>
                </HStack>
              </VStack>
              
              <HStack spacing={4} w="full">
                <Button
                  onClick={downloadQRCode}
                  leftIcon={<i className="fas fa-download"></i>}
                  flex={1}
                >
                  Download QR Code
                </Button>
                <Button
                  onClick={() => navigate(`/qrcodes/${generatedQR.id}`)}
                  variant="outline"
                  flex={1}
                >
                  View Analytics
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      )}
    </Box>
  );
};

export default QRCodeGenerator;
