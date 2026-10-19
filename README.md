# OpsPilot AI — Predictive Business Operations Intelligence & Decision Engine

> **Predict problems. Explain risks. Optimise decisions. Measure impact.**

OpsPilot AI is an AI-powered business operations intelligence platform designed to help organisations identify operational bottlenecks, predict potential delays, prioritise critical tasks, and recommend feasible actions based on urgency, workload, and business impact.

Instead of simply displaying business analytics, OpsPilot AI combines machine learning, explainable predictions, and decision optimisation to help operations managers make better-informed decisions.

**Project type:** AI/ML + Full-Stack Development + Decision Optimisation  
**Status:** In development  
**Team size:** 3 members

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Our Solution](#2-our-solution)
3. [Key Features](#3-key-features)
4. [Dataset](#4-dataset)
5. [System Architecture](#5-system-architecture)
6. [Technology Stack](#6-technology-stack)
7. [Machine Learning Approach](#7-machine-learning-approach)
8. [Decision Optimisation Engine](#8-decision-optimisation-engine)
9. [Application Workflow](#9-application-workflow)
10. [Project Structure](#10-project-structure)
11. [Installation and Setup](#11-installation-and-setup)
12. [Environment Configuration](#12-environment-configuration)
13. [API Design](#13-api-design)
14. [Evaluation and Performance Metrics](#14-evaluation-and-performance-metrics)
15. [Team Responsibilities](#15-team-responsibilities)
16. [Development Roadmap](#16-development-roadmap)
17. [Deployment](#17-deployment)
18. [Limitations and Future Scope](#18-limitations-and-future-scope)
19. [Responsible AI and Data Integrity](#19-responsible-ai-and-data-integrity)
20. [Dataset Attribution](#20-dataset-attribution)

---

## 1. Problem Statement

Modern businesses generate large amounts of operational data through customer support requests, task management systems, internal workflows, and service operations.

However, identifying recurring problems, predicting delays, balancing workloads, and choosing the best operational action can require significant manual effort.

Traditional dashboards primarily show what has already happened. Basic predictive systems may identify potential problems but often fail to explain what action should be taken next.

This creates several challenges:

- Operational bottlenecks remain undetected until they affect performance.
- Important tasks may not receive attention at the right time.
- Workloads can become unevenly distributed.
- Managers lack evidence-backed recommendations for prioritising work.
- Proposed process improvements are difficult to evaluate against existing practices.

### Our objective

Build an intelligent decision-support system that transforms operational data into actionable recommendations.

OpsPilot AI aims to answer five questions:

1. What is going wrong?
2. Which tasks are likely to experience delays?
3. Why are these tasks at risk?
4. What action should be taken, considering operational constraints?
5. Does the proposed action perform better than the existing approach?

---

## 2. Our Solution

OpsPilot AI combines four major capabilities into one platform.

### 2.1 Operational Intelligence

Analyse historical operational records to identify recurring delays, workload imbalances, and process bottlenecks.

### 2.2 Predictive Intelligence

Use machine learning to estimate the risk of delayed ticket resolution and, if supported by the dataset, predict resolution time.

### 2.3 Decision Optimisation

Use an optimisation engine to recommend task priorities and feasible assignments based on risk, urgency, available capacity, and skill requirements.

### 2.4 Explainability and Impact Evaluation

Explain the factors behind predictions and compare the proposed decision policy against a baseline using consistent evaluation conditions.

**Core idea:**

`Analyse → Predict → Explain → Optimise → Evaluate`

The initial implementation focuses on customer support operations using help-desk ticket data. The architecture can later be extended to inventory management, workforce planning, and supply-chain operations.

---

## 3. Key Features

### Operational Dashboard

- Total open and resolved tickets.
- High-risk ticket overview.
- Resolution-time and workload analytics.
- Operational trend visualisations.
- Filters for priority, category, status, and assignee where the dataset supports them.

### Ticket Risk Prediction

- Estimate the likelihood of a ticket exceeding a defined resolution-time target.
- Identify high-risk tasks for early intervention.
- Compare a simple baseline model with more advanced algorithms.

### Bottleneck Analysis

- Analyse recurring delays across categories and workflow stages.
- Identify patterns associated with longer resolution times.
- Highlight potential workload imbalances.

### Explainable Predictions

- Display the predicted risk and important contributing factors.
- Use feature-based reason codes or SHAP explanations where appropriate.
- Clearly distinguish model estimates from verified facts.

### Decision Optimisation

- Prioritise tasks using urgency, predicted risk, and business impact.
- Respect assignment eligibility, skills, and capacity constraints when those inputs are available.
- Generate a proposed operational plan.
- Flag infeasible assignments rather than silently violating constraints.

### Baseline vs Proposed Plan

- Compare the existing prioritisation policy with the proposed policy.
- Evaluate weighted overdue work, workload balance, and constraint violations.
- Show the assumptions and limitations of any simulation.

### Human-in-the-Loop Decisions

- Allow managers to review proposed recommendations.
- Record approval or rejection in the application.
- Preserve a history of proposed actions and decisions.

> Actual ticket reassignment requires integration with an authorised ticketing system. Until that integration exists, the prototype will demonstrate recommendations and simulated outcomes.

---

## 4. Dataset

### Primary Dataset: Help Desk Tickets

**Source:** Mendeley Data

**Dataset link:** https://data.mendeley.com/datasets/btm76zndnt/3

The dataset release describes help-desk records and related workflow information. The downloadable files and their exact schemas must be inspected before finalising the prediction targets.

### Why this dataset?

It is a suitable starting point for investigating operational delays because help-desk workflows can involve ticket priorities, timestamps, assignment changes, and resolution outcomes.

These records may support:

- Resolution-time analysis.
- Historical bottleneck identification.
- Ticket risk modelling.
- Workflow and assignment analysis.
- Decision-policy simulation.

### Dataset preparation

The data pipeline will:

1. Download and inspect the dataset documentation.
2. Identify the available files, columns, data types, and missing values.
3. Understand how ticket creation, updates, assignment, and resolution are represented.
4. Remove duplicates and handle missing or inconsistent values.
5. Construct a prediction target only when the available data supports a defensible definition.
6. Create training, validation, and test sets using a time-aware split where appropriate.
7. Preserve the original data and document all transformations.

### Important dataset limitations

The source dataset must not be assumed to contain every field required by the complete system.

In particular, we must verify whether it provides:

- A defensible SLA deadline or resolution-time threshold.
- Reliable creation and resolution timestamps.
- Historical status and assignment information.
- Sufficient features available at prediction time.
- Employee capacity and skill information.

If workforce capacity or skill information is unavailable, we will create a separate, explicitly labelled configuration for simulation. Simulated data will not be represented as real historical information.

### Target definition

The primary prediction target will be finalised after inspecting the dataset.

A possible target is:

`delayed = 1 if actual_resolution_time > defined_resolution_time_threshold, otherwise 0`

This definition is appropriate only if the required timestamps and threshold can be established reliably. If actual SLA deadlines are available, SLA breach prediction may be preferable.

The prediction target, threshold, exclusions, and assumptions will be documented before training.

### Data leakage prevention

Features that become available only after a ticket is resolved must not be used to predict its earlier risk.

For example, final resolution time, final status, and future assignment changes must be excluded from a prediction made at ticket creation unless the prediction time is explicitly defined otherwise.

---

## 5. System Architecture

The application follows a modular architecture separating the user interface, API layer, intelligence engine, decision engine, and database.

```mermaid
flowchart TD
    U[Operations Manager] --> FE[React + TypeScript Dashboard]
    FE -->|HTTPS / REST API| API[FastAPI Backend]

    DATA[Help Desk Dataset / CSV Upload] --> ING[Data Ingestion and Validation]
    ING --> DB[(PostgreSQL)]
    ING --> ML[ML Training Pipeline]

    API --> DB
    API --> PRED[Prediction Service]
    API --> OPT[Decision Optimisation Engine]

    ML --> PRED
    PRED --> EX[Risk Scores and Explanations]
    EX --> OPT

    OPT --> SIM[Baseline Comparison and Simulation]
    SIM --> DB
    DB --> API
    API --> FE
```

### Component responsibilities

**Frontend**

Displays operational metrics, ticket risk, explanations, recommendations, and evaluation results.

**Backend API**

Validates requests, retrieves records, calls prediction and optimisation modules, and returns structured responses.

**ML pipeline**

Prepares data, trains models, evaluates predictions, and saves model artefacts.

**Prediction service**

Loads the selected trained model and produces predictions for valid input records.

**Decision engine**

Uses risk scores and operational constraints to recommend a feasible prioritisation or assignment plan.

**Evaluation engine**

Runs comparable baseline and proposed policies against the same scenario and calculates performance metrics.

**Database**

Stores application records, prediction results, recommendation history, approvals, and evaluation summaries.

---

## 6. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React | Interactive user interface |
| Language | TypeScript | Type safety in frontend development |
| Styling | Tailwind CSS | Responsive dashboard design |
| Visualisation | Recharts | Charts and performance comparisons |
| Backend | Python + FastAPI | REST APIs and service orchestration |
| Data processing | Pandas, NumPy | Cleaning, transformations, and analysis |
| ML baselines | Scikit-learn | Preprocessing, classification, regression, and metrics |
| Advanced ML | XGBoost or LightGBM | Risk prediction and optional regression |
| Explainability | SHAP or reason codes | Explanation of model predictions |
| Optimisation | Google OR-Tools | Constraint-aware decision optimisation |
| Database | PostgreSQL | Persistent application data |
| Database access | SQLAlchemy | Database models and queries |
| API validation | Pydantic | Request and response validation |
| Testing | Pytest | Backend, ML, and optimisation tests |
| API testing | Postman | Endpoint verification |
| Version control | Git + GitHub | Collaboration and code review |
| Containerisation | Docker | Reproducible deployment |
| Frontend hosting | Vercel | Frontend delivery |
| Backend hosting | Python-compatible application host | FastAPI and ML inference |

The exact dependency versions will be pinned in the project configuration after the initial environment is tested.

---

## 7. Machine Learning Approach

We will begin with one reliable prediction task and add a second model only if the data supports it.

### Model 1: Ticket Resolution Risk Prediction

**Goal:** Estimate whether a ticket is likely to exceed a defined resolution-time target.

Candidate algorithms:

- Logistic Regression — interpretable baseline.
- Random Forest — nonlinear comparison model.
- XGBoost or LightGBM — advanced candidate model.

The final model will be selected using validation performance, calibration, reliability, and operational usefulness rather than model complexity alone.

**Expected output:**

```json
{
  "ticket_id": "example-ticket-id",
  "risk_probability": 0.82,
  "risk_category": "high",
  "explanation": [
    "Deadline approaching",
    "High historical workload for the relevant category"
  ]
}
```

This is an illustrative response format, not a measured prediction from the dataset. The explanation must be generated from actual model inputs and supported evidence.

### Model 2: Resolution-Time Prediction (Optional)

**Goal:** Estimate the time required to resolve a ticket.

Candidate approaches:

- Historical median resolution time as a baseline.
- Random Forest Regressor.
- XGBoost Regressor.

This model will be added only if the dataset has sufficient reliable resolution-time labels and useful features available at prediction time.

### Model training workflow

1. Inspect and validate the data.
2. Define the prediction target.
3. Establish a simple baseline.
4. Create leakage-safe features.
5. Train candidate models.
6. Tune using training and validation data.
7. Evaluate on an untouched test set.
8. Save the selected model and preprocessing pipeline.
9. Integrate inference with FastAPI.
10. Monitor prediction quality and data drift where suitable.

### Evaluation metrics

For risk classification:

- Precision.
- Recall.
- F1-score.
- PR-AUC.
- ROC-AUC as a supplementary metric.
- Brier score or other probability-calibration measures.

For resolution-time regression:

- Mean Absolute Error (MAE).
- Root Mean Squared Error (RMSE).

The final report will include baseline and selected-model results, class distribution, the test methodology, and limitations. No performance score will be claimed before the corresponding experiment has been run.

---

## 8. Decision Optimisation Engine

The decision engine turns predictions into proposed actions.

A prediction model tells us which tickets are risky. The optimiser determines which available action best satisfies the chosen operational objective.

### Inputs

- Ticket priority and urgency.
- Predicted risk.
- Estimated business impact.
- Required skills, if available.
- Employee availability and capacity, if available.
- Assignment eligibility and operational rules.

### Objective

Minimise the expected operational cost of the proposed plan, including overdue work and priority-weighted risk, while respecting the defined constraints.

A simplified objective can be represented as:

```text
Minimise:
    Total weighted operational risk
    + Estimated delay cost
    + Workload imbalance penalty

Subject to:
    Assignment eligibility
    Capacity constraints
    Required skill constraints
    Valid task allocation rules
```

The actual mathematical objective and constraints will be documented in the implementation.

### Optimisation approach

1. Implement a transparent baseline prioritisation policy.
2. Implement a feasible heuristic for task allocation.
3. Add Google OR-Tools when the required variables and constraints are defined.
4. Generate a proposed plan.
5. Validate every assignment against hard constraints.
6. Compare the baseline and proposed plans under the same scenario.

If the data does not provide reliable assignment-dependent outcomes, the prototype will clearly label its estimated benefits as simulation results rather than proof of real-world improvement.

---

## 9. Application Workflow

The typical user journey is:

1. **Open dashboard:** Review current operational status and KPIs.
2. **Load data:** Use the prepared dataset or upload a supported CSV.
3. **Analyse operations:** Explore ticket categories, delays, and workload patterns.
4. **Predict risk:** Run the trained model on eligible records.
5. **Review explanations:** Inspect the factors contributing to high-risk predictions.
6. **Generate a plan:** Request a prioritisation or assignment recommendation.
7. **Validate constraints:** Ensure the proposed plan respects the defined rules.
8. **Compare policies:** Evaluate baseline and proposed plans on the same scenario.
9. **Review and approve:** Record the manager's decision.
10. **Inspect history:** View saved predictions, recommendations, and evaluation results.

---

## 10. Project Structure

The following is the proposed repository structure. Files can be added as implementation progresses.

```text
opspilot-ai/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── main.py
│   ├── schemas.py
│   ├── dependencies.py
│   ├── routers/
│   │   ├── health.py
│   │   ├── tickets.py
│   │   ├── predictions.py
│   │   ├── recommendations.py
│   │   └── evaluations.py
│   ├── services/
│   ├── models/
│   └── database/
│
├── ml/
│   ├── data_preprocessing.py
│   ├── feature_engineering.py
│   ├── train.py
│   ├── predict.py
│   ├── evaluate.py
│   └── artifacts/
│
├── optimizer/
│   ├── baseline.py
│   ├── constraints.py
│   ├── allocate.py
│   ├── simulator.py
│   └── evaluate.py
│
├── data/
│   ├── raw/
│   ├── processed/
│   └── README.md
│
├── tests/
│   ├── test_api.py
│   ├── test_predictions.py
│   ├── test_optimizer.py
│   └── test_data_validation.py
│
├── .env.example
├── .gitignore
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── README.md
```

**Data policy:** Raw datasets, secrets, `.env` files, and unnecessary generated artefacts should not be committed to GitHub. Document the download instructions and required local paths instead.

---

## 11. Installation and Setup

### Prerequisites

Install:

- Python 3.11 or another version compatible with the pinned dependencies.
- Node.js and npm.
- Git.
- PostgreSQL, or Docker if using a containerised local database.

### Step 1: Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd opspilot-ai
```

Replace the placeholder with the actual repository URL.

### Step 2: Create the Python environment

```bash
python -m venv .venv
```

Activate it on Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

On macOS or Linux:

```bash
source .venv/bin/activate
```

### Step 3: Install backend dependencies

After `requirements.txt` has been created:

```bash
pip install -r requirements.txt
```

Core dependencies are expected to include:

```text
fastapi
uvicorn[standard]
pandas
numpy
scikit-learn
xgboost
ortools
sqlalchemy
psycopg[binary]
pydantic-settings
joblib
pytest
```

Add `shap`, database migration tools, and other dependencies only when needed. Pin tested versions before final deployment.

### Step 4: Install frontend dependencies

```bash
cd frontend
npm install
```

### Step 5: Configure environment variables

Create a local `.env` file using `.env.example` as a template. Do not commit actual secrets.

### Step 6: Run the backend

From the project root, with the Python environment active:

```bash
uvicorn backend.main:app --reload
```

This command assumes the backend package and imports follow the proposed repository structure. Adjust the import path if the actual implementation differs.

API documentation should be available at:

```text
http://127.0.0.1:8000/docs
```

### Step 7: Run the frontend

In a separate terminal:

```bash
cd frontend
npm run dev
```

Open the local URL printed by Vite.

### Step 8: Run tests

```bash
pytest
```

Run frontend tests and build checks using the scripts defined in `frontend/package.json`.

> These instructions describe the intended setup. The repository is not considered runnable until the corresponding files, dependencies, configuration, and tests have been implemented and verified.

---

## 12. Environment Configuration

Example `.env.example`:

```dotenv
APP_ENV=development
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/opspilot
MODEL_PATH=ml/artifacts/risk_model.joblib
CORS_ORIGINS=http://localhost:5173
```

Replace the database credentials and model path with values appropriate for your environment.

Production secrets should be configured through the hosting provider's secret or environment-variable settings. Never expose database credentials in frontend code.

---

## 13. API Design

The following endpoints are the proposed interface between React and FastAPI.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Check backend health |
| GET | `/api/v1/dashboard/summary` | Retrieve dashboard KPIs |
| GET | `/api/v1/tickets` | Retrieve and filter ticket records |
| GET | `/api/v1/tickets/{ticket_id}` | Retrieve ticket details |
| POST | `/api/v1/predictions` | Predict risk for eligible records |
| POST | `/api/v1/recommendations/generate` | Generate an operational plan |
| POST | `/api/v1/evaluations/compare` | Compare baseline and proposed policies |
| GET | `/api/v1/recommendations/history` | Retrieve saved recommendations |
| POST | `/api/v1/recommendations/{id}/decision` | Record approval or rejection |

The actual API schemas, error responses, validation rules, and authentication requirements will be defined during implementation.

### Example request

```json
{
  "ticket_id": "example-ticket-id"
}
```

### Example response

```json
{
  "ticket_id": "example-ticket-id",
  "risk_probability": 0.82,
  "risk_category": "high",
  "model_version": "baseline-v1"
}
```

These examples illustrate the intended contract. They are not evidence that the endpoints or models already exist.

---

## 14. Evaluation and Performance Metrics

A credible evaluation must demonstrate more than a visually impressive dashboard.

### Prediction evaluation

| Metric | Purpose |
|---|---|
| Precision | How many predicted high-risk cases are actually positive? |
| Recall | How many actual positive cases are identified? |
| F1-score | Balance between precision and recall |
| PR-AUC | Evaluate classification quality, especially with imbalanced labels |
| Brier score | Evaluate probability accuracy and calibration |
| MAE | Measure resolution-time prediction error, if regression is implemented |

### Decision evaluation

| Metric | Purpose |
|---|---|
| Weighted overdue workload | Measures priority-weighted delayed work |
| Workload imbalance | Measures how unevenly work is distributed |
| Constraint violations | Verifies whether the plan respects hard constraints |
| Assignment validity | Measures whether each proposed assignment is eligible |
| Objective value | Measures the optimiser's chosen cost under the defined objective |

### Baseline comparison

We will compare:

**Baseline:** Existing or explicitly defined priority-based allocation policy.

**Proposed:** Risk-informed policy using the prediction and optimisation components.

Both policies must use the same initial scenario, task set, capacity assumptions, and evaluation rules.

A proposed policy should be considered better only when the measured objective and relevant operational metrics support that conclusion.

### Reporting requirements

The final report should include:

- Dataset size and class distribution.
- Prediction target and feature definitions.
- Train, validation, and test methodology.
- Baseline and final-model metrics.
- Optimisation constraints and objective.
- Baseline vs proposed policy results.
- Simulation assumptions and limitations.

No performance figures or percentage improvements will be reported until the corresponding experiments have actually been completed.

---

## 15. Team Responsibilities

The project is divided into three independent workstreams so the team can develop in parallel.

### Person 1 — AI/ML and Data Intelligence

**Responsibilities**

- Dataset inspection and preprocessing.
- Exploratory data analysis.
- Target definition and leakage prevention.
- Baseline and improved risk-prediction models.
- Model evaluation and explanation.
- Optional resolution-time regression.

**Deliverables**

```text
ml/data_preprocessing.py
ml/feature_engineering.py
ml/train.py
ml/predict.py
ml/evaluate.py
ml/artifacts/
```

### Person 2 — Decision Engine and Evaluation

**Responsibilities**

- Define the baseline allocation policy.
- Implement prioritisation rules.
- Define capacity, eligibility, and skill constraints.
- Implement heuristic allocation and OR-Tools optimisation.
- Build the simulation and policy comparison.
- Validate that proposed allocations satisfy hard constraints.

**Deliverables**

```text
optimizer/baseline.py
optimizer/constraints.py
optimizer/allocate.py
optimizer/simulator.py
optimizer/evaluate.py
```

### Person 3 — Frontend, Backend, and Integration

**Responsibilities**

- Build the React dashboard.
- Implement charts, filters, ticket details, and recommendation views.
- Develop FastAPI routes and request/response schemas.
- Integrate the ML and optimisation modules.
- Implement database persistence.
- Configure deployment and demo readiness.

**Deliverables**

```text
frontend/
backend/main.py
backend/schemas.py
backend/routers/
backend/services/
backend/database/
```

### Collaboration workflow

All team members should agree on the dataset, prediction response schema, and optimiser input/output contract before implementation diverges.

Use mock predictions and recommendations initially so that frontend development does not depend on the completed ML model. Work in separate Git branches and merge through pull requests.

---

## 16. Development Roadmap

### Phase 1 — Data and contracts

- Download and inspect the dataset.
- Confirm the usable fields and prediction target.
- Establish shared API schemas.
- Define evaluation and baseline rules.

### Phase 2 — Core intelligence

- Implement preprocessing.
- Train and evaluate the baseline classifier.
- Test an advanced candidate model.
- Implement risk predictions and explanations.

### Phase 3 — Decision engine

- Implement the baseline policy.
- Add allocation rules and constraints.
- Build a simulation.
- Compare baseline and proposed policies.

### Phase 4 — Dashboard integration

- Build the dashboard and ticket table.
- Integrate prediction and recommendation endpoints.
- Add policy comparison charts.
- Add approval and recommendation history.

### Phase 5 — Validation and deployment

- Run backend, ML, and optimiser tests.
- Validate model and constraint correctness.
- Test missing, invalid, and unexpected input.
- Deploy the application.
- Rehearse the end-to-end demonstration.

---

## 17. Deployment

The preferred deployment architecture separates frontend delivery from Python inference.

```text
User's Browser
      |
      v
React Frontend — Vercel
      |
      | HTTPS / REST API
      v
Python Backend — Always-running Host
      |
      +---- ML Prediction Service
      |
      +---- Optimisation Engine
      |
      v
Managed PostgreSQL
```

### Frontend

Build the React application and deploy it on Vercel.

### Backend

Deploy FastAPI and its required Python dependencies on a host that supports persistent application processes and the resource requirements of the ML and optimisation modules.

### Database

Configure a managed PostgreSQL database and use the production connection string through environment variables.

### Deployment considerations

- Configure CORS for the production frontend domain.
- Keep database credentials and secrets out of source control.
- Load the trained model once during application startup when appropriate.
- Avoid retraining the model during normal prediction requests.
- Test cold starts, model loading, inference latency, and database connectivity.
- Verify the hosting provider's pricing, resource limits, and sleep behaviour before the final demonstration.

The frontend and backend can also be deployed together as a Docker-based service if a single application deployment is preferred.

---

## 18. Limitations and Future Scope

### Initial limitations

- The selected dataset may not include all information required for a true SLA-breach target.
- Employee capacity and skill information may require a separate, explicitly labelled simulation configuration.
- Historical patterns do not necessarily establish causal relationships.
- Simulated policy improvements do not prove real-world business improvement.
- Prediction quality may degrade if future operational data differs from the training data.

### Future improvements

- Integrate with real ticketing platforms.
- Add monitoring for prediction drift and changing workload patterns.
- Introduce time-series workload forecasting if sufficient timestamped data exists.
- Add more sophisticated scheduling and resource allocation.
- Incorporate manager feedback and verified outcomes.
- Extend the framework to supply chains, inventory, and workforce operations.
- Add role-based access control and an audit trail for production use.

---

## 19. Responsible AI and Data Integrity

OpsPilot AI is intended to support human decisions, not blindly automate them.

The implementation will aim to:

- Use only features available at the defined prediction time.
- Document missing values, assumptions, and simulated data.
- Report model performance on held-out data.
- Explain the factors contributing to predictions.
- Validate hard constraints before recommending assignments.
- Avoid treating correlation as proof of causation.
- Record approvals and rejections for traceability.
- Avoid claiming business improvements without measured evidence.
- Protect secrets and limit access to operational data.

Recommendations should remain reviewable by the responsible operations manager.

---

## 20. Dataset Attribution

The project uses the following candidate dataset source:

**Help Desk Tickets — Mendeley Data**

https://data.mendeley.com/datasets/btm76zndnt/3

Before redistribution or publication, verify the dataset version, author attribution, and licence information on the source page. Preserve the required attribution and licence notices when using or sharing the data.

---

## Final Summary

OpsPilot AI aims to move beyond descriptive dashboards and isolated predictions by connecting machine learning with constraint-aware operational decisions.

Its core workflow is:

**Operational Data → Risk Prediction → Explainable Insights → Decision Optimisation → Baseline Comparison**

The success of the project will be judged by the quality of its data, reliability of its predictions, validity of its recommendations, and evidence that the proposed policy performs better than a clearly defined baseline under comparable conditions.
