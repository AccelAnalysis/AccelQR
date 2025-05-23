import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import React from 'react';
import { 
  Box, 
  Heading, 
  VStack, 
  HStack, 
  Text, 
  Button, 
  useToast, 
  Card, 
  CardBody, 
  CardHeader, 
  Image, 
  Badge, 
  Divider,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  FormHelperText
} from '@chakra-ui/react';
import { FiEdit2, FiTrash2, FiArrowLeft, FiCopy, FiDownload } from 'react-icons/fi';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

interface QRCode {
  id: number;
  name: string;
  short_code: string;
  target_url: string;
  description: string;
  created_at: string;
  scan_count: number;
  folder: string | null;
}

// This component will always show a loading state, an error state, or the QR code details
const QRCodeDetail: React.FC = (): React.ReactElement => {
  const { id } = useParams<{ id: string }>();
  const [qrCode, setQRCode] = useState<QRCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [folders, setFolders] = useState<string[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    target_url: '',
    description: '',
    folder: ''
  });
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const navigate = useNavigate();

  const fetchQRCode = async () => {
    try {
      const response = await axios.get(`${API_URL}/qrcodes/${id}`);
      setQRCode(response.data);
      setFormData({
        name: response.data.name,
        target_url: response.data.target_url,
        description: response.data.description || '',
        folder: response.data.folder || ''
      });
    } catch (error) {
      console.error('Error fetching QR code:', error);
      toast({
        title: 'Error',
        description: 'Failed to load QR code',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    if (id) {
      fetchQRCode();
      fetchFolders();
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdate = async () => {
    try {
      const response = await axios.put(`${API_URL}/qrcodes/${id}`, formData);
      setQRCode(response.data);
      setIsEditing(false);
      toast({
        title: 'Success',
        description: 'QR Code updated successfully!',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating QR code:', error);
      toast({
        title: 'Error',
        description: 'Failed to update QR code',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API_URL}/qrcodes/${id}`);
      toast({
        title: 'Success',
        description: 'QR Code deleted successfully!',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      navigate('/');
    } catch (error) {
      console.error('Error deleting QR code:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete QR code',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
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

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Text>Loading QR code...</Text>
      </Box>
    ) as React.ReactElement;
  }

  if (!qrCode) {
    return (
      <Box textAlign="center" py={10}>
        <Text>QR code not found</Text>
      </Box>
    ) as React.ReactElement;
  }

  // At this point, qrCode is guaranteed to be defined
  // This satisfies TypeScript's type checking

  return (
    <Box>
      <Button 
        leftIcon={<FiArrowLeft />} 
        variant="ghost" 
        mb={6} 
        onClick={() => navigate(-1)}
      >
        Back to Dashboard
      </Button>

      <Card mb={6}>
        <CardHeader>
          <HStack justify="space-between">
            {isEditing ? (
              <Input
                name="name"
                value={formData.name}
                onChange={handleChange}
                fontSize="2xl"
                fontWeight="bold"
                variant="flushed"
                mb={2}
              />
            ) : (
              <Heading size="lg">{qrCode.name}</Heading>
            )}
            <HStack>
              <Button
                leftIcon={!isEditing ? <FiEdit2 /> : undefined}
                onClick={() => {
                  if (isEditing) {
                    handleUpdate();
                  } else {
                    setIsEditing(true);
                  }
                }}
                colorScheme={isEditing ? 'green' : 'blue'}
              >
                {isEditing ? 'Save Changes' : 'Edit'}
              </Button>
              <Button
                leftIcon={<FiTrash2 />}
                colorScheme="red"
                variant="ghost"
                onClick={onOpen}
              >
                Delete
              </Button>
            </HStack>
          </HStack>
        </CardHeader>

        <CardBody>
          {isEditing ? (
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Destination URL</FormLabel>
                <Input
                  name="target_url"
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
                  placeholder="Enter a description for this QR code"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Folder</FormLabel>
                <Select
                  name="folder"
                  value={formData.folder}
                  onChange={handleChange}
                  placeholder="Select a folder"
                  isDisabled={isLoadingFolders}
                >
                  <option value="">No folder</option>
                  {folders.map((folder) => (
                    <option key={folder} value={folder}>
                      {folder}
                    </option>
                  ))}
                </Select>
                <FormHelperText>
                  Select an existing folder or leave empty for no folder
                </FormHelperText>
              </FormControl>

              {!isLoadingFolders && !folders.some(f => f === formData.folder) && formData.folder && (
                <FormControl>
                  <FormLabel>New Folder Name</FormLabel>
                  <Input
                    value={formData.folder}
                    onChange={(e) => setFormData(prev => ({ ...prev, folder: e.target.value }))}
                    placeholder="Enter a name for the new folder"
                  />
                </FormControl>
              )}
            </VStack>
          ) : (
            <VStack spacing={4} align="stretch">
              <Box>
                <Text color="gray.600" fontSize="sm">Short Code</Text>
                <HStack>
                  <Text fontFamily="mono">{qrCode.short_code}</Text>
                  <Button
                    size="xs"
                    variant="ghost"
                    leftIcon={<FiCopy />}
                    onClick={() => copyToClipboard(qrCode.short_code)}
                  >
                    Copy
                  </Button>
                </HStack>
              </Box>

              <Box>
                <Text color="gray.600" fontSize="sm">Destination URL</Text>
                <HStack>
                  <Text isTruncated maxW="70%">{qrCode.target_url}</Text>
                  <Button
                    size="xs"
                    variant="ghost"
                    leftIcon={<FiCopy />}
                    onClick={() => copyToClipboard(qrCode.target_url)}
                  >
                    Copy
                  </Button>
                </HStack>
              </Box>

              {qrCode.folder && (
                <Box>
                  <Text color="gray.600" fontSize="sm">Folder</Text>
                  <Badge colorScheme="blue" variant="subtle">
                    {qrCode.folder}
                  </Badge>
                </Box>
              )}

              {qrCode.description && (
                <Box>
                  <Text color="gray.600" fontSize="sm">Description</Text>
                  <Text whiteSpace="pre-line">{qrCode.description}</Text>
                </Box>
              )}

              <Divider my={2} />

              <HStack spacing={4} color="gray.500" fontSize="sm">
                <Text>Created: {new Date(qrCode.created_at).toLocaleDateString()}</Text>
                <Text>•</Text>
                <Text>Scans: {qrCode.scan_count}</Text>
              </HStack>
            </VStack>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <Heading size="md">QR Code</Heading>
        </CardHeader>
        <CardBody>
          <Box maxW="300px" mx="auto">
            <Image 
              src={`${API_URL}/qrcodes/${qrCode.short_code}/image`} 
              alt={`QR Code for ${qrCode.name}`}
              width="100%"
              height="auto"
            />
          </Box>
          <HStack mt={4} justify="center">
            <Button
              leftIcon={<FiDownload />}
              onClick={() => {
                const link = document.createElement('a');
                link.href = `${API_URL}/qrcodes/${qrCode.short_code}/image`;
                link.download = `qrcode-${qrCode.short_code}.png`;
                link.click();
              }}
            >
              Download PNG
            </Button>
            <Button
              leftIcon={<FiCopy />}
              onClick={() => copyToClipboard(`${window.location.origin}/r/${qrCode.short_code}`)}
            >
              Copy Shareable Link
            </Button>
          </HStack>
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete QR Code</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Are you sure you want to delete this QR code? This action cannot be undone.</Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={handleDelete}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  ) as unknown as React.ReactElement;
};

export default QRCodeDetail;
