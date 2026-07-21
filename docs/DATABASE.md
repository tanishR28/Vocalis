# Database (Supabase Postgres)

Schema source of truth: [`../supabase_schema.sql`](../supabase_schema.sql).  
Age/sex migration: [`../supabase_migrate_profiles.sql`](../supabase_migrate_profiles.sql).  
Operational guide: [SUPABASE.md](./SUPABASE.md).

---

## ER overview

```
auth.users
    └── profiles (id = auth.users.id)
            ├── recordings (user_id)
            │       └── biomarkers (recording_id, user_id)
            └── alerts (user_id, recording_id nullable)
```

---

## Tables

### `profiles`

| Column | Notes |
|--------|-------|
| `id` | PK = Auth user UUID |
| `email`, `full_name` | From Google / onboarding |
| `condition` | e.g. Parkinson’s / Asthma |
| `age` | 18–100 (UPDRS feature) |
| `sex` | 0 female, 1 male (UPDRS feature) |

### `recordings`

Session metadata only. `audio_url` is reserved but **Vocalis does not upload WAVs**.

Status: `pending` | `analyzed` | `error`.

### `biomarkers`

Numeric columns for common scores (tremor, breathlessness, pitch, speech rate, pauses, HNR, jitter, shimmer, health_score, category, trend, confidence, `is_anomaly`).

**`raw_features` JSONB** holds the rich payload:

- Signal maps / prediction / severity / stage
- `motor_updrs`, `lstm_row`
- `clinical_insights`
- `source`: `"audio-analysis"` vs `"imported-medical-record"`
- Model provenance fields

### `alerts`

| `alert_type` | Meaning |
|--------------|---------|
| `anomaly` | Unusual session |
| `trend_decline` | Worsening vs baseline/weekly |
| `threshold` | Crossed configured threshold |

Severity: `low` | `medium` | `high` | `critical`. Soft-deletes not used — mark `is_read`.

---

## Indexes

- `recordings(user_id)`, `recordings(recorded_at DESC)`
- `biomarkers(user_id)`, `biomarkers(analyzed_at DESC)`
- `alerts(user_id)`, `alerts(is_read)`

---

## What is intentionally not stored

| Data | Why |
|------|-----|
| Raw audio / Storage objects | Privacy + free-tier Storage limit |
| Full Google tokens in DB | Handled by Supabase Auth |
| Training datasets | Local / notebooks only |

---

## Free-tier fit

- Rows are small (floats + JSONB metadata).
- No Storage bucket required.
- Auth MAU within free plan for demos.

After schema changes always run:

```sql
NOTIFY pgrst, 'reload schema';
```

to refresh PostgREST (`PGRST205` otherwise).

---

## Interview talking points

1. **Scores-only persistence** as a product and cost decision.
2. **JSONB `raw_features`** for flexible ML payloads without constant migrations.
3. **RLS + service role split** — clients can’t fabricate biomarker rows.
4. **Import tagging** in JSON so demo data can be deleted independently of real analyses.
