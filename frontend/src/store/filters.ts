import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ConversationFilters } from '@/types/conversations'

interface FiltersStore extends ConversationFilters {
  setQuery: (query: string) => void
  setFrom: (from: string) => void
  setTo: (to: string) => void
  setPage: (page: number) => void
  setIsClient: (isClient: boolean | undefined) => void
  setNeedsReply: (needsReply: boolean | undefined) => void
  reset: () => void
}

const initialState: ConversationFilters = {
  query: '',
  from: '',
  to: '',
  page: 1,
  isClient: undefined,
  needsReply: undefined
}

export const useFiltersStore = create<FiltersStore>()(
  persist(
    (set) => ({
      ...initialState,
      
      setQuery: (query: string) => set({ query, page: 1 }),
      setFrom: (from: string) => set({ from, page: 1 }),
      setTo: (to: string) => set({ to, page: 1 }),
      setPage: (page: number) => set({ page }),
      setIsClient: (isClient: boolean | undefined) => set({ isClient, page: 1 }),
      setNeedsReply: (needsReply: boolean | undefined) => set({ needsReply, page: 1 }),
      
      reset: () => set(initialState)
    }),
    {
      name: 'conversation-filters',
      partialize: (state) => ({
        query: state.query,
        from: state.from,
        to: state.to,
        isClient: state.isClient,
        needsReply: state.needsReply
        // No persistir page para que siempre empiece en 1
      })
    }
  )
)
