import { useState, useEffect, useCallback, useMemo } from 'react';
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Alert,
  AlertIcon,
  Badge,
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
  Stack,
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

import apiClient from '../api/client';

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
  timestamp: string;
  user_agent?: string;
  ip_address?: string;
  country?: string;
  country_iso_code?: string;
  region?: string;
  region_iso_code?: string;
  subdivision_iso_code?: string;
  city?: string;
  postal_code?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  accuracy_radius?: number | string | null;
  accuracy_radius_km?: number | string | null;
  timezone?: string;
  device_type?: string;
  os_family?: string;
  browser_family?: string;
  referrer_domain?: string;
  time_on_page?: number;
  scrolled?: boolean;
  scan_method?: string;
}

interface EnhancedStats {
  total_scans: number;
  daily_scans: ScanData[];
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

type DateRangeKey = '24h' | '7d' | '30d' | '90d' | 'all' | 'custom';

interface LocationGroup {
  key: string;
  country: string;
  countryIso?: string;
  region: string;
  regionIso?: string;
  city: string;
  postalCode: string;
  timezone: string;
  latitude?: string;
  longitude?: string;
  accuracyRadius?: string;
  count: number;
  lastScannedAt?: string;
}

const DATE_RANGE_OPTIONS: Array<{ value: DateRangeKey; label: string }> = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getAppBaseUrl = (): string => API_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');

const getShortUrl = (shortCode: string): string => `${getAppBaseUrl()}/r/${shortCode}`;

const parseBackendDate = (dateString?: string | null): Date | null => {
  if (!dateString) return null;
  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(dateString);
  const normalized = hasTimezone ? dateString : `${dateString}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseScanDate = (scan: Scan): Date | null => parseBackendDate(scan.timestamp);

const formatDateTime = (dateString?: string | null): string => {
  const date = parseBackendDate(dateString);
  if (!date) return 'N/A';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCoordinate = (value?: number | string | null): string | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return String(value);
  return numericValue.toFixed(4);
};

const formatAccuracyRadius = (scan: Scan): string | undefined => {
  const value = scan.accuracy_radius_km ?? scan.accuracy_radius;
  if (value === null || value === undefined || value === '') return undefined;
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return String(value);
  return `Approx. within ${numericValue} km`;
};

const maskIpAddress = (ipAddress?: string): string => {
  if (!ipAddress) return 'N/A';
  if (ipAddress.includes(':')) {
    return `${ipAddress.split(':').slice(0, 3).join(':')}:...`;
  }
  const parts = ipAddress.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  return ipAddress;
};

const getRangeStart = (range: DateRangeKey, customStart: string): Date | null => {
  const now = new Date();
  if (range === '24h') return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (range === '90d') return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  if (range === 'custom' && customStart) return new Date(`${customStart}T00:00:00`);
  return null;
};

const getRangeEnd = (range: DateRangeKey, customEnd: string): Date | null => {
  if (range === 'custom' && customEnd) return new Date(`${customEnd}T23:59:59.999`);
  return null;
};

const increment = (target: Record<string, number>, key?: string | number | null, fallback = 'Unknown') => {
  const normalizedKey = key === null || key === undefined || key === '' ? fallback : String(key);
  target[normalizedKey] = (target[normalizedKey] || 0) + 1;
};

const getTopEntry = (entries: Record<string, number>): [string, number] | null => {
  const sorted = Object.entries(entries).sort((a, b) => b[1] - a[1]);
  return sorted[0] || null;
};

const getLocationGroups = (scans: Scan[]): LocationGroup[] => {
  const groups = new Map<string, LocationGroup>();

  scans.forEach((scan) => {
    const country = scan.country || 'Unknown';
    const region = scan.region || 'Unknown';
    const city = scan.city || 'Unknown';
    const postalCode = scan.postal_code || 'Unknown';
    const timezone = scan.timezone || 'Unknown';
    const key = [country, scan.country_iso_code || '', region, scan.region_iso_code || scan.subdivision_iso_code || '', city, postalCode].join('|');
    const existing = groups.get(key);
    const scanDate = parseScanDate(scan);

    if (existing) {
      existing.count += 1;
      if (scanDate && (!existing.lastScannedAt || scanDate > new Date(existing.lastScannedAt))) {
        existing.lastScannedAt = scan.timestamp;
      }
      return;
    }

    groups.set(key, {
      key,
      country,
      countryIso: scan.country_iso_code,
      region,
      regionIso: scan.region_iso_code || scan.subdivision_iso_code,
      city,
      postalCode,
      timezone,
      latitude: formatCoordinate(scan.latitude),
      longitude: formatCoordinate(scan.longitude),
      accuracyRadius: formatAccuracyRadius(scan),
      count: 1,
      lastScannedAt: scan.timestamp,
    });
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return (new Date(b.lastScannedAt || 0).getTime()) - (new Date(a.lastScannedAt || 0).getTime());
  });
};

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
  const [dateRange, setDateRange] = useState<DateRangeKey>('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [scanLogSearch, setScanLogSearch] = useState('');
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
            const [qrResponse, enhancedStatsResponse] = await Promise.all([
        apiClient.get(`${ENDPOINTS.QR_CODES}/flex/${id}`),
        apiClient.get(`${ENDPOINTS.QR_CODES}/${id}/enhanced-stats`)
      ]);
      
      const qrData = qrResponse.data;
      const statsData = enhancedStatsResponse.data;
      setQRCode(qrData);
      setEnhancedStats(statsData);
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
            const response = await apiClient.get(ENDPOINTS.FOLDERS);
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

  const filteredScans = useMemo(() => {
    const scans = enhancedStats?.scans || [];
    const start = getRangeStart(dateRange, customStartDate);
    const end = getRangeEnd(dateRange, customEndDate);

    return scans
      .filter((scan) => {
        const scanDate = parseScanDate(scan);
        if (!scanDate) return false;
        if (start && scanDate < start) return false;
        if (end && scanDate > end) return false;
        return true;
      })
      .sort((a, b) => {
        const aTime = parseScanDate(a)?.getTime() || 0;
        const bTime = parseScanDate(b)?.getTime() || 0;
        return bTime - aTime;
      });
  }, [enhancedStats?.scans, dateRange, customStartDate, customEndDate]);

  const selectedStats = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    const scansByCountry: Record<string, number> = {};
    const scansByDevice: Record<string, number> = {};
    const scansByOs: Record<string, number> = {};
    const scansByBrowser: Record<string, number> = {};
    const scansByHour: Record<string, number> = {};
    const scansByWeekday: Record<string, number> = {};
    const topReferrers: Record<string, number> = {};
    let totalTime = 0;
    let timeCount = 0;
    let scrollCount = 0;
    let directScanCount = 0;
    let referredScanCount = 0;

    filteredScans.forEach((scan) => {
      const scanDate = parseScanDate(scan);
      if (scanDate) {
        const dateKey = formatLocalDateKey(scanDate);
        increment(dailyMap, dateKey);
        increment(scansByHour, scanDate.getHours());
        increment(scansByWeekday, scanDate.getDay());
      }

      increment(scansByCountry, scan.country);
      increment(scansByDevice, scan.device_type);
      increment(scansByOs, scan.os_family);
      increment(scansByBrowser, scan.browser_family);
      increment(topReferrers, scan.referrer_domain, 'Direct / QR scan');

      if (scan.referrer_domain) {
        referredScanCount += 1;
      } else {
        directScanCount += 1;
      }

      if (scan.time_on_page !== undefined && scan.time_on_page !== null) {
        totalTime += scan.time_on_page;
        timeCount += 1;
      }
      if (scan.scrolled) scrollCount += 1;
    });

    const totalScans = filteredScans.length;
    const locationGroups = getLocationGroups(filteredScans);
    const firstScan = filteredScans[filteredScans.length - 1];
    const lastScan = filteredScans[0];
    const bestHour = getTopEntry(scansByHour);
    const bestWeekday = getTopEntry(scansByWeekday);
    const topDevice = getTopEntry(scansByDevice);

    return {
      totalScans,
      dailyScans: Object.entries(dailyMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      scansByCountry,
      scansByDevice,
      scansByOs,
      scansByBrowser,
      scansByHour,
      scansByWeekday,
      topReferrers,
      avgTimeOnPage: timeCount ? Math.round((totalTime / timeCount) * 100) / 100 : 0,
      scrollRate: totalScans ? Math.round((scrollCount / totalScans) * 100) : 0,
      locationGroups,
      firstScanAt: firstScan?.timestamp,
      lastScanAt: lastScan?.timestamp,
      topLocation: locationGroups[0],
      bestHour,
      bestWeekday,
      topDevice,
      directScanCount,
      referredScanCount,
    };
  }, [filteredScans]);

  const filteredScanLog = useMemo(() => {
    const query = scanLogSearch.trim().toLowerCase();
    if (!query) return filteredScans;

    return filteredScans.filter((scan) => [
      scan.timestamp,
      scan.country,
      scan.region,
      scan.city,
      scan.postal_code,
      scan.timezone,
      scan.device_type,
      scan.os_family,
      scan.browser_family,
      scan.referrer_domain,
      scan.scan_method,
      scan.ip_address,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [filteredScans, scanLogSearch]);

  const dateRangeLabel = DATE_RANGE_OPTIONS.find((option) => option.value === dateRange)?.label || 'Selected range';
  const topLocationLabel = selectedStats.topLocation
    ? [selectedStats.topLocation.city, selectedStats.topLocation.region, selectedStats.topLocation.country]
      .filter((part) => part && part !== 'Unknown')
      .join(', ') || 'Unknown'
    : 'N/A';
  const bestHourLabel = selectedStats.bestHour ? `${selectedStats.bestHour[0]}:00` : 'N/A';
  const bestWeekdayLabel = selectedStats.bestWeekday ? WEEKDAYS[Number(selectedStats.bestWeekday[0])] : 'N/A';
  const topDeviceLabel = selectedStats.topDevice ? selectedStats.topDevice[0] : 'N/A';
  const directSplitData = [
    { name: 'Direct / QR scan', value: selectedStats.directScanCount },
    { name: 'Referred', value: selectedStats.referredScanCount },
  ].filter((entry) => entry.value > 0);

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
      const response = await apiClient.put(`${ENDPOINTS.QR_CODES}/${id}`, formData);
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
      await apiClient.delete(`${ENDPOINTS.QR_CODES}/${id}`);
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
    <Box minH="100vh" p={{ base: 4, md: 6 }} maxW="100vw" overflowX="hidden">
      <Box maxW="1400px" mx="auto" h="100%" w="100%" minW={0}>
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
                    link.href = `${API_URL}/qrcodes/image-by-shortcode/${qrCode.short_code}`;
                    link.download = `qrcode-${qrCode.short_code}.png`;
                    link.click();
                  }}
                >
                  Download
                </Button>
                <Button
                  leftIcon={<FiCopy />}
                  onClick={() => copyToClipboard(qrCode.short_url || getShortUrl(qrCode.short_code))}
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
                        <Text>{qrCode.short_url || getShortUrl(qrCode.short_code)}</Text>
                        <IconButton
                          icon={<FiCopy size={14} />}
                          aria-label="Copy URL"
                          size="xs"
                          variant="ghost"
                          onClick={() => copyToClipboard(qrCode.short_url || getShortUrl(qrCode.short_code))}
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

      <Card mb={6}>
        <CardBody>
          <Stack direction={{ base: 'column', md: 'row' }} spacing={4} align={{ base: 'stretch', md: 'end' }}>
            <FormControl maxW={{ base: '100%', md: '240px' }}>
              <FormLabel>Date range</FormLabel>
              <Select value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRangeKey)}>
                {DATE_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </FormControl>
            {dateRange === 'custom' && (
              <>
                <FormControl maxW={{ base: '100%', md: '180px' }}>
                  <FormLabel>Start date</FormLabel>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(event) => setCustomStartDate(event.target.value)}
                  />
                </FormControl>
                <FormControl maxW={{ base: '100%', md: '180px' }}>
                  <FormLabel>End date</FormLabel>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                  />
                </FormControl>
              </>
            )}
            <Text color="gray.600" fontSize="sm">
              Showing analytics for {dateRangeLabel.toLowerCase()} using your browser's local time.
            </Text>
          </Stack>
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
        minW={0}
        overflowX="auto"
      >
        <TabList overflowX="auto" overflowY="hidden" pb={1} w="100%">
          <Tab whiteSpace="nowrap" minW="max-content" px={4}><FiBarChart2 style={{ marginRight: '8px' }} /> Overview</Tab>
          <Tab whiteSpace="nowrap" minW="max-content" px={4}><FiGlobe style={{ marginRight: '8px' }} /> Locations</Tab>
          <Tab whiteSpace="nowrap" minW="max-content" px={4}><FiSmartphone style={{ marginRight: '8px' }} /> Devices</Tab>
          <Tab whiteSpace="nowrap" minW="max-content" px={4}><FiClock style={{ marginRight: '8px' }} /> Engagement</Tab>
          <Tab whiteSpace="nowrap" minW="max-content" px={4}><FiBarChart2 style={{ marginRight: '8px' }} /> Scan Log</Tab>
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
                title="Scans in Range" 
                value={selectedStats.totalScans} 
                description={dateRangeLabel} 
              />
              <StatCard 
                title="First Scan" 
                value={selectedStats.firstScanAt ? formatDateTime(selectedStats.firstScanAt) : 'No scans yet'} 
                description="Earliest scan in range" 
              />
              <StatCard 
                title="Last Scan" 
                value={selectedStats.lastScanAt ? formatDateTime(selectedStats.lastScanAt) : 'No scans yet'} 
                description="Most recent scan in range" 
              />
              <StatCard 
                title="Top Approx. IP Location" 
                value={topLocationLabel} 
                description={
                  selectedStats.topLocation
                    ? `${selectedStats.topLocation.count} scans. Based on IP; may reflect ISP, carrier, VPN, proxy, or cloud routing.`
                    : 'No location data'
                } 
              />
              <StatCard 
                title="Best Scan Hour" 
                value={bestHourLabel} 
                description={selectedStats.bestHour ? `${selectedStats.bestHour[1]} scans, local time` : 'N/A'} 
              />
              <StatCard 
                title="Best Scan Weekday" 
                value={bestWeekdayLabel} 
                description={selectedStats.bestWeekday ? `${selectedStats.bestWeekday[1]} scans, local time` : 'N/A'} 
              />
              <StatCard 
                title="Direct vs Referred" 
                value={`${selectedStats.directScanCount} / ${selectedStats.referredScanCount}`} 
                description="Direct QR scans / referred visits" 
              />
              <StatCard 
                title="Unique Locations" 
                value={selectedStats.locationGroups.length || 'N/A'} 
                description="Country, region, city, and postal groups" 
              />
              <StatCard 
                title="Top Device" 
                value={topDeviceLabel} 
                description={selectedStats.topDevice ? `${selectedStats.topDevice[1]} scans` : 'N/A'} 
              />
              <StatCard 
                title="Avg. Time on Page" 
                value={selectedStats.avgTimeOnPage ? `${selectedStats.avgTimeOnPage}s` : 'N/A'} 
                description="Average engagement time in range" 
              />
              <StatCard 
                title="Scroll Rate" 
                value={selectedStats.totalScans ? `${selectedStats.scrollRate}%` : 'N/A'} 
                description="Scans with recorded scrolling in range" 
              />
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} mb={6}>
            <Card>
              <CardHeader>
                <Heading size="md">Scan Activity</Heading>
              </CardHeader>
              <CardBody>
                {selectedStats.dailyScans.length > 0 ? (
                  <Box minH="300px" w="100%" position="relative">
                    <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                      <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedStats.dailyScans}>
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

            <Card>
              <CardHeader>
                <Heading size="md">Direct vs Referred</Heading>
              </CardHeader>
              <CardBody>
                {directSplitData.length > 0 ? (
                  <Box minH="300px" w="100%" position="relative">
                    <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={directSplitData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={85}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {directSplitData.map((_, index) => (
                              <Cell key={`direct-split-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                ) : (
                  <Box textAlign="center" py={10}>
                    <Text color="gray.500">No referrer data available for this date range</Text>
                  </Box>
                )}
              </CardBody>
            </Card>
            </SimpleGrid>
          </TabPanel>

          {/* Locations Tab */}
          <TabPanel p={0} pt={6}>
            <Alert status="info" mb={6} borderRadius="md">
              <AlertIcon />
              <Text>
                Location is approximate and based on IP geolocation. It may identify a nearby city, region, or network location, not the scanner's exact physical address.
              </Text>
            </Alert>

            <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6}>
              <Card>
                <CardHeader>
                  <Heading size="md">Approximate Locations</Heading>
                </CardHeader>
                <CardBody>
                  {selectedStats.locationGroups.length > 0 ? (
                    <Box overflowX="auto">
                      <Table variant="simple" size="sm">
                        <Thead>
                          <Tr>
                            <Th>Country</Th>
                            <Th>Region</Th>
                            <Th>City</Th>
                            <Th>Postal Code</Th>
                            <Th>Timezone</Th>
                            <Th>Approx. Coordinates</Th>
                            <Th>Accuracy</Th>
                            <Th isNumeric>Scans</Th>
                            <Th>Last Scanned</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {selectedStats.locationGroups.map((location) => (
                            <Tr key={location.key}>
                              <Td>
                                <HStack spacing={2}>
                                  <Text>{location.country}</Text>
                                  {location.countryIso && <Badge>{location.countryIso}</Badge>}
                                </HStack>
                              </Td>
                              <Td>
                                <HStack spacing={2}>
                                  <Text>{location.region}</Text>
                                  {location.regionIso && <Badge>{location.regionIso}</Badge>}
                                </HStack>
                              </Td>
                              <Td>{location.city}</Td>
                              <Td>{location.postalCode}</Td>
                              <Td>{location.timezone}</Td>
                              <Td>
                                {location.latitude && location.longitude
                                  ? `${location.latitude}, ${location.longitude}`
                                  : 'N/A'}
                              </Td>
                              <Td>{location.accuracyRadius || 'N/A'}</Td>
                              <Td isNumeric>{location.count}</Td>
                              <Td>{formatDateTime(location.lastScannedAt)}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                  ) : (
                    <Text color="gray.500">No location data available for this date range</Text>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <Heading size="md">Top Referrers</Heading>
                </CardHeader>
                <CardBody>
                  {Object.keys(selectedStats.topReferrers).length > 0 ? (
                    <Table variant="simple" size="sm">
                      <Thead>
                        <Tr>
                          <Th>Domain</Th>
                          <Th isNumeric>Visits</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {Object.entries(selectedStats.topReferrers)
                          .sort((a, b) => b[1] - a[1])
                          .map(([domain, count]) => (
                            <Tr key={domain}>
                              <Td>{domain}</Td>
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
                  {Object.keys(selectedStats.scansByDevice).length > 0 ? (
                    <Box minH="300px" w="100%" position="relative">
                      <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                        <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Object.entries(selectedStats.scansByDevice).map(([name, value]) => ({
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
                            {Object.entries(selectedStats.scansByDevice).map((_, index) => (
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
                  {Object.keys(selectedStats.scansByOs).length > 0 ? (
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>OS</Th>
                          <Th isNumeric>Scans</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {Object.entries(selectedStats.scansByOs)
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
                  {Object.keys(selectedStats.scansByBrowser).length > 0 ? (
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Browser</Th>
                          <Th isNumeric>Scans</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {Object.entries(selectedStats.scansByBrowser)
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
                  {Object.keys(selectedStats.scansByHour).length > 0 ? (
                    <Box minH="300px" w="100%" position="relative">
                      <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={Object.entries(selectedStats.scansByHour).map(([hour, count]) => ({
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
                  {Object.keys(selectedStats.scansByWeekday).length > 0 ? (
                    <Box minH="300px" w="100%" position="relative">
                      <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={SHORT_WEEKDAYS.map((name, index) => ({
                              name,
                              scans: selectedStats.scansByWeekday[String(index)] || 0,
                            }))}
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

          {/* Scan Log Tab */}
          <TabPanel p={0} pt={6}>
            <Card>
              <CardHeader>
                <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'stretch', md: 'center' }} spacing={4}>
                  <Box>
                    <Heading size="md">Scan Log</Heading>
                    <Text color="gray.600" fontSize="sm" mt={1}>
                      {filteredScanLog.length} scans shown for {dateRangeLabel.toLowerCase()}
                    </Text>
                  </Box>
                  <Input
                    value={scanLogSearch}
                    onChange={(event) => setScanLogSearch(event.target.value)}
                    placeholder="Search scans"
                    maxW={{ base: '100%', md: '280px' }}
                  />
                </Stack>
              </CardHeader>
              <CardBody>
                {filteredScanLog.length > 0 ? (
                  <Box overflowX="auto">
                    <Table variant="simple" size="sm">
                      <Thead>
                        <Tr>
                          <Th>Timestamp</Th>
                          <Th>Country</Th>
                          <Th>Region/State</Th>
                          <Th>City</Th>
                          <Th>Postal Code</Th>
                          <Th>Timezone</Th>
                          <Th>Approx. Coordinates</Th>
                          <Th>Accuracy</Th>
                          <Th>Device</Th>
                          <Th>OS</Th>
                          <Th>Browser</Th>
                          <Th>Referrer</Th>
                          <Th>Scan Method</Th>
                          <Th>IP Address</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {filteredScanLog.map((scan) => {
                          const latitude = formatCoordinate(scan.latitude);
                          const longitude = formatCoordinate(scan.longitude);

                          return (
                            <Tr key={scan.id}>
                              <Td whiteSpace="nowrap">{formatDateTime(scan.timestamp)}</Td>
                              <Td>{scan.country || 'Unknown'}</Td>
                              <Td>{scan.region || 'Unknown'}</Td>
                              <Td>{scan.city || 'Unknown'}</Td>
                              <Td>{scan.postal_code || 'N/A'}</Td>
                              <Td>{scan.timezone || 'N/A'}</Td>
                              <Td>{latitude && longitude ? `${latitude}, ${longitude}` : 'N/A'}</Td>
                              <Td>{formatAccuracyRadius(scan) || 'N/A'}</Td>
                              <Td>{scan.device_type || 'Unknown'}</Td>
                              <Td>{scan.os_family || 'Unknown'}</Td>
                              <Td>{scan.browser_family || 'Unknown'}</Td>
                              <Td>{scan.referrer_domain || 'Direct / QR scan'}</Td>
                              <Td>{scan.scan_method || 'N/A'}</Td>
                              <Td color="gray.500" fontFamily="mono">{maskIpAddress(scan.ip_address)}</Td>
                            </Tr>
                          );
                        })}
                      </Tbody>
                    </Table>
                  </Box>
                ) : (
                  <Box textAlign="center" py={10}>
                    <Text color="gray.500">No scans match the selected date range or search.</Text>
                  </Box>
                )}
              </CardBody>
            </Card>
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
