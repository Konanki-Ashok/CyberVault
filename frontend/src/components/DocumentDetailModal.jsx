import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Eye,
  Edit3,
  Share2,
  Trash2,
  Sparkles,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  Clock,
  User,
  Key,
  ExternalLink,
} from 'lucide-react';
import { documentService } from '../services/documentService.js';
import { useToast } from '../context/ToastContext.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';

export function DocumentDetailModal({ documentId, isOpen, onClose, onDocumentUpdated, onDocumentDeleted, currentUser }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'preview' | 'edit' | 'acl' | 'ai'

  // Edit metadata form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  // Sharing form state
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('read');
  const [sharing, setSharing] = useState(false);

  // AI assistant state
  const [aiPurpose, setAiPurpose] = useState('');
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Download ticket state for secure preview/download
  const [previewTicket, setPreviewTicket] = useState(null);
  const [loadingTicket, setLoadingTicket] = useState(false);

  // Confirmation dialog state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmRevokeTarget, setConfirmRevokeTarget] = useState(null);

  const { showToast } = useToast();

  const fetchDocument = async () => {
    try {
      setLoading(true);
      const data = await documentService.getDocument(documentId);
      setDoc(data.document);
      setTitle(data.document.title);
      setCategory(data.document.category);
      setTags(data.document.tags ? data.document.tags.join(', ') : '');
      setDescription(data.document.description || '');
    } catch (err) {
      showToast(err.message || 'Failed to fetch document details.', 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && documentId) {
      fetchDocument();
      setActiveTab('overview');
      setPreviewTicket(null);
      setAiRecommendations(null);
    }
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const isOwner = doc?.myPermission === 'owner' || doc?.owner?._id === currentUser?.id;
  const canEdit = isOwner || doc?.myPermission === 'edit';

  // Request secure ephemeral preview/download ticket
  const handleGenerateTicket = async (purpose = 'download') => {
    try {
      setLoadingTicket(true);
      const res = await documentService.createDownloadTicket(documentId, purpose);
      setPreviewTicket(res.ticket);
      return res.ticket;
    } catch (err) {
      showToast(err.message || 'Failed to issue download ticket.', 'error');
      return null;
    } finally {
      setLoadingTicket(false);
    }
  };

  const handleDownload = async () => {
    const ticket = await handleGenerateTicket('download');
    if (ticket) {
      window.location.href = `/api/documents/${documentId}/download?ticket=${ticket}`;
      showToast('Download ticket issued. Streaming file...', 'success');
    }
  };

  const handleOpenPreviewTab = async () => {
    setActiveTab('preview');
    if (!previewTicket) {
      await handleGenerateTicket('preview');
    }
  };

  // Update metadata handler
  const handleSaveMetadata = async (e) => {
    e.preventDefault();
    try {
      setSavingMeta(true);
      const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
      await documentService.updateMetadata(documentId, {
        title,
        category,
        tags: parsedTags,
        description,
      });
      showToast('Metadata updated successfully.', 'success');
      fetchDocument();
      onDocumentUpdated?.();
    } catch (err) {
      showToast(err.message || 'Failed to update metadata.', 'error');
    } finally {
      setSavingMeta(false);
    }
  };

  // Grant access handler
  const handleGrantAccess = async (e) => {
    e.preventDefault();
    if (!shareEmail) return;

    try {
      setSharing(true);
      await documentService.grantPermission(documentId, {
        email: shareEmail,
        permission: sharePermission,
      });
      showToast(`Granted ${sharePermission} permission to ${shareEmail}`, 'success');
      setShareEmail('');
      fetchDocument();
      onDocumentUpdated?.();
    } catch (err) {
      showToast(err.message || 'Failed to grant permission.', 'error');
    } finally {
      setSharing(false);
    }
  };

  // Revoke access handler
  const handleRevoke = async () => {
    if (!confirmRevokeTarget) return;
    try {
      await documentService.revokePermission(documentId, confirmRevokeTarget.id);
      showToast(`Revoked access for ${confirmRevokeTarget.email}. Access blocked immediately.`, 'info');
      setConfirmRevokeTarget(null);
      fetchDocument();
      onDocumentUpdated?.();
    } catch (err) {
      showToast(err.message || 'Failed to revoke access.', 'error');
    }
  };

  // Delete document handler
  const handleDelete = async () => {
    try {
      await documentService.deleteDocument(documentId);
      showToast('Document permanently deleted from vault.', 'info');
      setConfirmDeleteOpen(false);
      onDocumentDeleted?.(documentId);
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to delete document.', 'error');
    }
  };

  // AI recommendations
  const handleGetAiRecommendations = async () => {
    try {
      setLoadingAi(true);
      const res = await documentService.getAIRecommendations(documentId, aiPurpose);
      setAiRecommendations(res.result);
      showToast('AI recipient recommendations computed from metadata.', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to compute recommendations.', 'error');
    } finally {
      setLoadingAi(false);
    }
  };

  const handleAiDecision = async (rec, decision) => {
    try {
      await documentService.recordAIDecision(documentId, {
        targetUserId: rec.user._id,
        decision,
        permission: rec.recommendedPermission,
        reason: rec.rationale,
      });

      if (decision === 'accepted') {
        showToast(`AI recommendation accepted. Granted ${rec.recommendedPermission} access to ${rec.user.email}.`, 'success');
        fetchDocument();
        onDocumentUpdated?.();
      } else {
        showToast(`AI recommendation for ${rec.user.email} rejected. Recorded in audit log.`, 'info');
      }

      // Remove decided item from list
      setAiRecommendations((prev) => ({
        ...prev,
        recommendations: prev.recommendations.filter((r) => r.user._id !== rec.user._id),
      }));
    } catch (err) {
      showToast(err.message || 'Failed to record decision.', 'error');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400">
                <FileText className="w-5 h-5" />
              </div>
              <div className="max-w-lg">
                <h2 className="text-base font-bold text-slate-100 truncate">
                  {doc?.title || 'Loading document...'}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400 font-mono truncate">
                    {doc?.originalFilename}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                    {doc?.category}
                  </span>
                  {doc?.myPermission && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        doc.myPermission === 'owner'
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          : doc.myPermission === 'edit'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      Your Role: {doc.myPermission.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                disabled={loadingTicket}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition flex items-center gap-1.5 shadow"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="px-6 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2 shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" /> Overview & Integrity
            </button>

            <button
              onClick={handleOpenPreviewTab}
              className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-4 h-4" /> Secure Preview
            </button>

            {canEdit && (
              <button
                onClick={() => setActiveTab('edit')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'edit'
                    ? 'border-brand-500 text-brand-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Edit3 className="w-4 h-4" /> Edit Metadata
              </button>
            )}

            {isOwner && (
              <>
                <button
                  onClick={() => setActiveTab('acl')}
                  className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
                    activeTab === 'acl'
                      ? 'border-brand-500 text-brand-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Share2 className="w-4 h-4" /> Access Control ({doc?.acls?.length || 0})
                </button>

                <button
                  onClick={() => setActiveTab('ai')}
                  className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
                    activeTab === 'ai'
                      ? 'border-brand-500 text-brand-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-brand-400" /> AI Sharing Advisor
                </button>
              </>
            )}
          </div>

          {/* Modal Content Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                Loading document details...
              </div>
            ) : (
              <>
                {/* 1. Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Security & Verification Banner */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-start gap-3.5">
                      <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-slate-200">
                          Cryptographic Integrity & Isolated Storage
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          This document is stored under an unguessable UUID storage key outside the public web root.
                          File content is verified against its SHA-256 hash on every operation and delivered only after fresh authorization checks.
                        </p>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          File Characteristics
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Original Name:</span>
                            <span className="text-slate-200 font-mono">{doc?.originalFilename}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">MIME Type:</span>
                            <span className="text-slate-200 font-mono">{doc?.mimeType}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Size:</span>
                            <span className="text-slate-200 font-mono">
                              {(doc?.size / 1024).toFixed(1)} KB ({doc?.size} bytes)
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Uploaded On:</span>
                            <span className="text-slate-200">
                              {new Date(doc?.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Ownership & Security
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Owner:</span>
                            <span className="text-slate-200 font-semibold">{doc?.owner?.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Owner Email:</span>
                            <span className="text-slate-200 font-mono">{doc?.owner?.email}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Active Grants:</span>
                            <span className="text-slate-200 font-semibold">
                              {doc?.acls?.length || 0} user(s)
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Category:</span>
                            <span className="text-brand-300 font-medium">{doc?.category}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SHA-256 Checksum Card */}
                    <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Key className="w-4 h-4 text-brand-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          SHA-256 File Hash (Tamper-Evidence)
                        </span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 font-mono text-xs text-slate-300 break-all select-all">
                        {doc?.fileHash}
                      </div>
                    </div>

                    {/* Description & Tags */}
                    {doc?.description && (
                      <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Description
                        </h4>
                        <p className="text-sm text-slate-300 leading-relaxed">{doc.description}</p>
                      </div>
                    )}

                    {doc?.tags && doc.tags.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Tags
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {doc.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Owner Danger Zone */}
                    {isOwner && (
                      <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                        <div>
                          <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                            Danger Zone
                          </h4>
                          <p className="text-xs text-slate-500">
                            Soft-delete document metadata and purge storage file.
                          </p>
                        </div>
                        <button
                          onClick={() => setConfirmDeleteOpen(true)}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-950 border border-rose-800 text-rose-300 hover:bg-rose-900 transition flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Document
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Preview Tab */}
                {activeTab === 'preview' && (
                  <div className="h-full flex flex-col space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400">
                        Rendered via single-use ephemeral preview ticket. No permanent public URLs.
                      </p>
                      <button
                        onClick={() => handleGenerateTicket('preview')}
                        disabled={loadingTicket}
                        className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium"
                      >
                        <Clock className="w-3 h-3" /> Refresh Ticket
                      </button>
                    </div>

                    <div className="flex-1 min-h-[420px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center p-2">
                      {previewTicket ? (
                        doc?.mimeType?.startsWith('image/') ? (
                          <img
                            src={`/api/documents/${documentId}/preview?ticket=${previewTicket}`}
                            alt={doc?.title}
                            className="max-h-[500px] object-contain rounded-lg"
                          />
                        ) : (
                          <iframe
                            src={`/api/documents/${documentId}/preview?ticket=${previewTicket}`}
                            title={doc?.title}
                            className="w-full h-[520px] rounded border-none bg-white"
                          />
                        )
                      ) : (
                        <div className="text-center p-6">
                          <Eye className="w-8 h-8 text-slate-500 mx-auto mb-2 animate-pulse" />
                          <p className="text-sm text-slate-400">Generating secure ticket...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Edit Metadata Tab */}
                {activeTab === 'edit' && canEdit && (
                  <form onSubmit={handleSaveMetadata} className="space-y-4 max-w-lg">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Document Title
                      </label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Category
                      </label>
                      <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Tags (Comma separated)
                      </label>
                      <input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Description
                      </label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingMeta}
                      className="px-5 py-2 text-sm font-semibold rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition disabled:bg-slate-800"
                    >
                      {savingMeta ? 'Saving Changes...' : 'Save Metadata'}
                    </button>
                  </form>
                )}

                {/* 4. Access Control (ACL) Tab */}
                {activeTab === 'acl' && isOwner && (
                  <div className="space-y-6">
                    {/* Grant New Permission Form */}
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                        Grant Access to Registered User
                      </h4>
                      <form onSubmit={handleGrantAccess} className="flex flex-col sm:flex-row items-center gap-3">
                        <input
                          type="email"
                          required
                          placeholder="recipient@company.com"
                          value={shareEmail}
                          onChange={(e) => setShareEmail(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition w-full"
                        />

                        <select
                          value={sharePermission}
                          onChange={(e) => setSharePermission(e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition w-full sm:w-auto"
                        >
                          <option value="read">Viewer (Read & Download)</option>
                          <option value="edit">Editor (Read, Download & Edit)</option>
                        </select>

                        <button
                          type="submit"
                          disabled={sharing}
                          className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition disabled:bg-slate-800 w-full sm:w-auto shrink-0"
                        >
                          {sharing ? 'Granting...' : 'Grant Access'}
                        </button>
                      </form>
                    </div>

                    {/* Current Grants Table */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                        Active Access Grants ({doc?.acls?.length || 0})
                      </h4>

                      {doc?.acls?.length === 0 ? (
                        <div className="text-center py-8 bg-slate-950/30 rounded-xl border border-slate-800/80 text-slate-500 text-sm">
                          This document is completely private to you. No explicit user grants exist.
                        </div>
                      ) : (
                        <div className="border border-slate-800 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider">
                              <tr>
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Permission</th>
                                <th className="px-4 py-3">Granted Date</th>
                                <th className="px-4 py-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                              {doc.acls.map((acl) => (
                                <tr key={acl._id || acl.user?._id}>
                                  <td className="px-4 py-3 font-medium text-slate-200">
                                    <div>{acl.user?.name || 'User'}</div>
                                    <div className="text-xs text-slate-400 font-mono">
                                      {acl.user?.email}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                        acl.permission === 'edit'
                                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                                      }`}
                                    >
                                      {acl.permission.toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-400">
                                    {new Date(acl.grantedAt).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      onClick={() =>
                                        setConfirmRevokeTarget({
                                          id: acl.user?._id || acl.user,
                                          email: acl.user?.email || 'User',
                                        })
                                      }
                                      className="text-xs text-rose-400 hover:text-rose-300 font-medium transition"
                                    >
                                      Revoke Grant
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. AI Sharing Advisor Tab */}
                {activeTab === 'ai' && isOwner && (
                  <div className="space-y-6">
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-slate-200">
                          AI-Assisted Recipient Recommender
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Recommends collaborators using document metadata (category, tags, description) and intended collaboration purpose.
                          <strong className="text-slate-300"> Note:</strong> AI never grants access automatically. Every recommendation requires your explicit human review and confirmation.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Optional purpose (e.g., 'Need technical security review' or 'Finance signoff')"
                        value={aiPurpose}
                        onChange={(e) => setAiPurpose(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition"
                      />
                      <button
                        onClick={handleGetAiRecommendations}
                        disabled={loadingAi}
                        className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition disabled:bg-slate-800 flex items-center gap-1.5 shrink-0"
                      >
                        <Sparkles className="w-4 h-4" />
                        {loadingAi ? 'Analyzing...' : 'Generate Recommendations'}
                      </button>
                    </div>

                    {aiRecommendations && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>
                            Engine: <code className="text-slate-300">{aiRecommendations.engine}</code>
                          </span>
                          <span>Evaluated: {new Date(aiRecommendations.evaluatedAt).toLocaleTimeString()}</span>
                        </div>

                        {aiRecommendations.recommendations.length === 0 ? (
                          <div className="p-6 text-center text-sm text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
                            {aiRecommendations.rationale || 'No new recipient recommendations for this document.'}
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {aiRecommendations.recommendations.map((rec) => (
                              <div
                                key={rec.user._id}
                                className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm text-slate-200">
                                      {rec.user.name}
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono">
                                      {rec.user.email}
                                    </span>
                                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-brand-950 text-brand-300 border border-brand-800">
                                      {rec.confidence}% Match
                                    </span>
                                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                      Suggested: {rec.recommendedPermission}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-400 mt-1">
                                    <strong className="text-slate-300">Rationale:</strong> {rec.rationale}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => handleAiDecision(rec, 'accepted')}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 shadow-sm"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Accept & Share
                                  </button>
                                  <button
                                    onClick={() => handleAiDecision(rec, 'rejected')}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1"
                                  >
                                    <X className="w-3.5 h-3.5" /> Reject
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Delete Document from Vault"
        message="Are you sure you want to permanently delete this document? All active ACL grants will be revoked and storage content purged."
        confirmText="Permanently Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <ConfirmDialog
        isOpen={!!confirmRevokeTarget}
        title="Revoke Document Access"
        message={`Immediately revoke access for ${confirmRevokeTarget?.email}? Any subsequent read, preview, or download requests from this user will be blocked immediately.`}
        confirmText="Revoke Access"
        onConfirm={handleRevoke}
        onCancel={() => setConfirmRevokeTarget(null)}
      />
    </>
  );
}
