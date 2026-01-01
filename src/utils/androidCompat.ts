/**
 * Android compatibility utilities
 * Handles various Android-specific issues with WebView, media, touch, and keyboard
 */

// Device detection
export const isAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

export const isIOS = (): boolean => {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

export const isMobile = (): boolean => {
  return isAndroid() || isIOS();
};

// Detect OPPO/ColorOS devices (including Realme, OnePlus with ColorOS)
export const isOPPO = (): boolean => {
  const ua = navigator.userAgent;
  return /OPPO|ColorOS|PBAM00|PBEM00|PCAM10|PCEM00|PCLM10|PDAM10|PDEM10|PDHM00|PFUM10|PESM10|Realme|RMX/i.test(ua);
};

// Detect Vivo/FunTouch OS devices
export const isVivo = (): boolean => {
  const ua = navigator.userAgent;
  return /vivo|V\d{4}|Y\d{2}|X\d{2}|iQOO|FuntouchOS/i.test(ua);
};

// Detect Huawei/Honor/HarmonyOS devices
export const isHuawei = (): boolean => {
  const ua = navigator.userAgent;
  return /Huawei|Honor|HarmonyOS|EMUI|ANA-|ELS-|NOH-|TAS-|VOG-|MAR-|PCT-|JNY-|AQM-/i.test(ua);
};

// Detect Xiaomi/MIUI devices (including Redmi, POCO)
export const isXiaomi = (): boolean => {
  const ua = navigator.userAgent;
  return /Xiaomi|MIUI|Redmi|POCO|Mi \d|HM NOTE/i.test(ua);
};

// Detect Samsung devices
export const isSamsung = (): boolean => {
  const ua = navigator.userAgent;
  return /Samsung|SM-[GANJSTFM]/i.test(ua);
};

// Detect if device has known audio codec issues
export const hasAudioCodecIssues = (): boolean => {
  // OPPO, Vivo, Huawei budget devices often have WebM codec issues
  // Samsung A/J series and Xiaomi budget devices also have issues
  return isOPPO() || isVivo() || isHuawei() || /SM-A|SM-J|Redmi|POCO/i.test(navigator.userAgent);
};

// Detect if device has known WebRTC issues
export const hasWebRTCIssues = (): boolean => {
  const androidVersion = getAndroidVersion();
  // Older Android versions and certain OEMs have WebRTC issues
  return (androidVersion !== null && androidVersion < 9) || isHuawei();
};

// Detect if device has known camera issues
export const hasCameraIssues = (): boolean => {
  // Some devices have issues with camera orientation or format
  return isVivo() || (isHuawei() && getAndroidVersion() !== null && getAndroidVersion()! < 10);
};

// Get Android version
export const getAndroidVersion = (): number | null => {
  const match = navigator.userAgent.match(/Android (\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
};

/**
 * Fix for Android keyboard pushing content
 * Call this when input is focused
 */
export const handleAndroidKeyboardFocus = (inputElement: HTMLElement | null) => {
  if (!isAndroid() || !inputElement) return;
  
  // Wait for keyboard to appear
  setTimeout(() => {
    inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
};

/**
 * Prevent Android WebView zoom on double-tap
 */
export const preventAndroidZoom = () => {
  if (!isAndroid()) return;
  
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
};

/**
 * Fix Android audio context for autoplay
 */
export const unlockAndroidAudio = async (): Promise<AudioContext | null> => {
  if (!isAndroid()) return null;
  
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create and play silent buffer to unlock
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
    
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    return audioContext;
  } catch (e) {
    console.error('[Android] Failed to unlock audio:', e);
    return null;
  }
};

/**
 * Get optimized media constraints for Android
 */
export const getAndroidMediaConstraints = (type: 'audio' | 'video' | 'both'): MediaStreamConstraints => {
  const androidVersion = getAndroidVersion();
  const isOldAndroid = androidVersion !== null && androidVersion < 10;
  
  const audioConstraints: MediaTrackConstraints = isOldAndroid ? {
    echoCancellation: true,
    noiseSuppression: true,
  } : {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
  };
  
  const videoConstraints: MediaTrackConstraints = isOldAndroid ? {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: 'user',
  } : {
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 },
    facingMode: 'user',
    frameRate: { ideal: 24, max: 30 },
  };
  
  switch (type) {
    case 'audio':
      return { audio: audioConstraints, video: false };
    case 'video':
      return { audio: false, video: videoConstraints };
    case 'both':
      return { audio: audioConstraints, video: videoConstraints };
  }
};

/**
 * Fix scroll behavior for Android
 */
export const setupAndroidScroll = (element: HTMLElement | null) => {
  if (!isAndroid() || !element) return;
  
  // Enable smooth scrolling
  (element.style as any).webkitOverflowScrolling = 'touch';
  element.style.overscrollBehavior = 'contain';
  
  // Prevent pull-to-refresh
  let startY = 0;
  element.addEventListener('touchstart', (e) => {
    startY = e.touches[0].pageY;
  }, { passive: true });
  
  element.addEventListener('touchmove', (e) => {
    const currentY = e.touches[0].pageY;
    const isScrollingUp = currentY > startY;
    
    if (isScrollingUp && element.scrollTop === 0) {
      e.preventDefault();
    }
  }, { passive: false });
};

/**
 * Apply Android-specific video element fixes
 */
export const setupAndroidVideo = (videoElement: HTMLVideoElement | null) => {
  if (!videoElement) return;
  
  videoElement.setAttribute('playsinline', 'true');
  videoElement.setAttribute('webkit-playsinline', 'true');
  videoElement.setAttribute('x5-playsinline', 'true');
  videoElement.setAttribute('x5-video-player-type', 'h5');
  videoElement.setAttribute('x5-video-player-fullscreen', 'true');
  videoElement.muted = false;
  
  if (isAndroid()) {
    // Android-specific attributes
    videoElement.setAttribute('preload', 'auto');
  }
};

/**
 * Apply Android-specific audio element fixes
 * Enhanced for OPPO/ColorOS compatibility
 */
export const setupAndroidAudio = (audioElement: HTMLAudioElement | null) => {
  if (!audioElement) return;
  
  // Standard attributes
  audioElement.setAttribute('playsinline', 'true');
  audioElement.setAttribute('webkit-playsinline', 'true');
  audioElement.muted = false;
  audioElement.volume = 1.0;
  
  if (isAndroid()) {
    audioElement.setAttribute('preload', 'auto');
    
    // OPPO/ColorOS specific attributes
    audioElement.setAttribute('x5-playsinline', 'true');
    audioElement.setAttribute('x5-video-player-type', 'h5');
    audioElement.setAttribute('t7-video-player-type', 'inline');
    
    // Force hardware decoding off for problematic devices
    if (hasAudioCodecIssues()) {
      audioElement.setAttribute('x-webkit-airplay', 'allow');
    }
  }
};

/**
 * Try to play media with Android fallbacks
 * Enhanced with OPPO-specific handling
 */
export const playMediaWithFallback = async (
  mediaElement: HTMLMediaElement | null
): Promise<boolean> => {
  if (!mediaElement) return false;
  
  const tryPlay = async (): Promise<boolean> => {
    try {
      // Reset to beginning
      mediaElement.currentTime = 0;
      const playPromise = mediaElement.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      return true;
    } catch (e) {
      return false;
    }
  };
  
  // First attempt - direct play
  if (await tryPlay()) {
    return true;
  }
  
  console.warn('[Android] First play attempt failed, trying fallbacks');
  
  if (isAndroid()) {
    // OPPO-specific: try loading again before play
    if (hasAudioCodecIssues()) {
      try {
        mediaElement.load();
        await new Promise(resolve => setTimeout(resolve, 300));
        if (await tryPlay()) {
          return true;
        }
      } catch (e) {
        console.warn('[OPPO] Reload fallback failed:', e);
      }
    }
    
    // Android fallback: try muted first, then unmute
    try {
      mediaElement.muted = true;
      mediaElement.volume = 0;
      await mediaElement.play();
      // Gradually unmute
      await new Promise(resolve => setTimeout(resolve, 100));
      mediaElement.volume = 1.0;
      mediaElement.muted = false;
      return true;
    } catch (e) {
      console.warn('[Android] Muted play fallback failed:', e);
    }
    
    // Third fallback: create new Audio element (helps with some OPPO devices)
    if (hasAudioCodecIssues() && mediaElement.src) {
      try {
        const newAudio = new Audio(mediaElement.src);
        newAudio.volume = 1.0;
        await newAudio.play();
        // Replace the original element's events
        newAudio.onended = () => mediaElement.dispatchEvent(new Event('ended'));
        return true;
      } catch (e) {
        console.warn('[OPPO] New Audio element fallback failed:', e);
      }
    }
    
    // Last fallback: wait for user interaction
    return new Promise((resolve) => {
      let resolved = false;
      const handler = async () => {
        if (resolved) return;
        try {
          await mediaElement.play();
          resolved = true;
          document.removeEventListener('click', handler);
          document.removeEventListener('touchstart', handler);
          document.removeEventListener('touchend', handler);
          resolve(true);
        } catch (e) {
          // Still waiting for valid interaction
        }
      };
      document.addEventListener('click', handler, { capture: true });
      document.addEventListener('touchstart', handler, { capture: true });
      document.addEventListener('touchend', handler, { capture: true });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          document.removeEventListener('click', handler);
          document.removeEventListener('touchstart', handler);
          document.removeEventListener('touchend', handler);
          resolve(false);
        }
      }, 5000);
    });
  }
  
  return false;
};

/**
 * Vibrate on Android (for haptic feedback)
 */
export const androidVibrate = (pattern: number | number[] = 50) => {
  if (isAndroid() && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

/**
 * Fix input focus issues on Android
 */
export const fixAndroidInputFocus = () => {
  if (!isAndroid()) return;
  
  // Fix viewport resize on keyboard open
  const originalHeight = window.innerHeight;
  
  window.addEventListener('resize', () => {
    const currentHeight = window.innerHeight;
    const keyboardHeight = originalHeight - currentHeight;
    
    if (keyboardHeight > 150) {
      // Keyboard is open
      document.body.style.paddingBottom = `${keyboardHeight}px`;
    } else {
      // Keyboard is closed
      document.body.style.paddingBottom = '0px';
    }
  });
};

/**
 * Network change detection for reconnection handling
 * Returns cleanup function
 */
export const onNetworkChange = (callback: (online: boolean) => void): (() => void) => {
  const handleOnline = () => {
    console.log('[Network] Connection restored');
    callback(true);
  };
  
  const handleOffline = () => {
    console.log('[Network] Connection lost');
    callback(false);
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Also detect network type changes on mobile
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    if (connection) {
      const handleConnectionChange = () => {
        console.log('[Network] Connection type changed:', connection.effectiveType);
        // Treat connection change as potential reconnection opportunity
        if (navigator.onLine) {
          callback(true);
        }
      };
      connection.addEventListener('change', handleConnectionChange);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', handleConnectionChange);
      };
    }
  }
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

/**
 * App visibility change detection for foreground/background handling
 * Returns cleanup function
 */
export const onVisibilityChange = (callback: (visible: boolean) => void): (() => void) => {
  const handleVisibilityChange = () => {
    const isVisible = document.visibilityState === 'visible';
    console.log('[Visibility] App visibility changed:', isVisible ? 'foreground' : 'background');
    callback(isVisible);
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
};

/**
 * Get device info for diagnostics
 */
export const getDeviceInfo = (): {
  platform: string;
  androidVersion: number | null;
  oem: string;
  hasAudioIssues: boolean;
  hasWebRTCIssues: boolean;
  hasCameraIssues: boolean;
  webViewVersion: string | null;
} => {
  const ua = navigator.userAgent;
  
  let oem = 'unknown';
  if (isOPPO()) oem = 'OPPO';
  else if (isVivo()) oem = 'Vivo';
  else if (isHuawei()) oem = 'Huawei';
  else if (isXiaomi()) oem = 'Xiaomi';
  else if (isSamsung()) oem = 'Samsung';
  else if (isAndroid()) oem = 'Other Android';
  else if (isIOS()) oem = 'iOS';
  
  // Try to extract WebView/Chrome version
  let webViewVersion: string | null = null;
  const chromeMatch = ua.match(/Chrome\/(\d+\.\d+)/);
  if (chromeMatch) {
    webViewVersion = chromeMatch[1];
  }
  
  return {
    platform: isAndroid() ? 'Android' : isIOS() ? 'iOS' : 'Web',
    androidVersion: getAndroidVersion(),
    oem,
    hasAudioIssues: hasAudioCodecIssues(),
    hasWebRTCIssues: hasWebRTCIssues(),
    hasCameraIssues: hasCameraIssues(),
    webViewVersion,
  };
};

/**
 * Initialize all Android fixes
 * Call this in main.tsx or App.tsx
 */
export const initAndroidCompat = () => {
  // Set up viewport height CSS variable for all devices (helps with mobile browser chrome)
  const setVH = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  setVH();
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', () => {
    setTimeout(setVH, 100);
  });
  
  // Log device info for diagnostics
  const deviceInfo = getDeviceInfo();
  console.log('[Device] Info:', deviceInfo);
  
  if (!isAndroid()) return;
  
  console.log('[Android] Initializing Android compatibility layer');
  
  preventAndroidZoom();
  fixAndroidInputFocus();
  
  // Add click listener to unlock audio on first interaction
  const unlockOnInteraction = async () => {
    await unlockAndroidAudio();
    document.removeEventListener('click', unlockOnInteraction);
    document.removeEventListener('touchstart', unlockOnInteraction);
  };
  
  document.addEventListener('click', unlockOnInteraction, { once: true, capture: true });
  document.addEventListener('touchstart', unlockOnInteraction, { once: true, capture: true });
};
