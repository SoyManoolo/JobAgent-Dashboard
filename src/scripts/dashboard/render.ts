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
};

export const renderOffers = (
  elements: DashboardElements,
  offers: Offer[],
  total: number,
  currentPage: number,
  pageLimit: number,
  labels: LabelMap,
  openDetail: (id: string) => void,
  deleteOffer: (id: string) => void,
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
    requiredChild<HTMLElement>(card, '.tags').innerHTML = `${tag(labels[(offer.perfil_recomendado ?? '') as LabelKey] || 'Sin perfil', 'profile')} ${tag(offer.aplicacion_sencilla ? 'Aplicación sencilla' : 'Con preguntas', offer.aplicacion_sencilla ? 'easy' : '')}`;

    card.addEventListener('click', () => openDetail(offer.id));
    card.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDetail(offer.id);
      }
    });

    requiredChild<HTMLButtonElement>(card, '.apply').addEventListener('click', (event: MouseEvent) => event.stopPropagation());
    requiredChild<HTMLButtonElement>(card, '.delete').addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation();
      deleteOffer(offer.id);
    });

    elements.jobs.append(fragment);
  });
};

export const renderOfferDetail = (offer: Offer, labels: LabelMap): string => {
  const keywords = (offer.keywords ?? []).map((word: string) => tag(word)).join('');
  const initials = escapeHtml(initialsFor(offer.empresa));

  return `<p class="eyebrow">${escapeHtml(offer.plataforma || 'Oferta')}</p><div class="modal-title"><div><span class="company-logo">${initials}</span></div><div><p>${escapeHtml(offer.empresa)}</p><h2>${escapeHtml(offer.titulo)}</h2><span class="location">${escapeHtml(offer.ubicacion || 'Ubicación no indicada')}</span></div></div><div class="modal-meta"><span class="status state-${escapeHtml(offer.estado)}">${escapeHtml(labels[offer.estado as LabelKey] || offer.estado)}</span><span class="score-inline">${offer.score_encaje ?? '—'} <small>score de encaje</small></span></div><section><h3>Resumen</h3><p>${escapeHtml(offer.resumen || offer.descripcion)}</p></section><section><h3>Descripción</h3><p>${escapeHtml(offer.descripcion)}</p></section><section><h3>Información</h3><dl><div><dt>Perfil recomendado</dt><dd>${escapeHtml(labels[(offer.perfil_recomendado ?? '') as LabelKey] || 'No definido')}</dd></div><div><dt>Senioridad</dt><dd>${escapeHtml(offer.seniority || 'No definida')}</dd></div><div><dt>Salario</dt><dd>${escapeHtml(offer.salario || 'No indicado')}</dd></div><div><dt>Aplicación</dt><dd>${offer.aplicacion_sencilla ? 'Sencilla' : 'Con preguntas'}</dd></div></dl></section>${keywords ? `<section><h3>Palabras clave</h3><div class="tags">${keywords}</div></section>` : ''}<div class="modal-actions"><button class="apply" type="button">Postularme</button><a href="${escapeHtml(offer.url)}" target="_blank" rel="noreferrer">Ver oferta original ↗</a></div>`;
};
