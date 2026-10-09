export type UserRole = 'admin' | 'sales';

export interface UserProfile {
  uid: string;
  email?: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt?: string | number | Record<string, unknown>;
  updatedAt?: string | number | Record<string, unknown>;
}
