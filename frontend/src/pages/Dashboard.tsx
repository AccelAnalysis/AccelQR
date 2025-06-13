import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardBody, 
  CardHeader, 
  Flex, 
  Heading, 
  HStack, 
  Spinner, 
  Table, 
  Tbody, 
  Td, 
  Text, 
  Th, 
  Thead, 
  Tr, 
  useToast,
  Badge,
  Link as ChakraLink,
  Select,
  SimpleGrid,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton
 } from '@chakra-ui/react';
import { FiRefreshCw, FiDownload, FiCode, FiBarChart2, FiTrendingUp, FiMoreHorizontal } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import FolderSidebar from '../components/FolderSidebar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const ENDPOINTS = {
  QR_CODES: `${API_URL}/qrcodes`,
  FOLDERS: `${API_URL}/folders`,
  STATS: `${API_URL}/stats`,
  STATS_DASHBOARD: `${API_URL}/stats/dashboard`,
  EXPORT_QRCODES: `${API_URL}/export/qrcodes`
} as const;

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

type SortableField = keyof Pick<QRCode, 'name' | 'short_code' | 'scan_count' | 'created_at' | 'folder'>;

// Stat card component
const StatCard = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <Card variant="outline">
    <CardBody>
      <Flex justify="space-between" align="center">
        <Box>
          <Text color="gray.500" fontSize="sm">{label}</Text>
          <Heading size="lg">{value}</Heading>
        </Box>
        <Box color="blue.500" fontSize="2xl">
          {icon}
        </Box>
      </Flex>
    </CardBody>
  </Card>
);

const Dashboard = () => {
  // State management
  const [qrcodes, setQRCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [newFolderName, setNewFolderName] = useState('');
  const toast = useToast();
  
  // Time range options for the dashboard - memoized to prevent unnecessary re-renders
  const timeRangeOptions = useMemo(() => [
    { value: '24h', label: 'Last 24 hours' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
  ], []);
  
  // Format number with commas
  const formatNumber = useCallback((num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }, []);
  
  // Format date for display
  const formatDate = useCallback((dateString: string): string => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  }, []);
  
  // Event handlers
  const handleTimeRangeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeRange(event.target.value);
  }, []);
  
  const handleFolderSelect = useCallback((folder: string | null) => {
    setActiveFolder(folder);
  }, []);
  
  // Data fetching functions
  const fetchQRCodes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(ENDPOINTS.QR_CODES);
      setQRCodes(response.data);
      return response.data;
    } catch {

      console.error('Error fetching QR codes');
      toast({
        title: 'Error',
        description: 'Failed to load QR codes',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);
  
  const fetchDashboardStats = useCallback(async (folder: string | null = null, range: string = '30d') => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (folder && folder !== 'All QR Codes') {
        params.append('folder', folder);
      }
      params.append('time_range', range);
      
      const response = await axios.get(ENDPOINTS.STATS_DASHBOARD, { params });
      
      // Validate the data structure
      if (!response.data || !Array.isArray(response.data.scans)) {
        console.error('Invalid data structure received:', response.data);
        throw new Error('Invalid data structure');
      }
      
      setDashboardStats(response.data);
      return response.data;
    } catch {

      console.error('Error fetching dashboard stats');
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
  }, [toast]);
  
  // Data loading effect
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchDashboardStats(activeFolder, timeRange),
        fetchQRCodes()
      ]);
    };
    loadData();
  }, [activeFolder, timeRange, fetchQRCodes, fetchDashboardStats]);
  
  // Refresh data function
  const refreshData = useCallback(() => {
    return Promise.all([
      fetchQRCodes(),
      fetchDashboardStats(activeFolder, timeRange)
    ]);
  }, [activeFolder, timeRange, fetchQRCodes, fetchDashboardStats]);

  // Export single QR code (new endpoint)
  const handleExportNew = useCallback(async (id: number) => {
    try {
      const response = await axios.get(`${API_URL}/newstats/qrcode/${id}/quickstats`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `qrcode-export-${id}-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Export successful', description: 'QR code exported.', status: 'success', duration: 3000, isClosable: true });
    } catch {

      toast({ title: 'Export failed', description: 'Failed to export QR code.', status: 'error', duration: 5000, isClosable: true });
    }
  }, [toast]);

  // Folder-level export (new endpoint)
  const handleExportFolderNew = useCallback(async (folder: string) => {
    try {
      const response = await axios.get(`${API_URL}/newstats/export?folder=${encodeURIComponent(folder)}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `folder-export-${folder}-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Export successful', description: `Folder ${folder} exported.`, status: 'success', duration: 3000, isClosable: true });
    } catch {

      toast({ title: 'Export failed', description: 'Failed to export folder.', status: 'error', duration: 5000, isClosable: true });
    }
  }, [toast]);

  // Folder creation (new endpoint)
  const handleCreateFolderNew = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await axios.post(`${API_URL}/newstats/folders`, { name: newFolderName });
      toast({ title: 'Folder created', description: `Folder "${newFolderName}" created.`, status: 'success', duration: 3000, isClosable: true });
      setNewFolderName('');
      refreshData();
    } catch {

      toast({ title: 'Error', description: 'Could not create folder.', status: 'error', duration: 5000, isClosable: true });
    }
  }, [newFolderName, toast, refreshData]);
  
  // Sort configuration state
  const [sortConfig, setSortConfig] = useState<{
    key: SortableField;
    direction: 'ascending' | 'descending';
  }>({
    key: 'created_at',
    direction: 'descending',
  });
  
  // Sort function
  const requestSort = useCallback((key: SortableField) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'ascending' 
        ? 'descending' 
        : 'ascending',
    }));
  }, []);
  
  // Get sort indicator
  const getSortIndicator = useCallback((key: SortableField) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
  }, [sortConfig]);
  
  // Sort and filter QR codes
  const sortedQRCodes = useMemo(() => {
    const sortableItems = [...qrcodes];
    
    // Filter by active folder
    const filtered = sortableItems.filter(qr => {
      const matchesFolder = !activeFolder || qr.folder === activeFolder;
      return matchesFolder;
    });

    // Sort the filtered results
    return [...filtered].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortConfig.direction === 'ascending' ? 1 : -1;

      // Convert dates to timestamps for comparison
      if (sortConfig.key === 'created_at') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }

      // Compare values
      if (aValue < bValue) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
  }, [qrcodes, sortConfig, activeFolder]);

  // QR Code Table component
  const QRCodeTable = useMemo(() => {
    if (loading) {
      return (
        <Flex justify="center" align="center" minH="200px">
          <Spinner size="xl" />
        </Flex>
      );
    }
    
    if (sortedQRCodes.length === 0) {
      return (
        <Box textAlign="center" py={10}>
          <Text fontSize="lg" color="gray.500">
            No QR codes found{activeFolder ? ` in ${activeFolder}` : ''}
          </Text>
        </Box>
      );
    }
    
    return (
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th 
              cursor="pointer" 
              onClick={() => requestSort('name')}
              _hover={{ bg: 'gray.100' }}
            >
              Name {getSortIndicator('name')}
            </Th>
            <Th 
              cursor="pointer" 
              onClick={() => requestSort('short_code')}
              _hover={{ bg: 'gray.100' }}
            >
              Short Code {getSortIndicator('short_code')}
            </Th>
            <Th 
              cursor="pointer" 
              onClick={() => requestSort('scan_count')}
              _hover={{ bg: 'gray.100' }}
              isNumeric
            >
              Scans {getSortIndicator('scan_count')}
            </Th>
            <Th 
              cursor="pointer" 
              onClick={() => requestSort('created_at')}
              _hover={{ bg: 'gray.100' }}
            >
              Created {getSortIndicator('created_at')}
            </Th>
            <Th 
              cursor="pointer" 
              onClick={() => requestSort('folder')}
              _hover={{ bg: 'gray.100' }}
            >
              Folder {getSortIndicator('folder')}
            </Th>
            <Th>
              {/* Actions column */}
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {sortedQRCodes.map((qr) => (
            <Tr key={qr.id} _hover={{ bg: 'gray.50' }}>
              <Td>
                <ChakraLink as={RouterLink} to={`/qrcodes/${qr.id}`} color="blue.500">
                  {qr.name}
                </ChakraLink>
              </Td>
              <Td>
                <code>{qr.short_code}</code>
              </Td>
              <Td isNumeric>{formatNumber(qr.scan_count)}</Td>
              <Td>{formatDate(qr.created_at)}</Td>
              <Td>
                {qr.folder ? (
                  <Badge colorScheme="blue">{qr.folder}</Badge>
                ) : (
                  <Badge colorScheme="gray">No Folder</Badge>
                )}
              </Td>
              <Td>
                <Menu>
                  <MenuButton
                    as={IconButton}
                    aria-label="More options"
                    icon={<FiMoreHorizontal />}
                    variant="ghost"
                    size="sm"
                  />
                  <MenuList>
                    <MenuItem as={RouterLink} to={`/qrcodes/${qr.id}`}>View Stats</MenuItem>
                    <MenuItem as={RouterLink} to={`/newstats/${qr.id}`}>New Stats View</MenuItem>
                    <MenuItem onClick={() => handleExportNew(qr.id)} icon={<FiDownload />}>Export (New)</MenuItem>
                    <MenuItem onClick={() => handleExportFolderNew(qr.folder || '')} icon={<FiDownload />}>Export Folder (New)</MenuItem>
                  </MenuList>
                </Menu>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    );
  }, [loading, sortedQRCodes, activeFolder, requestSort, getSortIndicator, formatNumber, formatDate, handleExportNew, handleExportFolderNew]);

  // Dashboard stats component
  const DashboardStatsCard = useMemo(() => {
    if (!dashboardStats) return null;
    
    return (
      <Card mb={6}>
        <CardHeader>
          <Flex justify="space-between" align="center">
            <Heading size="md">Statistics</Heading>
            <Select 
              value={timeRange} 
              onChange={handleTimeRangeChange}
              width="auto"
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
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <StatCard 
              label="Total QR Codes" 
              value={formatNumber(dashboardStats.total_qrcodes)} 
              icon={<FiCode />}
            />
            <StatCard 
              label="Total Scans" 
              value={formatNumber(dashboardStats.total_scans)} 
              icon={<FiBarChart2 />}
            />
            <StatCard 
              label="Scans This Period" 
              value={formatNumber(dashboardStats.scans.reduce((sum, scan) => sum + scan.count, 0))} 
              icon={<FiTrendingUp />}
            />
          </SimpleGrid>
          
          <Box mt={6} height="300px">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboardStats.scans}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  tickFormatter={(value) => formatNumber(Number(value))}
                  tick={{ fontSize: 12 }}
                />
                <RechartsTooltip 
                  formatter={(value: number) => [formatNumber(value), 'Scans']}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3182ce" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </CardBody>
      </Card>
    );
  }, [dashboardStats, timeRange, handleTimeRangeChange, formatNumber, timeRangeOptions]);
  
  // Main render
  return (
    <Box p={6}>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Dashboard</Heading>
        <HStack spacing={4} mb={4}>
          <Button 
            leftIcon={<FiRefreshCw />} 
            onClick={refreshData}
            isLoading={loading}
            loadingText="Refreshing..."
          >
            Refresh
          </Button>
        </HStack>
      {/* New Folder Creation UI */}
      <Box mb={4}>
        <form onSubmit={handleCreateFolderNew} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input
            placeholder="New Folder Name"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            size="sm"
            width="auto"
          />
          <Button type="submit" size="sm" colorScheme="teal">Create Folder (New)</Button>
        </form>
      </Box>

      </Flex>
      
      <Flex>
        {/* Sidebar */}
        <Box width="250px" mr={6}>
          <FolderSidebar 
            activeFolder={activeFolder}
            onSelectFolder={handleFolderSelect}
          />
        </Box>
        
        {/* Main content */}
        <Box flex={1}>
          {DashboardStatsCard}
          <Card>
            <CardHeader>
              <Heading size="md">QR Codes</Heading>
            </CardHeader>
            <CardBody>
              {QRCodeTable}
            </CardBody>
          </Card>
        </Box>
      </Flex>
    </Box>
  );
};

export default Dashboard;
