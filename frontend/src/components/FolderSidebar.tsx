import { 
  Box, 
  VStack, 
  HStack, 
  Text, 
  Badge,
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
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  useDisclosure
} from '@chakra-ui/react';
import { 
  FiFolder, 
  FiPlus, 
  FiMoreVertical, 
  FiEdit2, 
  FiTrash2,
  FiCheck,
  FiX
} from 'react-icons/fi'; // Changed FiXCircle to FiX
import { useState, useEffect, useRef, useCallback } from 'react';
import type { AxiosError } from 'axios';
import apiClient from '../api/client';

interface FolderSidebarProps {
  activeFolder: string | null;
  onSelectFolder: (folder: string | null) => void;
  totalCount?: number;
  folderCounts?: Record<string, number>;
}

interface FolderItemProps {
  name: string;
  isActive: boolean;
  onSelect: () => void;
  onRename: (newName: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  count?: number;
}

const FolderItem: React.FC<FolderItemProps> = ({ name, isActive, onSelect, onRename, onDelete, count }) => {
  const deleteDialog = useDisclosure();
  const [isRenaming, setIsRenaming] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
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
            {count !== undefined && (
              <Badge colorScheme={isActive ? 'blue' : 'gray'}>{count}</Badge>
            )}
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

const FolderSidebar = ({ activeFolder, onSelectFolder, totalCount, folderCounts = {} }: FolderSidebarProps) => {
  const [folders, setFolders] = useState<string[]>([]);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isFolderPanelOpen, setIsFolderPanelOpen] = useState(false);
  const toast = useToast();

  const fetchFolders = useCallback(async () => {
    try {
      const response = await apiClient.get('/folders');
      // Filter out any null or empty folder names
      const validFolders = response.data.filter((folder: string | null) => folder && folder.trim() !== '');
      setFolders(validFolders);
    } catch (error: unknown) {
      console.error('Error fetching folders:', error);
      toast({
        title: 'Error',
        description: 'Failed to load folders',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

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
      // Retrieve auth token for the request
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Create the folder in the backend
      await apiClient.post('/folders', { name: newFolderName });
      
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
    } catch (error: unknown) {
      console.error('Error creating folder:', error);
      const axiosError = error as AxiosError;
      const data = axiosError.response?.data as { error?: string } | undefined;
      const errorMessage = data?.error || 'Failed to create folder';
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
      await apiClient.put(`/folders/${encodeURIComponent(oldName)}`, { name: newName });
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
    } catch (error: unknown) {
      console.error('Error renaming folder:', error);
      const axiosError = error as AxiosError;
      const data = axiosError.response?.data as { error?: string } | undefined;
      const errorMessage = data?.error || 'Failed to rename folder';
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
      await apiClient.delete(`/folders/${encodeURIComponent(folderName)}`);
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
    } catch (error: unknown) {
      console.error('Error deleting folder:', error);
      const axiosError = error as AxiosError;
      const data = axiosError.response?.data as { error?: string } | undefined;
      const errorMessage = data?.error || 'Failed to delete folder';
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

  const folderContent = (
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
              <Text flex={1}>All QR Codes</Text>
              {totalCount !== undefined && (
                <Badge colorScheme={!activeFolder ? 'blue' : 'gray'}>{totalCount}</Badge>
              )}
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
              count={folderCounts[folder] || 0}
            />
          ))}
        </VStack>
      </VStack>
  );

  return (
    <Box w="100%">
      <Button
        display={{ base: 'flex', lg: 'none' }}
        w="100%"
        mb={3}
        variant="outline"
        leftIcon={<FiFolder />}
        onClick={() => setIsFolderPanelOpen((open) => !open)}
      >
        {isFolderPanelOpen ? 'Hide folders' : 'Show folders'}
      </Button>
      <Box
        display={{ base: isFolderPanelOpen ? 'block' : 'none', lg: 'block' }}
        w={{ base: '100%', lg: '250px' }}
        borderRight={{ base: 0, lg: '1px' }}
        borderColor="gray.200"
        borderWidth={{ base: '1px', lg: 0 }}
        borderRadius={{ base: 'md', lg: 0 }}
        p={4}
        bg="white"
        h={{ base: 'auto', lg: '100vh' }}
        position={{ base: 'static', lg: 'sticky' }}
        top={0}
        zIndex="sticky"
      >
        {folderContent}
      </Box>
    </Box>
  );
};

export default FolderSidebar;
