import { 
  Box, 
  VStack, 
  HStack, 
  Text, 
  Button, 
  Input, 
  useToast, 
  Menu, 
  MenuButton, 
  MenuList, 
  MenuItem, 
  IconButton, 
  InputGroup, 
  InputRightElement,
  useDisclosure,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter
} from '@chakra-ui/react';
import { 
  FiFolder, 
  FiPlus, 
  FiMoreVertical, 
  FiEdit2, 
  FiTrash2,
  FiCheck,
  FiX
} from 'react-icons/fi';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface FolderSidebarProps {
  activeFolder: string | null;
  onSelectFolder: (folder: string | null) => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

interface FolderItemProps {
  name: string;
  isActive: boolean;
  onSelect: () => void;
  onRename: (newName: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}

const FolderItem: React.FC<FolderItemProps> = ({ name, isActive, onSelect, onRename, onDelete }) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const deleteDialog = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleRename = async () => {
    if (editedName.trim() === name) {
      setIsRenaming(false);
      return;
    }
    const success = await onRename(editedName);
    if (success) {
      setIsRenaming(false);
    } else {
      // Reset to original name if rename failed
      setEditedName(name);
    }
  };

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRenaming]);

  return (
    <Box
      key={name}
      as="li"
      listStyleType="none"
      w="100%"
      borderRadius="md"
      bg={isActive ? 'gray.100' : 'transparent'}
      _hover={{ bg: isActive ? 'gray.100' : 'gray.50' }}
    >
      <HStack
        spacing={2}
        p={2}
        borderRadius="md"
        cursor="pointer"
        onClick={!isRenaming ? onSelect : undefined}
      >
        <FiFolder />
        {isRenaming ? (
          <InputGroup size="sm">
            <Input
              ref={inputRef}
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              onClick={(e) => e.stopPropagation()}
            />
            <InputRightElement>
              <HStack spacing={1}>
                <IconButton
                  aria-label="Save"
                  icon={<FiCheck />}
                  size="xs"
                  variant="ghost"
                  onClick={handleRename}
                />
                <IconButton
                  aria-label="Cancel"
                  icon={<FiX />}
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setEditedName(name);
                    setIsRenaming(false);
                  }}
                />
              </HStack>
            </InputRightElement>
          </InputGroup>
        ) : (
          <>
            <Text flex={1} isTruncated>{name}</Text>
            <Menu isLazy>
              <MenuButton
                as={IconButton}
                icon={<FiMoreVertical size={16} />}
                size="xs"
                variant="ghost"
                onClick={(e) => e.stopPropagation()}
                aria-label="Folder options"
              />
              <MenuList zIndex="popover">
                <MenuItem icon={<FiEdit2 />} onClick={(e) => {
                  e.stopPropagation();
                  setIsRenaming(true);
                }}>
                  Rename
                </MenuItem>
                <MenuItem 
                  icon={<FiTrash2 />} 
                  color="red.500"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDialog.onOpen();
                  }}
                >
                  Delete
                </MenuItem>
              </MenuList>
            </Menu>
          </>
        )}
      </HStack>

      <AlertDialog
        isOpen={deleteDialog.isOpen}
        leastDestructiveRef={cancelRef}
        onClose={deleteDialog.onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete Folder</AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete the folder "{name}"? This will also delete all QR codes in this folder.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={deleteDialog.onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={async () => {
                const success = await onDelete();
                if (success) {
                  deleteDialog.onClose();
                }
              }} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

const FolderSidebar = ({ activeFolder, onSelectFolder }: FolderSidebarProps) => {
  const [folders, setFolders] = useState<string[]>([]);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
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
      // Create the folder in the backend
      await axios.post(`${API_URL}/folders`, { name: newFolderName });
      
      // Refresh the folders list from the server
      await fetchFolders();
      
      setNewFolderName('');
      setIsAddingFolder(false);
      
      toast({
        title: 'Success',
        description: 'Folder created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error('Error creating folder:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create folder';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleRenameFolder = async (oldName: string, newName: string): Promise<boolean> => {
    if (!newName.trim()) {
      toast({
        title: 'Error',
        description: 'Folder name cannot be empty',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }

    if (newName === oldName) {
      return true; // No changes
    }

    try {
      await axios.put(`${API_URL}/folders/${encodeURIComponent(oldName)}`, { name: newName });
      await fetchFolders();
      
      // If the renamed folder was active, update the active folder
      if (activeFolder === oldName) {
        onSelectFolder(newName);
      }
      
      toast({
        title: 'Success',
        description: 'Folder renamed successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      return true;
    } catch (error: any) {
      console.error('Error renaming folder:', error);
      const errorMessage = error.response?.data?.error || 'Failed to rename folder';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return false;
    }
  };

  const handleDeleteFolder = async (folderName: string): Promise<boolean> => {
    try {
      await axios.delete(`${API_URL}/folders/${encodeURIComponent(folderName)}`);
      await fetchFolders();
      
      // If the deleted folder was active, reset to all folders view
      if (activeFolder === folderName) {
        onSelectFolder(null);
      }
      
      toast({
        title: 'Success',
        description: 'Folder deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      return true;
    } catch (error: any) {
      console.error('Error deleting folder:', error);
      const errorMessage = error.response?.data?.error || 'Failed to delete folder';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return false;
    }
  };

  return (
    <Box w="250px" borderRight="1px" borderColor="gray.200" p={4} bg="white" h="100vh" position="sticky" top={0} zIndex="sticky">
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

        <VStack as="ul" spacing={1} align="stretch" overflowY="auto" maxH="calc(100vh - 180px)">
          <Box
            as="li"
            listStyleType="none"
            p={2}
            borderRadius="md"
            bg={!activeFolder ? 'gray.100' : 'transparent'}
            _hover={{ bg: !activeFolder ? 'gray.100' : 'gray.50' }}
            cursor="pointer"
            onClick={() => onSelectFolder(null)}
          >
            <HStack>
              <FiFolder />
              <Text>All QR Codes</Text>
            </HStack>
          </Box>
          
          {folders.map((folder) => (
            <FolderItem
              key={folder}
              name={folder}
              isActive={activeFolder === folder}
              onSelect={() => onSelectFolder(folder)}
              onRename={async (newName) => await handleRenameFolder(folder, newName)}
              onDelete={async () => await handleDeleteFolder(folder)}
            />
          ))}
        </VStack>
      </VStack>
    </Box>
  );
};

export default FolderSidebar;
