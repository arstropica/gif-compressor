import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useSettingsStore } from "@/store/settingsStore";

export function GlobalSettings() {
  const { globalOptions, setGlobalOptions, resetToDefaults } =
    useSettingsStore();

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Compression Settings</CardTitle>
          <Button variant="ghost" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Compression Level */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Compression Level</Label>
            <span className="text-sm font-medium text-primary">
              {globalOptions.compression_level}
            </span>
          </div>
          <Slider
            value={[globalOptions.compression_level]}
            onValueChange={([v]) => setGlobalOptions({ compression_level: v })}
            min={1}
            max={200}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            Higher values = smaller files, lower quality. Default: 75
          </p>
        </div>

        {/* Frame Dropping */}
        <div className="space-y-2">
          <Label>Drop Frames</Label>
          <Select
            value={globalOptions.drop_frames}
            onValueChange={(v) =>
              setGlobalOptions({
                drop_frames: v as typeof globalOptions.drop_frames,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (keep all frames)</SelectItem>
              <SelectItem value="n2">Keep every 2nd frame</SelectItem>
              <SelectItem value="n3">Keep every 3rd frame</SelectItem>
              <SelectItem value="n4">Keep every 4th frame</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Reduces animation smoothness but decreases file size
          </p>
        </div>

        {/* Color Reduction */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Reduce Colors</Label>
            <Switch
              checked={globalOptions.reduce_colors}
              onCheckedChange={(v) => setGlobalOptions({ reduce_colors: v })}
            />
          </div>

          {globalOptions.reduce_colors && (
            <div className="pl-4 space-y-3 border-l-2 border-primary/20">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Number of Colors</Label>
                <span className="text-sm font-medium text-primary">
                  {globalOptions.number_of_colors}
                </span>
              </div>
              <Slider
                value={[globalOptions.number_of_colors]}
                onValueChange={([v]) =>
                  setGlobalOptions({ number_of_colors: v })
                }
                min={2}
                max={256}
                step={1}
              />
            </div>
          )}
        </div>

        {/* Resize */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Resize</Label>
            <Switch
              checked={globalOptions.resize_enabled}
              onCheckedChange={(v) => setGlobalOptions({ resize_enabled: v })}
            />
          </div>

          {globalOptions.resize_enabled && (
            <div className="pl-4 space-y-3 border-l-2 border-primary/20">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Max Width</Label>
                  <Input
                    type="number"
                    placeholder="Width"
                    value={globalOptions.target_width || ""}
                    onChange={(e) =>
                      setGlobalOptions({
                        target_width: e.target.value
                          ? parseInt(e.target.value, 10)
                          : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Max Height</Label>
                  <Input
                    type="number"
                    placeholder="Height"
                    value={globalOptions.target_height || ""}
                    onChange={(e) =>
                      setGlobalOptions({
                        target_height: e.target.value
                          ? parseInt(e.target.value, 10)
                          : null,
                      })
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Specify one or both dimensions. Image will be scaled to fit
                (best-fit, no upscaling)
              </p>
            </div>
          )}
        </div>

        {/* Optimize Transparency */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Optimize Transparency</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Replace duplicate pixels with transparency
            </p>
          </div>
          <Switch
            checked={globalOptions.optimize_transparency}
            onCheckedChange={(v) =>
              setGlobalOptions({ optimize_transparency: v })
            }
          />
        </div>

        {/* Undo Optimizations */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Undo Prior Optimizations</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reset any existing optimizations first
            </p>
          </div>
          <Switch
            checked={globalOptions.undo_optimizations}
            onCheckedChange={(v) => setGlobalOptions({ undo_optimizations: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
