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
} from './api';
import { getDashboardElements } from './dom';
import { validOfferUrl } from './offer-url';
import { renderOfferDetail, renderOffers, setError, setLoading, setStatusText, showToast } from './render';
import { labels } from './shared';
import type { FormAnswerUpdate, Offer } from './types';

type DashboardView = 'active' | 'applied' | 'discarded';

const preferencesKey = 'jobagent-dashboard-preferences';
const activeStatusKey = 'jobagent-dashboard-active-status';
const activeStatuses = new Set(['extraida', 'analizada', 'pendientes_respuestas', 'lista_para_aplicar', 'error']);
type SortOrder = 'fecha' | 'score' | 'empresa' | 'estado';
type DashboardPreferences = { empresa: string; perfil: string; score: string; sencilla: string; orden: SortOrder };
type LegacyDashboardPreferences = DashboardPreferences & { estado?: string };
type AnswerField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type AnswerDraft = { update: FormAnswerUpdate; failed: boolean };
type AnswerSaves = { drafts: Map<string, AnswerDraft>; queue: Promise<void> };

export const initJobDashboard = (view: DashboardView = 'active'): void => {
  const elements = getDashboardElements();
  let offers: Offer[] = [];
  let totalOffers = 0;
  let currentPage = 1;
  let loading = false;
  let loadController: AbortController | undefined;
  let detailTrigger: HTMLElement | undefined;
  let latestDetailRequest = 0;
  let offerPendingDeletion: string | undefined;
  let discardConfirmationResolver: ((confirmed: boolean) => void) | undefined;
  const pendingActions = new Map<string, Offer['estado']>();
  const refreshingActions = new Set<string>();
  const actionsNeedingRefresh = new Set<string>();
  const answerSavesByOffer = new Map<string, AnswerSaves>();

  const restorePreferences = (): void => {
    const saved = localStorage.getItem(preferencesKey);
    if (saved) {
      try {
        const values = JSON.parse(saved) as Partial<LegacyDashboardPreferences>;
        elements.empresa.value = values.empresa ?? '';
        elements.perfil.value = values.perfil ?? '';
        elements.score.value = values.score ?? '';
        elements.sencilla.value = values.sencilla ?? '';
        elements.orden.value = values.orden ?? 'fecha';
        if (localStorage.getItem(activeStatusKey) === null && values.estado && activeStatuses.has(values.estado)) {
          localStorage.setItem(activeStatusKey, values.estado);
        }
      } catch { localStorage.removeItem(preferencesKey); }
    }
    if (view === 'active') {
      const status = localStorage.getItem(activeStatusKey) ?? '';
      if (Array.from(elements.estado.options).some((option) => option.value === status)) elements.estado.value = status;
    }
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
    orden: (elements.orden.value || 'fecha') as SortOrder,
    excludeStates: view === 'active' ? (['aplicada', 'descartada'] as const) : [],
  });

  const savePreferences = (): void => {
    const { empresa, perfil, score, sencilla, orden } = currentFilters();
    localStorage.setItem(preferencesKey, JSON.stringify({ empresa, perfil, score, sencilla, orden }));
    if (view === 'active') localStorage.setItem(activeStatusKey, elements.estado.value);
  };

  const showOfferDetail = (offer: Offer): void => {
    elements.modalBody.innerHTML = renderOfferDetail(offer, labels);
    const save = elements.modalBody.querySelector<HTMLButtonElement>('#save-detail');
    const status = elements.modalBody.querySelector<HTMLSelectElement>('#detail-status');
    const easyApply = elements.modalBody.querySelector<HTMLSelectElement>('#detail-easy-apply');
    const notes = elements.modalBody.querySelector<HTMLTextAreaElement>('#detail-notes');
    const confirmAnswers = elements.modalBody.querySelector<HTMLButtonElement>('#confirm-answers');
    const answerFields = elements.modalBody.querySelectorAll<AnswerField>('.question-answer');
    const answerSaves = answerSavesByOffer.get(offer.id) ?? { drafts: new Map<string, AnswerDraft>(), queue: Promise.resolve() };
    let detailBusy = false;
    const setDetailBusy = (busy: boolean): void => {
      detailBusy = busy;
      if (save) save.disabled = busy;
      if (confirmAnswers) confirmAnswers.disabled = busy;
      answerFields.forEach((field) => { field.disabled = busy; });
    };

    const showAnswerRetry = (questionId: string, field: AnswerField, draft: AnswerDraft): void => {
      const question = field.closest('li');
      if (!question || question.querySelector('.retry-answer')) return;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'retry-answer';
      retry.textContent = 'Reintentar guardado';
      retry.addEventListener('click', () => {
        if (!detailBusy && answerSaves.drafts.get(questionId) === draft) queueAnswer(questionId, field, draft.update);
      });
      question.append(retry);
    };

    const queueAnswer = (questionId: string, field: AnswerField, update: FormAnswerUpdate): void => {
      const draft = { update, failed: false };
      const question = field.closest('li');
      question?.querySelector('.retry-answer')?.remove();
      question?.classList.remove('answer-saved');
      answerSaves.drafts.set(questionId, draft);
      answerSavesByOffer.set(offer.id, answerSaves);
      answerSaves.queue = answerSaves.queue.then(async () => {
        try {
          await updateOfferAnswer(offer.id, questionId, update);
          if (answerSaves.drafts.get(questionId) === draft) {
            answerSaves.drafts.delete(questionId);
            question?.classList.add('answer-saved');
            if (answerSaves.drafts.size === 0) answerSavesByOffer.delete(offer.id);
          }
        } catch {
          if (answerSaves.drafts.get(questionId) !== draft) return;
          draft.failed = true;
          showAnswerRetry(questionId, field, draft);
          showToast(elements, 'No se pudo guardar la respuesta.');
        }
      });
    };

    answerFields.forEach((field) => {
      const { questionId, answerKind } = field.dataset;
      if (!questionId || !answerKind) return;
      const isRadio = field instanceof HTMLInputElement && field.type === 'radio';
      const draft = answerSaves.drafts.get(questionId);
      if (draft) {
        const value = (answerKind === 'option' ? draft.update.valor_seleccionado : draft.update.respuesta) ?? '';
        if (isRadio) field.checked = field.value === value;
        else field.value = value;
        if (draft.failed) showAnswerRetry(questionId, field, draft);
      }
      field.addEventListener('change', () => {
        if (detailBusy || (isRadio && !field.checked)) return;
        const value = field.value || null;
        queueAnswer(questionId, field, answerKind === 'option' ? { valor_seleccionado: value } : { respuesta: value });
      });
    });

    const waitForAnswers = async (): Promise<boolean> => {
      await answerSaves.queue;
      if (answerSaves.drafts.size === 0) return true;
      showToast(elements, 'Vuelve a guardar las respuestas pendientes antes de continuar.');
      return false;
    };

    confirmAnswers?.addEventListener('click', async () => {
      setDetailBusy(true);
      try {
        if (!await waitForAnswers() || !confirmAnswers.isConnected) return;
        await confirmOfferAnswers(offer.id);
        const updated = await fetchOfferById(offer.id);
        if (confirmAnswers.isConnected && elements.modal.open) showOfferDetail(updated);
        await loadOffers();
      } catch {
        showToast(elements, 'No se pudieron confirmar las respuestas. Revisa las preguntas obligatorias.');
      } finally {
        setDetailBusy(false);
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

      if (detailBusy || !save.isConnected) return;
      setDetailBusy(true);
      try {
        if (!await waitForAnswers() || !save.isConnected) return;
        const notesValue = notes.value || null;
        const changes = {
          ...(nextStatus !== offer.estado ? { estado: nextStatus } : {}),
          ...(nextEasyApply !== offer.aplicacion_sencilla ? { aplicacion_sencilla: nextEasyApply } : {}),
          ...(notesValue !== offer.notas ? { notas: notesValue } : {}),
        };
        const updated = Object.keys(changes).length === 0
          ? await fetchOfferById(offer.id)
          : await updateOfferById(offer.id, changes);
        if (save.isConnected && elements.modal.open) showOfferDetail(updated);
        await loadOffers();
      } catch {
        showToast(elements, 'No se pudieron guardar los cambios.');
      } finally {
        setDetailBusy(false);
      }
    });
  };

  const openDetail = async (id: string): Promise<void> => {
    const detailRequest = ++latestDetailRequest;
    detailTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    try {
      await answerSavesByOffer.get(id)?.queue;
      const offer = await fetchOfferById(id);
      if (detailRequest !== latestDetailRequest) return;
      showOfferDetail(offer);
    } catch (error) {
      if (detailRequest !== latestDetailRequest) return;
      const status = error instanceof ApiError && error.status !== undefined ? ` (HTTP ${error.status})` : '';
      const reason = error instanceof Error ? ` ${error.message}` : '';
      elements.modalBody.textContent = `No se pudo cargar el detalle de la oferta${status}.${reason} Vuelve a intentarlo desde el listado.`;
    }
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
        openOfferUrl(offer.url);
        return;
      } else if (offer.estado === 'analizada') {
        await processEasyApply(offer.id);
      } else if (offer.estado === 'pendientes_respuestas') {
        await generateOfferAnswers(offer.id);
      } else if (offer.estado === 'lista_para_aplicar') {
        await submitEasyApply(offer.id);
      } else {
        openOfferUrl(offer.url);
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

  const openOfferUrl = (url: string): void => {
    const validUrl = validOfferUrl(url);
    if (!validUrl) {
      showToast(elements, 'La URL de la oferta no es válida.');
      return;
    }
    window.open(validUrl, '_blank', 'noopener,noreferrer');
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
      const filters = currentFilters();
      let page = currentPage;
      let result = await fetchOffers(filters, page, PAGE_LIMIT, controller.signal);
      let lastPage = Math.max(1, Math.ceil(result.total / PAGE_LIMIT));
      // A filter or mutation may have removed the current last page.
      while (page > lastPage && loadController === controller) {
        page = lastPage;
        result = await fetchOffers(filters, page, PAGE_LIMIT, controller.signal);
        lastPage = Math.max(1, Math.ceil(result.total / PAGE_LIMIT));
      }
      if (loadController !== controller) return false;
      currentPage = page;
      totalOffers = result.total;
      offers = result.resultados;
      setStatusText(elements, 'API conectada', false);
      succeeded = true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      if (loadController !== controller) return false;
      offers = [];
      totalOffers = 0;
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
      elements.total.textContent = String(totalOffers);
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
