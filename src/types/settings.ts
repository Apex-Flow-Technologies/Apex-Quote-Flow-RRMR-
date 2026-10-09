export interface BankDetails {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
}

export interface CompanySettings {
  name: string;
  gstin: string;
  address: string;
  phones: string[];
  email: string;
  bankDetails: BankDetails;
  defaultTerms: string[];
  updatedAt?: string | number | Record<string, unknown>;
}
