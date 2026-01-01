/**
 * OPPO Device Audio Fix with Quality Enhancement
 * Specifically targets PFUM10, PESM10 and similar OPPO devices
 * with WebM codec compatibility issues
 * Includes audio quality optimization for better playback
 */

// Detect problematic OPPO device models
export const isProblematicOPPO = (): boolean => {
  const ua = navigator.userAgent;
  // PFUM10, PESM10 are specific OPPO models with known issues
  return /PFUM10|PESM10|OPPO A|OPPO Reno.*A/i.test(ua);
};

// Audio context singleton
let audioContext: AudioContext | null = null;
let audioSource: AudioBufferSourceNode | null = null;
let currentGainNode: GainNode | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      // Request higher sample rate for better quality
      sampleRate: 48000,
    });
  }
  return audioContext;
};

// Unlock audio context (must be called from user interaction)
export const unlockOPPOAudio = async (): Promise<boolean> => {
  try {
    const ctx = getAudioContext();
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    // Play silent buffer to unlock
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    
    console.log('[OPPO Audio] Audio context unlocked, state:', ctx.state, 'sampleRate:', ctx.sampleRate);
    return ctx.state === 'running';
  } catch (e) {
    console.error('[OPPO Audio] Failed to unlock audio context:', e);
    return false;
  }
};

// Stop currently playing audio
export const stopOPPOAudio = (): void => {
  if (audioSource) {
    try {
      audioSource.stop();
    } catch (e) {
      // Already stopped
    }
    audioSource.disconnect();
    audioSource = null;
  }
  if (currentGainNode) {
    currentGainNode.disconnect();
    currentGainNode = null;
  }
};

/**
 * Create audio processing chain for quality enhancement
 * Includes: EQ, compression, and gain staging
 */
const createAudioProcessingChain = (ctx: AudioContext): {
  input: AudioNode;
  output: AudioNode;
  gainNode: GainNode;
} => {
  // 1. Input gain node for level control
  const inputGain = ctx.createGain();
  inputGain.gain.value = 1.2; // Slight boost for voice clarity
  
  // 2. High-pass filter to remove low frequency rumble/noise
  const highPassFilter = ctx.createBiquadFilter();
  highPassFilter.type = 'highpass';
  highPassFilter.frequency.value = 80; // Cut below 80Hz
  highPassFilter.Q.value = 0.7;
  
  // 3. Low-shelf EQ to add warmth
  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 250;
  lowShelf.gain.value = 2; // Slight bass boost
  
  // 4. Peaking filter for voice presence (2-4kHz range)
  const presenceEQ = ctx.createBiquadFilter();
  presenceEQ.type = 'peaking';
  presenceEQ.frequency.value = 3000; // 3kHz - voice clarity
  presenceEQ.Q.value = 1.0;
  presenceEQ.gain.value = 3; // Boost for clarity
  
  // 5. High-shelf to add air/brightness
  const highShelf = ctx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 8000;
  highShelf.gain.value = 1.5; // Slight high boost
  
  // 6. Low-pass filter to remove harsh high frequencies
  const lowPassFilter = ctx.createBiquadFilter();
  lowPassFilter.type = 'lowpass';
  lowPassFilter.frequency.value = 12000; // Cut above 12kHz
  lowPassFilter.Q.value = 0.7;
  
  // 7. Dynamics compressor for consistent volume
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -24; // Start compressing at -24dB
  compressor.knee.value = 12; // Soft knee for natural sound
  compressor.ratio.value = 4; // 4:1 compression ratio
  compressor.attack.value = 0.003; // 3ms attack - fast for voice
  compressor.release.value = 0.15; // 150ms release
  
  // 8. Output gain node for final level adjustment
  const outputGain = ctx.createGain();
  outputGain.gain.value = 1.5; // Make up gain after compression
  
  // Connect the chain
  inputGain.connect(highPassFilter);
  highPassFilter.connect(lowShelf);
  lowShelf.connect(presenceEQ);
  presenceEQ.connect(highShelf);
  highShelf.connect(lowPassFilter);
  lowPassFilter.connect(compressor);
  compressor.connect(outputGain);
  
  return {
    input: inputGain,
    output: outputGain,
    gainNode: outputGain,
  };
};

/**
 * Simple audio processing chain (lighter on CPU)
 * For devices that might struggle with full processing
 */
const createSimpleProcessingChain = (ctx: AudioContext): {
  input: AudioNode;
  output: AudioNode;
  gainNode: GainNode;
} => {
  // Simple gain + compressor for basic quality improvement
  const gainNode = ctx.createGain();
  gainNode.gain.value = 1.3;
  
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 10;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.2;
  
  gainNode.connect(compressor);
  
  return {
    input: gainNode,
    output: compressor,
    gainNode: gainNode,
  };
};

// Play audio using Web Audio API with quality enhancement
export const playOPPOAudio = async (
  url: string,
  onEnded?: () => void,
  onError?: (error: Error) => void,
  useEnhancedQuality: boolean = true
): Promise<boolean> => {
  console.log('[OPPO Audio] Attempting playback via Web Audio API with quality enhancement');
  
  // Stop any currently playing audio
  stopOPPOAudio();
  
  try {
    const ctx = getAudioContext();
    
    // Ensure context is running
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    // Fetch the audio data
    console.log('[OPPO Audio] Fetching audio data from:', url);
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log('[OPPO Audio] Audio data fetched, size:', arrayBuffer.byteLength);
    
    // Decode the audio data
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      console.log('[OPPO Audio] Audio decoded successfully, duration:', audioBuffer.duration, 'channels:', audioBuffer.numberOfChannels, 'sampleRate:', audioBuffer.sampleRate);
    } catch (decodeError) {
      console.error('[OPPO Audio] Decode error, trying alternative approach:', decodeError);
      
      // Try with a copy of the buffer (some browsers need this)
      const bufferCopy = arrayBuffer.slice(0);
      audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        ctx.decodeAudioData(
          bufferCopy,
          (buffer) => resolve(buffer),
          (error) => reject(error)
        );
      });
    }
    
    // Create and play the source
    audioSource = ctx.createBufferSource();
    audioSource.buffer = audioBuffer;
    
    // Create audio processing chain
    let processingChain;
    try {
      processingChain = useEnhancedQuality 
        ? createAudioProcessingChain(ctx) 
        : createSimpleProcessingChain(ctx);
    } catch (e) {
      console.warn('[OPPO Audio] Failed to create enhanced processing, using simple chain:', e);
      processingChain = createSimpleProcessingChain(ctx);
    }
    
    currentGainNode = processingChain.gainNode;
    
    // Connect: source -> processing chain -> destination
    audioSource.connect(processingChain.input);
    processingChain.output.connect(ctx.destination);
    
    // Handle ended event
    audioSource.onended = () => {
      console.log('[OPPO Audio] Playback ended');
      stopOPPOAudio();
      onEnded?.();
    };
    
    // Start playback
    audioSource.start(0);
    console.log('[OPPO Audio] Playback started successfully with', useEnhancedQuality ? 'enhanced' : 'simple', 'quality');
    
    return true;
  } catch (error) {
    console.error('[OPPO Audio] Playback failed:', error);
    onError?.(error as Error);
    return false;
  }
};

// Alternative: Use HTML5 Audio with blob URL (may work for some formats)
export const playOPPOAudioWithBlob = async (
  url: string,
  onEnded?: () => void,
  onError?: (error: Error) => void
): Promise<HTMLAudioElement | null> => {
  console.log('[OPPO Audio Blob] Attempting blob playback');
  
  try {
    // Fetch as blob
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    
    const blob = await response.blob();
    console.log('[OPPO Audio Blob] Blob created, type:', blob.type, 'size:', blob.size);
    
    // Create blob URL
    const blobUrl = URL.createObjectURL(blob);
    
    // Create new audio element
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = 1.0;
    
    // OPPO specific attributes
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.setAttribute('x5-playsinline', 'true');
    audio.setAttribute('x5-video-player-type', 'h5');
    audio.setAttribute('t7-video-player-type', 'inline');
    
    // Set source
    audio.src = blobUrl;
    
    // Event handlers
    audio.onended = () => {
      URL.revokeObjectURL(blobUrl);
      onEnded?.();
    };
    
    audio.onerror = (e) => {
      URL.revokeObjectURL(blobUrl);
      console.error('[OPPO Audio Blob] Error:', e);
      onError?.(new Error('Blob audio playback failed'));
    };
    
    // Load and play
    audio.load();
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve(); // Try to play anyway after timeout
      }, 3000);
      
      audio.oncanplaythrough = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      audio.onloadeddata = () => {
        clearTimeout(timeout);
        resolve();
      };
    });
    
    await audio.play();
    console.log('[OPPO Audio Blob] Playback started');
    
    return audio;
  } catch (error) {
    console.error('[OPPO Audio Blob] Failed:', error);
    onError?.(error as Error);
    return null;
  }
};

// Combined approach: try multiple methods
export const playAudioOnOPPO = async (
  url: string,
  onEnded?: () => void,
  onError?: (error: Error) => void
): Promise<{ success: boolean; cleanup?: () => void }> => {
  console.log('[OPPO Audio] Starting combined playback approach with quality enhancement');
  
  // First, try Web Audio API with enhanced quality (most reliable for codec issues)
  const webAudioSuccess = await playOPPOAudio(url, onEnded, () => {}, true);
  
  if (webAudioSuccess) {
    return {
      success: true,
      cleanup: stopOPPOAudio,
    };
  }
  
  console.log('[OPPO Audio] Enhanced Web Audio API failed, trying simple processing');
  
  // Second, try Web Audio API with simple processing
  const simpleSuccess = await playOPPOAudio(url, onEnded, () => {}, false);
  
  if (simpleSuccess) {
    return {
      success: true,
      cleanup: stopOPPOAudio,
    };
  }
  
  console.log('[OPPO Audio] Web Audio API failed, trying blob method');
  
  // Third, try blob-based playback
  const blobAudio = await playOPPOAudioWithBlob(url, onEnded, onError);
  
  if (blobAudio) {
    return {
      success: true,
      cleanup: () => {
        blobAudio.pause();
        blobAudio.currentTime = 0;
      },
    };
  }
  
  console.log('[OPPO Audio] All methods failed');
  onError?.(new Error('Unable to play audio on this device'));
  
  return { success: false };
};

/**
 * Set playback volume (0.0 to 1.0)
 */
export const setOPPOAudioVolume = (volume: number): void => {
  if (currentGainNode) {
    // Adjust gain relative to the base processing gain
    currentGainNode.gain.value = Math.max(0, Math.min(2, volume * 1.5));
  }
};
