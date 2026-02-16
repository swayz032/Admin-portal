// Smart name parsing utility for formal display names

export interface ParsedName {
  firstName: string;
  lastName: string;
  formalName: string;
  displayName: string;
}

const capitalize = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Common first names for detection
const commonFirstNames = new Set([
  'tonio', 'tony', 'john', 'jane', 'mike', 'michael', 'sarah', 'david', 'james', 'robert',
  'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'william', 'richard', 'joseph',
  'thomas', 'charles', 'chris', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven',
  'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian', 'george', 'timothy', 'ronald',
  'edward', 'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric', 'jonathan',
  'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel', 'raymond',
  'gregory', 'frank', 'alexander', 'patrick', 'jack', 'dennis', 'jerry', 'tyler',
  'aaron', 'jose', 'adam', 'nathan', 'henry', 'douglas', 'zachary', 'peter', 'kyle',
  'alex', 'emma', 'olivia', 'ava', 'sophia', 'isabella', 'mia', 'charlotte', 'amelia',
  'harper', 'evelyn', 'abigail', 'emily', 'ella', 'madison', 'scarlett', 'victoria',
  'aria', 'grace', 'chloe', 'camila', 'penelope', 'riley', 'layla', 'lillian', 'nora',
  'zoey', 'mila', 'aubrey', 'hannah', 'lily', 'addison', 'eleanor', 'natalie', 'luna',
]);

export function parseDisplayName(email: string): ParsedName {
  // Extract username from email
  const username = email.split('@')[0].toLowerCase();
  
  let firstName = '';
  let lastName = '';
  
  // Try common separators first
  if (username.includes('.')) {
    const parts = username.split('.');
    firstName = parts[0];
    lastName = parts[1]?.replace(/\d+$/, '') || '';
  } else if (username.includes('_')) {
    const parts = username.split('_');
    firstName = parts[0];
    lastName = parts[1]?.replace(/\d+$/, '') || '';
  } else if (username.includes('-')) {
    const parts = username.split('-');
    firstName = parts[0];
    lastName = parts[1]?.replace(/\d+$/, '') || '';
  } else {
    // Try to find a known first name at the start
    const cleanUsername = username.replace(/\d+$/, ''); // Remove trailing numbers
    
    // Check if username starts with a common first name
    for (const name of commonFirstNames) {
      if (cleanUsername.startsWith(name) && cleanUsername.length > name.length) {
        firstName = name;
        lastName = cleanUsername.slice(name.length);
        break;
      }
    }
    
    // If no match found, try to split at likely boundaries
    if (!firstName) {
      // Look for camelCase
      const camelMatch = cleanUsername.match(/^([a-z]+)([A-Z][a-z]+)/);
      if (camelMatch) {
        firstName = camelMatch[1];
        lastName = camelMatch[2].toLowerCase();
      } else {
        // Fall back to using the whole username as first name
        firstName = cleanUsername;
      }
    }
  }
  
  // Clean up
  firstName = capitalize(firstName);
  lastName = capitalize(lastName);
  
  // Generate formal name
  const formalName = lastName ? `Mr. ${lastName}` : firstName;
  const displayName = lastName ? `${firstName} ${lastName}` : firstName;
  
  return {
    firstName,
    lastName,
    formalName,
    displayName,
  };
}
