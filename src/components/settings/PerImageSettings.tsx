import { useState, useEffect } from "react";

import type { CompressionOptions } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatBytes } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";
import { useUploadStore, type PendingFile } from "@/store/uploadStore";

interface PerImageSettingsProps {
  file: PendingFile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PerImageSettings({
  file,
  open,
  onOpenChange,
}: PerImageSettingsProps) {
  const { setFileOptions } = useUploadStore();
  const { globalOptions } = useSettingsStore();

  // Local state for editing
  const [options, setOptions] = useState<CompressionOptions>(
    file.options || globalOptions,
  );
  const [useCustom, setUseCustom] = useState(!!file.options);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setOptions(file.options || globalOptions);
      setUseCustom(!!file.options);
    }
  }, [open, file.options, globalOptions]);

  const handleSave = () => {
    if (useCustom) {
      setFileOptions(file.id, options);
    } else {
      setFileOptions(file.id, null);
    }
    onOpenChange(false);
  };

  const updateOption = <K extends keyof CompressionOptions>(
    key: K,
    value: CompressionOptions[K],
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings for {file.file.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {formatBytes(file.file.size)}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Use Custom Settings Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <Label>Use custom settings for this file</Label>
            <Switch checked={useCustom} onCheckedChange={setUseCustom} />
          </div>

          {useCustom && (
            <div className="space-y-4">
              {/* Compression Level */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Compression Level</Label>
                  <span className="text-sm font-medium text-primary">
                    {options.compression_level}
                  </span>
                </div>
                <Slider
                  value={[options.compression_level]}
                  onValueChange={([v]) => updateOption("compression_level", v)}
                  min={1}
                  max={200}
                  step={1}
                />
              </div>

              {/* Frame Dropping */}
              <div className="space-y-2">
                <Label className="text-sm">Drop Frames</Label>
                <Select
                  value={options.drop_frames}
                  onValueChange={(v) =>
                    updateOption(
                      "drop_frames",
                      v as CompressionOptions["drop_frames"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="n2">Every 2nd</SelectItem>
                    <SelectItem value="n3">Every 3rd</SelectItem>
                    <SelectItem value="n4">Every 4th</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Color Reduction */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Reduce Colors</Label>
                  <Switch
                    checked={options.reduce_colors}
                    onCheckedChange={(v) => updateOption("reduce_colors", v)}
                  />
                </div>
                {options.reduce_colors && (
                  <div className="pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs">Colors</span>
                      <span className="text-xs font-medium">
                        {options.number_of_colors}
                      </span>
                    </div>
                    <Slider
                      value={[options.number_of_colors]}
                      onValueChange={([v]) =>
                        updateOption("number_of_colors", v)
                      }
                      min={2}
                      max={256}
                      step={1}
                    />
                  </div>
                )}
              </div>

              {/* Resize */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Resize</Label>
                  <Switch
                    checked={options.resize_enabled}
                    onCheckedChange={(v) => updateOption("resize_enabled", v)}
                  />
                </div>
                {options.resize_enabled && (
                  <div className="grid grid-cols-2 gap-2 pl-4">
                    <Input
                      type="number"
                      placeholder="Width"
                      value={options.target_width || ""}
                      onChange={(e) =>
                        updateOption(
                          "target_width",
                          e.target.value ? parseInt(e.target.value, 10) : null,
                        )
                      }
                    />
                    <Input
                      type="number"
                      placeholder="Height"
                      value={options.target_height || ""}
                      onChange={(e) =>
                        updateOption(
                          "target_height",
                          e.target.value ? parseInt(e.target.value, 10) : null,
                        )
                      }
                    />
                  </div>
                )}
              </div>

              {/* Other options */}
              <div className="flex items-center justify-between">
                <Label className="text-sm">Optimize Transparency</Label>
                <Switch
                  checked={options.optimize_transparency}
                  onCheckedChange={(v) =>
                    updateOption("optimize_transparency", v)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Undo Prior Optimizations</Label>
                <Switch
                  checked={options.undo_optimizations}
                  onCheckedChange={(v) => updateOption("undo_optimizations", v)}
                />
              </div>
            </div>
          )}

          {!useCustom && (
            <p className="text-sm text-muted-foreground text-center py-4">
              This file will use the global compression settings.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
