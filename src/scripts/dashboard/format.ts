export const escapeHtml = (text: string): string => {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  };
  return String(text).replace(/[&<>"']/g, (character: string) => entities[character] ?? character);
};

export const tag = (text: string, className = ''): string => `<span class="tag ${className}">${escapeHtml(text)}</span>`;

export const initialsFor = (text: string): string =>
  text
    .split(/\s+/)
    .map((part: string) => part[0])
    .join('')
    .slice(0, 2);
