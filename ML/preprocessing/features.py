"""Vocal biomarker feature extraction — Parkinson's, Depression, Asthma only."""

import librosa
import numpy as np
import scipy.signal as signal


def detect_micro_tremor(f0, sr=16000):
    if len(f0) < 50:
        return False
    f0_detrend = f0 - np.mean(f0)
    freqs, psd = signal.welch(f0_detrend, fs=sr / 512, nperseg=len(f0_detrend))
    mask = (freqs >= 4) & (freqs <= 8)
    if not any(mask):
        return False
    return np.max(psd[mask]) > 5 * np.mean(psd)


def detect_wheeze(y, sr):
    S = np.abs(librosa.stft(y))
    freqs = librosa.fft_frequencies(sr=sr)
    mask = (freqs >= 400) & (freqs <= 1600)
    return np.mean(S[mask, :]) > 2.5 * np.mean(S)


def detect_cough_bursts(y, sr):
    """Detect cough-like impulsive bursts (works with a single cough in a short clip)."""
    if len(y) < sr // 10:
        return False

    hop = 512
    frame = 2048
    rms = librosa.feature.rms(y=y, frame_length=frame, hop_length=hop)[0]
    if len(rms) < 8:
        return False

    flatness = librosa.feature.spectral_flatness(y=y, hop_length=hop)[0]
    zcr = librosa.feature.zero_crossing_rate(y=y, frame_length=frame, hop_length=hop)[0]
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)

    rms_median = float(np.median(rms))
    rms_std = float(np.std(rms))
    impulse_threshold = max(rms_median + 1.1 * rms_std, rms_median * 2.2, 0.015)
    onset_cutoff = float(np.percentile(onset_env, 82)) if len(onset_env) else 0.0

    burst_count = 0
    in_burst = False
    n = min(len(rms), len(flatness), len(zcr), len(onset_env))
    for idx in range(n):
        loud = rms[idx] > impulse_threshold
        cough_like = loud and (
            flatness[idx] > 0.03
            or zcr[idx] > 0.035
            or onset_env[idx] >= onset_cutoff
        )
        if cough_like:
            if not in_burst:
                burst_count += 1
                in_burst = True
        else:
            in_burst = False

    if burst_count >= 1:
        return True

    peaks = librosa.util.peak_pick(
        onset_env,
        pre_max=3,
        post_max=3,
        pre_avg=3,
        post_avg=5,
        delta=0.04,
        wait=8,
    )
    for peak in peaks:
        if peak < n and rms[peak] > impulse_threshold and flatness[peak] > 0.025:
            return True

    return False


def extract_signal_features(audio_path):
    y, sr = librosa.load(audio_path, sr=16000)
    if np.max(np.abs(y)) > 0:
        y = y / np.max(np.abs(y))
    y, _ = librosa.effects.trim(y, top_db=30)
    total_duration = len(y) / sr

    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfccs_mean = np.mean(mfccs, axis=1)

    f0, voiced_flag, _ = librosa.pyin(y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7"))
    f0_only = f0[voiced_flag]
    f0_only = f0_only[~np.isnan(f0_only)]

    pitch_mean = np.mean(f0_only) if len(f0_only) > 0 else 0
    pitch_std = np.std(f0_only) if len(f0_only) > 0 else 0
    pitch_var = pitch_std / (pitch_mean + 1e-8) if pitch_mean > 0 else 0.5

    jitter = np.mean(np.abs(np.diff(f0_only))) / (pitch_mean + 1e-8) if len(f0_only) > 1 else 0
    rms_vals = librosa.feature.rms(y=y)[0]
    shimmer = np.mean(np.abs(np.diff(rms_vals))) / (np.mean(rms_vals) + 1e-8) if np.mean(rms_vals) > 0 else 0

    y_harm, y_perc = librosa.effects.hpss(y)
    hnr_db = 10 * np.log10(np.sum(y_harm**2) / (np.sum(y_perc**2) + 1e-8))

    intervals = librosa.effects.split(y, top_db=25)
    pause_ratio = (total_duration - sum([(e - s) for s, e in intervals]) / sr) / (total_duration + 1e-8)
    speech_rate = np.clip((len(f0_only) * 512 / sr) / (total_duration + 1e-8), 0, 1)

    signatures = {
        "micro_tremor": detect_micro_tremor(f0_only) if len(f0_only) > 0 else False,
        "wheeze": detect_wheeze(y, sr),
        "cough": detect_cough_bursts(y, sr),
    }

    raw_21 = list(mfccs_mean) + [
        pitch_mean, pitch_std, jitter, shimmer, hnr_db,
        speech_rate, len(intervals), pause_ratio,
    ]

    return {
        "raw": raw_21,
        "duration": total_duration,
        "signatures": signatures,
        "meta": {
            "jitter": jitter,
            "shimmer": shimmer,
            "hnr_db": hnr_db,
            "pitch_var": pitch_var,
            "pause_ratio": pause_ratio,
            "speech_rate": speech_rate,
            "total_duration": total_duration,
            "intervals": len(intervals),
        },
    }


def get_disease_biomarkers(meta, condition, signatures):
    m = meta
    s = signatures
    if condition == "Parkinson’s":
        tremor = np.clip(m["jitter"] + m["shimmer"], 0, 1)
        if s["micro_tremor"]:
            tremor = min(1.0, tremor + 0.2)
        return {
            "tremor": tremor,
            "breathlessness": np.clip(1 - (m["hnr_db"] + 10) / 40, 0, 0.7),
            "pitch_variation": m["pitch_var"],
            "speech_rate": m["speech_rate"],
            "pause_patterns": m["pause_ratio"],
            "SIGNATURE_DETECTED": s["micro_tremor"],
        }
    if condition == "Asthma":
        breath = np.clip(1 - (m["hnr_db"] + 10) / 40, 0, 1.0)
        noise = np.clip(1 - m["hnr_db"] / 20, 0, 1)
        c_flag = s["cough"]
        if c_flag:
            breath, noise = min(breath, 0.3), min(noise, 0.3)
        return {
            "breathlessness": breath,
            "pause_patterns": m["pause_ratio"],
            "speech_rate": m["speech_rate"],
            "wheeze_noise": noise,
            "energy_decay": 0.2,
            "cough_detected": c_flag,
            "SIGNATURE_DETECTED": c_flag,
        }
    if condition == "Depression":
        monotony = 1 - m["pitch_var"]
        slow_speech = np.clip(1 - m["speech_rate"] / 0.5, 0, 1)
        pause = m["pause_ratio"]
        energy = np.clip(1 - m["shimmer"], 0, 1)
        flat = monotony > 0.55 and slow_speech > 0.4
        return {
            "speech_rate": m["speech_rate"],
            "pause_patterns": pause,
            "pitch_monotony": monotony,
            "vocal_energy": energy,
            "SIGNATURE_DETECTED": flat,
        }
    return {}


def compute_disease_score(bios, condition):
    if condition == "Parkinson’s":
        t, b, p_p, p_v, s_r = (
            bios["tremor"], bios["breathlessness"], bios["pause_patterns"],
            bios["pitch_variation"], bios["speech_rate"],
        )
        if p_v > 0.6 and p_p < 0.3:
            return 0.1, "NO"
        score = 0.75 * (0.25 * t + 0.10 * b + 0.20 * p_p + 0.25 * (1 - p_v) + 0.20 * (1 - s_r)) + 0.25 * (t * b * p_p)
        return np.clip(score, 0, 1), ("YES" if score > 0.45 else "NO")
    if condition == "Asthma":
        b, p_p, s_r, n, e = (
            bios["breathlessness"], bios["pause_patterns"], bios["speech_rate"],
            bios["wheeze_noise"], bios["energy_decay"],
        )
        score = 0.7 * (0.30 * b + 0.20 * p_p + 0.20 * (1 - s_r) + 0.15 * n + 0.15 * e) + 0.3 * (b * p_p * n)
        return np.clip(score, 0, 1), ("YES" if score > 0.5 else "NO")
    if condition == "Depression":
        s_r, p_p, mono, energy = (
            bios["speech_rate"], bios["pause_patterns"],
            bios["pitch_monotony"], bios["vocal_energy"],
        )
        score = 0.30 * (1 - s_r) + 0.25 * p_p + 0.25 * mono + 0.20 * (1 - energy)
        return np.clip(score, 0, 1), ("YES" if score > 0.45 else "NO")
    return 0.0, "NO"


def severity_to_stage(severity: float) -> str:
    if severity < 35:
        return "Mild"
    if severity < 65:
        return "Moderate"
    return "Severe"


def build_signal_map(raw_vec):
    from ml_config import SIGNAL_FEATURE_NAMES
    return dict(zip(SIGNAL_FEATURE_NAMES, raw_vec))
