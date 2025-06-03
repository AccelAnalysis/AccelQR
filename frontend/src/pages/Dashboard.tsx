import { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Heading, 
  Card, 
  CardHeader, 
  CardBody, 
  SimpleGrid, 
  Flex, 
  Button, 
  Text, 
  useToast,
  VStack,
  HStack,
  Spinner,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Link as ChakraLink,
  Select
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FiRefreshCw, FiDownload } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import FolderSidebar from '../components/FolderSidebar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const ENDPOINTS = {
  QR_CODES: `${API_URL}/qrcodes`,
  FOLDERS: `${API_URL}/folders`,
  STATS: `${API_URL}/stats`,
  STATS_DASHBOARD: `${API_URL}/stats/dashboard`
};

interface QRCode {
  id: number;
  name: string;
  short_code: string;
  target_url: string;
  created_at: string;
  scan_count: number;
  folder: string | null;
}

interface DailyScanData {
  date: string;
  count: number;
}

interface TimeRange {
  start: string;
  end: string;
  group_by: string;
  date_format: string;
}

interface DashboardStats {
  scans: DailyScanData[];
  total_scans: number;
  total_qrcodes: number;
  time_range: TimeRange;
}


const Dashboard = () => {
  const [qrcodes, setQRCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [isExporting, setIsExporting] = useState(false);
  const toast = useToast();
  
  const timeRangeOptions = [
    { value: '24h', label: 'Last 24 hours' },
    { value: '3d', label: 'Last 3 days' },
    { value: 'week', label: 'Last week' },
    { value: '30d', label: 'Last 30 days' },
    { value: '60d', label: 'Last 60 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '6m', label: 'Last 6 months' },
    { value: 'year', label: 'Last year' },
    { value: 'all', label: 'All time' },
  ];

  // Format number with commas
  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const fetchDashboardStats = useCallback(async (folder: string | null = null, range: string = '30d') => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (folder && folder !== 'All QR Codes') {
        params.append('folder', folder);
      }
      params.append('time_range', range);
      
      console.log('Fetching dashboard stats with params:', params.toString());
      const response = await axios.get(ENDPOINTS.STATS_DASHBOARD, { params });
      console.log('Received dashboard stats:', response.data);
      
      // Validate the data structure
      if (response.data && Array.isArray(response.data.scans)) {
        console.log('Scans data structure is valid');
        console.log('First scan item:', response.data.scans[0]);
      } else {
        console.error('Invalid data structure received:', response.data);
      }
      
      setDashboardStats(response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard statistics',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, setLoading, setDashboardStats]);
  
  const handleTimeRangeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRange = e.target.value;
    setTimeRange(newRange);
    fetchDashboardStats(activeFolder, newRange);
  }, [fetchDashboardStats, activeFolder]);

  const fetchQRCodes = useCallback(async (folder: string | null = null) => {
    try {
      setLoading(true);
      // First, fetch all QR codes (filtering is now done on the frontend)
      const response = await axios.get(ENDPOINTS.QR_CODES);
      
      // Filter QR codes by folder if one is selected
      let filteredQRCodes = response.data;
      if (folder) {
        filteredQRCodes = response.data.filter((qr: QRCode) => qr.folder === folder);
      }
      
      setQRCodes(filteredQRCodes);
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
  }, [setQRCodes, setLoading, toast]);

  // Handle folder selection
  const handleFolderSelect = async (folder: string | null) => {
    setActiveFolder(folder);
    // Refresh the QR codes for the selected folder
    await fetchQRCodes(folder);
    // Update the dashboard stats for the selected folder
    fetchDashboardStats(folder, timeRange);
  };

  // Fetch QR codes on component mount or when active folder changes
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchDashboardStats(activeFolder, timeRange),
        fetchQRCodes(activeFolder)
      ]);
    };
    loadData();
  }, [activeFolder, timeRange, fetchDashboardStats, fetchQRCodes]);

  const refreshData = () => {
    fetchQRCodes(activeFolder);
    fetchDashboardStats(activeFolder, timeRange);
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (activeFolder && activeFolder !== 'All QR Codes') {
        params.append('folder', activeFolder);
      }
      params.append('time_range', timeRange);
      
      const response = await fetch(`${ENDPOINTS.STATS_DASHBOARD}/export?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast({
        title: 'Export successful',
        description: 'Dashboard data has been exported',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export dashboard data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Box display="flex" minH="100vh">
      <FolderSidebar activeFolder={activeFolder} onSelectFolder={handleFolderSelect} />
      <Box flex={1} p={5}>
        <Flex justify="space-between" align="center" mb={6}>
          <VStack align="flex-start" spacing={1}>
            <Heading as="h1" size="lg">
              {activeFolder ? `${activeFolder} Dashboard` : 'Dashboard'}
            </Heading>
            <Text color="gray.500" fontSize="sm">
              {activeFolder ? 'Viewing folder analytics' : 'Viewing all QR codes'}
            </Text>
          </VStack>
          <HStack spacing={3}>
            <Button
              leftIcon={<FiDownload />}
              onClick={handleExport}
              isLoading={isExporting}
              loadingText="Exporting..."
              colorScheme="green"
              variant="outline"
              isDisabled={loading}
            >
              Export Data
            </Button>
            <Button
              leftIcon={<FiRefreshCw />}
              onClick={refreshData}
              isLoading={loading}
              colorScheme="blue"
              variant="outline"
            >
              Refresh
            </Button>
          </HStack>
        </Flex>

        {loading ? (
          <Flex justify="center" align="center" minH="200px">
            <Spinner size="xl" />
          </Flex>
        ) : dashboardStats ? (
          <Box>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={5} mb={8}>
              <Card>
                <CardHeader pb={0}>
                  <Text fontSize="sm" color="gray.500">Total Scans</Text>
                </CardHeader>
                <CardBody>
                  <Text fontSize="3xl" fontWeight="bold">
                    {formatNumber(dashboardStats.total_scans)}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    {activeFolder ? 'In this folder' : 'All time'}
                  </Text>
                </CardBody>
              </Card>
              <Card>
                <CardHeader pb={0}>
                  <Text fontSize="sm" color="gray.500">QR Codes</Text>
                </CardHeader>
                <CardBody>
                  <Text fontSize="3xl" fontWeight="bold">
                    {formatNumber(dashboardStats.total_qrcodes)}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    {activeFolder ? 'In this folder' : 'Total created'}
                  </Text>
                </CardBody>
              </Card>
              <Card>
                <CardHeader pb={0}>
                  <Text fontSize="sm" color="gray.500">Avg. Scans per Code</Text>
                </CardHeader>
                <CardBody>
                  <Text fontSize="3xl" fontWeight="bold">
                    {dashboardStats.total_qrcodes > 0 
                      ? (dashboardStats.total_scans / dashboardStats.total_qrcodes).toFixed(1)
                      : '0.0'}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    {activeFolder ? 'In this folder' : 'Lifetime average'}
                  </Text>
                </CardBody>
              </Card>
            </SimpleGrid>

            <Card mb={8}>
              <CardHeader pb={0}>
                <Flex justify="space-between" align="center" mb={4}>
                  <Text fontSize="lg" fontWeight="semibold">
                    Scan Activity
                    {activeFolder && ` - ${activeFolder}`}
                  </Text>
                  <Select 
                    value={timeRange}
                    onChange={handleTimeRangeChange}
                    size="sm" 
                    width="200px"
                    variant="filled"
                  >
                    {timeRangeOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Flex>
              </CardHeader>
              <CardBody>
                <Box h="400px" position="relative" border="1px solid red" p={4}>
                  <Box position="absolute" top={2} left={2} bg="white" p={1} zIndex={10}>
                    <Text fontSize="xs" color="gray.500">
                      Data points: {dashboardStats?.scans?.length || 0}
                    </Text>
                  </Box>
                  {dashboardStats?.scans?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
                    <LineChart data={dashboardStats.scans}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis 
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#4A5568' }}
                        axisLine={{ stroke: '#A0AEC0' }}
                        tickLine={{ stroke: '#A0AEC0' }}
                        tickFormatter={(value) => {
                          if (!value) return '';
                          const date = new Date(value);
                          if (isNaN(date.getTime())) return value;
                          
                          const format = dashboardStats.time_range?.date_format || '%Y-%m-%d';
                          if (format.includes('H')) {
                            // Hourly format
                            return date.toLocaleTimeString('en-US', { 
                              hour: 'numeric',
                              hour12: true 
                            });
                          } else if (format.includes('m') && !format.includes('H')) {
                            // Monthly format
                            return date.toLocaleDateString('en-US', { 
                              month: 'short',
                              year: 'numeric'
                            });
                          } else {
                            // Daily format
                            return date.toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric'
                            });
                          }
                        }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: '#4A5568' }}
                        axisLine={{ stroke: '#A0AEC0' }}
                        tickLine={{ stroke: '#A0AEC0' }}
                        width={40}
                      />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#2D3748', color: 'white' }}
                        labelFormatter={(value: string) => {
                          const date = new Date(value);
                          if (isNaN(date.getTime())) return value;
                          
                          const format = dashboardStats.time_range?.date_format || '%Y-%m-%d';
                          if (format.includes('H')) {
                            // Hourly format
                            return date.toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            });
                          } else if (format.includes('m') && !format.includes('H')) {
                            // Monthly format
                            return date.toLocaleDateString('en-US', {
                              month: 'long',
                              year: 'numeric'
                            });
                          } else {
                            // Daily format
                            return date.toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            });
                          }
                        }}
                        formatter={(value: number) => [`${value} scans`, 'Scans']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#3182ce" 
                        strokeWidth={2}
                        dot={dashboardStats.scans.length < 15} // Only show dots for smaller datasets
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box display="flex" alignItems="center" justifyContent="center" h="100%" color="gray.500">
                      No chart data available
                    </Box>
                  )}
                </Box>
              </CardBody>
            </Card>

            <Box>
              <Heading size="lg" mb={6}>
                {activeFolder === 'Uncategorized' 
                  ? 'Uncategorized QR Codes'
                  : activeFolder 
                  ? `QR Codes in ${activeFolder}`
                  : 'All QR Codes'}
              </Heading>
              
              {qrcodes.length > 0 ? (
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Short Code</Th>
                      <Th>Scans</Th>
                      <Th>Created</Th>
                      <Th>Folder</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {qrcodes.map((qr) => (
                      <Tr key={qr.id} _hover={{ bg: 'gray.50' }}>
                        <Td>
                          <ChakraLink as={RouterLink} to={`/qrcodes/${qr.id}`} color="blue.500">
                            {qr.name}
                          </ChakraLink>
                        </Td>
                        <Td>
                          <code>{qr.short_code}</code>
                        </Td>
                        <Td>{formatNumber(qr.scan_count)}</Td>
                        <Td>{formatDate(qr.created_at)}</Td>
                        <Td>
                          {qr.folder ? (
                            <Badge colorScheme="blue">{qr.folder}</Badge>
                          ) : (
                            <Badge colorScheme="gray">Uncategorized</Badge>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              ) : (
                <Text>No QR codes found{activeFolder ? ' in this folder' : ''}.</Text>
              )}
            </Box>
          </Box>
        ) : (
          <Text>No data available</Text>
        )}
      </Box>
    </Box>
  );
};

export default Dashboard;
