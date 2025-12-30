import { safeStorage } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const CREDENTIAL_FILE_NAME = '.sync-credentials';

export interface SyncCredentials {
  apiKey: string;
  userId?: string;
}

/**
 * Secure credential storage for sync API keys.
 *
 * Uses Electron's safeStorage API which encrypts data using
 * the OS-level credential store:
 * - macOS: Keychain
 * - Windows: DPAPI (Credential Manager)
 * - Linux: libsecret (GNOME Keyring, KWallet, etc.)
 */
export class CredentialManager {
  private readonly credentialPath: string;

  constructor(vaultPath: string) {
    // Store encrypted credentials in vault's .scribe directory
    this.credentialPath = path.join(vaultPath, '.scribe', CREDENTIAL_FILE_NAME);
  }

  /**
   * Check if safeStorage encryption is available.
   * May be false on some Linux systems without libsecret.
   */
  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Store credentials securely.
   */
  async storeCredentials(credentials: SyncCredentials): Promise<void> {
    if (!this.isEncryptionAvailable()) {
      throw new Error(
        'Secure storage not available. Please install a keyring service (e.g., gnome-keyring).'
      );
    }

    const plaintext = JSON.stringify(credentials);
    const encrypted = safeStorage.encryptString(plaintext);

    // Ensure directory exists
    await fs.mkdir(path.dirname(this.credentialPath), { recursive: true });

    // Write encrypted buffer to file
    await fs.writeFile(this.credentialPath, encrypted);
  }

  /**
   * Retrieve stored credentials.
   * Returns null if no credentials stored.
   */
  async getCredentials(): Promise<SyncCredentials | null> {
    if (!this.isEncryptionAvailable()) {
      return null;
    }

    try {
      const encrypted = await fs.readFile(this.credentialPath);
      const plaintext = safeStorage.decryptString(encrypted);
      return JSON.parse(plaintext) as SyncCredentials;
    } catch {
      return null; // File doesn't exist or decryption failed
    }
  }

  /**
   * Get just the API key (convenience method).
   */
  async getApiKey(): Promise<string | null> {
    const credentials = await this.getCredentials();
    return credentials?.apiKey ?? null;
  }

  /**
   * Delete stored credentials (on sync disable).
   */
  async clearCredentials(): Promise<void> {
    try {
      await fs.unlink(this.credentialPath);
    } catch {
      // File might not exist, that's fine
    }
  }

  /**
   * Check if credentials are stored.
   */
  async hasCredentials(): Promise<boolean> {
    try {
      await fs.access(this.credentialPath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a CredentialManager for a vault.
 */
export function createCredentialManager(vaultPath: string): CredentialManager {
  return new CredentialManager(vaultPath);
}
