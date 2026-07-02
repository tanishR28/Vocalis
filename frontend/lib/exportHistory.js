import { apiFetch, getApiUserId, withUserIdParams } from './api';

export async function downloadParkinsonHistoryExport({ format, age, sex, subjectId = 1 }) {
  const params = withUserIdParams({
    format,
    age: String(age),
    sex: String(sex),
    subject_id: String(subjectId),
  });

  const response = await apiFetch(`/api/export-parkinson-history?${params.toString()}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Export failed (${response.status})`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `patient_history.${format}`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export { getApiUserId };
