'use client'
import { create } from 'zustand'
type MenuGroupe = { id: string; label: string; sous: { id: string; label: string }[] }

interface CatalogueStore {
  activeGroupe: string
  activeSous: string
  hasSelected: boolean
  menuGroupes: MenuGroupe[]
  setGroupe: (groupe: string, sous?: string) => void
  setSous: (sous: string) => void
  setHasSelected: (v: boolean) => void
  setMenuGroupes: (groupes: MenuGroupe[]) => void
  reset: () => void
}
export const useCatalogue = create<CatalogueStore>()((set) => ({
  activeGroupe: '',
  activeSous: '',
  hasSelected: false,
  menuGroupes: [],
  setGroupe: (groupe, sous) => set({ activeGroupe: groupe, activeSous: sous || '' }),
  setSous: (sous) => set({ activeSous: sous }),
  setHasSelected: (v) => set({ hasSelected: v }),
  setMenuGroupes: (groupes) => set({ menuGroupes: groupes }),
  reset: () => set({ activeGroupe: '', activeSous: '', hasSelected: false }),
}))
