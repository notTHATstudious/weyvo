// Typed client for the Weyvo API. Requests go to same-origin /api (proxied to Spring Boot in development).
import type { Scene } from './mocks/data';

export type Kind = 'FULL' | 'SHORT';
export type ShortTag = 'WEEKEND' | 'ONE_NIGHT' | 'LONG_DRIVE' | 'DAY_TRIP';
export type Visibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE';

export interface Me { id: number; username: string; displayName: string; bio: string | null; emailVerified: boolean; avatarUrl: string | null; admin: boolean }
export interface PublicUser { username: string; displayName: string; bio: string | null; followers: number; following: number; followedByMe: boolean; premium: boolean; avatarUrl: string | null; blockedByMe: boolean }
export interface FollowStats { followers: number; following: number; followedByMe: boolean }
export type ReactionType = 'been' | 'want' | 'save';
export type QuestionStatus = 'VISIBLE' | 'HIDDEN_BY_AUTHOR' | 'HIDDEN_BY_REPORTS';
export interface Question {
  id: number; body: string; asker: Author; answer: string | null; answeredAt: string | null; createdAt: string;
  /** Only filled in for the story's author. */
  status: QuestionStatus | null; mine: boolean;
}
export interface Questions { locked: boolean; count: number; items: Question[] }
export type ReportReason = 'SPAM' | 'ABUSE' | 'OFF_TOPIC' | 'OTHER';
export type NotificationType = 'FOLLOW' | 'BEEN' | 'WANT' | 'QUESTION' | 'ANSWER' | 'COMMENT' | 'REPLY';
export interface Comment {
  id: number; parentId: number | null; body: string; author: Author; createdAt: string;
  /** Only filled in for the story's author. */
  status: QuestionStatus | null; mine: boolean; replies: Comment[];
}
export interface Notification {
  id: number; type: NotificationType; actor: Author; trip: { slug: string; title: string } | null; read: boolean; createdAt: string;
}
export interface MapPin { placeSlug: string; name: string; country: string | null; lat: number; lng: number; trips: { slug: string; title: string }[] }
/** want is null unless it's your own map. */
export interface TravelMapData { been: MapPin[]; want: MapPin[] | null; countries: number; places: number }
export interface PlaceSummary { slug: string; name: string; country: string | null; lat: number; lng: number; stories: number; shorts: number }
export interface PlaceDetail {
  slug: string; name: string; country: string | null; lat: number; lng: number;
  stories: number; shorts: number; wantToGo: number; months: number[]; trips: TripCard[]; reactions: PlaceReactions;
}
export interface PlaceReactions { been: number; want: number; beenByMe: boolean; wantByMe: boolean }
export interface PlanLimits { fullTripSections: number; shortStoryPhotos: number; totalPhotos: number; uploadsPerHour: number }
export interface PlanUsage { plan: 'FREE' | 'PREMIUM'; limits: PlanLimits; photosUsed: number; uploadsLastHour: number; premiumUntil: string | null }
export type Period = 'MONTH' | 'YEAR';
export interface BillingPlans {
  keyId: string | null; available: boolean;
  options: { period: Period; amountPaise: number; currency: string; label: string }[];
  free: PlanLimits; premium: PlanLimits;
}
export interface PaymentOrder { orderId: string; amountPaise: number; currency: string; keyId: string; period: Period }
export interface Reactions { been: number; want: number; beenByMe: boolean; wantByMe: boolean; savedByMe: boolean }
export interface Author { username: string; displayName: string; avatarUrl: string | null }
export interface PhotoRef { id: number; url: string; thumbUrl: string; width: number; height: number }
export interface Section { heading: string | null; body: string; photoCaption: string | null; photo: PhotoRef | null }

export interface TripCard {
  id: number; slug: string; kind: Kind; shortTag: ShortTag | null; title: string; place: string;
  author: Author; visibility: Visibility; status: 'DRAFT' | 'PUBLISHED'; publishedAt: string | null;
  cover: PhotoRef | null;
  reactions: Reactions;
}

export interface AdminStats {
  users: { total: number; verified: number; premium: number; suspended: number };
  active: { now: number; today: number; week: number; month: number };
  signups: { today: number; week: number; month: number };
  stories: { published: number; full: number; shorts: number; drafts: number };
  engagement: { storiesPublished: number; comments: number; questions: number; reactions: number; saves: number; follows: number; shares: number };
  retention: { days: number; cohort: number; returned: number }[];
  daily: { day: string; signups: number; active: number; stories: number }[];
  openReports: number; generatedAt: string;
  system: { heapUsedMb: number; heapMaxMb: number; uptimeMinutes: number; databaseMb: number; photos: number };
}
export interface AdminUser {
  username: string; displayName: string; email: string; status: 'ACTIVE' | 'SUSPENDED'; premium: boolean; admin: boolean;
  verified: boolean; joinedAt: string; lastSeenAt: string | null; stories: number;
}
export interface SearchResults {
  people: { username: string; displayName: string; avatarUrl: string | null }[];
  places: { slug: string; name: string; country: string | null; stories: number }[];
  stories: TripCard[];
}
export interface BlockedUser { username: string; displayName: string; avatarUrl: string | null }
export interface AdminReport {
  kind: 'TRIP' | 'COMMENT' | 'QUESTION'; id: number; text: string | null; author: string; tripSlug: string; tripTitle: string;
  hidden: boolean; reports: number; reasons: ReportReason[]; lastReportedAt: string;
}

export interface TripView extends TripCard {
  startDate: string | null; endDate: string | null; intro: string | null;
  sections: Section[]; totalSections: number; moments: string[]; finalNote: string | null;
  locked: boolean; owner: boolean;
}

export interface TripInput {
  kind: Kind; shortTag?: ShortTag | null; title: string; place: string;
  startDate?: string | null; endDate?: string | null; intro?: string | null; finalNote?: string | null;
  visibility: Visibility; sections: { heading?: string | null; body: string; photoCaption?: string | null }[]; moments?: string[];
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly fields: Record<string, string> = {}) {
    super(message);
  }
}

// ---- waking a sleeping server ----
// The free API host sleeps when idle and takes up to a minute to start. Requests that are slow or hit a
// gateway error while it starts are retried, and WakeBanner tells the reader what's happening.

const slowListeners = new Set<(slow: boolean) => void>();
let slowRequests = 0;

export function onSlowRequests(listener: (slow: boolean) => void) {
  slowListeners.add(listener);
  return () => { slowListeners.delete(listener); };
}

function markSlow(delta: number) {
  const before = slowRequests > 0;
  slowRequests += delta;
  if (before !== slowRequests > 0) slowListeners.forEach((l) => l(slowRequests > 0));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  // POST may create something, so it's never repeated; the rest are safe to retry.
  const retryable = method !== 'POST';
  const giveUpAt = Date.now() + 90_000;
  let slow = false;
  const slowTimer = setTimeout(() => { slow = true; markSlow(1); }, 4000);
  let res: Response | null = null;
  try {
    for (let attempt = 1; ; attempt++) {
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 30_000);
      try {
        res = await fetch(`/api${path}`, {
          method,
          credentials: 'same-origin',
          signal: abort.signal,
          // FormData sets its own multipart boundary header.
          headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        });
      } catch {
        res = null;
      } finally {
        clearTimeout(timeout);
      }
      const starting = !res || res.status === 502 || res.status === 503 || res.status === 504;
      // No connection at all: say so now rather than retrying for a minute.
      if (!starting || !retryable || Date.now() > giveUpAt || navigator.onLine === false) break;
      await sleep(Math.min(2000 * attempt, 8000));
    }
  } finally {
    clearTimeout(slowTimer);
    if (slow) markSlow(-1);
  }
  if (!res || res.status === 502 || res.status === 503 || res.status === 504) {
    throw new ApiError(navigator.onLine === false ? "You're offline. Check your connection." : 'Weyvo is waking up. Try again in a moment.', 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Something went wrong. Try again.', res.status, data.fields);
  return data as T;
}

export const api = {
  me: () => request<Me>('GET', '/auth/me'),
  signup: (b: { email: string; password: string; username: string; displayName: string }) => request<Me>('POST', '/auth/signup', b),
  login: (b: { email: string; password: string }) => request<Me>('POST', '/auth/login', b),
  logout: () => request<void>('POST', '/auth/logout'),
  logoutEverywhere: () => request<void>('POST', '/auth/logout-everywhere'),
  verifyEmail: (code: string) => request<Me>('POST', '/auth/verify-email', { code }),
  resendCode: () => request<void>('POST', '/auth/verify-email/resend'),
  forgotPassword: (email: string) => request<void>('POST', '/auth/password/forgot', { email }),
  resetPassword: (email: string, code: string, password: string) => request<Me>('POST', '/auth/password/reset', { email, code, password }),

  search: (q: string) => request<SearchResults>('GET', `/search?q=${encodeURIComponent(q)}`),
  suggestedTravellers: () => request<{ username: string; displayName: string; avatarUrl: string | null; stories: number }[]>('GET', '/suggestions/travellers'),
  pushKey: () => request<{ publicKey: string }>('GET', '/push/key'),
  pushSubscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) => request<void>('PUT', '/me/push', sub),
  pushUnsubscribe: (endpoint: string) => request<void>('DELETE', '/me/push', { endpoint }),
  thisWeek: () => request<TripCard[]>('GET', '/trips/this-week'),
  feed: (kind?: Kind) => request<TripCard[]>('GET', `/trips${kind ? `?kind=${kind}` : ''}`),
  trip: (slug: string) => request<TripView>('GET', `/trips/${encodeURIComponent(slug)}`),
  user: (username: string) => request<PublicUser>('GET', `/users/${encodeURIComponent(username)}`),
  userTrips: (username: string) => request<TripCard[]>('GET', `/users/${encodeURIComponent(username)}/trips`),
  myTrips: () => request<TripCard[]>('GET', '/me/trips'),
  myPlan: () => request<PlanUsage>('GET', '/me/plan'),
  travelMap: (username: string) => request<TravelMapData>('GET', `/users/${encodeURIComponent(username)}/map`),
  places: () => request<PlaceSummary[]>('GET', '/places'),
  place: (slug: string) => request<PlaceDetail>('GET', `/places/${encodeURIComponent(slug)}`),
  markPlace: (slug: string, type: 'been' | 'want') => request<PlaceReactions>('PUT', `/places/${encodeURIComponent(slug)}/reactions/${type}`),
  unmarkPlace: (slug: string, type: 'been' | 'want') => request<PlaceReactions>('DELETE', `/places/${encodeURIComponent(slug)}/reactions/${type}`),
  billingPlans: () => request<BillingPlans>('GET', '/billing/plans'),
  createOrder: (period: Period) => request<PaymentOrder>('POST', '/billing/orders', { period }),
  verifyPayment: (orderId: string, paymentId: string, signature: string) => request<PlanUsage>('POST', '/billing/verify', { orderId, paymentId, signature }),
  questions: (tripId: number) => request<Questions>('GET', `/trips/${tripId}/questions`),
  ask: (tripId: number, text: string) => request<Question>('POST', `/trips/${tripId}/questions`, { text }),
  answer: (questionId: number, text: string) => request<Question>('PUT', `/questions/${questionId}/answer`, { text }),
  setHidden: (questionId: number, hidden: boolean) => request<Question>(hidden ? 'PUT' : 'DELETE', `/questions/${questionId}/hidden`),
  deleteQuestion: (questionId: number) => request<void>('DELETE', `/questions/${questionId}`),
  report: (questionId: number, reason: ReportReason) => request<void>('POST', `/questions/${questionId}/reports`, { reason }),
  comments: (tripId: number) => request<{ locked: boolean; count: number; items: Comment[] }>('GET', `/trips/${tripId}/comments`),
  postComment: (tripId: number, text: string, parentId?: number) => request<Comment>('POST', `/trips/${tripId}/comments`, { text, parentId: parentId ?? null }),
  setCommentHidden: (id: number, hidden: boolean) => request<Comment>(hidden ? 'PUT' : 'DELETE', `/comments/${id}/hidden`),
  deleteComment: (id: number) => request<void>('DELETE', `/comments/${id}`),
  reportComment: (id: number, reason: ReportReason) => request<void>('POST', `/comments/${id}/reports`, { reason }),
  notifications: () => request<Notification[]>('GET', '/me/notifications'),
  unreadCount: () => request<{ count: number }>('GET', '/me/notifications/unread-count'),
  markNotificationsRead: () => request<void>('POST', '/me/notifications/read'),
  followingFeed: () => request<TripCard[]>('GET', '/me/following'),
  myList: (type: 'save' | 'want') => request<TripCard[]>('GET', `/me/reactions/${type}`),
  react: (tripId: number, type: ReactionType, on: boolean) => request<Reactions>(on ? 'PUT' : 'DELETE', `/trips/${tripId}/reactions/${type}`),
  block: (username: string, on: boolean) => request<void>(on ? 'PUT' : 'DELETE', `/users/${encodeURIComponent(username)}/block`),
  blocked: () => request<BlockedUser[]>('GET', '/me/blocked'),
  reportTrip: (tripId: number, reason: ReportReason) => request<void>('POST', `/trips/${tripId}/reports`, { reason }),
  adminReports: () => request<AdminReport[]>('GET', '/admin/reports'),
  adminDecide: (kind: AdminReport['kind'], id: number, decision: 'hide' | 'keep') => request<void>('POST', `/admin/reports/${kind.toLowerCase()}/${id}/${decision}`),
  adminStats: () => request<AdminStats>('GET', '/admin/stats'),
  adminUsers: (q: string) => request<AdminUser[]>('GET', `/admin/users?q=${encodeURIComponent(q)}`),
  adminDeletePhotos: (username: string, confirm: string) => request<{ deleted: number }>('POST', '/admin/photos/delete', { username: username || null, confirm }),
  adminRestore: (username: string) => request<void>('POST', `/admin/users/${encodeURIComponent(username)}/restore`),
  recordShare: (tripId: number, kind: 'LINK' | 'IMAGE') => request<void>('POST', `/trips/${tripId}/shares`, { kind }),
  adminSuspend: (username: string) => request<void>('POST', `/admin/users/${encodeURIComponent(username)}/suspend`),
  follow: (username: string, on: boolean) => request<FollowStats>(on ? 'PUT' : 'DELETE', `/users/${encodeURIComponent(username)}/follow`),
  createTrip: (b: TripInput) => request<TripView>('POST', '/trips', b),
  updateTrip: (id: number, b: TripInput) => request<TripView>('PUT', `/trips/${id}`, b),
  deleteTrip: (id: number) => request<void>('DELETE', `/trips/${id}`),
  deletePhoto: (tripId: number, photoId: number) => request<void>('DELETE', `/trips/${tripId}/photos/${photoId}`),
  uploadAvatar: async (file: File) => {
    const form = new FormData();
    form.append('file', await shrinkPhoto(file, 800));
    return request<{ avatarUrl: string }>('PUT', '/me/avatar', form);
  },
  removeAvatar: () => request<void>('DELETE', '/me/avatar'),
  updateProfile: (displayName: string, bio: string) => request<{ username: string; displayName: string; bio: string | null }>('PUT', '/me/profile', { displayName, bio }),
  changePassword: (currentPassword: string, newPassword: string) => request<void>('POST', '/auth/password/change', { currentPassword, newPassword }),
  deleteAccount: (password: string) => request<void>('DELETE', '/me', { password }),
  publishTrip: (id: number) => request<TripView>('POST', `/trips/${id}/publish`),
  uploadPhoto: async (tripId: number, file: File, role: 'COVER' | 'SECTION', position = 0) => {
    const form = new FormData();
    form.append('file', await shrinkPhoto(file));
    form.append('role', role);
    form.append('position', String(position));
    return request<PhotoRef>('POST', `/trips/${tripId}/photos`, form);
  },
};

/**
 * Phone photos are often 5-15 MB, but the server keeps at most 2000 px. Resizing on the device first sends a
 * fraction of the data, so uploads finish much faster on mobile. The re-encode also drops location data;
 * the server still checks, resizes and strips every photo itself. Falls back to the original on any problem.
 */
export async function shrinkPhoto(file: File, max = 2000): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Quick checks before uploading; the server re-checks everything. */
export function photoProblem(file: File): string | null {
  if (!['image/jpeg', 'image/png'].includes(file.type)) return 'Use a JPEG or PNG photo';
  if (file.size > 15 * 1024 * 1024) return 'That photo is over 15 MB. Choose a smaller one';
  return null;
}

export const TAG_LABEL: Record<ShortTag, string> = {
  WEEKEND: 'Weekend', ONE_NIGHT: 'One night', LONG_DRIVE: 'Long drive', DAY_TRIP: 'Day trip',
};

const SCENES: Scene[] = ['mountain', 'sea', 'road', 'city', 'desert', 'forest'];

/** Stable illustrated cover for a trip until photo uploads exist. */
export const sceneFor = (id: number): Scene => SCENES[Math.abs(id) % SCENES.length];

/** One letter and a stable colour for an avatar circle. */
export function avatarOf(name: string) {
  const colors = ['#7A4E3F', '#2F6573', '#8E9A5B', '#6E8F6A', '#4A4F73', '#9C5733'];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return { initial: (name.trim()[0] ?? '?').toUpperCase(), color: colors[Math.abs(h) % colors.length] };
}
