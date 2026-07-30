const storageKey = 'jobagent-theme';

const currentTheme = (): 'light' | 'dark' => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

export const initThemeToggle = (): void => {
  const toggle = document.querySelector<HTMLButtonElement>('#theme-toggle');
  const label = document.querySelector<HTMLElement>('.theme-toggle-label');
  if (!toggle || !label) return;

  const render = (): void => {
    const isDark = currentTheme() === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? 'Activar modo claro' : 'Activar modo oscuro');
    label.textContent = isDark ? 'Modo claro' : 'Modo oscuro';
  };

  toggle.addEventListener('click', () => {
    const nextTheme = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(storageKey, nextTheme);
    render();
  });

  render();
};
