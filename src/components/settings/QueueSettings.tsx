import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useQueueConfig, useSetQueueConcurrency } from "@/hooks/useJobs";

export function QueueSettings() {
  const { data: queueConfig, isLoading } = useQueueConfig();
  const { mutate: setConcurrency, isPending } = useSetQueueConcurrency();

  const handleChange = (value: number[]) => {
    setConcurrency(value[0]);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Queue Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Concurrency</Label>
            {isLoading || isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="text-sm font-medium text-primary">
                {queueConfig?.concurrency || 2} parallel jobs
              </span>
            )}
          </div>
          <Slider
            value={[queueConfig?.concurrency || 2]}
            onValueChange={handleChange}
            min={1}
            max={10}
            step={1}
            disabled={isLoading || isPending}
          />
          <p className="text-xs text-muted-foreground">
            Number of GIFs to compress simultaneously (1-10)
          </p>
        </div>

        {queueConfig && (
          <div className="flex gap-4 pt-2 text-sm">
            <div>
              <span className="text-muted-foreground">Active:</span>{" "}
              <span className="font-medium">{queueConfig.active}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pending:</span>{" "}
              <span className="font-medium">{queueConfig.pending}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
