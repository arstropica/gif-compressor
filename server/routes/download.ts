import archiver from "archiver";
import { Router } from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";

import * as db from "../db/client.js";

const router = Router();

// Download single compressed file
router.get("/:id", (req: Request, res: Response) => {
  try {
    const job = db.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.status !== "completed") {
      return res.status(400).json({ error: "Job not completed yet" });
    }

    if (!job.compressed_path || !fs.existsSync(job.compressed_path)) {
      return res.status(404).json({ error: "Compressed file not found" });
    }

    // Generate download filename
    const ext = path.extname(job.original_filename);
    const basename = path.basename(job.original_filename, ext);
    const downloadFilename = `${basename}-compressed${ext}`;

    res.setHeader("Content-Type", "image/gif");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${downloadFilename}"`,
    );
    res.setHeader("Content-Length", job.compressed_size || 0);

    const stream = fs.createReadStream(job.compressed_path);
    stream.pipe(res);
  } catch (err) {
    console.error("[Download] Error:", err);
    res.status(500).json({ error: "Download failed" });
  }
});

// Download original file (for preview/comparison)
router.get("/:id/original", (req: Request, res: Response) => {
  try {
    const job = db.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (!job.original_path || !fs.existsSync(job.original_path)) {
      return res.status(404).json({ error: "Original file not found" });
    }

    res.setHeader("Content-Type", "image/gif");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${job.original_filename}"`,
    );
    res.setHeader("Content-Length", job.original_size);

    const stream = fs.createReadStream(job.original_path);
    stream.pipe(res);
  } catch (err) {
    console.error("[Download] Original error:", err);
    res.status(500).json({ error: "Download failed" });
  }
});

// Download multiple files as zip
router.get("/zip/archive", async (req: Request, res: Response) => {
  try {
    const idsParam = req.query.ids as string;

    if (!idsParam) {
      return res.status(400).json({ error: "No job IDs provided" });
    }

    const ids = idsParam.split(",").map((id) => id.trim());

    if (ids.length === 0) {
      return res.status(400).json({ error: "No job IDs provided" });
    }

    // Validate all jobs exist and are completed
    const jobs = ids.map((id) => db.getJob(id)).filter(Boolean);

    if (jobs.length === 0) {
      return res.status(404).json({ error: "No valid jobs found" });
    }

    const completedJobs = jobs.filter(
      (job) =>
        job &&
        job.status === "completed" &&
        job.compressed_path &&
        fs.existsSync(job.compressed_path),
    );

    if (completedJobs.length === 0) {
      return res
        .status(400)
        .json({ error: "No completed jobs with files found" });
    }

    // Set up response headers
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `compressed-gifs-${timestamp}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Create archive
    const archive = archiver("zip", { zlib: { level: 5 } });

    archive.on("error", (err) => {
      console.error("[Download] Archive error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Archive creation failed" });
      }
    });

    archive.pipe(res);

    // Add files to archive
    const usedNames = new Set<string>();

    for (const job of completedJobs) {
      if (!job || !job.compressed_path) continue;

      // Generate unique filename in archive
      const ext = path.extname(job.original_filename);
      const basename = path.basename(job.original_filename, ext);
      let archiveName = `${basename}-compressed${ext}`;

      // Handle duplicates
      let counter = 1;
      while (usedNames.has(archiveName)) {
        archiveName = `${basename}-compressed-${counter}${ext}`;
        counter++;
      }
      usedNames.add(archiveName);

      archive.file(job.compressed_path, { name: archiveName });
    }

    await archive.finalize();
  } catch (err) {
    console.error("[Download] Zip error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Zip download failed" });
    }
  }
});

export default router;
