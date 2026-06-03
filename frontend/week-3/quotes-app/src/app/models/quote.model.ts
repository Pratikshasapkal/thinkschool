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

/**
 * Request body for POST /api/quotes.
 * Field names match the backend CreateQuoteRequest DTO exactly.
 * Note: "text" here, not "quoteText" — that is the GET-response DTO field.
 */
export interface CreateQuoteRequest {
  author: string;
  text: string;
}
