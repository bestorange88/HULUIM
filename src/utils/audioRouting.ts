/**
 * Audio routing utility for switching between earpiece and speaker
 * 
 * On mobile browsers, direct earpiece/speaker control is not available via Web APIs.
 * This utility provides:
 * 1. Web API attempt (setSinkId) - works on some desktop browsers
 * 2. Capacitor native plugin integration - for true native control
 * 3. Fallback with user feedback
 */

import { isAndroid, isIOS, isMobile } from './androidCompat';

export type AudioOutputDevice = 'earpiece' | 'speaker';

interface AudioRoutingResult {
  success: boolean;
  method: 'native' | 'web' | 'fallback';
  message: string;
}

// Check if running in Capacitor native environment
const isCapacitorNative = (): boolean => {
  return !!(window as any).Capacitor?.isNativePlatform?.();
};

// Try to use native Capacitor plugin for audio routing
const tryNativeAudioRouting = async (device: AudioOutputDevice): Promise<boolean> => {
  try {
    const Capacitor = (window as any).Capacitor;
    if (!Capacitor?.isNativePlatform?.()) {
      return false;
    }

    // Try to use custom audio toggle plugin if available
    const AudioToggle = (window as any).Capacitor?.Plugins?.AudioToggle;
    if (AudioToggle) {
      if (device === 'speaker') {
        await AudioToggle.setAudioMode({ mode: 'speaker' });
      } else {
        await AudioToggle.setAudioMode({ mode: 'earpiece' });
      }
      console.log('[AudioRouting] Native plugin switched to:', device);
      return true;
    }

    // Try alternative plugin names
    const AudioRoute = (window as any).Capacitor?.Plugins?.AudioRoute;
    if (AudioRoute) {
      await AudioRoute.setOutput({ output: device });
      console.log('[AudioRouting] AudioRoute plugin switched to:', device);
      return true;
    }

    return false;
  } catch (error) {
    console.log('[AudioRouting] Native plugin not available or failed:', error);
    return false;
  }
};

// Try to use Web API setSinkId for audio routing
const tryWebApiAudioRouting = async (
  audioElement: HTMLAudioElement | HTMLVideoElement | null,
  device: AudioOutputDevice
): Promise<boolean> => {
  if (!audioElement) return false;

  try {
    // Check if setSinkId is supported
    if (!('setSinkId' in audioElement) || typeof (audioElement as any).setSinkId !== 'function') {
      console.log('[AudioRouting] setSinkId not supported');
      return false;
    }

    // Get available audio output devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
    
    console.log('[AudioRouting] Available audio outputs:', audioOutputs.map(d => ({
      deviceId: d.deviceId,
      label: d.label
    })));

    if (audioOutputs.length <= 1) {
      console.log('[AudioRouting] Only one or no audio output device available');
      return false;
    }

    // Try to find the appropriate device
    let targetDevice: MediaDeviceInfo | undefined;
    
    if (device === 'speaker') {
      targetDevice = audioOutputs.find(d => 
        d.label.toLowerCase().includes('speaker') ||
        d.label.toLowerCase().includes('扬声器') ||
        d.deviceId === 'default'
      );
    } else {
      targetDevice = audioOutputs.find(d => 
        d.label.toLowerCase().includes('earpiece') ||
        d.label.toLowerCase().includes('听筒') ||
        d.label.toLowerCase().includes('receiver')
      );
    }

    if (targetDevice) {
      await (audioElement as any).setSinkId(targetDevice.deviceId);
      console.log('[AudioRouting] Web API switched to:', targetDevice.label || targetDevice.deviceId);
      return true;
    }

    return false;
  } catch (error) {
    console.log('[AudioRouting] Web API setSinkId failed:', error);
    return false;
  }
};

// Main function to switch audio output
export const setAudioOutput = async (
  device: AudioOutputDevice,
  audioElement?: HTMLAudioElement | HTMLVideoElement | null
): Promise<AudioRoutingResult> => {
  console.log('[AudioRouting] Attempting to switch to:', device);

  // 1. Try native Capacitor plugin first (most reliable on mobile)
  if (isCapacitorNative()) {
    const nativeSuccess = await tryNativeAudioRouting(device);
    if (nativeSuccess) {
      return {
        success: true,
        method: 'native',
        message: device === 'speaker' ? '已切换到扬声器' : '已切换到听筒'
      };
    }
  }

  // 2. Try Web API (works on some browsers/desktop)
  if (audioElement) {
    const webSuccess = await tryWebApiAudioRouting(audioElement, device);
    if (webSuccess) {
      return {
        success: true,
        method: 'web',
        message: device === 'speaker' ? '已切换到扬声器' : '已切换到听筒'
      };
    }
  }

  // 3. Fallback - inform user about limitation
  if (isMobile()) {
    return {
      success: false,
      method: 'fallback',
      message: isCapacitorNative() 
        ? '音频路由切换需要安装原生插件' 
        : '浏览器不支持切换听筒/扬声器，请使用原生App'
    };
  }

  return {
    success: false,
    method: 'fallback',
    message: '当前设备不支持音频输出切换'
  };
};

// Get current audio output info (for display purposes)
export const getAudioOutputInfo = async (): Promise<string[]> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter(d => d.kind === 'audiooutput')
      .map(d => d.label || d.deviceId);
  } catch {
    return [];
  }
};

// Check if audio routing is likely to work
export const isAudioRoutingSupported = (): boolean => {
  // Native Capacitor has best support
  if (isCapacitorNative()) {
    return true; // Assume native plugin can be added
  }
  
  // Web API support check
  const testAudio = document.createElement('audio');
  return 'setSinkId' in testAudio;
};
