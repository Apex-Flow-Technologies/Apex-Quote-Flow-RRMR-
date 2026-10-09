export interface Customer {
  id: string;
  name: string;
  gstin?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  createdAt?: string | number | Record<string, unknown>;
  updatedAt?: string | number | Record<string, unknown>;
}

export type CreateCustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};
