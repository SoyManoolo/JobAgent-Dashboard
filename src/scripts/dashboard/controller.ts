import {
  analyzeOffer,
  deleteOfferById,
  fetchDashboardStats,
  fetchOfferById,
  fetchOffers,
  generateOfferAnswers,
  PAGE_LIMIT,
  processEasyApply,
  updateOfferById,
  updateOfferNotes,
} from './api';
import { getDashboardElements } from './dom';
import { renderOfferDetail, renderOffers, setError, setLoading, setStatusText } from './render';
import { labels } from './shared';
import type { Offer } from './types';

export const initJobDashboard = (): void => {
  const elements = getDashboardElements();
  let offers: Offer[] = [];
  let totalOffers = 0;
  let activeOffers = 0;
  let currentPage = 1;
  let loading = false;
  let offerPendingDeletion: string | undefined;

  const currentFilters = () => ({
    empresa: elements.empresa.value,
    estado: elements.estado.value,
    perfil: elements.perfil.value,
    score: elements.score.value,
    sencilla: elements.sencilla.value,
  });

  const showOfferDetail = (offer: Offer): void => {
    elements.modalBody.innerHTML = renderOfferDetail(offer, labels);
    const save = elements.modalBody.querySelector<HTMLButtonElement>('#save-detail');
    const status = elements.modalBody.querySelector<HTMLSelectElement>('#detail-status');
    const notes = elements.modalBody.querySelector<HTMLTextAreaElement>('#detail-notes');
    save?.addEventListener('click', async () => {
      if (!status || !notes) return;
      const nextStatus = status.value as Offer['estado'];
      if (
        nextStatus !== offer.estado
        && ['aplicada', 'descartada'].includes(nextStatus)
        && !confirm(`¿Confirmas que quieres marcar esta oferta como ${labels[nextStatus].toLowerCase()}?`)
      ) return;

      save.disabled = true;
      const notesValue = notes.value || null;
      const updated = await (async () => {
        const statusUpdated = nextStatus === offer.estado
          ? offer
          : await updateOfferById(offer.id, { estado: nextStatus });
        return notesValue === offer.notas
          ? statusUpdated
          : updateOfferNotes(offer.id, notesValue);
      })().catch(() => undefined);
      if (!updated) { alert('No se pudieron guardar los cambios.'); save.disabled = false; return; }
      offers = offers.map((item) => item.id === offer.id ? updated : item);
      showOfferDetail(updated);
      renderOffers(elements, offers, totalOffers, currentPage, PAGE_LIMIT, labels, openDetail, requestDeleteOffer, primaryAction);
    });
  };

  const openDetail = async (id: string): Promise<void> => {
    const offer = await fetchOfferById(id).catch(() => offers.find((item) => item.id === id));
    if (!offer) return;
    showOfferDetail(offer);
    elements.modal.showModal();
  };

  const primaryAction = async (offer: Offer): Promise<void> => {
    if (!offer.aplicacion_sencilla || offer.estado === 'lista_para_aplicar') {
      window.open(offer.url, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      if (offer.estado === 'extraida') {
        await analyzeOffer(offer.id);
      } else if (offer.estado === 'analizada') {
        await processEasyApply(offer.id);
      } else if (offer.estado === 'pendientes_respuestas') {
        await generateOfferAnswers(offer.id);
      } else {
        window.open(offer.url, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch {
      alert('No se ha podido completar la acción en la API.');
      return;
    }
    void loadOffers();
  };

  const deleteOffer = async (id: string): Promise<void> => {
    try {
      await deleteOfferById(id);
    } catch {
      alert('No se ha podido eliminar la oferta en la API.');
      return;
    }

    offers = offers.filter((offer) => offer.id !== id);
    totalOffers = Math.max(0, totalOffers - 1);
    void loadOffers();
  };

  const requestDeleteOffer = (id: string): void => {
    offerPendingDeletion = id;
    elements.deleteConfirmModal.showModal();
  };

  const loadOffers = async (): Promise<void> => {
    if (loading) return;
    loading = true;
    setLoading(elements, true);
    setError(elements);
    try {
      const data = await fetchOffers(currentFilters(), currentPage, PAGE_LIMIT);
      const stats = await fetchDashboardStats().catch(() => ({ total_ofertas: data.total, aplicadas: 0, descartadas: 0 }));
      offers = data.resultados ?? [];
      totalOffers = data.total;
      activeOffers = stats.total_ofertas;
      setStatusText(elements, 'API conectada', false);
    } catch {
      offers = [];
      totalOffers = 0;
      activeOffers = 0;
      setStatusText(elements, 'Sin conexión', false);
      setError(elements, 'No se han podido cargar las ofertas. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
      loading = false;
      setLoading(elements, false);
    }
    renderOffers(elements, offers, totalOffers, currentPage, PAGE_LIMIT, labels, openDetail, requestDeleteOffer, primaryAction);
    if (elements.errorState.hidden) elements.total.textContent = String(activeOffers);
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
  elements.deleteConfirmModal.addEventListener('click', (event: MouseEvent) => {
    if (event.target === elements.deleteConfirmModal) elements.deleteConfirmModal.close();
  });
  elements.deleteConfirmModal.addEventListener('close', () => {
    offerPendingDeletion = undefined;
  });
  elements.confirmDelete.addEventListener('click', () => {
    const id = offerPendingDeletion;
    if (!id) return;
    elements.deleteConfirmModal.close();
    void deleteOffer(id);
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
  elements.retryLoad.addEventListener('click', () => {
    void loadOffers();
  });

  void loadOffers();
};
