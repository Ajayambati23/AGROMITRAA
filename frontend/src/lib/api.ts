import axios from 'axios';

// Ensure base URL always ends with /api so paths like /orders/:id/status resolve to /api/orders/:id/status
const rawBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_BASE_URL = rawBase.endsWith('/api') ? rawBase : rawBase.replace(/\/?$/, '') + '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const buyerApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const adminApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; errors?: Array<{ msg?: string; path?: string }> } | undefined;
    if (data?.message) return data.message;
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      return data.errors.map((e) => e.msg || e.path).filter(Boolean).join('. ');
    }
    const status = err.response?.status;
    if (status === 400) return 'Invalid request. Check your input.';
    if (status === 401) return 'Please sign in again.';
    if (status === 403) return 'Access denied.';
    if (status === 404) return 'Not found.';
    if (status && status >= 500) return 'Server error. Try again later.';
  }
  return err instanceof Error ? err.message : 'Something went wrong.';
}

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

buyerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('buyerToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors – stay on current page; app will show login UI when state updates
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('agromitra:auth-logout'));
      }
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  preferredLanguage: string;
  location: {
    state: string;
    district: string;
    village: string;
  };
  soilType: string;
  farmSize: number;
  experience: string;
}

export interface Crop {
  id: string;
  name: string;
  scientificName: string;
  description: string;
  seasons: string[];
  soilTypes: string[];
  climate: {
    temperature: { min: number; max: number };
    rainfall: { min: number; max: number };
    humidity: { min: number; max: number };
  };
  planting: {
    spacing: { row: number; plant: number };
    depth: number;
    seedRate: number;
    plantingTime: string;
  };
  irrigation: {
    frequency: string;
    waterRequirement: number;
    methods: string[];
  };
  fertilization: {
    npk: { nitrogen: number; phosphorus: number; potassium: number };
    organic: string[];
    schedule: Array<{
      stage: string;
      fertilizer: string;
      quantity: string;
      timing: string;
    }>;
  };
  pestControl: {
    commonPests: string[];
    pesticides: Array<{
      name: string;
      activeIngredient: string;
      dosage: string;
      application: string;
      safetyPeriod: number;
    }>;
    organicControl: string[];
  };
  harvesting: {
    maturityPeriod: number;
    indicators: string[];
    method: string;
    yield: { min: number; max: number; unit: string };
  };
  marketPrice: {
    current: number;
    unit: string;
    currency: string;
  };
  images: string[];
}

export interface MarketCommodityPrice {
  cropName: string;
  variety?: string | null;
  price: number | null;
  min?: number | null;
  max?: number | null;
  unit: string;
  currency: string;
  arrivalDate?: string | null;
  marketName?: string;
  district?: string;
  state?: string;
  source?: string;
}

export interface ChatMessage {
  id: string;
  message: string;
  response: string;
  classification: string;
  language: string;
  timestamp: string;
  isUser?: boolean;
  /** 'local' = offline AI, 'openai' = cloud */
  model?: string;
}

export interface CalendarEvent {
  id: string;
  cropId: string;
  crop: Crop;
  plantingDate: string;
  activities: Array<{
    name: string;
    date: string;
    description: string;
    completed: boolean;
  }>;
}

// Auth API
export const authAPI = {
  register: async (userData: Partial<User> & { password: string }) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  updateProfile: async (userData: Partial<User>) => {
    const response = await api.put('/auth/profile', userData);
    return response.data;
  },
};

// Crops API
export const cropsAPI = {
  getAll: async (params?: {
    season?: string;
    soilType?: string;
    language?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) => {
    const response = await api.get('/crops', { params });
    return response.data;
  },

  getById: async (id: string, language?: string) => {
    const response = await api.get(`/crops/${id}`, {
      params: { language },
    });
    return response.data;
  },

  recommend: async (data: {
    season: string;
    soilType: string;
    location?: string;
    language?: string;
  }) => {
    const response = await api.post('/crops/recommend', data);
    return response.data;
  },

  getHarvesting: async (id: string, language?: string) => {
    const response = await api.get(`/crops/${id}/harvesting`, {
      params: { language },
    });
    return response.data;
  },

  getPestControl: async (id: string, language?: string) => {
    const response = await api.get(`/crops/${id}/pest-control`, {
      params: { language },
    });
    return response.data;
  },

  getIrrigation: async (id: string, language?: string) => {
    const response = await api.get(`/crops/${id}/irrigation`, {
      params: { language },
    });
    return response.data;
  },

  getFertilization: async (id: string, language?: string) => {
    const response = await api.get(`/crops/${id}/fertilization`, {
      params: { language },
    });
    return response.data;
  },

  getMarketPrices: async (language?: string, limit?: number, location?: string) => {
    const response = await api.get('/crops/market-prices', {
      params: { language, limit, location },
    });
    return response.data;
  },

  getMarketStates: async () => {
    const response = await api.get('/crops/market-locations/states');
    return response.data as { states: string[] };
  },

  getMarketDistricts: async (state: string) => {
    const response = await api.get('/crops/market-locations/districts', {
      params: { state },
    });
    return response.data as { state: string; districts: string[] };
  },

  getMarketMandis: async (state: string, district: string) => {
    const response = await api.get('/crops/market-locations/markets', {
      params: { state, district },
    });
    return response.data as { state: string; district: string; markets: string[] };
  },

  getPricesByMandi: async (params: {
    state: string;
    district: string;
    market: string;
    limit?: number;
  }) => {
    const response = await api.get('/crops/market-prices/by-market', { params });
    return response.data as {
      state: string;
      district: string;
      market: string;
      count: number;
      prices: MarketCommodityPrice[];
      source?: string;
      message?: string;
    };
  },
};

// Chat API
export const chatAPI = {
  sendMessage: async (message: string, language?: string) => {
    const response = await api.post('/chat/message', { message, language });
    return response.data;
  },

  sendDiseaseImage: async (imageBase64: string, message?: string, language?: string) => {
    const response = await api.post('/chat/disease-image', { image: imageBase64, message, language });
    return response.data;
  },

  getHistory: async () => {
    const response = await api.get('/chat/history');
    return response.data;
  },
};

// Calendar API
export const calendarAPI = {
  create: async (data: {
    cropId: string;
    plantingDate: string;
    language?: string;
  }) => {
    const response = await api.post('/calendar', data);
    return response.data;
  },

  getAll: async () => {
    const response = await api.get('/calendar');
    return response.data;
  },

  getUpcomingActivities: async (days?: number, language?: string) => {
    const response = await api.get('/calendar/upcoming/activities', {
      params: { days, language },
    });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/calendar/${id}`);
    return response.data;
  },

  updateActivity: async (
    calendarId: string,
    activityId: string,
    data: { status: 'pending' | 'completed' | 'overdue' | 'cancelled'; completedDate?: string }
  ) => {
    const response = await api.put(`/calendar/${calendarId}/activities/${activityId}`, data);
    return response.data;
  },
  deleteActivity: async (calendarId: string, activityId: string) => {
    const response = await api.delete(`/calendar/${calendarId}/activities/${activityId}`);
    return response.data;
  },

  addActivity: async (
    calendarId: string,
    data: {
      type: 'planting' | 'irrigation' | 'fertilization' | 'pest_control' | 'harvesting' | 'pruning' | 'weeding';
      name: string;
      description?: string;
      scheduledDate: string;
      priority?: 'low' | 'medium' | 'high' | 'critical';
    }
  ) => {
    const response = await api.post(`/calendar/${calendarId}/activities`, data);
    return response.data;
  },
};

// Weather API
export const weatherAPI = {
  getCurrent: async (params: { location?: string; latitude?: number; longitude?: number }) => {
    const fetchWeather = async (requestParams: { location?: string; latitude?: number; longitude?: number }) => {
      const response = await api.get('/weather/current', { params: requestParams });
      return response.data as {
        location: string;
        latitude: number;
        longitude: number;
        tempC: number;
        windKph: number;
        humidity: number;
        rainProbability: number;
        condition: string;
        alerts: string[];
        updatedAt: string;
        source: string;
      };
    };

    try {
      return await fetchWeather(params);
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 404 &&
        params.location &&
        !params.location.includes(',')
      ) {
        return fetchWeather({ ...params, location: `${params.location}, India` });
      }
      throw error;
    }
  },
};

// Voice API
export const voiceAPI = {
  getLanguages: async () => {
    const response = await api.get('/voice/languages');
    return response.data;
  },

  getFormats: async () => {
    const response = await api.get('/voice/formats');
    return response.data;
  },
};

// Marketplace API (farmer: add/list/update/remove listings)
export interface ListingForm {
  cropName: string;
  quantity: number;
  unit: 'kg' | 'quintal' | 'ton' | 'bag' | 'unit';
  pricePerUnit: number;
  description?: string;
  location?: { state?: string; district?: string; village?: string };
}

export interface Listing {
  _id?: string;
  id?: string;
  cropName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  location: { state?: string; district?: string; village?: string };
  description: string;
  status: 'active' | 'sold' | 'cancelled';
  contactPhone?: string;
  contactEmail?: string;
  createdAt: string;
  sellerId?: { name?: string; phone?: string; location?: Record<string, string> };
  sellerRating?: { avgRating: number | null; totalReviews: number };
}

export interface Buyer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: { state?: string; district?: string; village?: string; fullAddress?: string };
}

export interface BuyerOrder {
  _id: string;
  buyerId: Buyer | string;
  listingId: Listing & {
    sellerId?: { name?: string; phone?: string; email?: string };
  };
  quantity: number;
  status: string;
  createdAt: string;
}

export const marketplaceAPI = {
  getMyListings: async () => {
    const response = await api.get<{ listings: Listing[] }>('/marketplace/listings/my');
    return response.data;
  },
  create: async (data: ListingForm) => {
    const response = await api.post<{ listing: Listing }>('/marketplace/listings', data);
    return response.data;
  },
  update: async (id: string, data: Partial<ListingForm & { status?: string }>) => {
    const response = await api.patch<{ listing: Listing }>(`/marketplace/listings/${id}`, data);
    return response.data;
  },
  remove: async (id: string) => {
    await api.delete(`/marketplace/listings/${id}`);
  },
  browse: async (params?: { state?: string; cropName?: string; limit?: number; page?: number }) => {
    const response = await api.get<{ listings: Listing[]; total: number; page: number; limit: number }>('/marketplace/listings/browse', { params });
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get<{ listing: Listing }>(`/marketplace/listings/${id}`);
    return response.data;
  },
};

export const buyerMarketplaceAPI = {
  browse: async (params?: { state?: string; cropName?: string; limit?: number; page?: number }) => {
    const response = await api.get<{ listings: Listing[]; total: number; page: number; limit: number }>('/marketplace/listings/browse', { params });
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get<{ listing: Listing }>(`/marketplace/listings/${id}`);
    return response.data;
  },
  createReview: async (listingId: string, rating: number, comment?: string) => {
    const response = await buyerApi.post(`/marketplace/listings/${listingId}/reviews`, { rating, comment });
    return response.data as { review: unknown; sellerRating: { avgRating: number | null; totalReviews: number } };
  },
  getReviews: async (listingId: string) => {
    const response = await api.get(`/marketplace/listings/${listingId}/reviews`);
    return response.data as {
      reviews: Array<{ id: string; rating: number; comment: string; buyerName: string; createdAt: string }>;
      sellerRating: { avgRating: number | null; totalReviews: number };
    };
  },
};

export const buyerAuthAPI = {
  register: async (data: { name: string; email: string; phone: string; password: string; address?: Record<string, string> }) => {
    const response = await api.post<{ token: string; buyer: Buyer }>('/buyer-auth/register', data);
    return response.data;
  },
  login: async (email: string, password: string) => {
    const response = await api.post<{ token: string; buyer: Buyer }>('/buyer-auth/login', { email, password });
    return response.data;
  },
  getProfile: async () => {
    const response = await buyerApi.get<{ buyer: Buyer }>('/buyer-auth/profile');
    return response.data;
  },
};

// Orders API (farmer: orders for my listings with buyer details)
export interface OrderBuyer {
  name?: string;
  email?: string;
  phone?: string;
  address?: { state?: string; district?: string; village?: string; fullAddress?: string };
}
export interface FarmerOrder {
  _id: string;
  buyerId: OrderBuyer;
  listingId: { cropName?: string; unit?: string; quantity?: number; pricePerUnit?: number };
  quantity: number;
  status: string;
  createdAt: string;
}

export const ordersAPI = {
  getForSeller: async () => {
    const response = await api.get<{ orders: FarmerOrder[] }>('/orders/for-seller');
    return response.data;
  },
  updateStatus: async (orderId: string, status: 'accepted' | 'delivered' | 'rejected') => {
    const response = await api.put<{ order: FarmerOrder }>(`/orders/${orderId}/status`, { status });
    return response.data;
  },
};

export const buyerOrdersAPI = {
  create: async (listingId: string, quantity: number) => {
    const response = await buyerApi.post<{ order: BuyerOrder }>('/orders', { listingId, quantity });
    return response.data;
  },
  myOrders: async () => {
    const response = await buyerApi.get<{ orders: BuyerOrder[] }>('/orders/my');
    return response.data;
  },
};

// Training API
export const trainingAPI = {
  getStats: async () => {
    const response = await api.get('/training/stats');
    return response.data;
  },

  getPerformance: async () => {
    const response = await api.get('/training/performance');
    return response.data;
  },

  retrain: async () => {
    const response = await api.post('/training/retrain');
    return response.data;
  },

  addData: async (data: {
    text: string;
    category: string;
    language?: string;
  }) => {
    const response = await api.post('/training/add-data', data);
    return response.data;
  },

  testModel: async (queries: string[], language?: string) => {
    const response = await api.post('/training/test', { queries, language });
    return response.data;
  },
};

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  isActive?: boolean;
  preferredLanguage?: string;
  location?: { state?: string; district?: string; village?: string };
  soilType?: string;
  farmSize?: number;
  experience?: string;
  createdAt?: string;
  lastLogin?: string;
}

export interface AdminOrder {
  _id: string;
  quantity: number;
  status: string;
  createdAt: string;
  buyerId?: { name?: string; email?: string; phone?: string };
  listingId?: {
    cropName?: string;
    unit?: string;
    pricePerUnit?: number;
    sellerId?: { name?: string; email?: string; phone?: string };
  };
}

export interface AdminSummary {
  users: { total: number; active: number; inactive: number };
  listings: { total: number; active: number; sold: number };
  orders: { total: number; byStatus: Record<string, number> };
}

export const adminAPI = {
  login: async (email: string, password: string) => {
    const response = await adminApi.post('/admin/login', { email, password });
    return response.data as {
      message: string;
      token: string;
      admin: { email: string; role: string };
    };
  },
  getMe: async () => {
    const response = await adminApi.get('/admin/me');
    return response.data as { admin: { email: string; role: string } };
  },
  getUsers: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await adminApi.get('/admin/users', { params });
    return response.data as {
      users: AdminUser[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  },
  updateUserStatus: async (userId: string, isActive: boolean) => {
    const response = await adminApi.patch(`/admin/users/${userId}/status`, { isActive });
    return response.data as { message: string; user: AdminUser };
  },
  getSummary: async () => {
    const response = await adminApi.get('/admin/summary');
    return response.data as AdminSummary;
  },
  getOrders: async (params?: { page?: number; limit?: number; status?: string }) => {
    const response = await adminApi.get('/admin/orders', { params });
    return response.data as {
      orders: AdminOrder[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  },
  getTrainingStats: async () => {
    const response = await adminApi.get('/admin/training/stats');
    return response.data;
  },
  getTrainingPerformance: async () => {
    const response = await adminApi.get('/admin/training/performance');
    return response.data;
  },
  retrain: async () => {
    const response = await adminApi.post('/admin/training/retrain');
    return response.data;
  },
  addTrainingData: async (data: { text: string; category: string; language?: string }) => {
    const response = await adminApi.post('/admin/training/add-data', data);
    return response.data;
  },
  testModel: async (queries: string[], language?: string) => {
    const response = await adminApi.post('/admin/training/test', { queries, language });
    return response.data;
  },
};

export default api;
