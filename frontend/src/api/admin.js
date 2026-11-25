import { request } from './client';

export function getReviews() {
  return request('/api/admin/reviews');
}

export function approveReview(id) {
  return request(`/api/admin/reviews/${id}/approve`, { method: 'POST' });
}

export function rejectReview(id) {
  return request(`/api/admin/reviews/${id}/reject`, { method: 'POST' });
}

export function getReports(status = 'OPEN') {
  return request(`/api/admin/reports?status=${encodeURIComponent(status)}`);
}

/** decision: 'UPHOLD' (it was a scam: recover the money) or 'DISMISS'. */
export function resolveReport(id, decision) {
  return request(`/api/admin/reports/${id}/resolve`, { method: 'POST', body: { decision } });
}
