import { Router } from "express";
import type { Request, Response } from "express";
import type { UploadedFile } from "express-fileupload";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

import * as db from "../db/client.js";
import { getGifInfo } from "../services/compression.js";
import { compressionQueue } from "../services/queue.js";
import type { CompressionOptions } from "../types.js";

const router = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "104857600", 10);

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const DEFAULT_OPTIONS: CompressionOptions = {
  compression_level: 75,
  drop_frames: "none",
  reduce_colors: false,
  number_of_colors: 256,
  optimize_transparency: true,
  undo_optimizations: false,
  resize_enabled: false,
  target_width: null,
  target_height: null,
};

router.post("/", async (req: Request, res: Response) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // Parse options from request body
    let globalOptions: CompressionOptions = DEFAULT_OPTIONS;
    if (req.body.options) {
      try {
        globalOptions = { ...DEFAULT_OPTIONS, ...JSON.parse(req.body.options) };
      } catch {
        console.warn("[Upload] Invalid options JSON, using defaults");
      }
    }

    // Parse per-file options if provided
    let perFileOptions: Record<string, CompressionOptions> = {};
    if (req.body.perFileOptions) {
      try {
        perFileOptions = JSON.parse(req.body.perFileOptions);
      } catch {
        console.warn("[Upload] Invalid perFileOptions JSON");
      }
    }

    // Handle single or multiple files
    const files = Array.isArray(req.files.files)
      ? req.files.files
      : [req.files.files as UploadedFile];

    const createdJobs: Array<{ id: string; filename: string }> = [];
    const errors: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      // Validate file type
      if (file.mimetype !== "image/gif") {
        errors.push({ filename: file.name, error: "Not a GIF file" });
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push({
          filename: file.name,
          error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        });
        continue;
      }

      const jobId = uuidv4();
      const ext = path.extname(file.name);
      const uploadPath = path.join(UPLOAD_DIR, `${jobId}${ext}`);

      try {
        // Move file to upload directory
        await file.mv(uploadPath);

        // Get GIF dimensions
        const info = getGifInfo(uploadPath);

        // Use per-file options if provided, otherwise use global options
        const options = perFileOptions[file.name] || globalOptions;

        // Create job in database
        const job = db.createJob(
          jobId,
          file.name,
          file.size,
          uploadPath,
          options,
          info.width,
          info.height,
        );

        // Add to compression queue
        await compressionQueue.add(jobId);

        createdJobs.push({ id: job.id, filename: file.name });
        console.log(`[Upload] Created job ${jobId} for ${file.name}`);
      } catch (err) {
        console.error(`[Upload] Failed to process ${file.name}:`, err);
        errors.push({
          filename: file.name,
          error: err instanceof Error ? err.message : "Upload failed",
        });

        // Clean up uploaded file on error
        if (fs.existsSync(uploadPath)) {
          fs.unlinkSync(uploadPath);
        }
      }
    }

    if (createdJobs.length === 0 && errors.length > 0) {
      return res
        .status(400)
        .json({ error: "All uploads failed", details: errors });
    }

    res.status(201).json({
      jobs: createdJobs,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("[Upload] Error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
