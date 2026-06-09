export interface Quote {
  id: number;
  author: string;
  text: string;
  createdAt: string;
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

export interface CreateQuoteRequest {
  author: string;
  text: string;
}
