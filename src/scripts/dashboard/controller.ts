import {
  ApiError,
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
import { renderOfferDetail, renderOffers, setError, setLoading, setStatusText, showToast } from './render';
import { labels } from './shared';
import type { Offer } from './types';

type DashboardView = 'active' | 'applied' | 'discarded';

const API_PAGE_LIMIT = 100;
const preferencesKey = 'jobagent-dashboard-preferences';
type SortOrder = 'fecha' | 'score' | 'empresa' | 'estado';
type DashboardPreferences = { empresa: string; estado: string; perfil: string; score: string; sencilla: string; orden: SortOrder };

export const initJobDashboard = (view: DashboardView = 'active'): void => {
  const elements = getDashboardElements();
  let offers: Offer[] = [];
  let totalOffers = 0;
  let activeOffers = 0;
  let currentPage = 1;
  let loading = false;
  let loadController: AbortController | undefined;
  let detailTrigger: HTMLElement | undefined;
  let offerPendingDeletion: string | undefined;
  let discardConfirmationResolver: ((confirmed: boolean) => void) | undefined;
  const pendingActions = new Map<string, Offer['estado']>();
  const refreshingActions = new Set<string>();
  const actionsNeedingRefresh = new Set<string>();

  const restorePreferences = (): void => {
    const saved = localStorage.getItem(preferencesKey);
    if (!saved) return;
    try {
      const values = JSON.parse(saved) as Partial<DashboardPreferences>;
      elements.empresa.value = values.empresa ?? '';
      elements.estado.value = values.estado ?? '';
      elements.perfil.value = values.perfil ?? '';
      elements.score.value = values.score ?? '';
      elements.sencilla.value = values.sencilla ?? '';
      elements.orden.value = values.orden ?? 'fecha';
    } catch { localStorage.removeItem(preferencesKey); }
  };

  const currentFilters = () => ({
    empresa: elements.empresa.value,
    estado: view === 'applied'
      ? 'aplicada'
      : view === 'discarded'
        ? 'descartada'
        : elements.estado.value,
    perfil: elements.perfil.value,
    score: elements.score.value,
    sencilla: elements.sencilla.value,
  });

  const savePreferences = (): void => {
    const { empresa, estado, perfil, score, sencilla } = currentFilters();
    localStorage.setItem(preferencesKey, JSON.stringify({ empresa, estado, perfil, score, sencilla, orden: elements.orden.value as SortOrder }));
  };

  const fetchAllMatchingOffers = async (signal: AbortSignal): Promise<Offer[]> => {
    const firstPage = await fetchOffers(currentFilters(), 1, API_PAGE_LIMIT, signal);
    const totalPages = Math.ceil(firstPage.total / API_PAGE_LIMIT);
    if (totalPages <= 1) return firstPage.resultados ?? [];

    const remainingPages = await Promise.all(
      Array.from(
        { length: totalPages - 1 },
        (_, index) => fetchOffers(currentFilters(), index + 2, API_PAGE_LIMIT, signal),
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
        showToast(elements, 'No se pudo guardar la respuesta.');
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
        showToast(elements, 'Corrige o vuelve a guardar las respuestas antes de confirmarlas.');
        confirmAnswers.disabled = false;
        return;
      }
      try {
        await confirmOfferAnswers(offer.id);
        const updated = await fetchOfferById(offer.id);
        showOfferDetail(updated);
        await loadOffers();
      } catch {
        showToast(elements, 'No se pudieron confirmar las respuestas. Revisa las preguntas obligatorias.');
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
      if (!updated) { showToast(elements, 'No se pudieron guardar los cambios.'); save.disabled = false; return; }
      showOfferDetail(updated);
      await loadOffers();
    });
  };

  const openDetail = async (id: string): Promise<void> => {
    detailTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const offer = await fetchOfferById(id).catch(() => offers.find((item) => item.id === id));
    if (!offer) return;
    showOfferDetail(offer);
    elements.modal.showModal();
  };

  const primaryAction = async (offer: Offer): Promise<void> => {
    if (pendingActions.has(offer.id)) return;
    const postsToApi = offer.estado === 'extraida' || (offer.aplicacion_sencilla &&
      ['analizada', 'pendientes_respuestas', 'lista_para_aplicar'].includes(offer.estado));
    if (postsToApi) pendingActions.set(offer.id, offer.estado);
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
      pendingActions.delete(offer.id);
      if (postsToApi) {
        renderOffers(elements, offers, totalOffers, currentPage, PAGE_LIMIT, labels, openDetail, requestDeleteOffer, primaryAction, pendingActions);
      }
      showToast(elements, 'No se ha podido completar la acción en la API.');
      return;
    }
    actionsNeedingRefresh.add(offer.id);
    await refreshPendingAction(offer.id);
  };

  const refreshPendingAction = async (id: string): Promise<void> => {
    const previousStatus = pendingActions.get(id);
    if (!previousStatus || refreshingActions.has(id)) return;
    refreshingActions.add(id);
    try {
      const updated = await fetchOfferById(id);
      if (updated.estado === previousStatus) {
        setError(elements, 'La oferta aún no muestra un estado nuevo. Vuelve a consultar antes de repetir la acción.');
        return;
      }
      if (!await loadOffers()) return;
      const visible = offers.find((offer) => offer.id === id);
      if (visible && visible.estado !== updated.estado) {
        setError(elements, 'La lista aún no muestra el estado nuevo. Vuelve a consultar antes de repetir la acción.');
        return;
      }
      pendingActions.delete(id);
      actionsNeedingRefresh.delete(id);
      if (actionsNeedingRefresh.size === 0) setError(elements);
      renderOffers(elements, offers, totalOffers, currentPage, PAGE_LIMIT, labels, openDetail, requestDeleteOffer, primaryAction, pendingActions);
    } catch {
      setError(elements, 'No se pudo consultar el estado actualizado de la oferta. Vuelve a consultar antes de repetir la acción.');
    } finally {
      refreshingActions.delete(id);
    }
  };

  const deleteOffer = async (id: string): Promise<void> => {
    try {
      await deleteOfferById(id);
    } catch {
      showToast(elements, 'No se ha podido eliminar la oferta en la API.');
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

  const loadOffers = async (): Promise<boolean> => {
    loadController?.abort();
    const controller = new AbortController();
    loadController = controller;
    loading = true;
    setLoading(elements, true);
    setError(elements);
    let succeeded = false;
    try {
      const matchingOffers = await fetchAllMatchingOffers(controller.signal);
      if (loadController !== controller) return false;
      const visibleOffers = view === 'applied'
        ? matchingOffers.filter((offer) => offer.estado === 'aplicada')
        : view === 'discarded'
          ? matchingOffers.filter((offer) => offer.estado === 'descartada')
          : matchingOffers.filter((offer) => !['aplicada', 'descartada'].includes(offer.estado));
      const sortedOffers = [...visibleOffers].sort((left, right) => {
        switch (elements.orden.value as SortOrder) {
          case 'score': return (right.score_encaje ?? -1) - (left.score_encaje ?? -1);
          case 'empresa': return left.empresa.localeCompare(right.empresa, 'es');
          case 'estado': return left.estado.localeCompare(right.estado, 'es');
          default: return Date.parse(right.fecha_descubrimiento) - Date.parse(left.fecha_descubrimiento);
        }
      });
      totalOffers = sortedOffers.length;
      const totalPages = Math.max(1, Math.ceil(totalOffers / PAGE_LIMIT));
      currentPage = Math.min(currentPage, totalPages);
      const firstOffer = (currentPage - 1) * PAGE_LIMIT;
      offers = sortedOffers.slice(firstOffer, firstOffer + PAGE_LIMIT);
      activeOffers = totalOffers;
      setStatusText(elements, 'API conectada', false);
      succeeded = true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      if (loadController !== controller) return false;
      offers = [];
      totalOffers = 0;
      activeOffers = 0;
      setStatusText(elements, 'Sin conexión', false);
      const message = error instanceof ApiError
        ? error.status === 401 || error.status === 403
          ? 'No tienes permiso para acceder a las ofertas.'
          : error.status === 422
            ? 'Los filtros enviados no son válidos.'
            : `La API respondió con un error (${error.status}).`
        : 'No se ha podido conectar con la API. Comprueba que está en ejecución.';
      setError(elements, message);
    } finally {
      if (loadController === controller) {
        loading = false;
        setLoading(elements, false);
      }
    }
    if (loadController !== controller) return false;
    renderOffers(elements, offers, totalOffers, currentPage, PAGE_LIMIT, labels, openDetail, requestDeleteOffer, primaryAction, pendingActions);
    if (succeeded) {
      elements.total.textContent = String(activeOffers);
      if (actionsNeedingRefresh.size > 0) {
        setError(elements, 'Hay acciones pendientes de verificar. Vuelve a consultar antes de repetirlas.');
      }
    }
    return succeeded;
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
  elements.modal.addEventListener('close', () => detailTrigger?.focus());
  elements.modal.addEventListener('click', (event: MouseEvent) => {
    if (event.target === elements.modal) elements.modal.close();
  });
  elements.deleteConfirmModal.addEventListener('click', (event: MouseEvent) => {
    if (event.target === elements.deleteConfirmModal) elements.deleteConfirmModal.close();
  });
  elements.deleteConfirmModal.addEventListener('close', () => {
    offerPendingDeletion = undefined;
  });
  elements.confirmDelete.addEventListener('click', async () => {
    const id = offerPendingDeletion;
    if (!id) return;
    elements.confirmDelete.disabled = true;
    try {
      elements.deleteConfirmModal.close();
      await deleteOffer(id);
    } finally {
      elements.confirmDelete.disabled = false;
    }
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
  restorePreferences();
  elements.empresa.addEventListener('input', () => { savePreferences(); loadOffersDebounced(); });
  document.querySelectorAll<HTMLSelectElement>('.filters select').forEach((control) => {
    control.addEventListener('change', () => {
      savePreferences();
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
    elements.orden.value = 'fecha';
    savePreferences();
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
    if (pendingActions.size > 0) {
      void (async () => {
        for (const id of pendingActions.keys()) await refreshPendingAction(id);
      })();
    } else {
      void loadOffers();
    }
  });

  void loadOffers();
};
