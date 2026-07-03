import React, { useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Image,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FiDownload, FiImage, FiSearch } from 'react-icons/fi';
import apiClient from '../api/client';
import { API_URL } from '../config';

const QRCodeImageByShortCode: React.FC = () => {
  const [shortCode, setShortCode] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const normalizedShortCode = shortCode.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setImageUrl(null);
    setError(null);

    if (!normalizedShortCode) {
      setError('Enter a short code first.');
      return;
    }

    setImageUrl(`${API_URL}/qrcodes/image-by-shortcode/${encodeURIComponent(normalizedShortCode)}`);
  };

  const handleDownloadCsv = async () => {
    if (!normalizedShortCode) {
      setError('Enter a short code first.');
      return;
    }

    try {
      setIsDownloading(true);
      setError(null);
      const response = await apiClient.get(`/qrcodes/scans-csv/${normalizedShortCode}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `scans_${normalizedShortCode}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Could not download scan stats. Please sign in and try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box maxW="640px" mx="auto">
      <Card>
        <CardHeader>
          <Heading size="md">QR Image Lookup</Heading>
        </CardHeader>
        <CardBody>
          <VStack spacing={5} align="stretch">
            <Box as="form" onSubmit={handleSubmit}>
              <FormControl>
                <FormLabel>Short Code</FormLabel>
                <HStack align="flex-end">
                  <Input
                    value={shortCode}
                    onChange={(e) => setShortCode(e.target.value)}
                    placeholder="Enter short code"
                  />
                  <Button type="submit" leftIcon={<FiSearch />} colorScheme="teal">
                    Lookup
                  </Button>
                </HStack>
              </FormControl>
            </Box>

            {error && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                {error}
              </Alert>
            )}

            {imageUrl ? (
              <VStack spacing={4}>
                <Box borderWidth="1px" borderRadius="md" borderColor="gray.200" p={4} bg="white">
                  <Image
                    src={imageUrl}
                    alt={`QR code for ${normalizedShortCode}`}
                    maxW="320px"
                    w="100%"
                    onError={() => setError('Image not found or server error.')}
                  />
                </Box>
                <HStack spacing={3} flexWrap="wrap" justify="center">
                  <Button
                    leftIcon={<FiImage />}
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = imageUrl;
                      link.download = `qrcode-${normalizedShortCode}.png`;
                      link.click();
                    }}
                  >
                    Download Image
                  </Button>
                  <Button
                    leftIcon={<FiDownload />}
                    onClick={handleDownloadCsv}
                    isLoading={isDownloading}
                    loadingText="Downloading..."
                  >
                    Download Scan Stats
                  </Button>
                </HStack>
              </VStack>
            ) : (
              <Text color="gray.500">Enter a short code to look up its QR image.</Text>
            )}
          </VStack>
        </CardBody>
      </Card>
    </Box>
  );
};

export default QRCodeImageByShortCode;
