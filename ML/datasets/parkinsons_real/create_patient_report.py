import pandas as pd
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.colors import darkblue
from reportlab.lib.units import inch

# ==========================
# CONFIG
# ==========================

CSV_PATH = "parkinsons_telemonitoring_updrs.csv"

PATIENT_ID = 1

NUM_RECORDS = 30

OUTPUT = "patient_30_day_history.pdf"

# ==========================
# LOAD DATA
# ==========================

df = pd.read_csv(CSV_PATH)

patient = (
    df[df["subject#"] == PATIENT_ID]
    .sort_values("test_time")
    .head(NUM_RECORDS)
)

if len(patient) < NUM_RECORDS:
    raise Exception("Patient doesn't have 30 records.")

# ==========================
# PDF
# ==========================

styles = getSampleStyleSheet()

title_style = styles["Heading1"]
title_style.alignment = TA_CENTER
title_style.textColor = darkblue

heading = styles["Heading2"]

normal = styles["BodyText"]

doc = SimpleDocTemplate(
    OUTPUT,
    rightMargin=25,
    leftMargin=25,
    topMargin=30,
    bottomMargin=30
)

story = []

# =====================================================
# TITLE
# =====================================================

story.append(
    Paragraph(
        "Vocalis Parkinson's Disease Monitoring Report",
        title_style
    )
)

story.append(Spacer(1,20))

story.append(
    Paragraph(
        "<b>Patient Information</b>",
        heading
    )
)

story.append(
    Paragraph(
        f"<b>Patient ID :</b> P{PATIENT_ID:03d}",
        normal
    )
)

story.append(
    Paragraph(
        f"<b>Age :</b> {patient.iloc[0]['age']}",
        normal
    )
)

story.append(
    Paragraph(
        f"<b>Gender :</b> {'Female' if patient.iloc[0]['sex'] == 0 else 'Male'}",
        normal
    )
)

story.append(
    Paragraph(
        "<b>Disease :</b> Parkinson's Disease",
        normal
    )
)

story.append(
    Paragraph(
        f"<b>Historical Records :</b> {NUM_RECORDS}",
        normal
    )
)

story.append(PageBreak())

# =====================================================
# DAILY RECORDS
# =====================================================

records_per_page = 5

for idx, (_, row) in enumerate(patient.iterrows(), start=1):

    if (idx-1) % records_per_page == 0:

        story.append(
            Paragraph(
                f"<b>Historical Records ({idx}-{min(idx+4,NUM_RECORDS)})</b>",
                heading
            )
        )

        story.append(Spacer(1,12))

    story.append(
        Paragraph(
            f"<b>Day {idx}</b>",
            heading
        )
    )

    fields = [

        ("Test Time", row["test_time"]),

        ("Motor UPDRS", row["motor_UPDRS"]),

        ("Total UPDRS", row["total_UPDRS"]),

        ("Jitter (%)", row["Jitter(%)"]),

        ("Jitter Abs", row["Jitter(Abs)"]),

        ("Jitter RAP", row["Jitter:RAP"]),

        ("Jitter PPQ5", row["Jitter:PPQ5"]),

        ("Jitter DDP", row["Jitter:DDP"]),

        ("Shimmer", row["Shimmer"]),

        ("Shimmer (dB)", row["Shimmer(dB)"]),

        ("Shimmer APQ3", row["Shimmer:APQ3"]),

        ("Shimmer APQ5", row["Shimmer:APQ5"]),

        ("Shimmer APQ11", row["Shimmer:APQ11"]),

        ("Shimmer DDA", row["Shimmer:DDA"]),

        ("NHR", row["NHR"]),

        ("HNR", row["HNR"]),

        ("RPDE", row["RPDE"]),

        ("DFA", row["DFA"]),

        ("PPE", row["PPE"])

    ]

    for name, value in fields:

        story.append(
            Paragraph(
                f"<b>{name}</b> : {round(float(value),6)}",
                normal
            )
        )

    story.append(Spacer(1,15))

    if idx % records_per_page == 0 and idx != NUM_RECORDS:
        story.append(PageBreak())

doc.build(story)

print("PDF created successfully!")