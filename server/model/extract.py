#!/usr/bin/env python3
"""
Extract ridge regression baseline model from gifsicle profiling data.

Usage:
    python extract.py <input_csv> [output_json]

Example:
    python extract.py train.csv baseline.json

The output JSON contains frozen coefficients for the baseline predictor.
"""

import argparse
import json
import os
import sys
import logging
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Configure the root logger to output to stdout
logging.basicConfig(
    stream=sys.stdout,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    level=getattr(logging, LOG_LEVEL, logging.INFO),
)

logger = logging.getLogger(__name__)


class BaselineExtractor:
    """
    Extracts a baseline ridge regression model from GIF profiling data.

    The extractor loads training data from a CSV file, preprocesses the features,
    performs cross-validated ridge regression, and returns the fitted model's
    coefficients and preprocessing information as a JSON-serializable dictionary.

    Parameters
    ----------
    train_file : str
        Path to the CSV file containing training data.

    Methods
    -------
    load(train_file)
        Load training data from a CSV file.
    extract()
        Extract the baseline model and return it as a JSON-serializable dictionary.
    """

    target_field = "elapsed_seconds"
    fields = {
        "noop": ["width", "height", "output_size_bytes"],
        "category": ["drop_frames"],
        "boolean": [
            "reduce_colors",
            "optimize_transparency",
            "undo_optimizations",
        ],
        "numeric": [
            "total_pixels",
            "frames",
            "file_size_bytes",
            "target_width",
            "target_height",
            "number_of_colors",
            "compression_level",
        ],
    }

    def __init__(self, train_file):
        """
        Initialize the BaselineExtractor with a path to the training CSV file.

        Parameters
        ----------
        train_file : str
            Path to the CSV file containing training data.
        """
        self.data = None
        self.load(train_file)

    def load(self, train_file):
        """
        Load training data from a CSV file.

        Parameters
        ----------
        train_file : str
            Path to the CSV file containing training data.

        Raises
        ------
        FileNotFoundError
            If the specified CSV file does not exist.
        """
        if not os.path.exists(train_file):
            raise FileNotFoundError(f"The file {train_file} does not exist.")
        df = pd.read_csv(train_file)
        # Filter out failed runs
        df = df[df[self.target_field] > 0]
        # Drop noop fields
        df = df.drop(columns=self.fields["noop"])
        logger.info(f"Loaded {len(df)} successful samples")
        self.data = df

    def extract(self):
        """
        Extract the baseline model from the loaded training data.

        Returns
        -------
        dict
            A JSON-serializable dictionary containing the fitted model's coefficients,
            preprocessing information, and metadata.
        """
        if self.data is None:
            logger.error("Data not loaded. Please call the 'load' method first.")
            raise ValueError("Data not loaded. Please call the 'load' method first.")

        df = self.data.copy()

        # Target: log-transformed elapsed time
        y = np.log1p(df[self.target_field])

        # Convert boolean fields to integers
        for col in self.fields["boolean"]:
            df[col] = df[col].map({"true": 1, "false": 0, True: 1, False: 0}).fillna(0).astype(int)

        # Combine numeric and boolean fields as numeric features
        all_numeric_columns = self.fields["numeric"] + self.fields["boolean"]

        # Build feature matrix
        X = df[all_numeric_columns + self.fields["category"]]

        # Grouping for cross-validation (by filename to prevent leakage)
        groups = df["filename"]

        # Number of unique groups
        n_groups = groups.nunique()

        # Preprocessing pipelines
        preprocessor = ColumnTransformer(
            transformers=[
                ("num", StandardScaler(), all_numeric_columns),
                ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), self.fields["category"]),
            ]
        )

        # Full pipeline
        pipe = Pipeline([("prep", preprocessor), ("model", Ridge(alpha=1.0))])

        # Cross-validate with GroupKFold to prevent leakage between files
        cv = GroupKFold(n_splits=n_groups)
        scores = cross_val_score(pipe, X, y, cv=cv, groups=groups, scoring="neg_mean_absolute_error")
        mae_cv = -scores.mean()
        logger.info(f"Cross-validated MAE (log-space): {mae_cv:.4f}")

        # Fit the pipeline on the entire dataset
        pipe.fit(X, y)
        logger.info("Fitted the baseline model on the entire dataset")

        # Extract components
        ridge = pipe.named_steps["model"]
        prep = pipe.named_steps["prep"]

        # Get feature names after transformation
        num_transformer = prep.named_transformers_["num"]
        cat_transformer = prep.named_transformers_["cat"]

        # Combine numeric and categorical feature names
        num_feature_names = all_numeric_columns
        cat_feature_names = list(cat_transformer.get_feature_names_out(self.fields["category"]))
        feature_names = num_feature_names + cat_feature_names

        # Extract coefficients
        coeffs = dict(zip(feature_names, ridge.coef_))

        # Get scaler parameters for numeric features (needed to apply same scaling at runtime)
        scaler = num_transformer
        scaler_params = {
            "mean": dict(zip(all_numeric_columns, scaler.mean_.tolist())),
            "scale": dict(zip(all_numeric_columns, scaler.scale_.tolist())),
        }

        baseline = {
            "intercept": float(ridge.intercept_),
            "coefficients": {k: float(v) for k, v in coeffs.items()},
            "scaler": scaler_params,
            "metadata": {
                "samples": len(df),
                "mae_cv_log": float(mae_cv),
                "features": feature_names,
            },
        }
        return baseline


def main():
    """
    Main function to extract a baseline model from training data and save it to a JSON file.
    """

    parser = argparse.ArgumentParser(description="Extract baseline model from training data")
    parser.add_argument("train_file", type=str, help="Path to the training CSV file")
    parser.add_argument(
        "--output_file", type=str, default="baseline.json", help="Path to save the extracted baseline model"
    )
    args = parser.parse_args()

    extractor = BaselineExtractor(args.train_file)
    baseline = extractor.extract()
    logger.info(f"Extracted baseline model: {baseline}")

    # Save the baseline model to a JSON file
    with open(args.output_file, "w") as f:
        json.dump(baseline, f, indent=2)
    logger.info(f"Saved baseline model to {args.output_file}")


if __name__ == "__main__":
    main()
