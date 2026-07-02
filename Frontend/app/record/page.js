'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect, useMemo } from 'react';
import { getCondition } from '../../lib/conditions';
import { getProfile } from '../../lib/profile';
import RecordingInstructions from '../components/RecordingInstructions';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const DEFAULT_RECORDING_SECONDS = 15;

const PARKINSONS_MANUAL_SAMPLE = {
  age: 72,
  sex: 0,
  test_time: 5.6431,
  'Jitter(%)': 0.00662,
  'Jitter(Abs)': 0.0000338,
  'Jitter:RAP': 0.00401,
  'Jitter:PPQ5': 0.00317,
  'Jitter:DDP': 0.01204,
  Shimmer: 0.02565,
  'Shimmer(dB)': 0.23,
  'Shimmer:APQ3': 0.01438,
  'Shimmer:APQ5': 0.01309,
  'Shimmer:APQ11': 0.01662,
  'Shimmer:DDA': 0.04314,
  NHR: 0.01429,
  HNR: 21.64,
  RPDE: 0.41888,
  DFA: 0.54842,
  PPE: 0.16006,
};

const LIBROSA_MANUAL_SAMPLE = {
  mfcc_1: -5.2,
  mfcc_2: 3.1,
  mfcc_3: -1.4,
  mfcc_4: 2.0,
  mfcc_5: -0.8,
  mfcc_6: 1.2,
  mfcc_7: -0.5,
  mfcc_8: 0.9,
  mfcc_9: -1.1,
  mfcc_10: 0.4,
  mfcc_11: -0.3,
  mfcc_12: 0.6,
  mfcc_13: -0.2,
  pitch_mean: 180,
  pitch_std: 0.35,
  jitter: 0.012,
  shimmer: 0.04,
  hnr: 18,
  speech_rate: 0.42,
  pause_count: 4,
  avg_pause_len: 0.35,
};

function parseExtractedMedicalReport(rawText) {
  const text = String(rawText || '');
  if (!text.trim()) {
    return {
      patientName: null,
      disease: null,
      rows: [],
      firstScore: null,
      lastScore: null,
      scoreDelta: null,
      finalScore: null,
      finalStatus: null,
    };
  }

  const patientNameMatch = text.match(/name\s*:\s*([^\n]+)/i);
  const diseaseMatch = text.match(/disease\s*:\s*([^\n]+)/i);
  const finalScoreMatch = text.match(/final\s+health\s+score\s*:\s*([0-9]+(?:\.[0-9]+)?)(?:\s*\(([^)]+)\))?/i);

  const normalized = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const rowRegex = /day\s*(\d+)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)/gi;
  const rows = [];
  let match;

  while ((match = rowRegex.exec(normalized)) !== null) {
    rows.push({
      day: Number(match[1]),
      breathScore: Number(match[2]),
      pauseScore: Number(match[3]),
      speechRate: Number(match[4]),
      healthScore: Number(match[5]),
    });
  }

  rows.sort((a, b) => a.day - b.day);
  const firstScore = rows.length ? rows[0].healthScore : null;
  const lastScore = rows.length ? rows[rows.length - 1].healthScore : null;
  const scoreDelta = firstScore !== null && lastScore !== null ? lastScore - firstScore : null;

  return {
    patientName: patientNameMatch ? patientNameMatch[1].trim() : null,
    disease: diseaseMatch ? diseaseMatch[1].trim() : null,
    rows,
    firstScore,
    lastScore,
    scoreDelta,
    finalScore: finalScoreMatch ? Number(finalScoreMatch[1]) : null,
    finalStatus: finalScoreMatch && finalScoreMatch[2] ? finalScoreMatch[2].trim() : null,
  };
}


function normalizeStructuredReport(report) {
  const rows = Array.isArray(report?.rows)
    ? report.rows
        .map((row) => ({
          day: Number(row.day),
          breathScore: Number(row.breath_score),
          pauseScore: Number(row.pause_score),
          speechRate: Number(row.speech_rate),
          healthScore: Number(row.health_score),
        }))
        .filter((row) => Number.isFinite(row.day))
        .sort((a, b) => a.day - b.day)
    : [];

  const firstScore = rows.length ? rows[0].healthScore : null;
  const lastScore = rows.length ? rows[rows.length - 1].healthScore : null;
  const scoreDelta = firstScore !== null && lastScore !== null ? lastScore - firstScore : null;

  return {
    patientName: report?.patient_name || null,
    disease: report?.disease || null,
    rows,
    firstScore,
    lastScore,
    scoreDelta,
    finalScore: report?.final_health_score ?? null,
    finalStatus: report?.final_health_status || null,
  };
}

export default function RecordPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_RECORDING_SECONDS);
  const [error, setError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDocumentAnalyzing, setIsDocumentAnalyzing] = useState(false);
  const [sessionId, setSessionId] = useState('VX-....');
  const [profile, setProfile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [documentResult, setDocumentResult] = useState(null);
  const [mode, setMode] = useState('voice');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showManualDev, setShowManualDev] = useState(false);
  const [manualFeaturesJson, setManualFeaturesJson] = useState('');
  const [isManualAnalyzing, setIsManualAnalyzing] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const router = useRouter();

  const condition = profile ? getCondition(profile.conditionId) : null;
  const selectedDisease = condition?.apiValue || '';
  const recordingDuration = condition?.recordingSeconds || 15;
  const structuredDoc = useMemo(() => {
    if (documentResult?.report) {
      return normalizeStructuredReport(documentResult.report);
    }
    return parseExtractedMedicalReport(documentResult?.extracted_text);
  }, [documentResult]);

  const elapsedSeconds = Math.max(0, recordingDuration - timeLeft);

  useEffect(() => {
    setProfile(getProfile());
  }, []);

  useEffect(() => {
    if (!condition) return;
    const base =
      condition.id === 'parkinsons'
        ? {
            ...PARKINSONS_MANUAL_SAMPLE,
            age: profile?.age ?? PARKINSONS_MANUAL_SAMPLE.age,
            sex: profile?.sex ?? PARKINSONS_MANUAL_SAMPLE.sex,
          }
        : LIBROSA_MANUAL_SAMPLE;
    setManualFeaturesJson(JSON.stringify(base, null, 2));
  }, [condition?.id, profile?.age, profile?.sex]);

  // Cleanup on unmount
  useEffect(() => {
    setSessionId(`VX-${Math.floor(1000 + Math.random() * 9000)}`);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!isRecording && !isAnalyzing && condition) {
      setTimeLeft(recordingDuration);
    }
  }, [recordingDuration, isRecording, isAnalyzing, condition]);

  const processMedicalDocument = async (file) => {
    setIsDocumentAnalyzing(true);
    setError('');
    setDocumentResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/extract-medical-records`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Medical record extraction failed: ${txt}`);
      }

      const data = await response.json();
      setDocumentResult(data);
    } catch (err) {
      console.error('Document extraction error:', err);
      setError(err.message || 'Failed to extract medical record.');
    } finally {
      setIsDocumentAnalyzing(false);
    }
  };

  const handleStartRecording = async () => {
    if (isRecording) {
       stopRecording();
       return;
    }

    if (!selectedDisease) {
      setError('Complete onboarding first to set your monitoring condition.');
      router.push('/onboarding');
      return;
    }

    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setAudioUrl(null);
      setAnalysisResult(null);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        // Generate playback UI
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
        await processAudioBackend(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTimeLeft(recordingDuration);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      console.log("Recording started...");

    } catch (err) {
      console.error("Mic Error:", err);
      setError("Microphone access denied or not working. Please check permissions or try another browser.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      console.log("Recording stopped manually/automatically...");
    }
  };

  const processAudioBackend = async (audioBlob) => {
    setIsAnalyzing(true);
    setError('');

    // Native browser decode from webm to 16kHz Mono WAV
    const convertToWav = async (blob) => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      const wavData = new DataView(new ArrayBuffer(44 + channelData.length * 2));
      
      const writeString = (view, offset, string) => {
        for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
      };

      writeString(wavData, 0, 'RIFF');
      wavData.setUint32(4, 36 + channelData.length * 2, true);
      writeString(wavData, 8, 'WAVE');
      writeString(wavData, 12, 'fmt ');
      wavData.setUint32(16, 16, true);          
      wavData.setUint16(20, 1, true);           
      wavData.setUint16(22, 1, true);           
      wavData.setUint32(24, 16000, true);       
      wavData.setUint32(28, 16000 * 2, true);   
      wavData.setUint16(32, 2, true);           
      wavData.setUint16(34, 16, true);          
      writeString(wavData, 36, 'data');
      wavData.setUint32(40, channelData.length * 2, true);
      
      let offset = 44;
      for (let i = 0; i < channelData.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, channelData[i]));
        wavData.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
      return new Blob([wavData], { type: 'audio/wav' });
    };

    try {
      console.log("Converting webm Blob to WAV natively...");
      const wavBlob = await convertToWav(audioBlob);
      console.log("Sending WAV audio blob to backend: size", wavBlob.size);
      
      const formData = new FormData();
      formData.append('file', wavBlob, 'recording.wav');
      formData.append('disease', selectedDisease);
      if (profile?.age != null) formData.append('age', String(profile.age));
      if (profile?.sex === 0 || profile?.sex === 1) formData.append('sex', String(profile.sex));
      if (profile?.onboardedAt) formData.append('onboarded_at', profile.onboardedAt);

      const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
         const txt = await response.text();
         throw new Error(`API Error ${response.status}: ${txt}`);
      }

      const data = await response.json();
      console.log("Received AI Analysis:", data);

      // Save to localStorage so UI can instantly update globally
      localStorage.setItem('vocalis_latest_analysis', JSON.stringify(data));
      localStorage.setItem('vocalis_just_updated', 'true');

      // Display results inline instead of redirecting
      setAnalysisResult(data);
      setIsAnalyzing(false);
    } catch (err) {
      console.error("Backend integration error:", err);
      setError(err.message || "Failed to process audio.");
      setIsAnalyzing(false);
    }
  };

  const processManualBackend = async () => {
    if (!selectedDisease) {
      setError('Complete onboarding first to set your monitoring condition.');
      router.push('/onboarding');
      return;
    }

    setIsManualAnalyzing(true);
    setError('');
    setAnalysisResult(null);

    try {
      let features;
      try {
        features = JSON.parse(manualFeaturesJson);
      } catch {
        throw new Error('Invalid JSON in manual features. Check commas and quotes.');
      }
      if (!features || typeof features !== 'object' || Array.isArray(features)) {
        throw new Error('Manual features must be a JSON object.');
      }

      const payload = {
        disease: selectedDisease,
        features,
      };
      if (profile?.age != null) payload.age = profile.age;
      if (profile?.sex === 0 || profile?.sex === 1) payload.sex = profile.sex;
      if (profile?.onboardedAt) payload.onboarded_at = profile.onboardedAt;

      const response = await fetch(`${API_URL}/api/analyze-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`API Error ${response.status}: ${txt}`);
      }

      const data = await response.json();
      localStorage.setItem('vocalis_latest_analysis', JSON.stringify(data));
      localStorage.setItem('vocalis_just_updated', 'true');
      setAnalysisResult(data);
    } catch (err) {
      console.error('Manual analysis error:', err);
      setError(err.message || 'Failed to run manual analysis.');
    } finally {
      setIsManualAnalyzing(false);
    }
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 pb-28 md:pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <span className="text-on-surface-variant font-headline font-semibold text-xs sm:text-sm tracking-tight uppercase">
          Session {sessionId}
        </span>
        <div className="flex items-center gap-2 bg-secondary-container/30 px-3 py-1 rounded-full border border-secondary/10">
          <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span className="text-xs font-bold text-on-secondary-container uppercase tracking-wider">Signal Secure</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-start">
        {/* Mic + timer first on mobile */}
        <div className="flex flex-col items-center order-1 lg:order-2 lg:sticky lg:top-20">
          <div
            className={`mb-6 font-headline text-6xl sm:text-7xl font-light tracking-tighter ${isRecording ? 'text-blue-600 animate-pulse' : 'text-slate-400'}`}
          >
            00:<span className="font-bold">{timeLeft.toString().padStart(2, '0')}</span>
          </div>

          <div className="relative group">
            {isRecording && (
              <div className="absolute -inset-8 bg-blue-500/20 shadow-[0_0_50px_rgba(37,99,235,0.4)] rounded-full blur-3xl opacity-60 scale-110 animate-pulse" />
            )}
            {isAnalyzing && (
              <div className="absolute -inset-8 bg-purple-500/20 shadow-[0_0_50px_rgba(168,85,247,0.4)] rounded-full blur-3xl opacity-60 scale-110 animate-spin" />
            )}

            <button
              onClick={handleStartRecording}
              disabled={isAnalyzing || !condition}
              className={`relative w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center text-white shadow-2xl transition-all active:scale-95 ${
                isAnalyzing || !condition
                  ? 'bg-slate-300 opacity-50 cursor-not-allowed'
                  : isRecording
                    ? 'bg-gradient-to-br from-red-500 to-red-600'
                    : 'bg-gradient-to-tr from-primary to-primary-container hover:shadow-[0_0_30px_rgba(0,86,187,0.4)]'
              }`}
            >
              <span
                className={`material-symbols-outlined text-5xl sm:text-6xl ${isRecording ? 'animate-pulse' : ''}`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {isRecording ? 'stop_circle' : 'mic'}
              </span>
            </button>
          </div>

          <p className="mt-4 text-sm font-bold text-slate-400 tracking-wider uppercase text-center">
            {isRecording ? 'Click to stop early' : condition ? 'Click to Record' : 'Complete onboarding first'}
          </p>

          <div
            className={`mt-8 h-20 w-56 flex items-end justify-between gap-1 transition-opacity ${isRecording ? 'opacity-100' : 'opacity-20'}`}
          >
            {[2, 3, 4, 6, 4.5, 5, 3.5, 4, 2.5, 3, 2].map((h, i) => (
              <div
                key={i}
                className={`waveform-bar w-1.5 rounded-full ${isRecording ? 'bg-primary animate-pulse' : 'bg-slate-300'}`}
                style={{ height: `${h}rem` }}
              />
            ))}
          </div>

          {audioUrl && (
            <div className="mt-6 flex flex-col items-center w-full">
              <p className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2">Playback</p>
              <audio controls src={audioUrl} className="w-full max-w-xs h-10 rounded-full shadow-md bg-white border border-slate-200" />
            </div>
          )}
        </div>

        <div className="space-y-4 order-2 lg:order-1 min-w-0">
          <h2 className="font-headline font-extrabold text-on-surface tracking-tight text-2xl sm:text-3xl lg:text-4xl">
            {isAnalyzing ? 'Processing analysis…' : `Speak naturally for ${recordingDuration} seconds`}
          </h2>

          {condition && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monitoring</p>
                <p className="text-lg font-extrabold text-primary">{condition.label}</p>
              </div>
              <span className="material-symbols-outlined text-3xl text-primary">{condition.icon}</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
              <p className="font-bold mb-1">Recording error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!error && !isAnalyzing && condition && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <RecordingInstructions
                conditionId={condition.id}
                elapsedSeconds={elapsedSeconds}
                isRecording={isRecording}
              />
            </div>
          )}

          {isAnalyzing && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 animate-pulse">
              <p className="text-blue-700 font-medium leading-relaxed">
                Extracting vocal biomarkers and running your condition model…
              </p>
            </div>
          )}

          {condition && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setShowManualDev((v) => !v)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-amber-100/60 transition-colors"
              >
                <div>
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Temporary — dev only</p>
                  <p className="text-sm font-semibold text-amber-900 mt-0.5">Manual feature values (no recording)</p>
                </div>
                <span className="material-symbols-outlined text-amber-700">
                  {showManualDev ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {showManualDev && (
                <div className="px-5 pb-5 border-t border-amber-200/80 space-y-3">
                  <p className="text-xs text-amber-800 pt-3 leading-relaxed">
                    {condition.id === 'parkinsons'
                      ? 'Paste Oxford telemonitoring features (age, sex, test_time + 16 voice columns). Sample values are from the UCI dataset.'
                      : 'Paste librosa feature values (mfcc_1…mfcc_13, pitch_mean, jitter, etc.).'}
                  </p>
                  <textarea
                    value={manualFeaturesJson}
                    onChange={(e) => setManualFeaturesJson(e.target.value)}
                    rows={12}
                    spellCheck={false}
                    className="w-full font-mono text-xs rounded-lg border border-amber-300 bg-white p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={processManualBackend}
                    disabled={isManualAnalyzing || isAnalyzing || isRecording}
                    className="w-full py-3 rounded-xl bg-amber-600 text-white font-bold text-sm uppercase tracking-wider hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isManualAnalyzing ? 'Analyzing…' : 'Run analysis with values'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {analysisResult && (
              <div className="mt-12 bg-white p-8 rounded-2xl shadow-2xl w-full animate-in fade-in slide-in-from-bottom border border-blue-100 z-20">
                <h3 className="text-2xl font-black text-blue-900 mb-8 border-b border-slate-100 pb-4">Clinical Biomarker Analysis</h3>
                
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Left Side: Core Scores */}
                  <div className="w-full md:w-1/3 flex flex-col gap-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl py-8 px-4 border border-blue-100 flex-1 flex flex-col justify-center items-center shadow-inner">
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Composite Health Score</p>
                      <p className="text-6xl font-black text-blue-600 drop-shadow-sm">{analysisResult.health_score}<span className="text-2xl text-blue-300 font-bold">/100</span></p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl py-6 px-4 border border-purple-100 flex flex-col justify-center items-center shadow-inner gap-2">
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Severity & Stage</p>
                      <p className="text-4xl font-black text-purple-700">{Math.round(analysisResult.severity ?? 0)}<span className="text-lg text-purple-400">/100</span></p>
                      <p className="text-lg font-bold text-purple-600">{analysisResult.stage || '—'}</p>
                      <p className="text-xs text-slate-500">Confidence {(Number(analysisResult.confidence || 0) * 100).toFixed(0)}%</p>
                      {analysisResult.motor_updrs != null && (
                        <p className="text-xs font-semibold text-purple-600 mt-1">
                          Motor UPDRS: {Number(analysisResult.motor_updrs).toFixed(1)}
                        </p>
                      )}
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl py-6 px-4 border border-emerald-100 flex flex-col justify-center items-center shadow-inner gap-2">
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Diagnostic Status</p>
                      <p className="text-2xl font-bold text-emerald-700 tracking-tight text-center">{analysisResult.status}</p>
                      {condition?.id === 'asthma' && (analysisResult.cough_detected || analysisResult.wheeze_detected) && (
                        <div className="flex flex-wrap gap-2 justify-center mt-1">
                          {analysisResult.cough_detected && (
                            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              Cough signature
                            </span>
                          )}
                          {analysisResult.wheeze_detected && (
                            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                              Wheeze signature
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Graph Bars */}
                  <div className="w-full md:w-2/3 flex flex-col gap-6">
                    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6 shadow-inner">
                      <h4 className="text-sm font-extrabold text-slate-600 uppercase tracking-widest mb-4">Clinical Sub-Scores</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { label: 'Speech', value: analysisResult.speech_score, color: 'bg-blue-500' },
                          { label: 'Breathlessness', value: analysisResult.breathlessness_score, color: 'bg-orange-500' },
                          { label: 'Tremor', value: analysisResult.tremor_score, color: 'bg-purple-500' },
                        ].map((item) => (
                          <div key={item.label} className="bg-white rounded-xl p-4 border border-slate-100 text-center">
                            <p className="text-xs font-bold text-slate-500 uppercase">{item.label}</p>
                            <p className="text-3xl font-black text-slate-800 mt-1">{Math.round(Number(item.value || 0))}</p>
                            <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                              <div className={`h-full ${item.color}`} style={{ width: `${Math.min(100, Math.max(0, Number(item.value || 0)))}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-8 flex flex-col justify-center shadow-inner">
                     <div className="flex justify-between items-end mb-8">
                         <h4 className="text-sm font-extrabold text-slate-600 uppercase tracking-widest">Acoustic Biomarker Signatures</h4>
                     </div>
                     
                     <div className="space-y-6">
                       {(condition?.resultBars || []).map((item, idx) => {
                         const raw = analysisResult[item.key];
                         const isFlag = item.max === 1 && (item.key === 'cough_detected' || item.key === 'wheeze_detected');
                         const display = isFlag ? (raw ? 'Yes' : 'No') : Number(raw || 0).toFixed(3);
                         const width = isFlag ? (raw ? 100 : 0) : Math.min(100, Math.max(0, ((raw || 0) / item.max) * 100));
                         return (
                         <div key={idx} className="flex items-center gap-5">
                           <div className="w-44 text-right text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0 break-words">{item.label}</div>
                           <div className="flex-1 h-7 bg-slate-200 border border-slate-300 relative rounded-sm shadow-inner group overflow-hidden">
                             <div className={`h-full transition-all duration-1000 ease-out border-r border-black/10 ${isFlag && raw ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${width}%` }}></div>
                           </div>
                           <div className="w-16 text-right text-sm font-mono font-bold text-slate-700 bg-white border border-slate-200 py-1 px-2 rounded">{display}</div>
                         </div>
                       );})}
                     </div>
                    </div>
                  </div>
                </div>
              </div>
      )}

      <div className="mt-8 flex justify-center">
        <Link href="/">
          <button
            type="button"
            disabled={isRecording || isAnalyzing || isManualAnalyzing}
            className="px-6 py-2.5 rounded-xl text-slate-500 font-semibold hover:bg-slate-100 transition-colors disabled:opacity-30"
          >
            Return to dashboard
          </button>
        </Link>
      </div>

      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,90vw)] h-[min(600px,60vh)] -z-10">
        <div className="absolute inset-0 bg-primary/5 rounded-full blur-[100px]" />
      </div>
    </div>
  );
}
