export const validOfferUrl = (url: string): string | undefined => {
  if (!/^https?:\/\//i.test(url)) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
};
