import pandas as pd

# ==========================================
# CONFIG
# ==========================================

CSV_PATH = "parkinsons_telemonitoring_updrs.csv"

PATIENT_ID = 18       # Change patient if required
NUM_RECORDS = 30

OUTPUT_FILE = f"patient_{PATIENT_ID}_30_day_history.csv"

# ==========================================
# LOAD DATA
# ==========================================

df = pd.read_csv(CSV_PATH)

# ==========================================
# SELECT PATIENT
# ==========================================

patient_df = (
    df[df["subject#"] == PATIENT_ID]
    .sort_values("test_time")
    .reset_index(drop=True)
)

if len(patient_df) < NUM_RECORDS:
    raise Exception(
        f"Patient {PATIENT_ID} has only {len(patient_df)} records."
    )

# ==========================================
# TAKE FIRST 30 RECORDS
# ==========================================

history = patient_df.head(NUM_RECORDS).copy()

# ==========================================
# ADD DAY COLUMN
# ==========================================

history.insert(0, "day", range(1, NUM_RECORDS + 1))

# ==========================================
# SAVE
# ==========================================

history.to_csv(
    OUTPUT_FILE,
    index=False
)

print("=" * 50)
print("CSV CREATED SUCCESSFULLY")
print("=" * 50)

print(f"Patient ID : {PATIENT_ID}")
print(f"Records    : {NUM_RECORDS}")
print(f"Saved As   : {OUTPUT_FILE}")

print()
print(history.head())