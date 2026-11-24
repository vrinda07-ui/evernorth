
import pandas as pd
from pathlib import Path

FEATURE_FILE = Path("dataset/features/component_features.csv")
LABEL_FILE = Path("dataset/labels/component_labels.csv")
OUTPUT_FILE = Path("dataset/features/training_dataset.csv")

ID_COLS = ["dashboard_id", "candidate_id"]

# Preserve the original 20-feature XGBoost schema.
FEATURE_COLS = [
    "width", "height", "area", "aspect_ratio", "child_count",
    "text_count", "numeric_text_count", "text_density",
    "numeric_density", "vector_count", "line_count",
    "ellipse_count", "rectangle_count", "graphical_count",
    "has_percentage", "has_date_text", "has_chart_word",
    "has_table_word", "has_kpi_word", "has_filter_word",
]

VALID_LABELS = {
    "KPI_CARD", "CHART", "TABLE", "FILTER",
    "OTHER", "HEADER", "NAVBAR", "SIDEBAR"
}

# Load source datasets.
features = pd.read_csv(FEATURE_FILE, dtype=str).fillna("")
labels = pd.read_csv(LABEL_FILE, dtype=str).fillna("")

# Validate required columns.
required_feature_cols = ID_COLS + FEATURE_COLS
required_label_cols = ID_COLS + ["label"]

if not set(required_feature_cols).issubset(features.columns):
    raise ValueError("Feature dataset is missing required columns.")

if not set(required_label_cols).issubset(labels.columns):
    raise ValueError("Label dataset is missing required columns.")

# Normalize identifiers and labels.
for col in ID_COLS:
    features[col] = features[col].str.strip()
    labels[col] = labels[col].str.strip()

labels["label"] = labels["label"].str.strip().str.upper()

# Validate uniqueness before merging.
if features.duplicated(ID_COLS).any():
    raise ValueError("Duplicate feature IDs detected.")

if labels.duplicated(ID_COLS).any():
    raise ValueError("Duplicate label IDs detected.")

# Keep only recognized, non-empty labels.
valid_labels = labels[labels["label"].isin(VALID_LABELS)].copy()

# Identify stale labels for reporting.
feature_ids = set(map(tuple, features[ID_COLS].values))
label_ids = set(map(tuple, valid_labels[ID_COLS].values))

stale_labels = valid_labels[
    ~valid_labels.set_index(ID_COLS).index.isin(feature_ids)
]

# Merge only matching feature and label records.
df = features.merge(
    valid_labels[ID_COLS + ["label"]],
    on=ID_COLS,
    how="inner",
    validate="one_to_one"
)

# Convert original model features to numeric.
for col in FEATURE_COLS:
    df[col] = pd.to_numeric(df[col], errors="coerce")

missing_values = df[FEATURE_COLS].isna().sum().sum()

if missing_values:
    print("Missing feature values:", missing_values)
    df = df.dropna(subset=FEATURE_COLS).copy()

training_df = df[ID_COLS + FEATURE_COLS + ["label"]].copy()

if training_df.duplicated(ID_COLS).any():
    raise ValueError("Duplicate IDs found in training dataset.")

# Save the validated training dataset.
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
training_df.to_csv(OUTPUT_FILE, index=False)

print("\n========== DATASET PREPARATION COMPLETE ==========")
print("Feature rows:", len(features))
print("Label rows:", len(labels))
print("Stale valid labels excluded:", len(stale_labels))
print("Training rows:", len(training_df))
print("Training features:", len(FEATURE_COLS))

print("\nClass distribution:")
print(training_df["label"].value_counts().to_string())

print("\nUnlabeled candidates excluded:", len(features) - len(training_df))
print("Duplicate training IDs:", training_df.duplicated(ID_COLS).sum())
print("Output:", OUTPUT_FILE)
