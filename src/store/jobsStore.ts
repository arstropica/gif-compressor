import { create } from "zustand";

import type { JobStatus } from "@/api/types";

interface JobsState {
  statusFilter: JobStatus | "all";
  filenameFilter: string;
  selectedJobIds: Set<string>;

  setStatusFilter: (status: JobStatus | "all") => void;
  setFilenameFilter: (filename: string) => void;
  toggleJobSelected: (id: string) => void;
  selectAllJobs: (ids: string[]) => void;
  deselectAllJobs: () => void;
  clearFilters: () => void;
}

export const useJobsStore = create<JobsState>((set) => ({
  statusFilter: "all",
  filenameFilter: "",
  selectedJobIds: new Set(),

  setStatusFilter: (status) => set({ statusFilter: status }),

  setFilenameFilter: (filename) => set({ filenameFilter: filename }),

  toggleJobSelected: (id) =>
    set((state) => {
      const newSelected = new Set(state.selectedJobIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return { selectedJobIds: newSelected };
    }),

  selectAllJobs: (ids) => set({ selectedJobIds: new Set(ids) }),

  deselectAllJobs: () => set({ selectedJobIds: new Set() }),

  clearFilters: () =>
    set({
      statusFilter: "all",
      filenameFilter: "",
    }),
}));
