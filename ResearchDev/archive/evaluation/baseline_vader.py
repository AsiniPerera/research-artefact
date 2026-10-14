"""DSR Step 5 — VADER baseline (the method to beat).
Compares LLM extraction F1 against a VADER polarity baseline on the gold set.

Run: python evaluation/baseline_vader.py
"""

import pandas as pd
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sklearn.metrics import f1_score
from pathlib import Path

GOLD_CSV = Path("evaluation/gold_set.csv")
# gold_set.csv must include a 'review_text' column

def run():
    gold = pd.read_csv(GOLD_CSV, dtype=str)
    analyzer = SentimentIntensityAnalyzer()

    y_true, y_pred = [], []
    for _, row in gold.iterrows():
        # Gold: 1 if any positive opinion, 0 if any negative, skip neutral
        true_sent = row.get("sentiment")
        if true_sent is None:
            continue
        true_label = 1 if float(true_sent) > 0 else 0

        score = analyzer.polarity_scores(str(row.get("review_text", "")))["compound"]
        pred_label = 1 if score > 0 else 0

        y_true.append(true_label)
        y_pred.append(pred_label)

    f1 = f1_score(y_true, y_pred, average="binary", zero_division=0)
    print(f"VADER baseline F1: {f1:.3f}")
    print("(LLM extraction should score higher than this)")


if __name__ == "__main__":
    run()
