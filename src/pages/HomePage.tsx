import { Loader2, Play } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { GlobalSettings } from "@/components/settings/GlobalSettings";
import { QueueSettings } from "@/components/settings/QueueSettings";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/upload/DropZone";
import { FileList } from "@/components/upload/FileList";
import { useUploadMutation } from "@/hooks/useJobs";
import { useSettingsStore } from "@/store/settingsStore";
import { useUploadStore } from "@/store/uploadStore";

export function HomePage() {
  const navigate = useNavigate();
  const { files, clearFiles, isUploading, setUploading } = useUploadStore();
  const { globalOptions } = useSettingsStore();
  const uploadMutation = useUploadMutation();
  const [error, setError] = useState<string | null>(null);

  const handleCompress = async () => {
    if (files.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      // Build per-file options map
      const perFileOptions: Record<string, typeof globalOptions> = {};
      files.forEach((f) => {
        if (f.options) {
          perFileOptions[f.file.name] = f.options;
        }
      });

      await uploadMutation.mutateAsync({
        files: files.map((f) => f.file),
        globalOptions,
        perFileOptions:
          Object.keys(perFileOptions).length > 0 ? perFileOptions : undefined,
      });

      clearFiles();
      setUploading(false);
      navigate("/history");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">GIF Compressor</h1>
          <p className="text-muted-foreground">
            Compress your GIF files locally with full control over quality and
            size
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column - Upload area */}
          <div className="lg:col-span-2 space-y-4">
            <DropZone />
            <FileList />

            {error && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}

            {files.length > 0 && (
              <Button
                size="lg"
                className="w-full"
                onClick={handleCompress}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Compress {files.length} file{files.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Right column - Settings */}
          <div className="space-y-4">
            <GlobalSettings />
            <QueueSettings />
          </div>
        </div>
      </div>
    </div>
  );
}
