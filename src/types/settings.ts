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
  feetToMetre?: number; // defaults to 0.305 per Sprint 2
  defaultWidthFactor?: number; // defaults to 1.08 per Sprint 2
  enableRoundOff?: boolean; // defaults to false per Sprint 2
  updatedAt?: string | number | Record<string, unknown>;
}
