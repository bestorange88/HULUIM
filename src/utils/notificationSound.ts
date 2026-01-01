// Notification sound utilities using Web Audio API

let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioCtx();
  }
  return audioContext;
};

/**
 * Play a notification sound for new messages
 */
export const playMessageNotification = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const oscillator1 = ctx.createOscillator();
    const oscillator2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator1.type = 'sine';
    oscillator2.type = 'sine';
    oscillator1.frequency.value = 800;
    oscillator2.frequency.value = 1000;
    
    gainNode.gain.value = 0;
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator1.start(now);
    oscillator2.start(now);
    oscillator1.stop(now + 0.3);
    oscillator2.stop(now + 0.3);
  } catch (error) {
    console.error('Error playing message notification:', error);
  }
};

/**
 * Play a notification sound for friend requests
 */
export const playFriendRequestNotification = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.type = 'triangle';
    
    gainNode.gain.value = 0;
    gainNode.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    
    oscillator.frequency.value = 600;
    oscillator.frequency.linearRampToValueAtTime(800, now + 0.1);
    oscillator.frequency.linearRampToValueAtTime(1000, now + 0.25);
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.5);
  } catch (error) {
    console.error('Error playing friend request notification:', error);
  }
};
