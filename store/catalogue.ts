'use client'
import { create } from 'zustand'
interface CatalogueStore {
  activeGroupe: string
  activeSous: string
  hasSelected: boolean
  setGroupe: (groupe: string, sous?: string) => void
  setSous: (sous: string) => void
  setHasSelected: (v: boolean) => void
}
export const useCatalogue = create<CatalogueStore>()((set) => ({
  activeGroupe: 'boissons',
  activeSous: 'chaudes',
  hasSelected: false,
  setGroupe: (groupe, sous) => set({ activeGroupe: groupe, activeSous: sous || '' }),
  setSous: (sous) => set({ activeSous: sous }),
  setHasSelected: (v) => set({ hasSelected: v }),
}))
