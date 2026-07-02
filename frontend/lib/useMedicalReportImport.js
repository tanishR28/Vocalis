'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getProfile } from './profile';
import {
  clearReportImport,
  getStoredReportImport,
  saveReportImport,
  toReportImportResult,
  REPORT_IMPORT_CHANGED,
} from './reportImport';
import { normalizeStructuredReport } from './reportDisplay';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useMedicalReportImport({ onImportSuccess, onImportRemoved } = {}) {
  const [selectedReportFile, setSelectedReportFile] = useState(null);
  const [selectedReportFileName, setSelectedReportFileName] = useState('');
  const [uploadedReportFileName, setUploadedReportFileName] = useState('');
  const [isReportUploading, setIsReportUploading] = useState(false);
  const [reportImportResult, setReportImportResult] = useState(null);
  const [reportError, setReportError] = useState('');
  const [showReportUploadForm, setShowReportUploadForm] = useState(false);
  const reportFileInputRef = useRef(null);

  useEffect(() => {
    function hydrateFromStorage() {
      const storedReport = getStoredReportImport();
      if (storedReport) {
        setReportImportResult(toReportImportResult(storedReport));
        setUploadedReportFileName(storedReport.filename || 'Imported report');
        setShowReportUploadForm(false);
      } else {
        setReportImportResult(null);
        setUploadedReportFileName('');
        setShowReportUploadForm(false);
      }
    }

    hydrateFromStorage();
    window.addEventListener(REPORT_IMPORT_CHANGED, hydrateFromStorage);
    return () => window.removeEventListener(REPORT_IMPORT_CHANGED, hydrateFromStorage);
  }, []);

  const structuredReport = useMemo(() => {
    if (!reportImportResult?.report) return null;
    return normalizeStructuredReport(reportImportResult.report);
  }, [reportImportResult]);

  const hasUploadedReport = Boolean(uploadedReportFileName && reportImportResult);

  async function handleReportUpload() {
    if (!selectedReportFile) {
      setReportError('Please choose a PDF, CSV, or image file first.');
      reportFileInputRef.current?.click();
      return;
    }

    const profile = getProfile();
    setIsReportUploading(true);
    setReportError('');
    setReportImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedReportFile);
      if (profile?.age != null) formData.append('age', String(profile.age));
      if (profile?.sex === 0 || profile?.sex === 1) formData.append('sex', String(profile.sex));

      const response = await fetch(`${API_URL}/api/extract-medical-records`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Medical record extraction failed: ${txt}`);
      }

      const data = await response.json();
      const saved = saveReportImport(data);
      setReportImportResult(toReportImportResult(saved) || data);
      setUploadedReportFileName(data?.filename || selectedReportFile?.name || 'Uploaded file');
      setShowReportUploadForm(false);
      setSelectedReportFile(null);
      setSelectedReportFileName('');

      if (onImportSuccess) {
        await onImportSuccess(data);
      }
    } catch (error) {
      setReportError(error?.message || 'Failed to import report.');
    } finally {
      setIsReportUploading(false);
    }
  }

  function handleChangeReport() {
    setShowReportUploadForm(true);
    setSelectedReportFile(null);
    setSelectedReportFileName('');
    setReportError('');
  }

  async function handleRemoveReport() {
    const filename = uploadedReportFileName || reportImportResult?.filename || null;
    const profile = getProfile();

    try {
      const params = new URLSearchParams();
      if (filename) params.set('filename', filename);
      if (profile?.userId) params.set('user_id', profile.userId);

      const query = params.toString();
      await fetch(
        `${API_URL}/api/imported-medical-records${query ? `?${query}` : ''}`,
        { method: 'DELETE' },
      );
    } catch {
      // Still clear local UI if backend is offline
    }

    clearReportImport();
    setReportImportResult(null);
    setUploadedReportFileName('');
    setShowReportUploadForm(true);
    setSelectedReportFile(null);
    setSelectedReportFileName('');
    setReportError('');

    if (onImportRemoved) {
      await onImportRemoved();
    }
  }

  return {
    selectedReportFile,
    selectedReportFileName,
    uploadedReportFileName,
    isReportUploading,
    reportImportResult,
    reportError,
    showReportUploadForm,
    reportFileInputRef,
    structuredReport,
    hasUploadedReport,
    handleReportUpload,
    handleChangeReport,
    handleRemoveReport,
    setSelectedReportFile,
    setSelectedReportFileName,
    setReportError,
    setShowReportUploadForm,
  };
}
