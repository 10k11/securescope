import mongoose from 'mongoose';
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    failedLogins: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    // SHA-256 hashes of valid refresh tokens (rotated on every use).
    refreshHashes: { type: [String], default: [], select: false },
  },
  { timestamps: true }
);

const targetSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    url: { type: String, required: true }, // normalized origin, e.g. https://example.com
    hostname: { type: String, required: true },
    verifyToken: { type: String, required: true },
    verified: { type: Boolean, default: false },
    verifiedAt: Date,
    verifiedMethod: { type: String, enum: ['dns', 'file', 'meta', null], default: null },
    scanIntervalHours: { type: Number, default: 0, min: 0, max: 720 },
    lastScore: { type: Number, default: null },
    lastGrade: { type: String, default: null },
    lastScanAt: Date,
  },
  { timestamps: true }
);
targetSchema.index({ owner: 1, url: 1 }, { unique: true });

const findingSchema = new Schema(
  {
    id: String,
    title: String,
    severity: { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'] },
    category: String,
    description: String,
    remediation: String,
    evidence: String,
  },
  { _id: false }
);

const scanSchema = new Schema(
  {
    target: { type: Schema.Types.ObjectId, ref: 'Target', required: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
    trigger: { type: String, enum: ['manual', 'scheduled'], default: 'manual' },
    score: Number,
    grade: String,
    counts: { type: Map, of: Number },
    findings: [findingSchema],
    durationMs: Number,
    error: String,
  },
  { timestamps: true }
);

const auditSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true },
    ip: String,
    meta: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const User = mongoose.model('User', userSchema);
export const Target = mongoose.model('Target', targetSchema);
export const Scan = mongoose.model('Scan', scanSchema);
export const Audit = mongoose.model('Audit', auditSchema);
