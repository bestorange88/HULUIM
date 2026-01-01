/**
 * Security utilities for transaction password handling
 * All transaction password operations should use these functions
 * to ensure consistent hashing across the application
 */

/**
 * Hash a transaction password using SHA-256
 * @param password - The plain text password to hash
 * @returns The SHA-256 hash as a lowercase hex string (64 characters)
 */
export async function hashTransactionPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a stored hash looks like a valid SHA-256 hash
 * @param hash - The stored hash value
 * @returns true if it's a 64-character lowercase hex string
 */
export function isValidSha256Hash(hash: string): boolean {
  return hash.length === 64 && /^[0-9a-f]+$/.test(hash);
}

/**
 * Check if a stored value looks like Base64 encoded
 * @param value - The stored value
 * @returns true if it looks like Base64
 */
export function looksLikeBase64(value: string): boolean {
  // Base64 strings are typically shorter and contain only alphanumeric + /+=
  if (value.length > 20 || value.length < 4) return false;
  return /^[A-Za-z0-9+/=]+$/.test(value);
}

/**
 * Safely decode Base64 string
 * @param value - The Base64 encoded value
 * @returns The decoded string or null if decoding fails
 */
export function safeAtob(value: string): string | null {
  try {
    return atob(value);
  } catch {
    return null;
  }
}

/**
 * Verify a transaction password against a stored hash
 * Supports backward compatibility with legacy formats (plain text, Base64)
 * and automatically migrates to SHA-256 format
 * 
 * @param inputPassword - The password entered by the user
 * @param storedHash - The hash stored in the database
 * @returns Object with verification result and migration info
 */
export async function verifyTransactionPassword(
  inputPassword: string,
  storedHash: string
): Promise<{
  isValid: boolean;
  needsMigration: boolean;
  newHash?: string;
}> {
  // First, try SHA-256 verification (the correct format)
  const inputHash = await hashTransactionPassword(inputPassword);
  
  if (storedHash === inputHash) {
    // Already using SHA-256, no migration needed
    return { isValid: true, needsMigration: false };
  }
  
  // Check if stored value is plain text (legacy format from admin panel)
  if (storedHash === inputPassword) {
    // Plain text match - needs migration to SHA-256
    return { 
      isValid: true, 
      needsMigration: true, 
      newHash: inputHash 
    };
  }
  
  // Check if stored value is Base64 encoded (legacy format from ChangeTransactionPasswordDialog)
  if (looksLikeBase64(storedHash)) {
    const decoded = safeAtob(storedHash);
    if (decoded === inputPassword) {
      // Base64 match - needs migration to SHA-256
      return { 
        isValid: true, 
        needsMigration: true, 
        newHash: inputHash 
      };
    }
  }
  
  // No match found
  return { isValid: false, needsMigration: false };
}
