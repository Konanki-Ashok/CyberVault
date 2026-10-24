import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { documentService } from '../services/documentService.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  FileText,
  Search,
  Filter,
  Upload,
  Download,
  Eye,
  Lock,
  Tag,
  Calendar,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { UploadModal } from '../components/UploadModal.jsx';
import { DocumentDetailModal } from '../components/DocumentDetailModal.jsx';

const CATEGORIES = [
  'All',
  'Finance',
  'Legal',
  'Engineering',
  'Human Resources',
  'Operations',
  'Security & Compliance',
  'Executive',
  'General',
];

export function Documents() {
  const { user, isOwner, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTag, setSelectedTag] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 12,
        sortBy,
        order: sortOrder,
      };

      if (search.trim()) params.search = search.trim();
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedTag) params.tag = selectedTag;

      const res = await documentService.listDocuments(params);
      setDocuments(res.documents || []);
      setPagination(res.pagination || { totalPages: 1, total: 0 });
    } catch (err) {
      showToast(err.message || 'Failed to fetch documents.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [page, selectedCategory, selectedTag, sortBy, sortOrder]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDocuments();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-400" />
            Document Vault
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Cryptographically verified files strictly restricted to authorized recipients
          </p>
        </div>

        {(isOwner || isAdmin) && (
          <button
            onClick={() => setUploadModalOpen(true)}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition flex items-center gap-2 shadow-lg shadow-brand-500/20 shrink-0"
          >
            <Upload className="w-4 h-4" /> Upload Document
          </button>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by title, original filename, tags, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-brand-500 transition"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  Category: {cat}
                </option>
              ))}
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb);
                setSortOrder(so);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-brand-500 transition"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="title-asc">Title (A-Z)</option>
              <option value="title-desc">Title (Z-A)</option>
              <option value="size-desc">Size (Largest)</option>
              <option value="size-asc">Size (Smallest)</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
            >
              Search
            </button>
          </div>
        </form>

        {/* Selected tag pill if active */}
        {selectedTag && (
          <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
            <span>Filtered by tag:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-950 text-brand-300 border border-brand-800">
              #{selectedTag}
              <button
                onClick={() => setSelectedTag('')}
                className="hover:text-white transition ml-1"
              >
                ×
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Documents Grid / Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">
          Searching and verifying accessible documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center text-slate-500">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-200">No documents found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Either no documents match your filters, or you have not been granted access to them yet.
            </p>
          </div>
          {(isOwner || isAdmin) && (
            <button
              onClick={() => setUploadModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition inline-flex items-center gap-1.5 shadow"
            >
              <Upload className="w-3.5 h-3.5" /> Upload Document Now
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedDocId(doc.id)}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition duration-200 flex flex-col justify-between group cursor-pointer hover:shadow-brand-500/5 hover:-translate-y-0.5"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400 shrink-0 group-hover:scale-105 transition">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {doc.category}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        doc.myPermission === 'owner'
                          ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          : doc.myPermission === 'edit'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {doc.myPermission?.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Title & filename */}
                <div>
                  <h3 className="text-base font-bold text-slate-100 group-hover:text-brand-300 transition line-clamp-1">
                    {doc.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono truncate mt-0.5">
                    {doc.originalFilename}
                  </p>
                </div>

                {/* Description if present */}
                {doc.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {doc.description}
                  </p>
                )}

                {/* Tags */}
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {doc.tags.slice(0, 3).map((tag) => (
                      <button
                        key={tag}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTag(tag);
                          setPage(1);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700 transition"
                      >
                        #{tag}
                      </button>
                    ))}
                    {doc.tags.length > 3 && (
                      <span className="text-[10px] text-slate-500 self-center">
                        +{doc.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Footer metadata & actions */}
              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex flex-col">
                  <span className="text-slate-300 font-medium">{doc.owner?.name}</span>
                  <span className="text-[10px] text-slate-500">
                    {(doc.size / 1024).toFixed(1)} KB • {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-brand-400 group-hover:translate-x-0.5 transition flex items-center gap-1">
                    Details <Eye className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
          <div>
            Showing page <span className="text-slate-200 font-semibold">{page}</span> of{' '}
            <span className="text-slate-200 font-semibold">{pagination.totalPages}</span> ({pagination.total} documents)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadSuccess={fetchDocuments}
      />

      <DocumentDetailModal
        documentId={selectedDocId}
        isOpen={!!selectedDocId}
        onClose={() => setSelectedDocId(null)}
        onDocumentUpdated={fetchDocuments}
        onDocumentDeleted={fetchDocuments}
        currentUser={user}
      />
    </div>
  );
}
