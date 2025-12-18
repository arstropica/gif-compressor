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
  size: number;
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
    const fileSize = getFilesizeInBytes(filePath);

    return {
      width: screenMatch ? parseInt(screenMatch[1], 10) : 0,
      height: screenMatch ? parseInt(screenMatch[2], 10) : 0,
      frames: framesMatch ? parseInt(framesMatch[1], 10) : 1,
      size: fileSize,
    };
  } catch {
    return { width: 0, height: 0, frames: 1, size: 0 };
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

  // Frame dropping - use frame selection (input file + frame selectors)
  // Must add input file BEFORE frame selectors
  let frameSelectors: string[] = [];
  if (options.drop_frames !== "none") {
    // n2 = keep every 2nd frame, n3 = keep every 3rd frame, etc.
    const n = parseInt(options.drop_frames.slice(1), 10);
    // Keep frames where index % n == (n-1): n2 keeps 1,3,5..., n3 keeps 2,5,8...
    for (let i = n - 1; i < originalInfo.frames; i += n) {
      frameSelectors.push(`#${i}`);
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

  // Input file (must come before frame selectors)
  args.push(inputPath);

  // Frame selectors (must come after input file)
  if (frameSelectors.length > 0) {
    args.push(...frameSelectors);
  }

  // Output
  args.push("-o", outputPath);

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

    const { interval, increment } = estimateProgress(originalInfo, options);
    progressInterval = setInterval(() => {
      if (currentProgress < 99) {
        currentProgress = Math.min(99, currentProgress + increment);
        onProgress?.(Math.round(currentProgress));
      }
    }, interval);

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

function getFilesizeInBytes(filePath: string): number {
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats.size;
  return fileSizeInBytes;
}

// TODO: Tune these parameters based on real-world testing
export function estimateProgress(
  info: GifInfo,
  options: CompressionOptions,
): { interval: number; increment: number } {
  const frames = info.frames;

  // --- 1. Compute final dimensions (same logic as your pipeline) ---
  let width = info.width;
  let height = info.height;

  if (options.resize_enabled) {
    if (options.target_width && options.target_width < width) {
      const scale = options.target_width / width;
      width = options.target_width;
      height = Math.round(height * scale);
    } else if (options.target_height && options.target_height < height) {
      const scale = options.target_height / height;
      height = options.target_height;
      width = Math.round(width * scale);
    }
  }

  // --- 2. Base pixel work ---
  const pixelWork = frames * width * height;

  // --- 3. Lossy amplifies per-frame cost strongly ---
  const lossyFramePenalty =
    1 + Math.pow(options.compression_level / 100, 1.2) * 3.0;

  // --- 4. Additional per-frame overhead ---
  let frameOverhead = 3_000_000 * frames * lossyFramePenalty;

  if (options.optimize_transparency) {
    frameOverhead *= 1.15;
  }

  if (options.undo_optimizations) {
    frameOverhead *= 1.25;
  }

  if (options.reduce_colors && options.number_of_colors < 256) {
    frameOverhead *= 1 + ((256 - options.number_of_colors) / 256) * 0.5;
  }

  // --- 5. Total effective work ---
  const effectiveWork = pixelWork + frameOverhead;

  // --- 6. Map work → interval (inverse, smooth, unbounded) ---
  const BASE_WORK = 12_000_000; // ~1 second baseline
  const MIN_INTERVAL = 30; // don't spam the UI
  const MIN_INCREMENT = 0.15;
  const MAX_INCREMENT = 5.0;
  const SCALE = 15; // ms per log2 step

  const interval = Math.round(
    Math.max(
      MIN_INTERVAL + SCALE * Math.log2(effectiveWork / BASE_WORK + 1),
      MIN_INTERVAL,
    ),
  );

  const increment = Math.max(
    MIN_INCREMENT,
    Math.min(MAX_INCREMENT, BASE_WORK / effectiveWork),
  );

  return { interval, increment };
}
