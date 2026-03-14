'use client';

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { User, ChatMessage, Crop, CalendarEvent } from '@/lib/api';

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  authChecked: boolean; // true after we've read localStorage so refresh doesn't flash landing
  selectedLanguage: string;
  crops: Crop[];
  chatMessages: ChatMessage[];
  calendarEvents: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
}

type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_AUTH_CHECKED'; payload: boolean }
  | { type: 'SET_LANGUAGE'; payload: string }
  | { type: 'SET_CROPS'; payload: Crop[] }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_CHAT_MESSAGES'; payload: ChatMessage[] }
  | { type: 'SET_CALENDAR_EVENTS'; payload: CalendarEvent[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' };

const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  authChecked: false,
  selectedLanguage: 'english',
  crops: [],
  chatMessages: [],
  calendarEvents: [],
  isLoading: false,
  error: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    case 'SET_AUTH_CHECKED':
      return { ...state, authChecked: action.payload };
    case 'SET_LANGUAGE':
      return { ...state, selectedLanguage: action.payload };
    case 'SET_CROPS':
      return { ...state, crops: action.payload };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatMessages: [...state.chatMessages, action.payload] };
    case 'SET_CHAT_MESSAGES':
      return { ...state, chatMessages: action.payload };
    case 'SET_CALENDAR_EVENTS':
      return { ...state, calendarEvents: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  setLanguage: (language: string) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearError: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    // Restore auth from localStorage so refresh keeps user on the same page
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('user');
    const savedLanguage = localStorage.getItem('selectedLanguage');

    if (token && user) {
      try {
        const parsedUser = JSON.parse(user);
        dispatch({ type: 'SET_USER', payload: parsedUser });
        dispatch({ type: 'SET_AUTHENTICATED', payload: true });
      } catch {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    }

    if (savedLanguage) {
      dispatch({ type: 'SET_LANGUAGE', payload: savedLanguage });
    }

    dispatch({ type: 'SET_AUTH_CHECKED', payload: true });
  }, []);

  // When 401 is received (e.g. from api interceptor), update state so we stay on current page
  useEffect(() => {
    const handleLogout = () => {
      dispatch({ type: 'SET_USER', payload: null });
      dispatch({ type: 'SET_AUTHENTICATED', payload: false });
      dispatch({ type: 'SET_CHAT_MESSAGES', payload: [] });
      dispatch({ type: 'SET_CALENDAR_EVENTS', payload: [] });
    };
    window.addEventListener('agromitra:auth-logout', handleLogout);
    return () => window.removeEventListener('agromitra:auth-logout', handleLogout);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const { authAPI } = await import('@/lib/api');
      const response = await authAPI.login(email.trim().toLowerCase(), password);
      
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      dispatch({ type: 'SET_USER', payload: response.user });
      dispatch({ type: 'SET_AUTHENTICATED', payload: true });
    } catch (error: any) {
      const validationErrors = error?.response?.data?.errors;
      const message = Array.isArray(validationErrors) && validationErrors.length > 0
        ? validationErrors.map((item: { msg?: string }) => item.msg).filter(Boolean).join('. ')
        : error?.response?.data?.message || 'Login failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw new Error(message);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const register = async (userData: any) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });

      const { authAPI } = await import('@/lib/api');
      const response = await authAPI.register(userData);
      
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      dispatch({ type: 'SET_USER', payload: response.user });
      dispatch({ type: 'SET_AUTHENTICATED', payload: true });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Registration failed' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    dispatch({ type: 'SET_USER', payload: null });
    dispatch({ type: 'SET_AUTHENTICATED', payload: false });
    dispatch({ type: 'SET_CHAT_MESSAGES', payload: [] });
    dispatch({ type: 'SET_CALENDAR_EVENTS', payload: [] });
  };

  const setLanguage = (language: string) => {
    localStorage.setItem('selectedLanguage', language);
    dispatch({ type: 'SET_LANGUAGE', payload: language });
  };

  const addChatMessage = (message: ChatMessage) => {
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: message });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        login,
        register,
        logout,
        setLanguage,
        addChatMessage,
        clearError,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
