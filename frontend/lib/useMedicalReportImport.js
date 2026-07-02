'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthScopeId } from './useAuthScope';
import { getProfile, updateProfile } from './profile';
import {
  clearReportImport,
  getStoredReportImport,
  saveReportImport,
  toReportImportResult,
  REPORT_IMPORT_CHANGED,
  AUTH_USER_CHANGED,
} from './reportImport';
import { normalizeStructuredReport } from './reportDisplay';
import { apiFetch, getApiUserId, withUserIdParams } from './api';

export function useMedicalReportImport({ onImportSuccess, onImportRemoved } = {}) {
  const { userId, authReady } = useAuthScopeId();
  const [selectedReportFile, setSelectedReportFile] = useState(null);
  const [selectedReportFileName, setSelectedReportFileName] = useState('');
  const [uploadedReportFileName, setUploadedReportFileName] = useState('');
  const [isReportUploading, setIsReportUploading] = useState(false);
  const [reportImportResult, setReportImportResult] = useState(null);
  const [reportError, setReportError] = useState('');
  const [showReportUploadForm, setShowReportUploadForm] = useState(false);
  const [demographicsPreview, setDemographicsPreview] = useState(null);
  const [showDemographicsModal, setShowDemographicsModal] = useState(false);
  const reportFileInputRef = useRef(null);
  const hydratingRef = useRef(false);

  async function fetchImportStatus() {
    if (!authReady) return { active: false };
    try {
      const response = await apiFetch(`/api/import-status?${withUserIdParams().toString()}`);
      if (!response.ok) return { active: false };
      return response.json();
    } catch {
      return { active: false };
    }
  }

  async function hydrateFromStorage() {
    if (!authReady || hydratingRef.current) return;

    hydratingRef.current = true;
    try {
      const status = await fetchImportStatus();
      if (!status?.active) {
        const storedReport = getStoredReportImport(userId);
        if (storedReport) {
          if (userId) clearReportImport(userId);
          else clearReportImport();
        }
        setReportImportResult(null);
        setUploadedReportFileName('');
        setShowReportUploadForm(false);
        return;
      }

      const storedReport = getStoredReportImport(userId);
      if (storedReport && storedReport.userId && userId && storedReport.userId !== userId) {
        clearReportImport(userId);
        setReportImportResult(null);
        setUploadedReportFileName('');
        setShowReportUploadForm(false);
        return;
      }

      if (storedReport) {
        setReportImportResult(toReportImportResult(storedReport));
        setUploadedReportFileName(storedReport.filename || status.filename || 'Imported report');
        setShowReportUploadForm(false);
        return;
      }

      if (status.active) {
        setReportImportResult({
          filename: status.filename || 'Imported report',
          imported_rows: status.row_count ?? 0,
          importedAt: null,
        });
        setUploadedReportFileName(status.filename || 'Imported report');
        setShowReportUploadForm(false);
        return;
      }

      setReportImportResult(null);
      setUploadedReportFileName('');
      setShowReportUploadForm(false);
    } finally {
      hydratingRef.current = false;
    }
  }

  useEffect(() => {
    hydrateFromStorage();

    function onChanged() {
      hydrateFromStorage();
    }

    window.addEventListener(REPORT_IMPORT_CHANGED, onChanged);
    window.addEventListener(AUTH_USER_CHANGED, onChanged);
    return () => {
      window.removeEventListener(REPORT_IMPORT_CHANGED, onChanged);
      window.removeEventListener(AUTH_USER_CHANGED, onChanged);
    };
  }, [userId, authReady]);

  const structuredReport = useMemo(() => {
    if (!reportImportResult?.report) return null;
    return normalizeStructuredReport(reportImportResult.report);
  }, [reportImportResult]);

  const hasUploadedReport = Boolean(uploadedReportFileName && reportImportResult);

  async function previewReportDemographics(file, profile) {
    const formData = new FormData();
    formData.append('file', file);
    if (profile?.age != null) formData.append('age', String(profile.age));
    if (profile?.sex === 0 || profile?.sex === 1) formData.append('sex', String(profile.sex));
    const apiUserId = getApiUserId();
    if (apiUserId) formData.append('user_id', apiUserId);

    const response = await apiFetch('/api/preview-medical-records', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`Could not preview report demographics: ${txt}`);
    }

    return response.json();
  }

  async function uploadReportWithDemographics(file, age, sex) {
    const formData = new FormData();
    formData.append('file', file);
    if (age != null) formData.append('age', String(age));
    if (sex === 0 || sex === 1) formData.append('sex', String(sex));
    const apiUserId = getApiUserId();
    if (apiUserId) formData.append('user_id', apiUserId);

    const response = await apiFetch('/api/extract-medical-records', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`Medical record extraction failed: ${txt}`);
    }

    return response.json();
  }

  async function runImport(age, sex) {
    if (!selectedReportFile) return;

    setIsReportUploading(true);
    setReportError('');
    setReportImportResult(null);

    try {
      const data = await uploadReportWithDemographics(selectedReportFile, age, sex);
      const saved = saveReportImport(data, userId);
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
      setShowDemographicsModal(false);
      setDemographicsPreview(null);
    }
  }

  async function handleReportUpload() {
    if (!selectedReportFile) {
      setReportError('Please choose a PDF, CSV, or image file first.');
      reportFileInputRef.current?.click();
      return;
    }

    const profile = getProfile();
    setReportError('');

    try {
      const preview = await previewReportDemographics(selectedReportFile, profile);
      const useAge = preview.profile_age ?? profile?.age ?? null;
      const useSex = preview.profile_sex ?? profile?.sex;

      if (preview.conflict) {
        setDemographicsPreview(preview);
        setShowDemographicsModal(true);
        return;
      }

      await runImport(useAge, useSex);
    } catch (error) {
      setReportError(error?.message || 'Failed to import report.');
    }
  }

  function confirmDemographicsFromProfile() {
    if (!demographicsPreview) return;
    runImport(demographicsPreview.profile_age, demographicsPreview.profile_sex);
  }

  function confirmDemographicsFromReport() {
    if (!demographicsPreview) return;
    const { report_age, report_sex } = demographicsPreview;
    updateProfile({
      age: report_age ?? undefined,
      sex: report_sex === 0 || report_sex === 1 ? report_sex : undefined,
    });
    runImport(report_age, report_sex);
  }

  function cancelDemographicsModal() {
    setShowDemographicsModal(false);
    setDemographicsPreview(null);
  }

  function handleChangeReport() {
    setShowReportUploadForm(true);
    setSelectedReportFile(null);
    setSelectedReportFileName('');
    setReportError('');
  }

  async function handleRemoveReport() {
    const filename = uploadedReportFileName || reportImportResult?.filename || null;

    try {
      const params = withUserIdParams();
      if (filename) params.set('filename', filename);

      const query = params.toString();
      await apiFetch(`/api/imported-medical-records${query ? `?${query}` : ''}`, {
        method: 'DELETE',
      });
    } catch {
      // Still clear local UI if backend is offline
    }

    clearReportImport(userId);
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
    showDemographicsModal,
    demographicsPreview,
    confirmDemographicsFromProfile,
    confirmDemographicsFromReport,
    cancelDemographicsModal,
  };
}
