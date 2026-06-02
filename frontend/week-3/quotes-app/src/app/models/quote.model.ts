export interface Quote {
  id: number;
  author: string;
  quoteText: string;
  createdAt: string;
}

export interface QuotesResponse {
  value: Quote[];
  count: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}
