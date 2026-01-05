import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) {
      // For web, use visualViewport API
      const handleViewportResize = () => {
        if (window.visualViewport) {
          const viewportHeight = window.visualViewport.height;
          const windowHeight = window.innerHeight;
          const keyboardH = Math.max(0, windowHeight - viewportHeight);
          
          setKeyboardHeight(keyboardH);
          setIsKeyboardVisible(keyboardH > 100);
          
          // Set CSS variable for keyboard inset
          document.documentElement.style.setProperty('--keyboard-inset', `${keyboardH}px`);
        }
      };

      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleViewportResize);
        window.visualViewport.addEventListener('scroll', handleViewportResize);
      }

      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleViewportResize);
          window.visualViewport.removeEventListener('scroll', handleViewportResize);
        }
      };
    }

    // For native platforms, use Capacitor Keyboard plugin
    let Keyboard: any = null;
    
    const setupKeyboardListeners = async () => {
      try {
        const keyboardModule = await import('@capacitor/keyboard');
        Keyboard = keyboardModule.Keyboard;
        
        // Listen for keyboard show event
        Keyboard.addListener('keyboardWillShow', (info: { keyboardHeight: number }) => {
          const height = info.keyboardHeight || 0;
          setKeyboardHeight(height);
          setIsKeyboardVisible(true);
          document.documentElement.style.setProperty('--keyboard-inset', `${height}px`);
        });

        // Listen for keyboard hide event
        Keyboard.addListener('keyboardWillHide', () => {
          setKeyboardHeight(0);
          setIsKeyboardVisible(false);
          document.documentElement.style.setProperty('--keyboard-inset', '0px');
        });
      } catch (error) {
        console.warn('Capacitor Keyboard plugin not available:', error);
        
        // Fallback to visualViewport API
        const handleViewportResize = () => {
          if (window.visualViewport) {
            const viewportHeight = window.visualViewport.height;
            const windowHeight = window.innerHeight;
            const keyboardH = Math.max(0, windowHeight - viewportHeight);
            
            setKeyboardHeight(keyboardH);
            setIsKeyboardVisible(keyboardH > 100);
            document.documentElement.style.setProperty('--keyboard-inset', `${keyboardH}px`);
          }
        };

        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', handleViewportResize);
          window.visualViewport.addEventListener('scroll', handleViewportResize);
        }
      }
    };

    setupKeyboardListeners();

    return () => {
      if (Keyboard) {
        Keyboard.removeAllListeners();
      }
      document.documentElement.style.setProperty('--keyboard-inset', '0px');
    };
  }, []);

  return { keyboardHeight, isKeyboardVisible };
}
