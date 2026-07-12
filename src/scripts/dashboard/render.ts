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
  primaryAction: (offer: Offer) => void,
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
    apply.textContent = offer.aplicacion_sencilla ? 'Preparar solicitud' : 'Abrir oferta';
    apply.addEventListener('click', (event: MouseEvent) => { event.stopPropagation(); primaryAction(offer); });
    requiredChild<HTMLButtonElement>(card, '.delete').addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation();
      deleteOffer(offer.id);
    });

    elements.jobs.append(fragment);
  });
};

export const renderOfferDetail = (offer: Offer, labels: LabelMap): string => {
  const value = (item: string | number | null | undefined) => escapeHtml(String(item ?? 'No indicado'));
  const profile = labels[(offer.perfil_recomendado ?? '') as LabelKey] ?? 'No definido';
  const statuses = (Object.keys(labels) as LabelKey[]).filter((key) => ['extraida', 'analizada', 'pendiente_revision', 'lista_para_aplicar', 'aplicada', 'descartada', 'error'].includes(key)).map((key) => `<option value="${key}" ${offer.estado === key ? 'selected' : ''}>${labels[key]}</option>`).join('');
  const detail = (label: string, item: string | number | null | undefined) => `<div><dt>${label}</dt><dd>${value(item)}</dd></div>`;
  return `<p class="eyebrow">${value(offer.plataforma)}</p><div class="modal-title"><span class="company-logo">${escapeHtml(initialsFor(offer.empresa))}</span><div><p>${value(offer.empresa)}</p><h2>${value(offer.titulo)}</h2><span class="location">${value(offer.ubicacion)}</span></div></div><div class="modal-meta"><span class="status state-${offer.estado}">${labels[offer.estado]}</span><span class="score-inline">${offer.score_encaje ?? '—'} <small>score de encaje</small></span></div><section><h3>Resumen</h3><p>${value(offer.resumen || offer.descripcion)}</p></section><section><h3>Por qué encaja</h3><p>${value(offer.motivo_encaje || 'Sin análisis de encaje todavía.')}</p></section><section><h3>Información</h3><dl>${detail('Perfil recomendado', profile)}${detail('Senioridad', offer.seniority)}${detail('Idioma', offer.idioma_oferta)}${detail('Descubierta', new Date(offer.fecha_descubrimiento).toLocaleDateString('es-ES'))}${detail('Tipo de aplicación', offer.aplicacion_sencilla ? 'Solicitud sencilla' : 'Aplicación externa')}${detail('Salario', offer.salario)}</dl></section><section><h3>Scores por perfil</h3><dl>${detail('Backend', offer.score_backend)}${detail('Full stack', offer.score_fullstack)}${detail('IA', offer.score_ia)}</dl></section><section class="review"><h3>Revisión manual</h3><label>Estado<select id="detail-status">${statuses}</select></label><label>Notas<textarea id="detail-notes" rows="4">${escapeHtml(offer.notas ?? '')}</textarea></label><button id="save-detail" type="button">Guardar cambios</button></section>`;
};
