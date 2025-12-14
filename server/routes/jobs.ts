import { Router } from "express";
import type { Request, Response } from "express";

import * as db from "../db/client.js";
import { cleanupJobFiles } from "../services/cleanup.js";
import { compressionQueue } from "../services/queue.js";
import type { JobFilters } from "../types.js";

const router = Router();

// List jobs with filters
router.get("/", (req: Request, res: Response) => {
  try {
    const filters: JobFilters = {
      status: req.query.status as JobFilters["status"],
      filename: req.query.filename as string,
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const { jobs, total } = db.listJobs(filters);

    res.json({
      jobs,
      total,
      limit: filters.limit,
      offset: filters.offset,
    });
  } catch (err) {
    console.error("[Jobs] List error:", err);
    res.status(500).json({ error: "Failed to list jobs" });
  }
});

// Get job counts by status
router.get("/counts", (_req: Request, res: Response) => {
  try {
    const counts = db.getJobCounts();
    res.json(counts);
  } catch (err) {
    console.error("[Jobs] Counts error:", err);
    res.status(500).json({ error: "Failed to get job counts" });
  }
});

// Get single job
router.get("/:id", (req: Request, res: Response) => {
  try {
    const job = db.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json(job);
  } catch (err) {
    console.error("[Jobs] Get error:", err);
    res.status(500).json({ error: "Failed to get job" });
  }
});

// Delete job
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const job = db.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Clean up files
    cleanupJobFiles(req.params.id);

    // Delete from database
    const deleted = db.deleteJob(req.params.id);

    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: "Failed to delete job" });
    }
  } catch (err) {
    console.error("[Jobs] Delete error:", err);
    res.status(500).json({ error: "Failed to delete job" });
  }
});

// Retry failed job
router.post("/:id/retry", async (req: Request, res: Response) => {
  try {
    const job = db.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.status !== "failed") {
      return res.status(400).json({ error: "Only failed jobs can be retried" });
    }

    // Reset job status
    db.updateJob(req.params.id, {
      status: "queued",
      progress: 0,
      error_message: null,
      started_at: null,
      completed_at: null,
      compressed_path: null,
      compressed_size: null,
      reduction_percent: null,
    });

    // Re-add to queue
    await compressionQueue.add(req.params.id);

    const updatedJob = db.getJob(req.params.id);
    res.json(updatedJob);
  } catch (err) {
    console.error("[Jobs] Retry error:", err);
    res.status(500).json({ error: "Failed to retry job" });
  }
});

export default router;
