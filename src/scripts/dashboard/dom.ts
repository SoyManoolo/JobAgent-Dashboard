import type { DashboardElements } from './types';

export const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`No se encontró el elemento: ${selector}`);
  return element as T;
};

export const requiredChild = <T extends Element>(parent: ParentNode, selector: string): T => {
  const element = parent.querySelector(selector);
  if (!element) throw new Error(`No se encontró el elemento hijo: ${selector}`);
  return element as T;
};

export const getDashboardElements = (): DashboardElements => ({
  jobs: required<HTMLElement>('#jobs'),
  empty: required<HTMLElement>('#empty'),
  template: required<HTMLTemplateElement>('#job-template'),
  total: required<HTMLElement>('#total-count'),
  results: required<HTMLElement>('#results-count'),
  connection: required<HTMLElement>('#connection-status'),
  modal: required<HTMLDialogElement>('#detail-modal'),
  modalBody: required<HTMLElement>('#modal-body'),
  empresa: required<HTMLInputElement>('#empresa'),
  estado: required<HTMLSelectElement>('#estado'),
  perfil: required<HTMLSelectElement>('#perfil'),
  score: required<HTMLSelectElement>('#score'),
  sencilla: required<HTMLSelectElement>('#sencilla'),
  modalClose: required<HTMLButtonElement>('#modal-close'),
  clearFilters: required<HTMLButtonElement>('#clear-filters'),
  pagination: required<HTMLElement>('#pagination'),
  previousPage: required<HTMLButtonElement>('#previous-page'),
  nextPage: required<HTMLButtonElement>('#next-page'),
  pageInfo: required<HTMLElement>('#page-info'),
  loadState: required<HTMLElement>('#load-state'),
  errorState: required<HTMLElement>('#error-state'),
  errorMessage: required<HTMLElement>('#error-message'),
  retryLoad: required<HTMLButtonElement>('#retry-load'),
});
