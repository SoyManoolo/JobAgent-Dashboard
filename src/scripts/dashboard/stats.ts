import { fetchDashboardStats } from './api';
import type { DashboardStats, OfferStatus } from './types';

const statusLabels: Record<OfferStatus, string> = {
  extraida: 'Extraídas',
  analizada: 'Analizadas',
  pendientes_respuestas: 'Pendientes de respuesta',
  lista_para_aplicar: 'Listas para aplicar',
  aplicada: 'Aplicadas',
  descartada: 'Descartadas',
  error: 'Con error',
};

const statusOrder: OfferStatus[] = ['extraida', 'analizada', 'pendientes_respuestas', 'lista_para_aplicar', 'aplicada', 'descartada', 'error'];

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`No se encontró el elemento: ${selector}`);
  return element as T;
};

const formatNumber = (value: number): string => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value);
const escapeHtml = (value: string): string => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character] ?? character);

const renderBars = (items: Array<{ label: string; value: number }>, total: number, className = ''): string => items
  .map(({ label, value }) => {
    const percent = total > 0 ? Math.min(100, (value / total) * 100) : 0;
    return `<div class="metric-bar ${className}"><div><span>${escapeHtml(label)}</span><strong>${formatNumber(value)}</strong></div><i><b style="width: ${percent}%"></b></i></div>`;
  })
  .join('');

export const initDashboardStats = (): void => {
  const loading = required<HTMLElement>('#stats-loading');
  const error = required<HTMLElement>('#stats-error');
  const errorMessage = required<HTMLElement>('#stats-error-message');
  const retry = required<HTMLButtonElement>('#stats-retry');
  const page = required<HTMLElement>('#stats-page');
  const connection = required<HTMLElement>('#stats-connection');

  const render = (stats: DashboardStats): void => {
    required<HTMLElement>('#stat-total').textContent = formatNumber(stats.total_ofertas);
    required<HTMLElement>('#stat-applied').textContent = formatNumber(stats.aplicadas);
    required<HTMLElement>('#stat-discarded').textContent = formatNumber(stats.descartadas);
    required<HTMLElement>('#stat-rate').textContent = `${formatNumber(stats.tasa_aplicacion)} %`;

    required<HTMLElement>('#stats-funnel').innerHTML = renderBars(
      statusOrder.map((status) => ({ label: statusLabels[status], value: stats.por_estado[status] ?? 0 })),
      stats.total_ofertas,
    );

    required<HTMLElement>('#stats-pending').innerHTML = renderBars([
      { label: 'Por analizar', value: stats.pendientes.analisis },
      { label: 'Por responder', value: stats.pendientes.respuestas },
      { label: 'Listas para aplicar', value: stats.pendientes.listas_para_aplicar },
    ], stats.total_ofertas, 'compact-bar');

    required<HTMLElement>('#stats-priority-total').textContent = formatNumber(stats.ofertas_prioritarias.total);
    required<HTMLElement>('#stats-priority-score').textContent = String(stats.ofertas_prioritarias.score_minimo);

    required<HTMLElement>('#stats-evaluated').textContent = `${formatNumber(stats.score_encaje.ofertas_evaluadas)} evaluadas`;
    required<HTMLElement>('#stats-score-summary').innerHTML = [
      ['Media', stats.score_encaje.medio],
      ['Mínima', stats.score_encaje.minimo],
      ['Máxima', stats.score_encaje.maximo],
    ].map(([label, value]) => `<div><span>${label}</span><strong>${formatNumber(Number(value))}</strong></div>`).join('');
    required<HTMLElement>('#stats-score-distribution').innerHTML = renderBars(
      Object.entries(stats.score_encaje.por_rango).map(([range, value]) => ({ label: range.replace('_', '–'), value })),
      stats.score_encaje.ofertas_evaluadas,
      'compact-bar',
    );

    required<HTMLElement>('#stats-easy-apply').innerHTML = renderBars([
      { label: 'Total Easy Apply', value: stats.easy_apply.total },
      { label: 'Pendientes de preguntas', value: stats.easy_apply.pendientes_preguntas },
      { label: 'Pendientes de respuestas', value: stats.easy_apply.pendientes_respuestas },
      { label: 'Listas para aplicar', value: stats.easy_apply.listas_para_aplicar },
    ], stats.easy_apply.total, 'compact-bar');

    required<HTMLElement>('#stats-distributions').innerHTML = [
      ['Por perfil', stats.por_perfil],
      ['Por plataforma', stats.por_plataforma],
    ].map(([title, values]) => {
      const entries = Object.entries(values as Record<string, number>);
      return `<section><h3>${title}</h3>${renderBars(entries.map(([label, value]) => ({ label, value })), stats.total_ofertas, 'compact-bar')}</section>`;
    }).join('');
  };

  const load = async (): Promise<void> => {
    loading.hidden = false;
    error.hidden = true;
    page.hidden = true;
    connection.innerHTML = '<span></span>Cargando estadísticas...';
    try {
      const stats = await fetchDashboardStats();
      render(stats);
      page.hidden = false;
      connection.innerHTML = '<span></span>API conectada';
    } catch {
      errorMessage.textContent = 'No se han podido cargar las estadísticas. Comprueba la conexión e inténtalo de nuevo.';
      error.hidden = false;
      connection.innerHTML = '<span></span>Sin conexión';
    } finally {
      loading.hidden = true;
    }
  };

  retry.addEventListener('click', () => { void load(); });
  void load();
};
