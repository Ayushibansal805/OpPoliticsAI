# Model Card — Ticket Delay Risk (delay-risk-v4)

**Target.** delayed = 1 if resolution time > 168 hours (open tickets older than that are delayed)
Prediction time = ticket creation.

**Model.** xgboost ({'max_depth': 4, 'learning_rate': 0.04, 'subsample': 0.7, 'colsample_bytree': 0.7, 'min_child_weight': 10, 'scale_pos_weight': 1.0, 'half_life_days': None, 'n_trees': 227}), calibration: sigmoid.
**Decision threshold:** 0.5084 (goal: high_precision).
Risk bands: low < 0.35, medium < 0.65, high >= 0.65.

**Metrics (test).**
- PR-AUC: 0.7150
- ROC-AUC: 0.7760
- Precision: 0.6757
- Recall: 0.6329
- F1: 0.6536
- Brier Loss: 0.1925

**Confusion Matrix (Test):**
- True Negatives (On-Time): 1973
- False Positives (False Alarms): 600
- False Negatives: 725
- True Positives (Delayed Caught): 1250
