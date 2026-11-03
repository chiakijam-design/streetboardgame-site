export const OPERATIONS_PAGE_SIZE = 50;

export function submissionPageOptions(url) {
  const raw = url.searchParams.get('submissionOffset');
  if (raw === null) return null; // Preserve the existing overview contract.
  if (!/^\d{1,8}$/.test(raw)) throw Object.assign(new Error('submission-page-invalid'), { status: 400 });
  return { offset: Number(raw), limit: OPERATIONS_PAGE_SIZE };
}

export function pageWindow(items, page, size = OPERATIONS_PAGE_SIZE) {
  const total = items.length;
  const lastPage = Math.max(0, Math.ceil(total / size) - 1);
  const currentPage = Math.max(0, Math.min(Number.isInteger(page) ? page : 0, lastPage));
  const start = currentPage * size;
  return { page: currentPage, start, total, items: items.slice(start, start + size), hasPrevious: currentPage > 0, hasNext: start + size < total };
}
