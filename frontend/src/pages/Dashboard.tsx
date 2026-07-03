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
  Input,
  InputGroup,
  InputLeftElement,
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
  IconButton,
  Tooltip,
  VStack
 } from '@chakra-ui/react';
import { FiRefreshCw, FiDownload, FiCode, FiBarChart2, FiTrendingUp, FiMoreHorizontal, FiSearch, FiCopy, FiExternalLink, FiEye, FiX } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Link as RouterLink } from 'react-router-dom';
// Added import for the new page

import apiClient from '../api/client';
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
  last_scanned_at: string | null;
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

type SortableField = keyof Pick<QRCode, 'name' | 'short_code' | 'scan_count' | 'created_at' | 'last_scanned_at' | 'folder'>;
type ScanStatusFilter = 'all' | 'never' | 'today' | 'recent' | 'inactive';
type CreatedDateFilter = 'all' | '7d' | '30d' | '90d';
type LastScannedDateFilter = 'all' | '24h' | '7d' | '30d' | 'never';

const SCAN_STATUS_OPTIONS: Array<{ value: ScanStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'never', label: 'Never Scanned' },
  { value: 'today', label: 'Active Today' },
  { value: 'recent', label: 'Recently Active' },
  { value: 'inactive', label: 'Inactive' },
];

const CREATED_DATE_OPTIONS: Array<{ value: CreatedDateFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

const LAST_SCANNED_DATE_OPTIONS: Array<{ value: LastScannedDateFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'never', label: 'Never Scanned' },
];

const getAppBaseUrl = () => API_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');
const getShortUrl = (shortCode: string) => `${getAppBaseUrl()}/r/${shortCode}`;

const getStartOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const isToday = (dateString: string | null) => {
  if (!dateString) return false;
  return new Date(dateString) >= getStartOfToday();
};

const isWithinDays = (dateString: string | null, days: number) => {
  if (!dateString) return false;
  return new Date(dateString) >= getDaysAgo(days);
};

const getScanStatus = (qr: QRCode): { key: Exclude<ScanStatusFilter, 'all'> | 'active'; label: string; colorScheme: string } => {
  if (qr.scan_count === 0 || !qr.last_scanned_at) {
    return { key: 'never', label: 'Never Scanned', colorScheme: 'gray' };
  }
  if (isToday(qr.last_scanned_at)) {
    return { key: 'today', label: 'Active Today', colorScheme: 'green' };
  }
  if (isWithinDays(qr.last_scanned_at, 7)) {
    return { key: 'recent', label: 'Recently Active', colorScheme: 'blue' };
  }
  if (!isWithinDays(qr.last_scanned_at, 30)) {
    return { key: 'inactive', label: 'Inactive', colorScheme: 'orange' };
  }
  return { key: 'active', label: 'Scanned', colorScheme: 'teal' };
};

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
  const [searchQuery, setSearchQuery] = useState('');
  const [scanStatusFilter, setScanStatusFilter] = useState<ScanStatusFilter>('all');
  const [createdDateFilter, setCreatedDateFilter] = useState<CreatedDateFilter>('all');
  const [lastScannedDateFilter, setLastScannedDateFilter] = useState<LastScannedDateFilter>('all');
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
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await apiClient.get(ENDPOINTS.QR_CODES, { headers });
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

      // Calculate start_date and end_date based on range
      const now = new Date();
      let startDate: Date;
      const endDate: Date = now;
      switch (range) {
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          startDate = new Date(2000, 0, 1); // Arbitrary early date
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      // Format to YYYY-MM-DD
      const formatDate = (d: Date) => d.toISOString().slice(0, 10);
      params.append('start_date', formatDate(startDate));
      params.append('end_date', formatDate(endDate));

      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await apiClient.get(ENDPOINTS.STATS_DASHBOARD, { params, headers });
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

  const copyShortLink = useCallback(async (shortCode: string) => {
    const shortUrl = getShortUrl(shortCode);
    await navigator.clipboard.writeText(shortUrl);
    toast({
      title: 'Short link copied',
      description: shortUrl,
      status: 'success',
      duration: 2500,
      isClosable: true,
    });
  }, [toast]);

  const downloadQrImage = useCallback((qr: QRCode) => {
    const link = document.createElement('a');
    link.href = `${API_URL}/qrcodes/image-by-shortcode/${qr.short_code}`;
    link.download = `qrcode-${qr.short_code}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setScanStatusFilter('all');
    setCreatedDateFilter('all');
    setLastScannedDateFilter('all');
    setActiveFolder(null);
  }, []);
  
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
  
  const hasActiveFilters = Boolean(
    searchQuery.trim()
    || activeFolder
    || scanStatusFilter !== 'all'
    || createdDateFilter !== 'all'
    || lastScannedDateFilter !== 'all'
  );

  const folderCounts = useMemo(() => {
    return qrcodes.reduce((counts, qr) => {
      if (qr.folder) {
        counts[qr.folder] = (counts[qr.folder] || 0) + 1;
      }
      return counts;
    }, {} as Record<string, number>);
  }, [qrcodes]);

  const filteredQRCodes = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return qrcodes.filter(qr => {
      if (activeFolder && qr.folder !== activeFolder) {
        return false;
      }

      if (normalizedSearch) {
        const searchable = [
          qr.name,
          qr.short_code,
          qr.target_url,
          qr.folder || '',
        ].join(' ').toLowerCase();
        if (!searchable.includes(normalizedSearch)) {
          return false;
        }
      }

      if (scanStatusFilter !== 'all') {
        const status = getScanStatus(qr).key;
        if (scanStatusFilter === 'inactive') {
          if (status !== 'inactive' && status !== 'never') return false;
        } else if (status !== scanStatusFilter) {
          return false;
        }
      }

      if (createdDateFilter !== 'all') {
        const days = Number(createdDateFilter.replace('d', ''));
        if (!isWithinDays(qr.created_at, days)) {
          return false;
        }
      }

      if (lastScannedDateFilter !== 'all') {
        if (lastScannedDateFilter === 'never') {
          if (qr.last_scanned_at) return false;
        } else {
          const days = lastScannedDateFilter === '24h' ? 1 : Number(lastScannedDateFilter.replace('d', ''));
          if (!isWithinDays(qr.last_scanned_at, days)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [qrcodes, activeFolder, searchQuery, scanStatusFilter, createdDateFilter, lastScannedDateFilter]);

  // Sort and filter QR codes
  const sortedQRCodes = useMemo(() => {
    const filtered = [...filteredQRCodes];

    // Sort the filtered results
    return [...filtered].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortConfig.direction === 'ascending' ? 1 : -1;

      // Convert dates to timestamps for comparison
      if (sortConfig.key === 'created_at' || sortConfig.key === 'last_scanned_at') {
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
  }, [filteredQRCodes, sortConfig]);

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
            {hasActiveFilters
              ? 'No QR codes match the current search or filters.'
              : 'No QR codes found'}
          </Text>
          {hasActiveFilters && (
            <Button mt={4} size="sm" variant="outline" onClick={clearFilters} leftIcon={<FiX />}>
              Clear filters
            </Button>
          )}
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
            <Th>Status</Th>
            <Th 
              cursor="pointer" 
              onClick={() => requestSort('last_scanned_at')}
              _hover={{ bg: 'gray.100' }}
            >
              Last Scanned {getSortIndicator('last_scanned_at')}
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
              <Td>
                <Badge colorScheme={getScanStatus(qr).colorScheme}>
                  {getScanStatus(qr).label}
                </Badge>
              </Td>
              <Td>{qr.last_scanned_at ? formatDate(qr.last_scanned_at) : '-'}</Td>
              <Td>{formatDate(qr.created_at)}</Td>
              <Td>
                {qr.folder ? (
                  <Badge colorScheme="blue">{qr.folder}</Badge>
                ) : (
                  <Badge colorScheme="gray">No Folder</Badge>
                )}
              </Td>
              <Td>
                <HStack spacing={1} justify="flex-end">
                  <Tooltip label="View details">
                    <IconButton
                      as={RouterLink}
                      to={`/qrcodes/${qr.id}`}
                      aria-label={`View details for ${qr.name}`}
                      icon={<FiEye />}
                      variant="ghost"
                      size="sm"
                    />
                  </Tooltip>
                  <Tooltip label="Copy short link">
                    <IconButton
                      aria-label={`Copy short link for ${qr.name}`}
                      icon={<FiCopy />}
                      variant="ghost"
                      size="sm"
                      onClick={() => copyShortLink(qr.short_code)}
                    />
                  </Tooltip>
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      aria-label={`More actions for ${qr.name}`}
                      icon={<FiMoreHorizontal />}
                      variant="ghost"
                      size="sm"
                    />
                    <MenuList>
                      <MenuItem as={RouterLink} to={`/qrcodes/${qr.id}`} icon={<FiEye />}>View details</MenuItem>
                      <MenuItem onClick={() => copyShortLink(qr.short_code)} icon={<FiCopy />}>Copy short link</MenuItem>
                      <MenuItem onClick={() => window.open(qr.target_url, '_blank', 'noopener,noreferrer')} icon={<FiExternalLink />}>Open destination</MenuItem>
                      <MenuItem onClick={() => downloadQrImage(qr)} icon={<FiDownload />}>Download QR image</MenuItem>
                    </MenuList>
                  </Menu>
                </HStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    );
  }, [loading, sortedQRCodes, hasActiveFilters, clearFilters, requestSort, getSortIndicator, formatNumber, formatDate, copyShortLink, downloadQrImage]);

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
    <Box p={{ base: 4, md: 6 }}>
      <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={4} mb={6}>
        <Heading size="lg">Dashboard</Heading>
        <HStack spacing={4}>
          <Button 
            leftIcon={<FiRefreshCw />} 
            onClick={refreshData}
            isLoading={loading}
            loadingText="Refreshing..."
          >
            Refresh
          </Button>
        </HStack>
      </Flex>
      
      <Flex direction={{ base: 'column', lg: 'row' }} align="flex-start" gap={6}>
        {/* Sidebar */}
        <Box width={{ base: '100%', lg: '250px' }} flexShrink={0}>
          <FolderSidebar 
            activeFolder={activeFolder}
            onSelectFolder={handleFolderSelect}
            totalCount={qrcodes.length}
            folderCounts={folderCounts}
          />
        </Box>
        
        {/* Main content */}
        <Box flex={1} minW={0} w="100%">
          {DashboardStatsCard}
          <Card>
            <CardHeader>
              <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3}>
                <Box>
                  <Heading size="md">QR Codes</Heading>
                  <Text color="gray.500" fontSize="sm" mt={1}>
                    Showing {formatNumber(sortedQRCodes.length)} of {formatNumber(qrcodes.length)} QR codes
                  </Text>
                </Box>
                {hasActiveFilters && (
                  <Button size="sm" variant="outline" leftIcon={<FiX />} onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </Flex>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch" mb={4}>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <FiSearch color="gray" />
                  </InputLeftElement>
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by name, short code, target URL, or folder"
                  />
                </InputGroup>
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={1}>Scan status</Text>
                    <Select value={scanStatusFilter} onChange={(event) => setScanStatusFilter(event.target.value as ScanStatusFilter)}>
                      {SCAN_STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                  </Box>
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={1}>Created</Text>
                    <Select value={createdDateFilter} onChange={(event) => setCreatedDateFilter(event.target.value as CreatedDateFilter)}>
                      {CREATED_DATE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                  </Box>
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" mb={1}>Last scanned</Text>
                    <Select value={lastScannedDateFilter} onChange={(event) => setLastScannedDateFilter(event.target.value as LastScannedDateFilter)}>
                      {LAST_SCANNED_DATE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                  </Box>
                </SimpleGrid>
              </VStack>
              <Box overflowX="auto">
                {QRCodeTable}
              </Box>
            </CardBody>
          </Card>
        </Box>
      </Flex>
    </Box>
  );
};

export default Dashboard;
