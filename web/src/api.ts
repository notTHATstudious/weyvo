// Typed client for the Weyvo API. Requests go to same-origin /api (proxied to Spring Boot in development).
import type { Scene } from './mocks/data';

export type Kind = 'FULL' | 'SHORT';
export type ShortTag = 'WEEKEND' | 'ONE_NIGHT' | 'LONG_DRIVE' | 'DAY_TRIP';
export type Visibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE';

export interface Me { id: number; username: string; displayName: string; bio: string | null; emailVerified: boolean }
export interface PublicUser { username: string; displayName: string; bio: string | null; followers: number; following: number; followedByMe: boolean }
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
export type NotificationType = 'FOLLOW' | 'BEEN' | 'WANT' | 'QUESTION' | 'ANSWER';
export interface Notification {
  id: number; type: NotificationType; actor: Author; trip: { slug: string; title: string } | null; read: boolean; createdAt: string;
}
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
export interface Author { username: string; displayName: string }
export interface PhotoRef { id: number; url: string; thumbUrl: string; width: number; height: number }
export interface Section { heading: string | null; body: string; photoCaption: string | null; photo: PhotoRef | null }

export interface TripCard {
  id: number; slug: string; kind: Kind; shortTag: ShortTag | null; title: string; place: string;
  author: Author; visibility: Visibility; status: 'DRAFT' | 'PUBLISHED'; publishedAt: string | null;
  cover: PhotoRef | null;
  reactions: Reactions;
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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  const isForm = body instanceof FormData;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      // FormData sets its own multipart boundary header.
      headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach Weyvo right now. Check your connection.", 0);
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
  verifyEmail: (code: string) => request<Me>('POST', '/auth/verify-email', { code }),
  resendCode: () => request<void>('POST', '/auth/verify-email/resend'),
  forgotPassword: (email: string) => request<void>('POST', '/auth/password/forgot', { email }),
  resetPassword: (email: string, code: string, password: string) => request<Me>('POST', '/auth/password/reset', { email, code, password }),

  feed: (kind?: Kind) => request<TripCard[]>('GET', `/trips${kind ? `?kind=${kind}` : ''}`),
  trip: (slug: string) => request<TripView>('GET', `/trips/${encodeURIComponent(slug)}`),
  user: (username: string) => request<PublicUser>('GET', `/users/${encodeURIComponent(username)}`),
  userTrips: (username: string) => request<TripCard[]>('GET', `/users/${encodeURIComponent(username)}/trips`),
  myTrips: () => request<TripCard[]>('GET', '/me/trips'),
  myPlan: () => request<PlanUsage>('GET', '/me/plan'),
  billingPlans: () => request<BillingPlans>('GET', '/billing/plans'),
  createOrder: (period: Period) => request<PaymentOrder>('POST', '/billing/orders', { period }),
  verifyPayment: (orderId: string, paymentId: string, signature: string) => request<PlanUsage>('POST', '/billing/verify', { orderId, paymentId, signature }),
  questions: (tripId: number) => request<Questions>('GET', `/trips/${tripId}/questions`),
  ask: (tripId: number, text: string) => request<Question>('POST', `/trips/${tripId}/questions`, { text }),
  answer: (questionId: number, text: string) => request<Question>('PUT', `/questions/${questionId}/answer`, { text }),
  setHidden: (questionId: number, hidden: boolean) => request<Question>(hidden ? 'PUT' : 'DELETE', `/questions/${questionId}/hidden`),
  deleteQuestion: (questionId: number) => request<void>('DELETE', `/questions/${questionId}`),
  report: (questionId: number, reason: ReportReason) => request<void>('POST', `/questions/${questionId}/reports`, { reason }),
  notifications: () => request<Notification[]>('GET', '/me/notifications'),
  unreadCount: () => request<{ count: number }>('GET', '/me/notifications/unread-count'),
  markNotificationsRead: () => request<void>('POST', '/me/notifications/read'),
  followingFeed: () => request<TripCard[]>('GET', '/me/following'),
  myList: (type: 'save' | 'want') => request<TripCard[]>('GET', `/me/reactions/${type}`),
  react: (tripId: number, type: ReactionType, on: boolean) => request<Reactions>(on ? 'PUT' : 'DELETE', `/trips/${tripId}/reactions/${type}`),
  follow: (username: string, on: boolean) => request<FollowStats>(on ? 'PUT' : 'DELETE', `/users/${encodeURIComponent(username)}/follow`),
  createTrip: (b: TripInput) => request<TripView>('POST', '/trips', b),
  updateTrip: (id: number, b: TripInput) => request<TripView>('PUT', `/trips/${id}`, b),
  deleteTrip: (id: number) => request<void>('DELETE', `/trips/${id}`),
  deletePhoto: (tripId: number, photoId: number) => request<void>('DELETE', `/trips/${tripId}/photos/${photoId}`),
  updateProfile: (displayName: string, bio: string) => request<{ username: string; displayName: string; bio: string | null }>('PUT', '/me/profile', { displayName, bio }),
  changePassword: (currentPassword: string, newPassword: string) => request<void>('POST', '/auth/password/change', { currentPassword, newPassword }),
  deleteAccount: (password: string) => request<void>('DELETE', '/me', { password }),
  publishTrip: (id: number) => request<TripView>('POST', `/trips/${id}/publish`),
  uploadPhoto: (tripId: number, file: File, role: 'COVER' | 'SECTION', position = 0) => {
    const form = new FormData();
    form.append('file', file);
    form.append('role', role);
    form.append('position', String(position));
    return request<PhotoRef>('POST', `/trips/${tripId}/photos`, form);
  },
};

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
