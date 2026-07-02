import pandas as pd
import numpy as np

CSV_PATH = "parkinsons_telemonitoring_updrs.csv"

df = pd.read_csv(CSV_PATH)

# Sort correctly
df = df.sort_values(["subject#", "test_time"])

summary = []

for patient_id, patient_df in df.groupby("subject#"):

    motor = patient_df["motor_UPDRS"].values

    # Total fluctuation
    fluctuation = np.sum(np.abs(np.diff(motor)))

    # Overall change
    overall_change = motor[-1] - motor[0]

    # Number of increases/decreases
    increases = np.sum(np.diff(motor) > 0)
    decreases = np.sum(np.diff(motor) < 0)

    summary.append({
        "Patient ID": patient_id,
        "Total Fluctuation": fluctuation,
        "Overall Change": overall_change,
        "Increases": increases,
        "Decreases": decreases,
        "First Motor": motor[0],
        "Last Motor": motor[-1]
    })

summary = pd.DataFrame(summary)

summary = summary.sort_values(
    "Total Fluctuation",
    ascending=False
)

print("="*90)
print("TOP 5 MOST FLUCTUATING PATIENTS")
print("="*90)

print(summary.head(5).to_string(index=False))