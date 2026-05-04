'use client'
import { create } from 'zustand'
interface CatalogueStore {
  activeGroupe: string
  activeSous: string
  hasSelected: boolean
  setGroupe: (groupe: string, sous?: string) => void
  setSous: (sous: string) => void
  setHasSelected: (v: boolean) => void
  reset: () => void
}
export const useCatalogue = create<CatalogueStore>()((set) => ({
  activeGroupe: '',
  activeSous: '',
  hasSelected: false,
  setGroupe: (groupe, sous) => set({ activeGroupe: groupe, activeSous: sous || '' }),
  setSous: (sous) => set({ activeSous: sous }),
  setHasSelected: (v) => set({ hasSelected: v }),
  reset: () => set({ activeGroupe: '', activeSous: '', hasSelected: false }),
}))
