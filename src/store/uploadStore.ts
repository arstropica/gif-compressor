import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";

import type { CompressionOptions } from "@/api/types";

export interface PendingFile {
  id: string;
  file: File;
  preview: string;
  options: CompressionOptions | null; // null = use global defaults
}

interface UploadState {
  files: PendingFile[];
  isUploading: boolean;
  selectedIds: Set<string>;

  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  clearFiles: (revokeUrls?: boolean) => void;
  setFileOptions: (id: string, options: CompressionOptions | null) => void;
  getFileOptions: (id: string) => CompressionOptions | null;
  setUploading: (value: boolean) => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
}

export const useUploadStore = create<UploadState>((set, get) => ({
  files: [],
  isUploading: false,
  selectedIds: new Set(),

  addFiles: (files) =>
    set((state) => ({
      files: [
        ...state.files,
        ...files
          .filter((f) => f.type === "image/gif")
          .map((file) => ({
            id: uuidv4(),
            file,
            preview: URL.createObjectURL(file),
            options: null,
          })),
      ],
    })),

  removeFile: (id) =>
    set((state) => {
      const file = state.files.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      const newSelectedIds = new Set(state.selectedIds);
      newSelectedIds.delete(id);
      return {
        files: state.files.filter((f) => f.id !== id),
        selectedIds: newSelectedIds,
      };
    }),

  clearFiles: (revokeUrls = true) =>
    set((state) => {
      if (revokeUrls) {
        state.files.forEach((f) => URL.revokeObjectURL(f.preview));
      }
      return { files: [], selectedIds: new Set() };
    }),

  setFileOptions: (id, options) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, options } : f)),
    })),

  getFileOptions: (id) => {
    const file = get().files.find((f) => f.id === id);
    return file?.options ?? null;
  },

  setUploading: (isUploading) => set({ isUploading }),

  toggleSelected: (id) =>
    set((state) => {
      const newSelectedIds = new Set(state.selectedIds);
      if (newSelectedIds.has(id)) {
        newSelectedIds.delete(id);
      } else {
        newSelectedIds.add(id);
      }
      return { selectedIds: newSelectedIds };
    }),

  selectAll: () =>
    set((state) => ({
      selectedIds: new Set(state.files.map((f) => f.id)),
    })),

  deselectAll: () => set({ selectedIds: new Set() }),
}));
