import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Heading,
  Text,
  Button,
  Badge,
  Spinner,
  IconButton,
  SimpleGrid,
  Link as ChakraLink,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Tooltip,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Divider,
  VStack,
  HStack,
  useToast,
  useClipboard,
  type ButtonProps,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
} from '@chakra-ui/react';
import { FiArrowLeft, FiCopy, FiDownload, FiExternalLink, FiTrash2 } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';

// Type definitions for Chakra UI v3 components
declare module '@chakra-ui/react' {
  interface ButtonProps {
    leftIcon?: React.ReactElement;
    rightIcon?: React.ReactElement;
  }
  
  interface IconButtonProps {
    icon?: React.ReactElement;
    'aria-label': string;
  }
  
  interface LinkProps {
    isExternal?: boolean;
    noOfLines?: number;
  }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

interface QRCode {
  id: number;
  name: string;
  short_code: string;
  target_url: string;
  created_at: string;
  scan_count: number;
}

interface ScanData {
  date: string;
  count: number;
}

// Custom button component that handles navigation with onClick
interface NavButtonProps extends ButtonProps {
  to: string;
}

const NavButton = ({ to, children, ...rest }: NavButtonProps) => {
  const navigate = useNavigate();
  return (
    <Button
      onClick={() => navigate(to)}
      _hover={{ textDecoration: 'none' }}
      {...rest}
    >
      {children}
    </Button>
  );
};

const QRCodeDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [qrCode, setQRCode] = useState<QRCode | null>(null);
  const [scanData, setScanData] = useState<ScanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { onCopy } = useClipboard(qrCode?.target_url || '');
  
  const handleCopy = () => {
    onCopy();
    toast({
      title: 'Copied to clipboard',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`http://localhost:5001/api/qrcodes/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete QR code');
      }

      toast({
        title: 'QR code deleted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Navigate back to the dashboard after a short delay
      setTimeout(() => {
        navigate('/');
      }, 1000);
      
    } catch (error) {
      console.error('Error deleting QR code:', error);
      toast({
        title: 'Error deleting QR code',
        description: 'An error occurred while deleting the QR code. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      onClose();
    }
  };
  
  // Use handleCopy for the copy button
  const copyButtonProps: any = {
    'aria-label': 'Copy to clipboard',
    onClick: handleCopy,
    variant: 'outline' as const,
    icon: <FiCopy />
  };

  useEffect(() => {
    const fetchQRCodeDetails = async () => {
      try {
        setLoading(true);
        const [qrResponse, statsResponse] = await Promise.all([
          axios.get(`${API_URL}/qrcodes/${id}`),
          axios.get(`${API_URL}/qrcodes/${id}/stats`)
        ]);
        
        setQRCode(qrResponse.data);
        setScanData(statsResponse.data.daily_scans || []);
      } catch (err) {
        console.error('Error fetching QR code details:', err);
        setError('Failed to load QR code details');
        toast({
          title: 'Error',
          description: 'Failed to load QR code details',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchQRCodeDetails();
    }
  }, [id, toast]);



  const downloadQRCode = () => {
    if (!qrCode) return;
    
    const link = document.createElement('a');
    link.href = `http://localhost:5001/api/qrcodes/${qrCode.short_code}/image`;
    link.download = `qrcode-${qrCode.short_code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
      </Box>
    );
  }

  if (error || !qrCode) {
    return (
      <Box textAlign="center" py={10}>
        <Text color="red.500" mb={4}>{error || 'QR Code not found'}</Text>
          <NavButton to="/" colorScheme="teal">
            Back to Dashboard
          </NavButton>
      </Box>
    );
  }

  const totalScans = scanData.reduce((sum, day) => sum + day.count, 0);
  const lastScan = scanData.length > 0 ? scanData[scanData.length - 1] : null;

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        <Button
          variant="ghost"
          mb={4}
          onClick={() => navigate(-1)}
          leftIcon={<FiArrowLeft />}
          aria-label="Back to Dashboard"
        >
          Back to Dashboard
        </Button>

        <HStack justify="space-between" mb={8} align="flex-start">
          <VStack align="flex-start" spacing={1}>
            <Heading>{qrCode.name}</Heading>
            <HStack>
              <Text color="gray.500">Created on {formatDate(qrCode.created_at)}</Text>
              <Badge colorScheme={qrCode.scan_count > 0 ? 'green' : 'gray'}>
                {qrCode.scan_count} {qrCode.scan_count === 1 ? 'scan' : 'scans'}
              </Badge>
            </HStack>
          </VStack>
          <HStack spacing={4}>
            <Tooltip label="Copy to clipboard">
              <IconButton {...copyButtonProps} />
            </Tooltip>
            <ChakraLink
              href={qrCode.target_url}
              isExternal
              _hover={{ textDecoration: 'none' }}
            >
              <Button
                as="span"
                colorScheme="teal"
                rightIcon={<FiExternalLink />}
              >
                Visit Target URL
              </Button>
            </ChakraLink>
          </HStack>
        </HStack>

        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6} mb={8}>
          <StatCard
            title="Total Scans"
            value={totalScans}
            description="All time"
            trend={null}
          />
          <StatCard
            title="Scans (Last 30 Days)"
            value={scanData.reduce((sum, day) => sum + day.count, 0)}
            description="vs previous period"
            trend={null} // You can calculate trend if you have previous period data
          />
          <StatCard
            title="Last Scan"
            value={lastScan ? lastScan.count : 0}
            description={lastScan ? `on ${lastScan.date}` : 'No scans yet'}
            trend={null}
          />
        </SimpleGrid>

        <Card variant="outline" mb={8}>
          <CardHeader>
            <Heading size="md">Scan Analytics</Heading>
          </CardHeader>
          <CardBody>
            {scanData.length > 0 ? (
              <Box height="400px">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scanData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <RechartsTooltip 
                      formatter={(value: number) => [value, 'Scans']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Scans"
                      stroke="#3182ce"
                      strokeWidth={2}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Box textAlign="center" py={10}>
                <Text color="gray.500">No scan data available yet</Text>
              </Box>
            )}
          </CardBody>
        </Card>

        <Card variant="outline">
          <CardHeader>
            <Heading size="lg">AccelQR Code Details</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <DetailRow 
                label="Name" 
                value={qrCode.name} 
              />
              <Divider />
              <DetailRow 
                label="Destination URL" 
                value={qrCode.target_url} 
                isUrl 
              />
              <Divider />
              <DetailRow 
                label="Short URL" 
                value={`${window.location.origin}/r/${qrCode.short_code}`} 
                isCopyable 
              />
              <Divider />
              <DetailRow 
                label="QR Code URL" 
                value={`${API_URL}/qrcodes/${qrCode.short_code}/image`} 
                isCopyable 
              />
            </VStack>
          </CardBody>
          <CardFooter>
              <NavButton 
                to={`/r/${qrCode.short_code}`} 
                colorScheme="teal" 
                variant="outline"
              >
                Test QR Code
              </NavButton>
            <HStack spacing={4}>
              <Button
                leftIcon={<FiDownload />}
                onClick={downloadQRCode}
                colorScheme="teal"
                variant="outline"
              >
                Download QR Code
              </Button>
              <Button
                leftIcon={<FiTrash2 />}
                onClick={onOpen}
                colorScheme="red"
                variant="outline"
              >
                Delete QR Code
              </Button>
            </HStack>
          </CardFooter>
        </Card>
      </VStack>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete QR Code
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this QR code? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDelete} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

const StatCard = ({ title, value, description, trend }: { title: string; value: number; description: string; trend: number | null }) => (
  <Card variant="outline">
    <CardBody>
      <Stat>
        <StatLabel color="gray.500" fontSize="sm">{title}</StatLabel>
        <StatNumber fontSize="2xl">{value.toLocaleString()}</StatNumber>
        <StatHelpText mb={0}>
          {description}
          {trend !== null && (
            <Badge ml={2} colorScheme={trend >= 0 ? 'green' : 'red'}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </Badge>
          )}
        </StatHelpText>
      </Stat>
    </CardBody>
  </Card>
);

const DetailRow = ({ label, value, isUrl = false, isCopyable = false }: { label: string; value: string; isUrl?: boolean; isCopyable?: boolean }) => (
  <Box>
    <Text fontSize="sm" color="gray.500" mb={1}>{label}</Text>
    <HStack>
      {isUrl ? (
        <ChakraLink href={value} isExternal color="teal.500" noOfLines={1} textDecoration="underline">
          {value}
        </ChakraLink>
      ) : (
        <Text overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" maxW="100%">{value}</Text>
      )}
      {isCopyable && (
        <IconButton
          icon={<FiCopy />}
          aria-label={`Copy ${label}`}
          size="sm"
          variant="ghost"
          onClick={() => navigator.clipboard.writeText(value)}
        />
      )}
    </HStack>
  </Box>
);

export default QRCodeDetails;
