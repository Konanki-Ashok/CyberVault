import mongoose from 'mongoose';
import { PERMISSIONS } from '../constants/index.js';

const AclGrantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    permission: {
      type: String,
      enum: Object.values(PERMISSIONS),
      required: true,
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    grantedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const DocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
      maxlength: 255,
      index: true,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
    },
    storageKey: {
      type: String,
      required: true,
      unique: true,
    },
    storageType: {
      type: String,
      enum: ['local', 's3'],
      default: 'local',
    },
    mimeType: {
      type: String,
      required: true,
      index: true,
    },
    size: {
      type: Number,
      required: true,
      min: 1,
    },
    fileHash: {
      type: String,
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      default: 'General',
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    acls: [AclGrantSchema],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound text index for search
DocumentSchema.index({
  title: 'text',
  description: 'text',
  category: 'text',
  tags: 'text',
});

export const Document = mongoose.model('Document', DocumentSchema);
