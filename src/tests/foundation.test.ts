import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION } from '../engine';
import { formatAuthErrorMessage } from '../services/authService';

describe('Project Foundation & Engine Setup', () => {
  it('should expose the engine foundation version', () => {
    expect(ENGINE_VERSION).toBe('2.0.0-decimal-precision');
  });

  it('should provide user-friendly error messages for common Firebase Auth errors', () => {
    expect(formatAuthErrorMessage('auth/invalid-credential')).toContain(
      'Invalid email or password'
    );
    expect(formatAuthErrorMessage('auth/user-disabled')).toContain(
      'disabled'
    );
    expect(formatAuthErrorMessage('auth/too-many-requests')).toContain(
      'temporarily locked'
    );
    expect(formatAuthErrorMessage('unknown-error-code')).toContain(
      'Authentication failed'
    );
  });
});
