import { Box, VStack, HStack, Text, Button, useDisclosure, Input, useToast } from '@chakra-ui/react';
import { FiFolder, FiPlus, FiX } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import axios from 'axios';

interface FolderSidebarProps {
  activeFolder: string | null;
  onSelectFolder: (folder: string | null) => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function FolderSidebar({ activeFolder, onSelectFolder }: FolderSidebarProps) {
  const [folders, setFolders] = useState<string[]>([]);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

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
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const handleAddFolder = async () => {
    if (!newFolderName.trim()) {
      toast({
        title: 'Error',
        description: 'Folder name cannot be empty',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      // The folder will be created when a QR code is added to it
      setFolders(prev => [...prev, newFolderName].sort());
      setNewFolderName('');
      setIsAddingFolder(false);
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: 'Error',
        description: 'Failed to create folder',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Box w="250px" borderRight="1px" borderColor="gray.200" p={4} bg="white" h="100vh" position="sticky" top={0}>
      <VStack align="stretch" spacing={4}>
        <HStack justify="space-between" mb={4}>
          <Text fontSize="lg" fontWeight="bold">Folders</Text>
          <Button
            size="sm"
            leftIcon={<FiPlus />}
            onClick={isAddingFolder ? () => setIsAddingFolder(false) : () => setIsAddingFolder(true)}
            variant="ghost"
          >
            {isAddingFolder ? 'Cancel' : 'New'}
          </Button>
        </HStack>

        {isAddingFolder && (
          <HStack>
            <Input
              size="sm"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
              autoFocus
            />
            <Button size="sm" onClick={handleAddFolder} colorScheme="blue">
              Add
            </Button>
          </HStack>
        )}

        <VStack align="stretch" spacing={1}>
          <Button
            variant={activeFolder === null ? 'solid' : 'ghost'}
            justifyContent="flex-start"
            leftIcon={<FiFolder />}
            onClick={() => onSelectFolder(null)}
            size="sm"
          >
            All QR Codes
          </Button>
          <Button
            variant={activeFolder === 'Uncategorized' ? 'solid' : 'ghost'}
            justifyContent="flex-start"
            leftIcon={<FiFolder />}
            onClick={() => onSelectFolder('Uncategorized')}
            size="sm"
          >
            Uncategorized
          </Button>
          {folders.map((folder) => (
            <Button
              key={folder}
              variant={activeFolder === folder ? 'solid' : 'ghost'}
              justifyContent="space-between"
              leftIcon={<FiFolder />}
              onClick={() => onSelectFolder(folder)}
              size="sm"
            >
              <Text isTruncated flex={1} textAlign="left">{folder}</Text>
            </Button>
          ))}
        </VStack>
      </VStack>
    </Box>
  );
}
