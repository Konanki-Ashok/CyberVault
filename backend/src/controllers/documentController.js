import crypto from 'crypto';
import { Document } from '../models/Document.js';
import { DownloadTicket } from '../models/DownloadTicket.js';
import { storageService } from '../services/storageService.js';
import { auditService } from '../services/auditService.js';
import { getAccessibleDocumentsFilter } from '../middleware/documentAuthMiddleware.js';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES, PERMISSIONS } from '../constants/index.js';
import { updateMetadataSchema } from '../utils/validators.js';

export async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded.',
      });
    }

    const { title, category, tags, description } = req.body;

    // Calculate file hash (SHA-256) for tamper detection and data integrity
    const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    // Parse tags if provided as JSON string or array
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch {
        parsedTags = String(tags).split(',').map((t) => t.trim()).filter(Boolean);
      }
    }

    // Save file buffer to secure storage
    const ext = req.file.sanitizedFilename.split('.').pop() || '';
    const stored = await storageService.saveFile(req.file.buffer, ext);

    const document = new Document({
      title: title || req.file.sanitizedFilename,
      originalFilename: req.file.sanitizedFilename,
      storageKey: stored.storageKey,
      storageType: stored.storageType,
      mimeType: req.file.mimetype,
      size: req.file.size,
      fileHash: hash,
      owner: req.user._id,
      category: category || 'General',
      tags: Array.isArray(parsedTags) ? parsedTags : [],
      description: description || '',
      acls: [],
    });

    await document.save();

    // Log upload in tamper-evident audit trail
    await auditService.logEvent({
      actor: req.user,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.DOC_UPLOAD,
      documentId: document._id,
      documentTitle: document.title,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
      metadata: {
        size: document.size,
        mimeType: document.mimeType,
        fileHash: document.fileHash,
        category: document.category,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Document securely uploaded.',
      document: {
        id: document._id,
        title: document.title,
        originalFilename: document.originalFilename,
        mimeType: document.mimeType,
        size: document.size,
        fileHash: document.fileHash,
        category: document.category,
        tags: document.tags,
        description: document.description,
        createdAt: document.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listDocuments(req, res, next) {
  try {
    const {
      search,
      category,
      tag,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    // 1. Mandatory access control filter: only documents owned by or granted to user
    const baseFilter = getAccessibleDocumentsFilter(req.user);
    const queryConditions = [baseFilter];

    // 2. Search filter (by title, category, description, tags)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      queryConditions.push({
        $or: [
          { title: searchRegex },
          { originalFilename: searchRegex },
          { description: searchRegex },
          { category: searchRegex },
          { tags: searchRegex },
        ],
      });
    }

    // 3. Category filter
    if (category && category !== 'All') {
      queryConditions.push({ category });
    }

    // 4. Tag filter
    if (tag) {
      queryConditions.push({ tags: tag });
    }

    // 5. Upload date range filter
    if (startDate || endDate) {
      const dateQuery = {};
      if (startDate) dateQuery.$gte = new Date(startDate);
      if (endDate) dateQuery.$lte = new Date(endDate);
      queryConditions.push({ createdAt: dateQuery });
    }

    const finalQuery = { $and: queryConditions };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;
    const sortOrder = order === 'asc' ? 1 : -1;

    const [documents, total] = await Promise.all([
      Document.find(finalQuery)
        .populate('owner', 'name email')
        .populate('acls.user', 'name email')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Document.countDocuments(finalQuery),
    ]);

    // Format response and determine current user's effective permission for each document
    const formatted = documents.map((doc) => {
      const isOwner = doc.owner._id.toString() === req.user._id.toString();
      let myPermission = isOwner ? 'owner' : null;

      if (!isOwner) {
        const myGrant = doc.acls.find((a) => a.user && a.user._id.toString() === req.user._id.toString());
        myPermission = myGrant ? myGrant.permission : null;
      }

      return {
        id: doc._id,
        title: doc.title,
        originalFilename: doc.originalFilename,
        mimeType: doc.mimeType,
        size: doc.size,
        fileHash: doc.fileHash,
        owner: doc.owner,
        category: doc.category,
        tags: doc.tags,
        description: doc.description,
        aclsCount: doc.acls ? doc.acls.length : 0,
        myPermission,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    });

    res.json({
      success: true,
      documents: formatted,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getDocument(req, res, next) {
  try {
    // req.document is attached by requireDocumentAccess middleware
    const doc = await Document.findById(req.document._id)
      .populate('owner', 'name email role')
      .populate('acls.user', 'name email role')
      .populate('acls.grantedBy', 'name email')
      .lean();

    const isOwner = doc.owner._id.toString() === req.user._id.toString();
    const myGrant = isOwner
      ? null
      : doc.acls.find((a) => a.user && a.user._id.toString() === req.user._id.toString());

    res.json({
      success: true,
      document: {
        id: doc._id,
        title: doc.title,
        originalFilename: doc.originalFilename,
        mimeType: doc.mimeType,
        size: doc.size,
        fileHash: doc.fileHash,
        owner: doc.owner,
        category: doc.category,
        tags: doc.tags,
        description: doc.description,
        acls: isOwner ? doc.acls : doc.acls.filter((a) => a.user && a.user._id.toString() === req.user._id.toString()),
        myPermission: isOwner ? 'owner' : (myGrant ? myGrant.permission : null),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMetadata(req, res, next) {
  try {
    const validated = updateMetadataSchema.parse(req.body);

    const doc = req.document; // loaded via requireDocumentAccess(PERMISSIONS.EDIT)
    const oldTitle = doc.title;
    const oldCategory = doc.category;

    if (validated.title !== undefined) doc.title = validated.title;
    if (validated.category !== undefined) doc.category = validated.category;
    if (validated.tags !== undefined) doc.tags = validated.tags;
    if (validated.description !== undefined) doc.description = validated.description;

    await doc.save();

    await auditService.logEvent({
      actor: req.user,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.DOC_METADATA_UPDATE,
      documentId: doc._id,
      documentTitle: doc.title,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
      metadata: {
        changes: {
          titleChanged: oldTitle !== doc.title,
          categoryChanged: oldCategory !== doc.category,
        },
      },
    });

    res.json({
      success: true,
      message: 'Document metadata updated successfully.',
      document: {
        id: doc._id,
        title: doc.title,
        category: doc.category,
        tags: doc.tags,
        description: doc.description,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createDownloadTicket(req, res, next) {
  try {
    // req.document loaded via requireDocumentAccess('read')
    const { purpose = 'download' } = req.query;

    const ticketId = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 1000); // 60 seconds TTL

    const ticket = new DownloadTicket({
      ticketId,
      documentId: req.document._id,
      userId: req.user._id,
      purpose,
      used: false,
      expiresAt,
    });
    await ticket.save();

    res.json({
      success: true,
      ticket: ticketId,
      expiresAt,
      purpose,
    });
  } catch (err) {
    next(err);
  }
}

export async function downloadDocument(req, res, next) {
  try {
    const { ticket: ticketId } = req.query;
    let document = null;
    let user = req.user;

    // If ticket provided in query
    if (ticketId) {
      const ticket = await DownloadTicket.findOne({
        ticketId,
        used: false,
        expiresAt: { $gt: new Date() },
      });

      if (!ticket) {
        return res.status(403).json({
          success: false,
          error: 'Download ticket is invalid, expired, or has already been used.',
        });
      }

      // Purpose check: ticket purpose must be 'download'
      if (ticket.purpose !== 'download') {
        return res.status(403).json({
          success: false,
          error: 'Ticket purpose mismatch: This ticket was not issued for file download.',
        });
      }

      // If user is authenticated, verify ticket was issued to this user
      if (req.user && ticket.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Ticket does not belong to authenticated user.',
        });
      }

      // Mark ticket as immediately used (single-use ticket)
      ticket.used = true;
      ticket.usedAt = new Date();
      await ticket.save();

      // Perform a fresh permission check against the latest document state!
      document = await Document.findOne({ _id: ticket.documentId, isDeleted: false });
      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found or has been deleted.',
        });
      }

      // Verify current access permission (ensures revocation takes immediate effect!)
      const userIdStr = ticket.userId.toString();
      const isOwner = document.owner.toString() === userIdStr;
      const hasAcl = document.acls.some((a) => a.user.toString() === userIdStr);

      if (!isOwner && !hasAcl) {
        await auditService.logEvent({
          targetUserId: ticket.userId,
          action: AUDIT_ACTIONS.DOC_ACCESS_DENIED,
          documentId: document._id,
          documentTitle: document.title,
          outcome: AUDIT_OUTCOMES.DENIED,
          reason: 'Permission was revoked prior to download ticket redemption.',
          correlationId: req.correlationId,
        });

        return res.status(403).json({
          success: false,
          error: 'Access denied: Access permissions for this document have been revoked.',
        });
      }
    } else {
      // Direct authenticated download (document attached by requireDocumentAccess middleware)
      document = req.document;
    }

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found.',
      });
    }

    // Verify file exists in storage
    const exists = await storageService.fileExists(document.storageKey);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Stored document file was not found on disk.',
      });
    }

    // Stream file
    const stream = storageService.createReadStream(document.storageKey);

    // Sanitize download filename for Content-Disposition header
    const safeFilename = encodeURIComponent(document.originalFilename);
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);
    res.setHeader('Content-Length', document.size);

    // Log download event
    await auditService.logEvent({
      actor: user || null,
      actorEmail: user ? user.email : 'TICKET_USER',
      action: AUDIT_ACTIONS.DOC_DOWNLOAD,
      documentId: document._id,
      documentTitle: document.title,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
    });

    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

export async function previewDocument(req, res, next) {
  try {
    const { ticket: ticketId } = req.query;
    let document = null;
    let user = req.user;

    // If ticket provided in query
    if (ticketId) {
      const ticket = await DownloadTicket.findOne({
        ticketId,
        used: false,
        expiresAt: { $gt: new Date() },
      });

      if (!ticket) {
        return res.status(403).json({
          success: false,
          error: 'Preview ticket is invalid, expired, or has already been used.',
        });
      }

      // Purpose check: ticket purpose must be 'preview'
      if (ticket.purpose !== 'preview') {
        return res.status(403).json({
          success: false,
          error: 'Ticket purpose mismatch: This ticket was not issued for preview.',
        });
      }

      // If user is authenticated, verify ticket was issued to this user
      if (req.user && ticket.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Ticket does not belong to authenticated user.',
        });
      }

      // Mark ticket as immediately used (single-use ticket)
      ticket.used = true;
      ticket.usedAt = new Date();
      await ticket.save();

      // Perform a fresh permission check against the latest document state!
      document = await Document.findOne({ _id: ticket.documentId, isDeleted: false });
      if (!document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found or has been deleted.',
        });
      }

      // Verify current access permission (ensures revocation takes immediate effect!)
      const userIdStr = ticket.userId.toString();
      const isOwner = document.owner.toString() === userIdStr;
      const hasAcl = document.acls.some((a) => a.user.toString() === userIdStr);

      if (!isOwner && !hasAcl) {
        await auditService.logEvent({
          targetUserId: ticket.userId,
          action: AUDIT_ACTIONS.DOC_ACCESS_DENIED,
          documentId: document._id,
          documentTitle: document.title,
          outcome: AUDIT_OUTCOMES.DENIED,
          reason: 'Permission was revoked prior to preview ticket redemption.',
          correlationId: req.correlationId,
        });

        return res.status(403).json({
          success: false,
          error: 'Access denied: Access permissions for this document have been revoked.',
        });
      }
    } else {
      document = req.document; // validated via requireDocumentAccess('read')
    }

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found.',
      });
    }

    const exists = await storageService.fileExists(document.storageKey);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'File not found on disk.',
      });
    }

    const stream = storageService.createReadStream(document.storageKey);
    const safeFilename = encodeURIComponent(document.originalFilename);

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Audit preview event
    await auditService.logEvent({
      actor: user || null,
      actorEmail: user ? user.email : 'TICKET_USER',
      action: AUDIT_ACTIONS.DOC_PREVIEW,
      documentId: document._id,
      documentTitle: document.title,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
    });

    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

export async function deleteDocument(req, res, next) {
  try {
    // req.document loaded via requireDocumentAccess & requireDocumentOwner
    const doc = req.document;
    doc.isDeleted = true;
    await doc.save();

    // Clean up physical file storage
    await storageService.deleteFile(doc.storageKey);

    await auditService.logEvent({
      actor: req.user,
      actorEmail: req.user.email,
      action: AUDIT_ACTIONS.DOC_DELETE,
      documentId: doc._id,
      documentTitle: doc.title,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      correlationId: req.correlationId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown',
    });

    res.json({
      success: true,
      message: 'Document successfully deleted.',
    });
  } catch (err) {
    next(err);
  }
}
