/**
 * Shares a link: the system share sheet on phones (WhatsApp, Instagram, Copy…), or a copy to the clipboard
 * elsewhere. Resolves to what happened so the caller can show "Link copied".
 */
export async function shareLink(url: string, title: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const absolute = new URL(url, window.location.origin).toString();
  if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title, url: absolute });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(absolute);
    return 'copied';
  } catch {
    return 'failed';
  }
}
