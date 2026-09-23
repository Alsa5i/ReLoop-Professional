const path = require('path');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}

const isProduction = process.env.NODE_ENV === 'production';
const insecure = value => !value || /replace.with|change.me|example\.com|demo@|password123|local.only|secret.change|^reloop.dev.secret/i.test(value);
if(isProduction && (insecure(process.env.SESSION_SECRET) || process.env.SESSION_SECRET.length < 48)) throw Error('Production requires a unique SESSION_SECRET of at least 48 characters.');
if(isProduction && (insecure(process.env.OWNER_PASSWORD) || process.env.OWNER_PASSWORD.length < 14 || insecure(process.env.OWNER_EMAIL))) throw Error('Production requires genuine OWNER_EMAIL and a strong OWNER_PASSWORD (14+ characters).');

module.exports = {
  appName: 'ReLoop',
  tagline: 'Recycle smarter. Keep materials in the loop.',
  port: Number(process.env.PORT || 3000),
  isProduction,
  dbPath: process.env.DATABASE_PATH || process.env.DB_PATH || path.join(__dirname, '..', 'data.db'),
  sessionSecret: process.env.SESSION_SECRET || (isProduction ? '' : 'reloop-dev-secret-change-before-production'),
  ownerEmail: String(process.env.OWNER_EMAIL || '').trim().toLowerCase(),
  ownerPassword: String(process.env.OWNER_PASSWORD || ''),
  ownerName: String(process.env.OWNER_NAME || 'ReLoop Owner').trim(),
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  uploadLimitBytes: Number(process.env.UPLOAD_LIMIT_BYTES || 2 * 1024 * 1024),
  roles: ['owner', 'admin', 'collector', 'partner', 'customer'],
  pickupStatuses: ['pending','approved','assigned','accepted','en_route','arrived','collected','delivered','verified','completed','cancelled'],
  paymentStatuses: ['pending','paid','failed','cancelled','refunded']
};
