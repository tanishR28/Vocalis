'use client';

import { getCondition } from '../../lib/conditions';

export default function RecordingInstructions({ conditionId, elapsedSeconds, isRecording }) {
  const condition = getCondition(conditionId);
  if (!condition) return null;

  if (conditionId === 'asthma') {
    return (
      <div className="space-y-3">
        <p className="text-on-surface-variant font-medium text-lg leading-relaxed italic">
          Say <span className="text-on-surface font-bold">&quot;aah&quot;</span> for{' '}
          <span className="text-on-surface font-bold">5 seconds</span>, then read:
        </p>
        <p className="text-on-surface font-semibold text-base leading-relaxed">
          &quot;Today I tried to walk a short distance, but I started feeling short of breath. I had to
          slow down and take deeper breaths. Speaking continuously sometimes feels difficult, and I
          need to pause to breathe properly.&quot;
        </p>
        {isRecording && (
          <p className="text-sm font-bold uppercase tracking-wider text-blue-700">
            {elapsedSeconds < 5 ? 'Step 1: Keep saying "aah"' : 'Step 2: Read the sentence above'}
          </p>
        )}
      </div>
    );
  }

  if (conditionId === 'parkinsons') {
    return (
      <div className="space-y-3">
        <p className="text-on-surface-variant font-medium text-lg leading-relaxed italic">
          Sustain <span className="text-on-surface font-bold">&quot;eeeeeee&quot;</span> in a steady tone for{' '}
          <span className="text-on-surface font-bold">5 seconds</span>, then read:
        </p>
        <p className="text-on-surface font-semibold text-base leading-relaxed">
          &quot;I am speaking in a steady voice and trying to maintain the same tone throughout this
          sentence. Sometimes my voice feels softer and less expressive, and I need to focus more to
          keep it clear and consistent.&quot;
        </p>
        {isRecording && (
          <p className="text-sm font-bold uppercase tracking-wider text-blue-700">
            {elapsedSeconds < 5 ? 'Step 1: Sustain "eeeeeee"' : 'Step 2: Read the sentence above'}
          </p>
        )}
      </div>
    );
  }

  if (conditionId === 'depression') {
    return (
      <div className="space-y-3">
        <p className="text-on-surface-variant font-medium text-lg leading-relaxed italic">
          Describe how you are feeling today in your own words. Speak naturally for the full{' '}
          <span className="text-on-surface font-bold">15 seconds</span>.
        </p>
        <p className="text-on-surface font-semibold text-base leading-relaxed text-slate-600">
          Example topics: your mood, energy level, sleep, and anything that stood out about today.
        </p>
      </div>
    );
  }

  return null;
}
