import { create } from "zustand";

interface DareStoreState {
  acceptedDareIds: Set<number>;
  markAccepted: (dareId: number) => void;
  setAcceptedIds: (ids: number[]) => void;
}

export const useDareStore = create<DareStoreState>((set) => ({
  acceptedDareIds: new Set(),

  markAccepted: (dareId) =>
    set((s) => ({ acceptedDareIds: new Set([...s.acceptedDareIds, dareId]) })),

  setAcceptedIds: (ids) =>
    set({ acceptedDareIds: new Set(ids) }),
}));
