import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

// Dynamically import MLKit barcode scanning for native platforms
let BarcodeScanner: any = null;
let BarcodeFormat: any = null;

if (Capacitor.isNativePlatform()) {
  import('@capacitor-mlkit/barcode-scanning').then((module) => {
    BarcodeScanner = module.BarcodeScanner;
    BarcodeFormat = module.BarcodeFormat;
  }).catch(err => {
    console.warn('MLKit barcode scanning not available:', err);
  });
}

interface ScanResult {
  content: string;
  format: string;
}

interface UseNativeScannerReturn {
  isNativePlatform: boolean;
  isSupported: boolean;
  isScanning: boolean;
  error: string | null;
  startScan: () => Promise<ScanResult | null>;
  stopScan: () => Promise<void>;
  checkPermission: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
}

export function useNativeScanner(): UseNativeScannerReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isNativePlatform = Capacitor.isNativePlatform();
  const isSupported = isNativePlatform && BarcodeScanner !== null;

  const checkPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !BarcodeScanner) return false;
    
    try {
      const { camera } = await BarcodeScanner.checkPermissions();
      return camera === 'granted';
    } catch (err) {
      console.error('Error checking camera permission:', err);
      return false;
    }
  }, [isSupported]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !BarcodeScanner) return false;
    
    try {
      const { camera } = await BarcodeScanner.requestPermissions();
      return camera === 'granted';
    } catch (err) {
      console.error('Error requesting camera permission:', err);
      setError('相机权限请求失败');
      return false;
    }
  }, [isSupported]);

  const startScan = useCallback(async (): Promise<ScanResult | null> => {
    if (!isSupported || !BarcodeScanner) {
      setError('原生扫码不可用');
      return null;
    }

    try {
      setIsScanning(true);
      setError(null);

      // Check and request permission
      const hasPermission = await checkPermission();
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          setError('需要相机权限才能扫码');
          setIsScanning(false);
          return null;
        }
      }

      // Configure scanner
      const formats = BarcodeFormat ? [BarcodeFormat.QrCode] : [];

      // Start scanning
      const result = await BarcodeScanner.scan({
        formats,
      });

      setIsScanning(false);

      if (result.barcodes && result.barcodes.length > 0) {
        const barcode = result.barcodes[0];
        return {
          content: barcode.rawValue || barcode.displayValue || '',
          format: barcode.format || 'QR_CODE',
        };
      }

      return null;
    } catch (err: any) {
      console.error('Scan error:', err);
      setError(err.message || '扫码失败');
      setIsScanning(false);
      return null;
    }
  }, [isSupported, checkPermission, requestPermission]);

  const stopScan = useCallback(async (): Promise<void> => {
    if (!isSupported || !BarcodeScanner) return;

    try {
      await BarcodeScanner.stopScan();
      setIsScanning(false);
    } catch (err) {
      console.error('Error stopping scan:', err);
    }
  }, [isSupported]);

  return {
    isNativePlatform,
    isSupported,
    isScanning,
    error,
    startScan,
    stopScan,
    checkPermission,
    requestPermission,
  };
}
