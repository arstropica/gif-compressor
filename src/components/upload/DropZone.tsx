import { Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useUploadStore } from "@/store/uploadStore";

export function DropZone() {
  const { addFiles } = useUploadStore();
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === "image/gif",
      );

      if (files.length > 0) {
        addFiles(files);
      }
    },
    [addFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        addFiles(files);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [addFiles],
  );

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer",
        "hover:border-primary/50 hover:bg-primary/5",
        isDragging
          ? "border-primary bg-primary/10 scale-[1.02]"
          : "border-muted-foreground/25",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/gif"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      <Upload
        className={cn(
          "mx-auto h-12 w-12 transition-colors",
          isDragging ? "text-primary" : "text-muted-foreground",
        )}
      />

      <p className="mt-4 text-lg font-medium">
        {isDragging ? "Drop GIF files here" : "Drag & drop GIF files here"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>

      <p className="mt-4 text-xs text-muted-foreground">
        Supports multiple files up to 100MB each
      </p>
    </div>
  );
}
