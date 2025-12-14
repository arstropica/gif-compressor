import { Settings, Trash2, X } from "lucide-react";
import { useState } from "react";

import { PerImageSettings } from "@/components/settings/PerImageSettings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";
import { useUploadStore, type PendingFile } from "@/store/uploadStore";

function FileItem({ file }: { file: PendingFile }) {
  const { removeFile } = useUploadStore();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <img
          src={file.preview}
          alt={file.file.name}
          className="w-12 h-12 object-cover rounded"
        />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(file.file.size)}
            {file.options && (
              <span className="ml-2 text-primary">Custom settings</span>
            )}
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowSettings(true)}
          title="Custom settings for this file"
        >
          <Settings className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => removeFile(file.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <PerImageSettings
        file={file}
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </>
  );
}

export function FileList() {
  const { files, clearFiles } = useUploadStore();

  if (files.length === 0) {
    return null;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">
          {files.length} file{files.length !== 1 ? "s" : ""} ready
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFiles}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Clear all
        </Button>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {files.map((file) => (
          <FileItem key={file.id} file={file} />
        ))}
      </div>
    </Card>
  );
}
