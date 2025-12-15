import { ArrowRight, Loader2, Settings, Trash2, X } from "lucide-react";
import { useState } from "react";

import { PerImageSettings } from "@/components/settings/PerImageSettings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";
import { useUploadStore, type PendingFile } from "@/store/uploadStore";

interface FileListProps {
  onCompress?: () => void;
  isCompressing?: boolean;
}

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

export function FileList({ onCompress, isCompressing }: FileListProps) {
  const { files, clearFiles } = useUploadStore();

  if (files.length === 0) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <h3 className="font-medium">
          {files.length} file{files.length !== 1 ? "s" : ""} ready
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clearFiles()}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Clear all
        </Button>
      </div>

      {/* File list */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto px-4">
        {files.map((file) => (
          <FileItem key={file.id} file={file} />
        ))}
      </div>

      {/* Footer with compress button */}
      {onCompress && (
        <div className="flex items-center justify-between p-4 mt-3 border-t bg-muted/30">
          <span className="text-sm text-muted-foreground">
            Added {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
          <Button
            onClick={onCompress}
            disabled={isCompressing}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
          >
            {isCompressing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                Compress GIF
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}
