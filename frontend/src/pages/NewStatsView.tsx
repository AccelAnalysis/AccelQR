import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Heading, Spinner, Table, Thead, Tr, Th, Tbody, Td, Button, useToast, Flex, Text
} from '@chakra-ui/react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const NewStatsView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  interface Scan {
    scan_id: string;
    timestamp: string;
    ip_address: string;
    country: string;
    city: string;
    device_type: string;
    scan_method: string;
  }
  interface Stats {
    scans: Scan[];
  }
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    axios.get(`${API_URL}/newstats/qrcode/${id}/quickstats`)
      .then(res => setStats(res.data))
      .catch(() => {
        toast({ title: 'Error', description: 'Failed to load stats', status: 'error' });
      })
      .finally(() => setLoading(false));
  }, [id, toast]);

  const handleExport = async () => {
    try {
      const response = await axios.get(`${API_URL}/newstats/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `qr_stats_export_${id}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Export failed', description: 'Could not export stats.', status: 'error' });
    }
  };

  if (loading) return <Flex justify="center" align="center" minH="200px"><Spinner size="xl" /></Flex>;
  if (!stats) return <Text>No stats found.</Text>;

  return (
    <Box maxW="900px" mx="auto" mt={8}>
      <Heading mb={4}>QR Code Stats (New)</Heading>
      <Button colorScheme="blue" mb={4} onClick={handleExport}>Export QR Stats</Button>
      <Table variant="simple" mb={8}>
        <Thead>
          <Tr>
            <Th>Scan ID</Th>
            <Th>Timestamp</Th>
            <Th>IP Address</Th>
            <Th>Country</Th>
            <Th>City</Th>
            <Th>Device</Th>
            <Th>Scan Method</Th>
          </Tr>
        </Thead>
        <Tbody>
          {stats.scans.map((scan) => (
            <Tr key={scan.scan_id}>
              <Td>{scan.scan_id}</Td>
              <Td>{scan.timestamp}</Td>
              <Td>{scan.ip_address}</Td>
              <Td>{scan.country}</Td>
              <Td>{scan.city}</Td>
              <Td>{scan.device_type}</Td>
              <Td>{scan.scan_method}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};

export default NewStatsView;
