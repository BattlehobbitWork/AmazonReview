import axios from 'axios';
import type { AxiosProgressEvent } from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')?.replace(/"/g, '');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ProductInfo {
  asin: string;
  product_name: string;
  description?: string | null;
  average_rating?: number | null;
  price?: number | null;
  features?: string[] | null;
  positive_themes?: string[] | null;
  negative_themes?: string[] | null;
  scrape_failed: boolean;
  error_message?: string | null;
}

export interface PriceSummaryEntry {
  asin: string;
  product_name: string;
  added_at: string;
  current_price: number | null;
  last_checked: string | null;
  lowest_price_365d: number | null;
  lowest_price_date: string | null;
  highest_price_365d: number | null;
  check_count: number;
}

export interface PriceHistoryEntry {
  price: number | null;
  scraped_at: string;
}

export interface TrackProductsResponse {
  added: number;
  skipped: number;
  total: number;
  message: string;
}

export interface ReviewGenerateRequest {
  asin: string;
  product_name: string;
  star_rating: number;
  product_info?: ProductInfo | null;
  sample_reviews: { star_rating: number; review_text: string }[];
  llm_settings?: LLMSettings | null;
  additional_context?: string | null;
}

export interface ReviewGenerateResponse {
  review_title: string;
  review_text: string;
  model_used: string;
  tokens_used?: number | null;
}

export interface LLMSettings {
  api_key?: string | null;
  api_url?: string | null;
  model?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
  top_p?: number | null;
  frequency_penalty?: number | null;
  presence_penalty?: number | null;
}

export interface UploadResponse {
  success: boolean;
  row_count: number;
  message: string;
  data?: Record<string, unknown>[] | null;
}

export const apiClient = {
  healthCheck: () => api.get('/health'),

  uploadSamples: (file: File, onProgress?: (e: AxiosProgressEvent) => void) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<UploadResponse>('/upload/samples', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },

  uploadProducts: (file: File, onProgress?: (e: AxiosProgressEvent) => void) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<UploadResponse>('/upload/products', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },

  getProduct: (index: number) => api.get<ProductInfo>(`/products/${index}`),

  scrapeProduct: (asin: string) => api.post<ProductInfo>(`/products/${asin}/scrape`),

  generateReview: (data: ReviewGenerateRequest) =>
    api.post<ReviewGenerateResponse>('/reviews/generate', data),

  exportReviews: (reviews: Record<string, unknown>[], format: string = 'csv') =>
    api.post('/reviews/export', { reviews, format }, { responseType: 'blob' }),

  getLLMSettings: () => api.get<LLMSettings>('/settings/llm'),

  updateLLMSettings: (settings: LLMSettings) =>
    api.put<LLMSettings>('/settings/llm', settings),

  getState: () => api.get<Record<string, unknown>>('/state'),

  patchState: (partial: Record<string, unknown>) =>
    api.patch<Record<string, unknown>>('/state', partial),

  checkAuth: () => api.get<{ auth_required: boolean }>('/auth/check'),

  login: (password: string) =>
    api.post<{ token: string; expires_in: number }>('/auth/login', { password }),

  // Price tracker
  trackProducts: (products: { asin: string; product_name: string }[]) =>
    api.post<TrackProductsResponse>('/prices/track', { products }),

  getTrackedProducts: () =>
    api.get<{ asin: string; product_name: string; added_at: string; active: number }[]>('/prices/tracked'),

  getPriceSummary: () =>
    api.get<PriceSummaryEntry[]>('/prices/summary'),

  getPriceHistory: (asin: string, days: number = 365) =>
    api.get<PriceHistoryEntry[]>(`/prices/history/${asin}`, { params: { days } }),

  triggerPriceCheck: () =>
    api.post<{ message: string }>('/prices/check-now'),

  untrackProduct: (asin: string) =>
    api.delete<{ message: string }>(`/prices/track/${asin}`),
};

export default api;
