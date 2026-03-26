import { create } from 'zustand';
import type { ConversationStatus, Channel } from '../types';

interface ChatState {
  // UI State
  activeConversationId: number | null;
  sidebarOpen: boolean;
  contactPanelOpen: boolean;

  // Filters
  statusFilter: ConversationStatus | 'all';
  channelFilter: Channel | 'all';
  searchQuery: string;

  // Actions
  setActiveConversation: (id: number | null) => void;
  toggleSidebar: () => void;
  toggleContactPanel: () => void;
  setStatusFilter: (status: ConversationStatus | 'all') => void;
  setChannelFilter: (channel: Channel | 'all') => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  sidebarOpen: true,
  contactPanelOpen: false,

  statusFilter: 'all',
  channelFilter: 'all',
  searchQuery: '',

  setActiveConversation: (id) =>
    set({ activeConversationId: id, contactPanelOpen: false }),

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  toggleContactPanel: () =>
    set((state) => ({ contactPanelOpen: !state.contactPanelOpen })),

  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setChannelFilter: (channelFilter) => set({ channelFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  resetFilters: () =>
    set({ statusFilter: 'all', channelFilter: 'all', searchQuery: '' }),
}));