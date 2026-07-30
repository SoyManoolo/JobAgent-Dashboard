import {
  analyzeOffer,
  confirmOfferAnswers,
  deleteOfferById,
  fetchOfferById,
  fetchOffers,
  generateOfferAnswers,
  PAGE_LIMIT,
  processEasyApply,
  submitEasyApply,
  updateOfferAnswer,
  updateOfferById,
  updateOfferNotes,
} from './api';
import { getDashboardElements } from './dom';
import { renderOfferDetail, renderOffers, setError, setLoading, setStatusText } from './render';
import { labels } from './shared';
import type { Offer } from './types';

type DashboardView = 'active' | 'applied';

const API_PAGE_LIMIT = 100;

export const initJobDashboard = (view: DashboardView = 'active'): void => {
  const elements = getDashboardElements();
  let offers: Offer[] = [];
  let totalOffers = 0;
  let activeOffers = 0;
  let currentPage = 1;
  let loading = false;
  let offerPendingDeletion: string | undefined;
  let discardConfirmationResolver: ((confirmed: boolean) => void) | undefined;

  const currentFilters = () => ({
    empresa: elements.empresa.value,
    estado: view === 'applied' ? 'aplicada' : elements.estado.value,
    perfil: elements.perfil.value,
    score: elements.score.value,
    sencilla: elements.sencilla.value,
  });

  const fetchAllMatchingOffers = async (): Promise<Offer[]> => {
    const firstPage = await fetchOffers(currentFilters(), 1, API_PAGE_LIMIT);
    const totalPages = Math.ceil(firstPage.total / API_PAGE_LIMIT);
    if (totalPages <= 1) return firstPage.resultados ?? [];

    const remainingPages = await Promise.all(
      Array.from(
        { length: totalPages - 1 },
        (_, index) => fetchOffers(currentFilters(), index + 2, API_PAGE_LIMIT),
      ),
    );
    return [
      ...(firstPage.resultados ?? []),
      ...remainingPages.flatMap((page) => page.resultados ?? []),
    ];
  };

  const showOfferDetail = (offer: Offer): void => {
    elements.modalBody.innerHTML = renderOfferDetail(offer, labels);
    const save = elements.modalBody.querySelector<HTMLButtonElement>('#save-detail');
    const status = elements.modalBody.querySelector<HTMLSelectElement>('#detail-status');
    const easyApply = elements.modalBody.querySelector<HTMLSelectElement>('#detail-easy-apply');
    const notes = elements.modalBody.querySelector<HTMLTextAreaElement>('#detail-notes');
    const confirmAnswers = elements.modalBody.querySelector<HTMLButtonElement>('#confirm-answers');
    const answerFields = Array.from(elements.modalBody.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('.question-answer'));
    let answerSaveQueue = Promise.resolve(true);

    const saveAnswer = async (field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): Promise<boolean> => {
      if (field instanceof HTMLInputElement && field.type === 'radio' && !field.checked) return true;
      const questionId = field.dataset.questionId;
      const kind = field.dataset.answerKind;
      if (!questionId || !kind) return false;

      field.disabled = true;
      try {
        const value = field.value || null;
        await updateOfferAnswer(offer.id, questionId, kind === 'option' ? { valor_seleccionado: value } : { respuesta: value });
        field.closest('li')?.classList.add('answer-saved');
        return true;
      } catch {
        alert('No se pudo guardar la respuesta.');
        return false;
      } finally {
        field.disabled = false;
      }
    };

    answerFields.forEach((field) => {
      field.addEventListener('change', () => {
        answerSaveQueue = answerSaveQueue.then(() => saveAnswer(field));
      });
    });
    confirmAnswers?.addEventListener('click', async () => {
      confirmAnswers.disabled = true;
      if (!await answerSaveQueue) {
        alert('Corrige o vuelve a guardar las respuestas antes de confirmarlas.');
        confirmAnswers.disabled = false;
        return;
      }
      try {
        await confirmOfferAnswers(offer.id);
        const updated = await fetchOfferById(offer.id);
        offers = offers.map((item) => item.id === offer.id ? updated : item);
        showOfferDetail(updated);
        renderOffers(elements, offers, totalOffers, currentPage, PAGE_LIMIT, labels, openDetail, requestDeleteOffer, primaryAction);
      } catch {
        alert('No se pudieron confirmar las respuestas. Revisa las preguntas obligatorias.');
        confirmAnswers.disabled = false;
      }
    });
    save?.addEventListener('click', async () => {
      if (!status || !easyApply || !notes) return;
      const nextStatus = status.value as Offer['estado'];
      const nextEasyApply = easyApply.value === 'true';
      if (
        nextStatus !== offer.estado
        && nextStatus === 'descartada'
        && !await requestDiscardConfirmation()
      ) return;
      if (
        nextStatus !== offer.estado
        && nextStatus === 'aplicada'
        && !confirm(`¿Confirmas que quieres marcar esta oferta como ${labels[nextStatus].toLowerCase()}?`)
      ) return;

      save.disabled = true;
      const notesValue = notes.value || null;
      const updated = await (async () => {
        const changes = {
          ...(nextStatus !== offer.estado ? { estado: nextStatus } : {}),
          ...(nextEasyApply !== offer.aplicacion_sencilla ? { aplicacion_sencilla: nextEasyApply } : {}),
        };
        const statusUpdated = Object.keys(changes).length === 0
          ? offer
          : await updateOfferById(offer.id, changes);
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
    try {
      if (offer.estado === 'extraida') {
        await analyzeOffer(offer.id);
      } else if (!offer.aplicacion_sencilla) {
        window.open(offer.url, '_blank', 'noopener,noreferrer');
        return;
      } else if (offer.estado === 'analizada') {
        await processEasyApply(offer.id);
      } else if (offer.estado === 'pendientes_respuestas') {
        await generateOfferAnswers(offer.id);
      } else if (offer.estado === 'lista_para_aplicar') {
        await submitEasyApply(offer.id);
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

  const requestDiscardConfirmation = (): Promise<boolean> => new Promise((resolve) => {
    discardConfirmationResolver = resolve;
    elements.discardConfirmModal.showModal();
  });

  const loadOffers = async (): Promise<void> => {
    if (loading) return;
    loading = true;
    setLoading(elements, true);
    setError(elements);
    try {
      const matchingOffers = await fetchAllMatchingOffers();
      const visibleOffers = view === 'applied'
        ? matchingOffers.filter((offer) => offer.estado === 'aplicada')
        : matchingOffers.filter((offer) => offer.estado !== 'aplicada');
      totalOffers = visibleOffers.length;
      const totalPages = Math.max(1, Math.ceil(totalOffers / PAGE_LIMIT));
      currentPage = Math.min(currentPage, totalPages);
      const firstOffer = (currentPage - 1) * PAGE_LIMIT;
      offers = visibleOffers.slice(firstOffer, firstOffer + PAGE_LIMIT);
      activeOffers = totalOffers;
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
  elements.discardConfirmModal.addEventListener('click', (event: MouseEvent) => {
    if (event.target === elements.discardConfirmModal) elements.discardConfirmModal.close();
  });
  elements.discardConfirmModal.addEventListener('close', () => {
    const resolve = discardConfirmationResolver;
    discardConfirmationResolver = undefined;
    resolve?.(false);
  });
  elements.confirmDiscard.addEventListener('click', () => {
    const resolve = discardConfirmationResolver;
    discardConfirmationResolver = undefined;
    elements.discardConfirmModal.close();
    resolve?.(true);
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
