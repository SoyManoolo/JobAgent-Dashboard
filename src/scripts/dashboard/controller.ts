import { deleteOfferById, fetchMockOffers, fetchOfferById, fetchOffers, PAGE_LIMIT, updateOfferById } from './api';
import { getDashboardElements } from './dom';
import { renderOfferDetail, renderOffers, createFiltersPredicate, setError, setLoading, setStatusText } from './render';
import { labels } from './shared';
import type { Offer } from './types';

export const initJobDashboard = (): void => {
  const elements = getDashboardElements();
  let offers: Offer[] = [];
  let usingMock = false;
  let totalOffers = 0;
  let currentPage = 1;
  let loading = false;

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
    const save = elements.modalBody.querySelector<HTMLButtonElement>('#save-detail');
    const status = elements.modalBody.querySelector<HTMLSelectElement>('#detail-status');
    const notes = elements.modalBody.querySelector<HTMLTextAreaElement>('#detail-notes');
    save?.addEventListener('click', async () => {
      if (!status || !notes) return;
      save.disabled = true;
      const update = { estado: status.value as Offer['estado'], notas: notes.value || null };
      const updated = usingMock ? { ...offer, ...update } : await updateOfferById(id, update).catch(() => undefined);
      if (!updated) { alert('No se pudieron guardar los cambios.'); save.disabled = false; return; }
      offers = offers.map((item) => item.id === id ? updated : item);
      elements.modalBody.innerHTML = renderOfferDetail(updated, labels);
      renderOffers(elements, offers, totalOffers, currentPage, PAGE_LIMIT, labels, openDetail, deleteOffer, primaryAction);
    });
    elements.modal.showModal();
  };

  const primaryAction = (offer: Offer): void => {
    if (!offer.aplicacion_sencilla) { window.open(offer.url, '_blank', 'noopener,noreferrer'); return; }
    offers = offers.map((item) => item.id === offer.id ? { ...item, estado: 'lista_para_aplicar' } : item);
    renderOffers(elements, offers, totalOffers, currentPage, PAGE_LIMIT, labels, openDetail, deleteOffer, primaryAction);
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
    totalOffers = Math.max(0, totalOffers - 1);
    if (!usingMock) {
      void loadOffers();
      return;
    }
    renderOffers(elements, offers, totalOffers, currentPage, PAGE_LIMIT, labels, openDetail, deleteOffer, primaryAction);
  };

  const loadOffers = async (): Promise<void> => {
    try {
      const data = await fetchOffers(currentFilters(), currentPage, PAGE_LIMIT);
      offers = data.resultados ?? [];
      totalOffers = data.total;
      usingMock = false;
      setStatusText(elements, 'API conectada', false);
    } catch {
      const data = await fetchMockOffers();
      const matchingOffers = data.resultados.filter(createFiltersPredicate(elements));
      totalOffers = matchingOffers.length;
      const firstOffer = (currentPage - 1) * PAGE_LIMIT;
      offers = matchingOffers.slice(firstOffer, firstOffer + PAGE_LIMIT);
      usingMock = true;
      setStatusText(elements, 'Vista previa · datos simulados', true);
    }
    renderOffers(elements, offers, totalOffers, currentPage, PAGE_LIMIT, labels, openDetail, deleteOffer, primaryAction);
  };

  const debounce = <T extends (...args: never[]) => void>(
    callback: T,
    delay: number,
  ): ((...args: Parameters<T>) => void) => {
    let timeout: ReturnType<typeof setTimeout>;

    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => callback(...args), delay);
    };
  };

  const loadOffersDebounced = debounce(() => {
    currentPage = 1;
    void loadOffers();
  }, 350);

  elements.modalClose.addEventListener('click', () => elements.modal.close());
  elements.modal.addEventListener('click', (event: MouseEvent) => {
    if (event.target === elements.modal) elements.modal.close();
  });
  elements.empresa.addEventListener('input', loadOffersDebounced);
  document.querySelectorAll<HTMLSelectElement>('.filters select').forEach((control) => {
    control.addEventListener('change', () => {
      currentPage = 1;
      void loadOffers();
    });
  });
  elements.clearFilters.addEventListener('click', () => {
    document
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>('.filters input, .filters select')
      .forEach((control) => {
        control.value = '';
      });
    currentPage = 1;
    void loadOffers();
  });
  elements.previousPage.addEventListener('click', () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    void loadOffers();
  });
  elements.nextPage.addEventListener('click', () => {
    if (currentPage >= Math.ceil(totalOffers / PAGE_LIMIT)) return;
    currentPage += 1;
    void loadOffers();
  });

  void loadOffers();
};
