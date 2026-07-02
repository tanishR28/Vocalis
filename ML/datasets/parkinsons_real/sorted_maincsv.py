import pandas as pd

# ==========================================
# CONFIG
# ==========================================

INPUT_CSV = "parkinsons_telemonitoring_updrs.csv"
OUTPUT_CSV = "parkinsons_telemonitoring_updrs_sorted.csv"

# ==========================================
# LOAD
# ==========================================

df = pd.read_csv(INPUT_CSV)

# ==========================================
# SORT
# ==========================================

df_sorted = (
    df
    .sort_values(
        by=["subject#", "test_time"],
        ascending=[True, True]
    )
    .reset_index(drop=True)
)

# ==========================================
# SAVE
# ==========================================

df_sorted.to_csv(
    OUTPUT_CSV,
    index=False
)

print("=" * 50)
print("DATASET SORTED SUCCESSFULLY")
print("=" * 50)

print(f"Input  : {INPUT_CSV}")
print(f"Output : {OUTPUT_CSV}")

print("\nFirst 20 rows:\n")
print(df_sorted[["subject#", "test_time"]].head(20))