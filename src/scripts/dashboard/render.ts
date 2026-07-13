import { requiredChild } from './dom';
import type { DashboardElements, LabelMap, LabelKey, Offer } from './types';
import { escapeHtml, initialsFor, tag } from './format';

export const createFiltersPredicate = (elements: DashboardElements) => (offer: Offer): boolean => {
  return (
    (!elements.empresa.value || offer.empresa.toLowerCase().includes(elements.empresa.value.toLowerCase())) &&
    (!elements.estado.value || offer.estado === elements.estado.value) &&
    (!elements.perfil.value || offer.perfil_recomendado === elements.perfil.value) &&
    (!elements.score.value || (offer.score_encaje ?? 0) >= Number(elements.score.value)) &&
    (!elements.sencilla.value || offer.aplicacion_sencilla === (elements.sencilla.value === 'true'))
  );
};

export const setStatusText = (elements: DashboardElements, text: string, mock: boolean): void => {
  elements.connection.innerHTML = `<span></span>${text}`;
  elements.connection.classList.toggle('mock', mock);
  elements.mockNotice.hidden = !mock;
};
export const setLoading = (elements: DashboardElements, loading: boolean): void => { elements.loadState.hidden = !loading; elements.loadState.textContent = loading ? 'Cargando ofertas…' : ''; };
export const setError = (elements: DashboardElements, message = ''): void => { elements.errorState.hidden = !message; elements.errorMessage.textContent = message; };

export const renderOffers = (
  elements: DashboardElements,
  offers: Offer[],
  total: number,
  currentPage: number,
  pageLimit: number,
  labels: LabelMap,
  openDetail: (id: string) => void,
  deleteOffer: (id: string) => void,
  primaryAction: (offer: Offer) => void | Promise<void>,
): void => {
  elements.jobs.innerHTML = '';
  elements.total.textContent = String(total);
  elements.results.textContent = `${total} ${total === 1 ? 'oferta encontrada' : 'ofertas encontradas'}`;
  elements.empty.hidden = offers.length !== 0;
  const totalPages = Math.max(1, Math.ceil(total / pageLimit));
  elements.pagination.hidden = total === 0;
  elements.previousPage.disabled = currentPage <= 1;
  elements.nextPage.disabled = currentPage >= totalPages;
  elements.pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;

  offers.forEach((offer) => {
    const fragment = elements.template.content.cloneNode(true) as DocumentFragment;
    const card = requiredChild<HTMLElement>(fragment, '.job-card');
    card.dataset.id = offer.id;

    const initials = initialsFor(offer.empresa);
    requiredChild<HTMLElement>(card, '.company-logo').textContent = initials;
    requiredChild<HTMLElement>(card, '.company').textContent = offer.empresa;
    requiredChild<HTMLHeadingElement>(card, 'h2').textContent = offer.titulo;
    requiredChild<HTMLElement>(card, '.location').textContent = offer.ubicacion || 'Ubicación no indicada';
    requiredChild<HTMLElement>(card, '.summary').textContent = offer.resumen || offer.descripcion;

    const state = requiredChild<HTMLElement>(card, '.status');
    state.textContent = labels[offer.estado as LabelKey] || offer.estado;
    state.classList.add(`state-${offer.estado}`);

    requiredChild<HTMLElement>(card, '.score strong').textContent = String(offer.score_encaje ?? '—');
    requiredChild<HTMLElement>(card, '.tags').innerHTML = `${tag(labels[(offer.perfil_recomendado ?? '') as LabelKey] || 'Sin perfil', 'profile')} ${tag(offer.aplicacion_sencilla ? 'Solicitud sencilla' : 'Aplicación externa', offer.aplicacion_sencilla ? 'easy' : '')}`;

    card.addEventListener('click', () => openDetail(offer.id));
    card.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDetail(offer.id);
      }
    });

    const apply = requiredChild<HTMLButtonElement>(card, '.apply');
    apply.textContent = primaryActionLabel(offer);
    apply.addEventListener('click', (event: MouseEvent) => { event.stopPropagation(); primaryAction(offer); });
    requiredChild<HTMLButtonElement>(card, '.delete').addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation();
      deleteOffer(offer.id);
    });

    elements.jobs.append(fragment);
  });
};

const primaryActionLabel = (offer: Offer): string => {
  if (offer.estado === 'analizada') return 'Enviar a revisión';
  if (offer.estado === 'pendiente_revision') return 'Aprobar para aplicar';
  return offer.aplicacion_sencilla ? 'Preparar solicitud' : 'Abrir oferta';
};

const renderSection = (title: string, content: string, className = ''): string =>
  `<section${className ? ` class="${className}"` : ''}><h3>${title}</h3>${content}</section>`;

const renderDetail = (label: string, value: string): string => `<div><dt>${label}</dt><dd>${value}</dd></div>`;

const renderStatusOptions = (offer: Offer, labels: LabelMap): string => {
  const statuses: LabelKey[] = ['extraida', 'analizada', 'pendiente_revision', 'lista_para_aplicar', 'aplicada', 'descartada', 'error'];
  return statuses
    .map((status) => `<option value="${status}" ${offer.estado === status ? 'selected' : ''}>${labels[status]}</option>`)
    .join('');
};

const renderOfferHeader = (offer: Offer, labels: LabelMap, value: (item: string | number | null | undefined) => string): string => `
  <p class="eyebrow">${value(offer.plataforma)}</p>
  <div class="modal-title">
    <span class="company-logo">${escapeHtml(initialsFor(offer.empresa))}</span>
    <div><p>${value(offer.empresa)}</p><h2>${value(offer.titulo)}</h2><span class="location">${value(offer.ubicacion)}</span></div>
  </div>
  <div class="modal-meta">
    <span class="status state-${offer.estado}">${labels[offer.estado]}</span>
    <span class="score-inline">${offer.score_encaje ?? '—'} <small>score de encaje</small></span>
  </div>`;

const renderOfferInformation = (offer: Offer, profile: string, value: (item: string | number | null | undefined) => string): string =>
  renderSection('Información', `<dl>
    ${renderDetail('Perfil recomendado', value(profile))}
    ${renderDetail('Senioridad', value(offer.seniority))}
    ${renderDetail('Idioma', value(offer.idioma_oferta))}
    ${renderDetail('Descubierta', value(new Date(offer.fecha_descubrimiento).toLocaleDateString('es-ES')))}
    ${renderDetail('Tipo de aplicación', value(offer.aplicacion_sencilla ? 'Solicitud sencilla' : 'Aplicación externa'))}
    ${renderDetail('Salario', value(offer.salario))}
  </dl>`);

const renderScores = (offer: Offer, value: (item: string | number | null | undefined) => string): string =>
  renderSection('Scores por perfil', `<dl>
    ${renderDetail('Backend', value(offer.score_backend))}
    ${renderDetail('Full stack', value(offer.score_fullstack))}
    ${renderDetail('IA', value(offer.score_ia))}
  </dl>`);

const renderManualReview = (offer: Offer, labels: LabelMap): string => renderSection('Revisión manual', `
  <label>Estado<select id="detail-status">${renderStatusOptions(offer, labels)}</select></label>
  <label>Notas<textarea id="detail-notes" rows="4">${escapeHtml(offer.notas ?? '')}</textarea></label>
  <button id="save-detail" type="button">Guardar cambios</button>`, 'review');

export const renderOfferDetail = (offer: Offer, labels: LabelMap): string => {
  const value = (item: string | number | null | undefined) => escapeHtml(String(item ?? 'No indicado'));
  const profile = labels[(offer.perfil_recomendado ?? '') as LabelKey] ?? 'No definido';
  return [
    renderOfferHeader(offer, labels, value),
    renderSection('Resumen', `<p>${value(offer.resumen || offer.descripcion)}</p>`),
    renderSection('Por qué encaja', `<p>${value(offer.motivo_encaje || 'Sin análisis de encaje todavía.')}</p>`),
    renderOfferInformation(offer, profile, value),
    renderScores(offer, value),
    renderManualReview(offer, labels),
  ].join('');
};
