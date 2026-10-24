# Figma Dashboard Generation Pipeline

An intelligent dashboard generation system that processes Figma design data, extracts dashboard components, classifies them using machine learning, and generates structured dashboard layouts and visualizations.

## Overview

This project automates the conversion of Figma dashboard designs into structured, data-driven dashboard representations. It combines Python-based data processing, machine learning classification, and a React frontend for viewing generated layouts and dashboard previews.

## Key Features

- **Figma Data Processing:** Processes exported Figma design data in JSON format.
- **Candidate Generation:** Identifies potential dashboard components such as KPI cards, charts, tables, filters, headers, and navigation elements.
- **Feature Extraction:** Extracts geometric, textual, numerical, and graphical features from candidate components.
- **Machine Learning Classification:** Uses trained classification models to identify dashboard component types.
- **Dashboard Layout Generation:** Generates structured grid layouts from detected components.
- **Vista Page Generation:** Converts classified components into a structured dashboard page representation.
- **Interactive Frontend:** Provides dashboard previews, layout visualization, JSON inspection, and history views.
- **Backend API:** Connects the frontend with the Python processing pipeline.

## Technology Stack

### Frontend
- React
- TypeScript
- Vite

### Backend
- Python
- Flask or the configured Python web framework in `server.py`
- JSON-based data processing

### Machine Learning
- XGBoost
- Scikit-learn
- Joblib
- Pandas

### Data and Outputs
- Figma JSON exports
- CSV feature datasets
- JSON candidate files
- Generated dashboard layouts and page configurations

## Project Structure

```text
figma_proj/
├── dataset/
│   ├── candidates/             # Generated dashboard candidates
│   ├── features/               # Feature datasets for training and analysis
│   ├── new_candidates/         # Candidate predictions and cleaned results
│   └── new_dashboard/          # Exported Figma design data
├── frontend/
│   ├── src/
│   │   ├── components/         # Dashboard and layout UI components
│   │   ├── services/           # Backend API integration
│   │   ├── App.tsx             # Main frontend application
│   │   └── types.ts            # TypeScript definitions
│   └── package.json
├── models/                     # Main classification model artifacts
├── outputs/
│   ├── dashboard_configs/      # Generated grid layouts
│   └── vista_pages/            # Generated dashboard page JSON
├── src/
│   ├── features/               # Feature extraction
│   ├── model/                  # Training and prediction scripts
│   ├── output/                 # Layout and page generation
│   ├── preprocessing/           # Candidate generation
│   └── pipeline.py             # Main generation pipeline
├── server.py                   # Backend API server
└── README.md
```

## Pipeline Workflow

1. **Input:** Load exported Figma design data.
2. **Preprocessing:** Parse the design hierarchy and generate candidate components.
3. **Feature Extraction:** Compute layout, text, numeric, and graphical features.
4. **Classification:** Predict component labels using trained machine learning models.
5. **Layout Generation:** Organize detected components into a structured grid.
6. **Page Generation:** Produce the final dashboard page configuration.
7. **Visualization:** Display the generated dashboard through the React frontend.

```text
Figma JSON
    ↓
Candidate Generation
    ↓
Feature Extraction
    ↓
ML Classification
    ↓
Grid Layout Generation
    ↓
Vista Page Generation
    ↓
Dashboard Preview
```

## Getting Started

### Prerequisites

Install the following before running the project:

- Python 3.10 or a compatible version
- Node.js and npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/vrinda07-ui/figma_proj.git
cd figma_proj
```

### 2. Set Up the Python Environment

On Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install the project's Python dependencies using its dependency file, if provided:

```powershell
pip install -r requirements.txt
```

If `requirements.txt` is not present, install the dependencies specified by the project's imports and setup instructions.

### 3. Install Frontend Dependencies

```powershell
cd frontend
npm install
cd ..
```

### 4. Start the Backend

From the project root, run:

```powershell
python server.py
```

The API address and port depend on the configuration in `server.py`.

### 5. Start the Frontend

In a separate terminal:

```powershell
cd frontend
npm run dev
```

Open the local URL printed by Vite in the terminal.

## Machine Learning Workflow

The project includes scripts for training and using component classification models.

Typical workflow:

1. Prepare and label component feature data.
2. Extract features from dashboard candidates.
3. Train the required classification model.
4. Save the trained model artifacts.
5. Load the model during candidate prediction and dashboard generation.

Relevant scripts include:

- `src/features/extract_features.py`
- `src/model/train_component_model.py`
- `src/model/train_xgboost.py`
- `src/model/predict.py`

Use the scripts' configured arguments and paths when training or generating predictions.

## Output Files

Generated outputs are stored in the `outputs/` directory.

- `outputs/dashboard_configs/` — grid-based layout configurations.
- `outputs/vista_pages/` — generated dashboard page representations.

Candidate extraction and prediction artifacts are stored under `dataset/candidates/` and `dataset/new_candidates/`.

## Development Notes

- Exported Figma data should follow the structure expected by the preprocessing pipeline.
- Candidate counts should match the number of records in each candidate JSON file.
- Model files must be compatible with the prediction code.
- Generated dashboard JSON should be validated before use.
- Keep temporary logs, backups, virtual environments, and local secrets out of version control.

## Future Improvements

- Improve candidate detection and classification accuracy.
- Enhance chart and KPI data extraction.
- Improve layout reconstruction and component positioning.
- Add automated tests for candidate generation and page output validation.
- Expand support for additional dashboard component types.
