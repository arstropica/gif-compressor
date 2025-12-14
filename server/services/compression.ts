import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

import type { CompressionOptions, CompressResult } from "../types.js";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "./output";

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

interface GifInfo {
  width: number;
  height: number;
  frames: number;
}

export function getGifInfo(filePath: string): GifInfo {
  try {
    // Use gifsicle --info to get dimensions
    const output = execSync(`gifsicle --info "${filePath}" 2>&1`, {
      encoding: "utf-8",
    });

    // Parse output like: "  logical screen 640x480"
    const screenMatch = output.match(/logical screen (\d+)x(\d+)/);
    const framesMatch = output.match(/(\d+) images?/);

    return {
      width: screenMatch ? parseInt(screenMatch[1], 10) : 0,
      height: screenMatch ? parseInt(screenMatch[2], 10) : 0,
      frames: framesMatch ? parseInt(framesMatch[1], 10) : 1,
    };
  } catch {
    return { width: 0, height: 0, frames: 1 };
  }
}

function calculateBestFit(
  originalWidth: number,
  originalHeight: number,
  targetWidth: number,
  targetHeight: number,
): { width: number; height: number } {
  const scaleX = targetWidth / originalWidth;
  const scaleY = targetHeight / originalHeight;
  const scale = Math.min(scaleX, scaleY, 1); // Never upscale

  return {
    width: Math.round(originalWidth * scale),
    height: Math.round(originalHeight * scale),
  };
}

export async function compressGif(
  inputPath: string,
  options: CompressionOptions,
  onProgress?: (progress: number) => void,
): Promise<CompressResult> {
  const outputPath = path.join(OUTPUT_DIR, `${uuidv4()}.gif`);

  // Get original dimensions for resize calculation
  const originalInfo = getGifInfo(inputPath);

  // Build gifsicle arguments
  const args: string[] = [];

  // Lossy compression (main compression method)
  args.push(`--lossy=${options.compression_level}`);

  // Optimization level 3 (most aggressive)
  args.push("-O3");

  // Undo prior optimizations first if requested
  if (options.undo_optimizations) {
    args.push("--unoptimize");
  }

  // Frame dropping
  if (options.drop_frames !== "none") {
    // Delete frames based on pattern
    // n2 = keep every 2nd frame (delete odd frames)
    // n3 = keep every 3rd frame
    // n4 = keep every 4th frame
    const n = parseInt(options.drop_frames.slice(1), 10);
    // Generate frame deletion pattern - delete all frames except every nth
    const info = getGifInfo(inputPath);
    const framesToDelete: string[] = [];
    for (let i = 0; i < info.frames; i++) {
      if ((i + 1) % n !== 0) {
        framesToDelete.push(`#${i}`);
      }
    }
    if (framesToDelete.length > 0 && framesToDelete.length < info.frames) {
      args.push("--delete", framesToDelete.join(" "));
    }
  }

  // Color reduction
  if (options.reduce_colors && options.number_of_colors < 256) {
    args.push(`--colors=${options.number_of_colors}`);
  }

  // Resize if enabled
  let targetWidth = originalInfo.width;
  let targetHeight = originalInfo.height;

  if (options.resize_enabled) {
    const hasWidth = options.target_width && options.target_width > 0;
    const hasHeight = options.target_height && options.target_height > 0;

    if (hasWidth && hasHeight) {
      // Both dimensions provided - use best-fit logic
      const bestFit = calculateBestFit(
        originalInfo.width,
        originalInfo.height,
        options.target_width!,
        options.target_height!,
      );

      // Only resize if dimensions actually change
      if (
        bestFit.width < originalInfo.width ||
        bestFit.height < originalInfo.height
      ) {
        args.push(`--resize-fit=${bestFit.width}x${bestFit.height}`);
        targetWidth = bestFit.width;
        targetHeight = bestFit.height;
      }
    } else if (hasWidth && options.target_width! < originalInfo.width) {
      // Only width provided - scale to fit width (no upscaling)
      args.push(`--resize-width=${options.target_width}`);
      const scale = options.target_width! / originalInfo.width;
      targetWidth = options.target_width!;
      targetHeight = Math.round(originalInfo.height * scale);
    } else if (hasHeight && options.target_height! < originalInfo.height) {
      // Only height provided - scale to fit height (no upscaling)
      args.push(`--resize-height=${options.target_height}`);
      const scale = options.target_height! / originalInfo.height;
      targetHeight = options.target_height!;
      targetWidth = Math.round(originalInfo.width * scale);
    }
  }

  // Input and output
  args.push("-o", outputPath, inputPath);

  // Report initial progress
  onProgress?.(10);

  return new Promise((resolve, reject) => {
    const proc = spawn("gifsicle", args, { shell: true });

    let stderr = "";
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Simulate progress since gifsicle doesn't provide it
    let progressInterval: NodeJS.Timeout | null = null;
    let currentProgress = 10;

    progressInterval = setInterval(() => {
      if (currentProgress < 90) {
        currentProgress += 10;
        onProgress?.(currentProgress);
      }
    }, 200);

    proc.on("close", (code) => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      if (code !== 0) {
        reject(new Error(`gifsicle failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const stats = fs.statSync(outputPath);
        const outputInfo = getGifInfo(outputPath);

        resolve({
          path: outputPath,
          size: stats.size,
          width: outputInfo.width || targetWidth,
          height: outputInfo.height || targetHeight,
        });
      } catch (err) {
        reject(new Error(`Failed to read output file: ${err}`));
      }
    });

    proc.on("error", (err) => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      reject(err);
    });
  });
}
