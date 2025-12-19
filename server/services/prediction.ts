/**
 * Two-layer prediction model for gifsicle processing time.
 *
 * Layer 1: Frozen baseline (ridge regression from CSV profiling data)
 *   - Loaded from baseline.json at startup
 *   - Never mutated at runtime
 *   - Provides structural prior based on measured gifsicle behavior
 *
 * Layer 2: Residual learning (EMA per option/value)
 *   - Learns corrections from actual job times
 *   - Adapts to hardware-specific characteristics
 *   - Bounded to prevent runaway corrections
 *
 * Architecture:
 *   prediction = baseline(frozen) + residual_correction(learned)
 *
 * All predictions work in log-space for multiplicative effects.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import * as db from "../db/client.js";
import type { CompressionOptions } from "../types.js";

interface FeatureVector {
  // Numeric features
  total_pixels: number;
  target_pixels: number;
  frames: number;
  file_size_bytes: number;
  target_width: number;
  target_height: number;
  number_of_colors: number;
  compression_level: number;
  // Boolean features (0/1)
  reduce_colors: number;
  optimize_transparency: number;
  undo_optimizations: number;
  // Categorical one-hot: drop_frames
  drop_frames_none: number;
  drop_frames_n2: number;
  drop_frames_n3: number;
  drop_frames_n4: number;
}

interface GifInfo {
  width: number;
  height: number;
  frames: number;
  size: number;
}

interface BaselineModel {
  intercept: number;
  coefficients: Record<string, number>;
  scaler: {
    mean: Record<string, number>;
    scale: Record<string, number>;
  };
  metadata: {
    samples: number;
    mae_cv_log: number;
    features: string[];
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const BASELINE_PATH = path.join(__dirname, "../model/baseline.json");

// Residual learning parameters
const EMA_ALPHA = 0.3; // Smoothing factor for exponential moving average
const MAX_RESIDUAL_CORRECTION = 0.5; // Cap at ~65% multiplicative correction
const MIN_SAMPLES_FOR_CORRECTION = 3; // Minimum samples before applying correction

class PredictionService {
  private model: BaselineModel | null = null;

  constructor() {
    this.model = this.loadBaselineModel();
  }

  private loadBaselineModel(): BaselineModel | null {
    try {
      if (fs.existsSync(BASELINE_PATH)) {
        const data = fs.readFileSync(BASELINE_PATH, "utf-8");
        return JSON.parse(data) as BaselineModel;
      }
      console.warn(
        "[Prediction] No baseline.json found, predictions will use fallback",
      );
    } catch (err) {
      console.error("[Prediction] Failed to load baseline:", err);
    }
    return null;
  }

  /**
   * Extract feature vector from job info and options.
   * Must match the features used in extract.py exactly.
   */
  private extractFeatures(
    info: GifInfo,
    options: CompressionOptions,
  ): FeatureVector {
    // Compute target dimensions
    let targetWidth = info.width;
    let targetHeight = info.height;

    if (options.resize_enabled) {
      if (options.target_width && options.target_height) {
        const scaleX = options.target_width / info.width;
        const scaleY = options.target_height / info.height;
        const scale = Math.min(scaleX, scaleY, 1);
        targetWidth = Math.round(info.width * scale);
        targetHeight = Math.round(info.height * scale);
      } else if (options.target_width && options.target_width < info.width) {
        const scale = options.target_width / info.width;
        targetWidth = options.target_width;
        targetHeight = Math.round(info.height * scale);
      } else if (options.target_height && options.target_height < info.height) {
        const scale = options.target_height / info.height;
        targetHeight = options.target_height;
        targetWidth = Math.round(info.width * scale);
      }
    }

    return {
      // Numeric features
      total_pixels: info.frames * info.width * info.height,
      target_pixels: info.frames * targetWidth * targetHeight,
      frames: info.frames,
      file_size_bytes: info.size,
      target_width: targetWidth,
      target_height: targetHeight,
      number_of_colors: options.reduce_colors ? options.number_of_colors : 256,
      compression_level: options.compression_level,

      // Boolean features (0/1)
      reduce_colors: options.reduce_colors ? 1 : 0,
      optimize_transparency: options.optimize_transparency ? 1 : 0,
      undo_optimizations: options.undo_optimizations ? 1 : 0,

      // Categorical one-hot: drop_frames
      drop_frames_none: options.drop_frames === "none" ? 1 : 0,
      drop_frames_n2: options.drop_frames === "n2" ? 1 : 0,
      drop_frames_n3: options.drop_frames === "n3" ? 1 : 0,
      drop_frames_n4: options.drop_frames === "n4" ? 1 : 0,
    };
  }

  /**
   * Apply baseline prediction using frozen ridge coefficients.
   * Works in log-space: returns log(seconds).
   */
  private baselinePredict(features: FeatureVector): number {
    if (!this.model) {
      // Fallback: simple heuristic if no baseline loaded
      const pixels = features.total_pixels || 1;
      return Math.log1p(pixels * 1e-7 + 0.5); // Very rough estimate
    }

    const { intercept, coefficients, scaler } = this.model;

    let logSeconds = intercept;

    for (const [name, value] of Object.entries(features)) {
      const weight = coefficients[name];
      if (weight !== undefined) {
        // Scale numeric features (categorical one-hots don't need scaling)
        let scaledValue = value;
        if (
          scaler.mean[name] !== undefined &&
          scaler.scale[name] !== undefined
        ) {
          if (scaler.scale[name] === 0) continue; // Avoid division by zero
          scaledValue = (value - scaler.mean[name]) / scaler.scale[name];
        }
        logSeconds += weight * scaledValue;
      }
    }

    return logSeconds;
  }

  /**
   * Get feature keys for residual learning.
   * Returns keys like "optimize_transparency=1", "drop_frames=n2", etc.
   */
  private getResidualKeys(
    features: FeatureVector,
    options: CompressionOptions,
  ): string[] {
    const keys: string[] = [];
    const tp = features.target_pixels ?? features.total_pixels ?? 0;
    let sizeGroup: string;

    // Determine size group based on target pixels
    if (tp < 200_000) sizeGroup = "xs";
    else if (tp < 1_000_000) sizeGroup = "s";
    else if (tp < 4_000_000) sizeGroup = "m";
    else sizeGroup = "l";

    // Group by size
    keys.push(`size_group=${sizeGroup}`);

    // Boolean options
    keys.push(`optimize_transparency=${options.optimize_transparency ? 1 : 0}`);
    keys.push(`reduce_colors=${options.reduce_colors ? 1 : 0}`);
    keys.push(`undo_optimizations=${options.undo_optimizations ? 1 : 0}`);

    // Categorical options
    keys.push(`drop_frames=${options.drop_frames}`);

    // Bucketed numeric options (to avoid sparse residuals)
    const compLevel = options.compression_level;
    if (compLevel === 0) {
      keys.push("compression_bucket=none");
    } else if (compLevel <= 50) {
      keys.push("compression_bucket=low");
    } else if (compLevel <= 100) {
      keys.push("compression_bucket=medium");
    } else {
      keys.push("compression_bucket=high");
    }

    return keys;
  }

  /**
   * Compute residual correction from learned EMAs.
   * Returns correction in log-space, bounded by MAX_RESIDUAL_CORRECTION.
   */
  private applyResidualCorrection(
    features: FeatureVector,
    options: CompressionOptions,
  ): number {
    const keys = this.getResidualKeys(features, options);
    let totalCorrection = 0;
    let activeCount = 0;

    for (const key of keys) {
      const entry = db.getResidual(key);
      if (entry && entry.count >= MIN_SAMPLES_FOR_CORRECTION) {
        totalCorrection += entry.ema;
        activeCount++;
      }
    }

    // Average the corrections if multiple apply
    if (activeCount > 0) {
      totalCorrection /= activeCount;
    }

    // Clamp to prevent runaway corrections
    return Math.max(
      -MAX_RESIDUAL_CORRECTION,
      Math.min(MAX_RESIDUAL_CORRECTION, totalCorrection),
    );
  }

  /**
   * Predict processing time in milliseconds.
   */
  predict(info: GifInfo, options: CompressionOptions): number {
    const features = this.extractFeatures(info, options);

    // Layer 1: Baseline prediction (log-space)
    const logBaseline = this.baselinePredict(features);

    // Layer 2: Residual correction (log-space)
    const correction = this.applyResidualCorrection(features, options);

    // Combined prediction
    const logPrediction = logBaseline + correction;

    // Convert from log-space to milliseconds
    const seconds = Math.expm1(logPrediction);
    const ms = seconds * 1000;

    return Math.max(100, ms); // At least 100ms
  }

  /**
   * Record a completed job and update residual corrections.
   */
  recordSample(
    jobId: string,
    info: GifInfo,
    options: CompressionOptions,
    actualTimeMs: number,
  ): void {
    const features = this.extractFeatures(info, options);
    const logBaseline = this.baselinePredict(features);
    const actualLogSeconds = Math.log1p(actualTimeMs / 1000);

    // Residual = actual - baseline (in log-space)
    const residual = actualLogSeconds - logBaseline;

    // Store training sample in SQLite
    db.insertPredictionSample({
      jobId,
      frames: info.frames,
      width: info.width,
      height: info.height,
      fileSize: info.size,
      totalPixels: features.total_pixels,
      targetWidth: features.target_width,
      targetHeight: features.target_height,
      compressionLevel: options.compression_level,
      dropFrames: options.drop_frames,
      reduceColors: options.reduce_colors,
      numberOfColors: options.number_of_colors,
      optimizeTransparency: options.optimize_transparency,
      undoOptimizations: options.undo_optimizations,
      elapsedMs: actualTimeMs,
    });

    // Update EMA for each relevant feature key
    const keys = this.getResidualKeys(features, options);
    for (const key of keys) {
      const existing = db.getResidual(key);
      let newEma: number;
      let newCount: number;

      // Decay existing EMA and incorporate new residual
      if (!existing || existing.count === 0) {
        newEma = residual;
        newCount = 1;
      } else {
        newEma = EMA_ALPHA * residual + (1 - EMA_ALPHA) * existing.ema;
        newCount = existing.count + 1;
      }

      db.upsertResidual(key, newEma, newCount);
    }

    // Compute what we would have predicted
    const correction = this.applyResidualCorrection(features, options);
    const predictedMs = Math.expm1(logBaseline + correction) * 1000;
    const sampleCount = db.getPredictionSampleCount();

    console.log(
      `[Prediction] Recorded sample #${sampleCount}: ` +
        `actual=${actualTimeMs.toFixed(0)}ms, predicted=${predictedMs.toFixed(0)}ms, ` +
        `residual=${residual.toFixed(3)} (log-space)`,
    );
  }

  /**
   * Check if baseline model is loaded.
   */
  hasBaseline(): boolean {
    return this.model !== null;
  }

  /**
   * Get model statistics.
   */
  getStats(): {
    hasBaseline: boolean;
    baselineSamples: number;
    residualSamples: number;
    activeCorrections: number;
  } {
    const stats = db.getResidualStats();
    const residuals = db.getAllResiduals();

    return {
      hasBaseline: this.model !== null,
      baselineSamples: this.model?.metadata.samples || 0,
      residualSamples: stats.totalSamples,
      activeCorrections: residuals.filter(
        (e) => e.count >= MIN_SAMPLES_FOR_CORRECTION,
      ).length,
    };
  }
}

// Singleton instance
export const predictionService = new PredictionService();
