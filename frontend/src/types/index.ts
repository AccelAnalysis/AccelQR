export interface QRCode {
  id: number;
  name: string;
  short_code: string;
  target_url: string;
  created_at: string;
  scan_count: number;
  description?: string;
}

export interface ScanData {
  date: string;
  count: number;
}

export interface QRCodeStats {
  total_scans: number;
  recent_scans: number;
  daily_scans: ScanData[];
}
