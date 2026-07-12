import { deleteOfferById, fetchMockOffers, fetchOfferById, fetchOffers } from './api';
import { getDashboardElements } from './dom';
import { renderOfferDetail, renderOffers, createFiltersPredicate, setStatusText } from './render';
import { labels } from './shared';
import type { Offer } from './types';

export const initJobDashboard = (): void => {
  const elements = getDashboardElements();
  let offers: Offer[] = [];
  let usingMock = false;

  const currentFilters = () => ({
    empresa: elements.empresa.value,
    estado: elements.estado.value,
    perfil: elements.perfil.value,
    score: elements.score.value,
    sencilla: elements.sencilla.value,
  });

  const openDetail = async (id: string): Promise<void> => {
    const offer = usingMock ? offers.find((item) => item.id === id) : await fetchOfferById(id).catch(() => offers.find((item) => item.id === id));
    if (!offer) return;
    elements.modalBody.innerHTML = renderOfferDetail(offer, labels);
    elements.modal.showModal();
  };

  const deleteOffer = async (id: string): Promise<void> => {
    if (!confirm('¿Quieres eliminar esta oferta?')) return;

    if (!usingMock) {
      try {
        await deleteOfferById(id);
      } catch {
        alert('No se ha podido eliminar la oferta en la API.');
        return;
      }
    }

    offers = offers.filter((offer) => offer.id !== id);
    renderOffers(elements, offers, labels, openDetail, deleteOffer);
  };

  const loadOffers = async (): Promise<void> => {
    try {
      const data = await fetchOffers(currentFilters());
      offers = data.resultados ?? [];
      usingMock = false;
      setStatusText(elements, 'API conectada', false);
    } catch {
      const data = await fetchMockOffers();
      offers = data.resultados.filter(createFiltersPredicate(elements));
      usingMock = true;
      setStatusText(elements, 'Vista previa · datos simulados', true);
    }
    renderOffers(elements, offers, labels, openDetail, deleteOffer);
  };

  elements.modalClose.addEventListener('click', () => elements.modal.close());
  elements.modal.addEventListener('click', (event: MouseEvent) => {
    if (event.target === elements.modal) elements.modal.close();
  });
  document
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>('.filters input, .filters select')
    .forEach((control) => control.addEventListener('input', () => void loadOffers()));
  elements.clearFilters.addEventListener('click', () => {
    document
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>('.filters input, .filters select')
      .forEach((control) => {
        control.value = '';
      });
    void loadOffers();
  });

  void loadOffers();
};
