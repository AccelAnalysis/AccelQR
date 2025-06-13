import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Button, 
  Card, 
  CardBody, 
  CardHeader, 
  FormControl, 
  FormLabel, 
  HStack, 
  Heading,
  IconButton, 
  Input, 
  Modal, 
  ModalBody, 
  ModalCloseButton, 
  ModalContent, 
  ModalFooter, 
  ModalHeader, 
  ModalOverlay, 
  Select, 
  SimpleGrid, 
  Spinner, 
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text, 
  Textarea,
  useDisclosure, 
  useToast, 
  VStack
} from '@chakra-ui/react';

import { DeleteIcon } from '@chakra-ui/icons';
import { FiArrowLeft, FiCopy, FiDownload, FiEdit2, FiExternalLink, FiTrash2, FiGlobe, FiSmartphone, FiClock, FiBarChart2 } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const ENDPOINTS = {
  QR_CODES: `${API_URL}/qrcodes`,
  FOLDERS: `${API_URL}/folders`
};

interface QRCode {
  id: number;
  name: string;
  short_code: string;
  target_url: string;
  description: string;
  created_at: string;
  scan_count: number;
  folder: string | null;
  qr_code_image?: string;
  short_url?: string;
}

interface ScanData {
  date: string;
  count: number;
}

interface Scan {
  id: string;
  created_at: string;
  user_agent?: string;
  ip_address?: string;
  country?: string;
  region?: string;
  city?: string;
  device_type?: string;
  os?: string;
  browser?: string;
  referrer?: string;
  time_on_page?: number;
  scroll_depth?: number;
}

interface EnhancedStats {
  total_scans: number;
  scans_by_country: Record<string, number>;
  scans_by_device: Record<string, number>;
  scans_by_os: Record<string, number>;
  scans_by_browser: Record<string, number>;
  scans_by_hour: Record<string, number>;
  scans_by_weekday: Record<string, number>;
  avg_time_on_page: number;
  scroll_rate: number;
  top_referrers: Record<string, number>;
  scans: Scan[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  description 
}) => (
  <Card variant="outline" h="100%">
    <CardBody>
      <Stat>
        <StatLabel color="gray.600" fontSize="sm">{title}</StatLabel>
        <StatNumber fontSize="2xl">{value}</StatNumber>
        <StatHelpText mb={0}>{description}</StatHelpText>
      </Stat>
    </CardBody>
  </Card>
);

const QRCodeDetail: React.FC = (): React.ReactElement => {
  const { id } = useParams<{ id: string }>();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const [qrCode, setQRCode] = useState<QRCode | null>(null);
  const [scanData, setScanData] = useState<ScanData[]>([]);
  const [enhancedStats, setEnhancedStats] = useState<EnhancedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [folders, setFolders] = useState<string[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    target_url: '',
    description: '',
    folder: ''
  });
  // Tab state
  const [tabIndex, setTabIndex] = useState(0);
  const navigate = useNavigate();
  
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const fetchQRCode = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const [qrResponse, statsResponse, enhancedStatsResponse] = await Promise.all([
        axios.get(`${API_URL}/qrcodes/flex/${id}`),
        axios.get(`${API_URL}/qrcodes/flex/${id}/stats`),
        axios.get(`${API_URL}/qrcodes/flex/${id}/enhanced-stats`)
      ]);
      
      setQRCode(qrResponse.data);
      setScanData(statsResponse.data.daily_scans || []);
      setEnhancedStats(enhancedStatsResponse.data);
      setFormData({
        name: qrResponse.data.name,
        target_url: qrResponse.data.target_url,
        description: qrResponse.data.description || '',
        folder: qrResponse.data.folder || ''
      });
    } catch (error) {
      console.error('Error fetching QR code:', error);
      toast({
        title: 'Error',
        description: 'Failed to load QR code details',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  const fetchFolders = useCallback(async () => {
    try {
      const response = await axios.get(ENDPOINTS.FOLDERS);
      setFolders(response.data);
    } catch (error) {
      console.error('Error fetching folders:', error);
      toast({
        title: 'Error',
        description: 'Failed to load folders',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoadingFolders(false);
    }
  }, [toast]);

  useEffect(() => {
    if (id) {
      fetchQRCode();
      fetchFolders();
    }
  }, [id, fetchQRCode, fetchFolders]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdate = async () => {
    if (!id) return;
    
    try {
      const response = await axios.put(`${ENDPOINTS.QR_CODES}/${id}`, formData);
      setQRCode(response.data);
      setIsEditing(false);
      toast({
        title: 'Success',
        description: 'QR code updated successfully',
        status: 'success',
        duration: 3000,
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
    if (!id) return;
    
    try {
      setDeleting(true);
      await axios.delete(ENDPOINTS.QR_CODES + `/${id}`);
      toast({
        title: 'Success',
        description: 'QR code deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Error deleting QR code:', error);
      setDeleting(false);
      toast({
        title: 'Error',
        description: 'Failed to delete QR code',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setDeleting(false);
      onClose();
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

  // Loading state
  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Loading QR code details...</Text>
      </Box>
    );
  }

  if (!qrCode) {
    return (
      <Box textAlign="center" py={10}>
        <Text>QR code not found</Text>
      </Box>
    );
  }

  return (
    <Box minH="100vh" p={{ base: 4, md: 6 }}>
      <Box maxW="1400px" mx="auto" h="100%">
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
                size="lg"
                fontWeight="bold"
              />
            ) : (
              <Heading size="lg">{qrCode.name}</Heading>
            )}
            <HStack>
              {!isEditing ? (
                <>
                  <IconButton
                    icon={<FiEdit2 />}
                    aria-label="Edit"
                    onClick={() => setIsEditing(true)}
                  />
                  <IconButton
                    icon={<FiTrash2 />}
                    aria-label="Delete"
                    colorScheme="red"
                    variant="ghost"
                    onClick={onOpen}
                  />
                </>
              ) : (
                <>
                  <Button 
                    colorScheme="blue" 
                    size="sm" 
                    onClick={handleUpdate}
                    isLoading={loading}
                  >
                    Save
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({
                        name: qrCode.name,
                        target_url: qrCode.target_url,
                        description: qrCode.description || '',
                        folder: qrCode.folder || ''
                      });
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </HStack>
          </HStack>
        </CardHeader>
        <CardBody>
          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
            <Box>
              <Box 
                as="img"
                src={qrCode.qr_code_image}
                alt={`QR Code for ${qrCode.name}`}
                maxW="100%"
                maxH="300px"
                mx="auto"
                display="block"
                mb={4}
              />
              <HStack spacing={4} justify="center">
                <Button
                  leftIcon={<FiDownload />}
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `${API_URL}/qrcodes/${qrCode.short_code}/image`;
                    link.download = `qrcode-${qrCode.short_code}.png`;
                    link.click();
                  }}
                >
                  Download
                </Button>
                <Button
                  leftIcon={<FiCopy />}
                  onClick={() => copyToClipboard(`${window.location.origin}/r/${qrCode.short_code}`)}
                >
                  Copy Link
                </Button>
              </HStack>
            </Box>
            <Box>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>Destination URL</FormLabel>
                  {isEditing ? (
                    <Input
                      name="target_url"
                      value={formData.target_url}
                      onChange={handleChange}
                      placeholder="https://example.com"
                    />
                  ) : (
                    <HStack>
                      <Text isTruncated>{qrCode.target_url}</Text>
                      <IconButton
                        icon={<FiExternalLink size={16} />}
                        aria-label="Open URL"
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(qrCode.target_url, '_blank')}
                      />
                    </HStack>
                  )}
                </FormControl>

                <FormControl>
                  <FormLabel>Description</FormLabel>
                  {isEditing ? (
                    <Textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Enter a description"
                      rows={3}
                    />
                  ) : (
                    <Text color={qrCode.description ? 'inherit' : 'gray.500'}>
                      {qrCode.description || 'No description'}
                    </Text>
                  )}
                </FormControl>

                <FormControl>
                  <FormLabel>Folder</FormLabel>
                  {isEditing ? (
                    <Select
                      name="folder"
                      value={formData.folder}
                      onChange={handleChange}
                      placeholder="Select a folder (optional)"
                      isDisabled={isLoadingFolders}
                    >
                      <option value="">No folder</option>
                      {folders.map((folder) => (
                        <option key={folder} value={folder}>
                          {folder}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Text>{qrCode.folder || 'No folder'}</Text>
                  )}
                </FormControl>

                <SimpleGrid columns={2} spacing={4} mt={4}>
                  <Stat>
                    <StatLabel>Short Code</StatLabel>
                    <StatNumber fontSize="lg">{qrCode.short_code}</StatNumber>
                    <StatHelpText>
                      <HStack>
                        <Text>{`${window.location.origin}/r/${qrCode.short_code}`}</Text>
                        <IconButton
                          icon={<FiCopy size={14} />}
                          aria-label="Copy URL"
                          size="xs"
                          variant="ghost"
                          onClick={() => copyToClipboard(`${window.location.origin}/r/${qrCode.short_code}`)}
                        />
                      </HStack>
                    </StatHelpText>
                  </Stat>
                  <Stat>
                    <StatLabel>Created</StatLabel>
                    <StatNumber fontSize="lg">{formatDate(qrCode.created_at)}</StatNumber>
                    <StatHelpText>
                      {new Date(qrCode.created_at).toLocaleDateString()}
                    </StatHelpText>
                  </Stat>
                </SimpleGrid>
              </VStack>
            </Box>
          </SimpleGrid>
        </CardBody>
      </Card>

      <Tabs 
        variant="enclosed" 
        colorScheme="blue" 
        mb={6}
        index={tabIndex}
        onChange={(index) => setTabIndex(index as number)}
        isFitted
        isLazy
        w="100%"
        overflowX="auto"
      >
        <TabList overflowX="auto" overflowY="hidden" pb={1} w="max-content" minW="100%">
          <Tab whiteSpace="nowrap" minW="max-content" px={4}><FiBarChart2 style={{ marginRight: '8px' }} /> Overview</Tab>
          <Tab whiteSpace="nowrap" minW="max-content" px={4}><FiGlobe style={{ marginRight: '8px' }} /> Locations</Tab>
          <Tab whiteSpace="nowrap" minW="max-content" px={4}><FiSmartphone style={{ marginRight: '8px' }} /> Devices</Tab>
          <Tab whiteSpace="nowrap" minW="max-content" px={4}><FiClock style={{ marginRight: '8px' }} /> Engagement</Tab>
        </TabList>

        <TabPanels>
          {/* Overview Tab */}
          <TabPanel p={0} pt={6}>
            <SimpleGrid 
              columns={{ base: 1, sm: 2, lg: 3 }} 
              spacing={{ base: 4, md: 6 }} 
              mb={6}
              w="100%"
            >
              <StatCard 
                title="Total Scans" 
                value={qrCode.scan_count} 
                description="All time scans" 
              />
              <StatCard 
                title="Avg. Time on Page" 
                value={enhancedStats?.avg_time_on_page ? `${enhancedStats.avg_time_on_page}s` : 'N/A'} 
                description="Average engagement time" 
              />
              <StatCard 
                title="Scroll Rate" 
                value={enhancedStats?.scroll_rate ? `${enhancedStats.scroll_rate}%` : 'N/A'} 
                description="Percentage of users who scrolled" 
              />
            </SimpleGrid>

            <Card mb={6}>
              <CardHeader>
                <Heading size="md">Scan Activity</Heading>
              </CardHeader>
              <CardBody>
                {scanData.length > 0 ? (
                  <Box minH="300px" w="100%" position="relative">
                    <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                      <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={scanData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        />
                        <YAxis />
                        <RechartsTooltip 
                          labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          name="Scans" 
                          stroke="#3182ce" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                ) : (
                  <Box textAlign="center" py={10}>
                    <Text color="gray.500">No scan data available yet</Text>
                  </Box>
                )}
              </CardBody>
            </Card>
          </TabPanel>

          {/* Locations Tab */}
          <TabPanel p={0} pt={6}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <Card>
                <CardHeader>
                  <Heading size="md">Top Locations</Heading>
                </CardHeader>
                <CardBody>
                  {enhancedStats?.scans_by_country && Object.keys(enhancedStats.scans_by_country).length > 0 ? (
                    <Table variant="simple" size="sm">
                      <Thead>
                        <Tr>
                          <Th>Location</Th>
                          <Th isNumeric>Scans</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {Object.entries(enhancedStats.scans_by_country)
                          .sort((a, b) => b[1] - a[1])
                          .map(([country, count]) => {
                            // Get all scans for this country
                            const countryScans = (enhancedStats.scans || []).filter(
                              (scan: Scan) => scan.country === country
                            );
                            
                            // Group by city, region
                            const locations = countryScans.reduce((acc: Record<string, number>, scan: Scan) => {
                              const key = `${scan.city || 'Unknown'}, ${scan.region || 'Unknown'}`;
                              acc[key] = (acc[key] || 0) + 1;
                              return acc;
                            }, {} as Record<string, number>);
                            
                            return (
                              <React.Fragment key={country}>
                                <Tr bg="gray.50">
                                  <Td colSpan={2} fontWeight="bold">
                                    {country || 'Unknown'}
                                    <Text as="span" ml={2} color="gray.500" fontWeight="normal">
                                      ({count} scans)
                                    </Text>
                                  </Td>
                                </Tr>
                                {Object.entries(locations)
                                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                                  .map(([location, locationCount]) => (
                                    <Tr key={`${country}-${location}`}>
                                      <Td pl={8} fontStyle="italic">
                                        {location}
                                      </Td>
                                      <Td isNumeric>{locationCount as number}</Td>
                                    </Tr>
                                  ))}
                              </React.Fragment>
                            );
                          })}
                      </Tbody>
                    </Table>
                  ) : (
                    <Text color="gray.500">No location data available</Text>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <Heading size="md">Top Referrers</Heading>
                </CardHeader>
                <CardBody>
                  {enhancedStats?.top_referrers && Object.keys(enhancedStats.top_referrers).length > 0 ? (
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Domain</Th>
                          <Th isNumeric>Visits</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {Object.entries(enhancedStats.top_referrers)
                          .map(([domain, count]) => (
                            <Tr key={domain}>
                              <Td>{domain || 'Direct'}</Td>
                              <Td isNumeric>{count}</Td>
                            </Tr>
                          ))}
                      </Tbody>
                    </Table>
                  ) : (
                    <Text color="gray.500">No referrer data available</Text>
                  )}
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>

          {/* Devices Tab */}
          <TabPanel p={0} pt={6}>
            <SimpleGrid 
              columns={{ base: 1, sm: 2, lg: 3 }} 
              spacing={{ base: 4, md: 6 }}
              w="100%"
            >
              <Card h="100%">
                <CardHeader>
                  <Heading size="md">Devices</Heading>
                </CardHeader>
                <CardBody>
                  {enhancedStats?.scans_by_device && Object.keys(enhancedStats.scans_by_device).length > 0 ? (
                    <Box minH="300px" w="100%" position="relative">
                      <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                        <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Object.entries(enhancedStats.scans_by_device).map(([name, value]) => ({
                              name: name.charAt(0).toUpperCase() + name.slice(1),
                              value
                            }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {Object.entries(enhancedStats.scans_by_device).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      </Box>
                    </Box>
                  ) : (
                    <Text color="gray.500">No device data available</Text>
                  )}
                </CardBody>
              </Card>

              <Card h="100%">
                <CardHeader>
                  <Heading size="md">Operating Systems</Heading>
                </CardHeader>
                <CardBody>
                  {enhancedStats?.scans_by_os && Object.keys(enhancedStats.scans_by_os).length > 0 ? (
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>OS</Th>
                          <Th isNumeric>Scans</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {Object.entries(enhancedStats.scans_by_os)
                          .sort((a, b) => b[1] - a[1])
                          .map(([os, count]) => (
                            <Tr key={os}>
                              <Td>{os}</Td>
                              <Td isNumeric>{count}</Td>
                            </Tr>
                          ))}
                      </Tbody>
                    </Table>
                  ) : (
                    <Text color="gray.500">No OS data available</Text>
                  )}
                </CardBody>
              </Card>

              <Card h="100%">
                <CardHeader>
                  <Heading size="md">Browsers</Heading>
                </CardHeader>
                <CardBody>
                  {enhancedStats?.scans_by_browser && Object.keys(enhancedStats.scans_by_browser).length > 0 ? (
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Browser</Th>
                          <Th isNumeric>Scans</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {Object.entries(enhancedStats.scans_by_browser)
                          .sort((a, b) => b[1] - a[1])
                          .map(([browser, count]) => (
                            <Tr key={browser}>
                              <Td>{browser}</Td>
                              <Td isNumeric>{count}</Td>
                            </Tr>
                          ))}
                      </Tbody>
                    </Table>
                  ) : (
                    <Text color="gray.500">No browser data available</Text>
                  )}
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>

          {/* Engagement Tab */}
          <TabPanel p={0} pt={6}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <Card h="100%">
                <CardHeader>
                  <Heading size="md">Scans by Hour</Heading>
                </CardHeader>
                <CardBody>
                  {enhancedStats?.scans_by_hour ? (
                    <Box minH="300px" w="100%" position="relative">
                      <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={Object.entries(enhancedStats.scans_by_hour).map(([hour, count]) => ({
                              hour: `${hour}:00`,
                              scans: count
                            }))}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="hour" />
                            <YAxis />
                            <RechartsTooltip />
                            <Bar dataKey="scans" fill="#3182ce" name="Scans" />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </Box>
                  ) : (
                    <Text color="gray.500">No hourly data available</Text>
                  )}
                </CardBody>
              </Card>

              <Card h="100%">
                <CardHeader>
                  <Heading size="md">Scans by Weekday</Heading>
                </CardHeader>
                <CardBody>
                  {enhancedStats?.scans_by_weekday ? (
                    <Box minH="300px" w="100%" position="relative">
                      <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              { name: 'Sun', scans: enhancedStats.scans_by_weekday['0'] || 0 },
                              { name: 'Mon', scans: enhancedStats.scans_by_weekday['1'] || 0 },
                              { name: 'Tue', scans: enhancedStats.scans_by_weekday['2'] || 0 },
                              { name: 'Wed', scans: enhancedStats.scans_by_weekday['3'] || 0 },
                              { name: 'Thu', scans: enhancedStats.scans_by_weekday['4'] || 0 },
                              { name: 'Fri', scans: enhancedStats.scans_by_weekday['5'] || 0 },
                              { name: 'Sat', scans: enhancedStats.scans_by_weekday['6'] || 0 },
                            ]}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <RechartsTooltip />
                            <Bar dataKey="scans" fill="#38a169" name="Scans" />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </Box>
                  ) : (
                    <Text color="gray.500">No weekday data available</Text>
                  )}
                </CardBody>
              </Card>
            </SimpleGrid>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <Modal isOpen={isOpen} onClose={deleting ? () => {} : onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete QR Code</ModalHeader>
          <ModalCloseButton isDisabled={deleting} />
          <ModalBody>
            <Text>Are you sure you want to delete this QR code? This action cannot be undone.</Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose} isDisabled={deleting}>
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={handleDelete}
              leftIcon={<DeleteIcon />}
              isLoading={deleting}
              loadingText="Deleting..."
              isDisabled={deleting}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      </Box>
    </Box>
  );
};

export default QRCodeDetail;
