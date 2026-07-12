export type OfferStatus = 'extraida' | 'analizada' | 'pendiente_revision' | 'lista_para_aplicar' | 'aplicada' | 'descartada' | 'error';
export type RecommendedProfile = 'backend' | 'fullstack' | 'ia' | 'hibrido' | 'desconocido';
export type Seniority = 'junior' | 'mid' | 'senior' | 'desconocido';
export type OfferUpdate = { estado?: OfferStatus; notas?: string | null };

export type Offer = {
  id: string;
  id_plataforma: string;
  plataforma: string;
  url: string;
  titulo: string;
  empresa: string;
  descripcion: string;
  salario: string | null;
  ubicacion: string | null;
  estado: OfferStatus;
  eliminado: boolean;
  notas: string | null;
  fecha_descubrimiento: string;
  fecha_aplicacion: string | null;
  aplicacion_sencilla: boolean;
  preguntas_formulario: unknown[] | null;
  perfil_recomendado: RecommendedProfile | null;
  idioma_oferta: string | null;
  seniority: Seniority | null;
  score_backend: number | null;
  score_fullstack: number | null;
  score_ia: number | null;
  score_encaje: number | null;
  keywords: string[] | null;
  resumen: string | null;
  motivo_encaje: string | null;
};

export type OffersResponse = {
  total: number;
  pagina: number;
  limite: number;
  resultados: Offer[];
};

export type LabelMap = {
  extraida: string;
  analizada: string;
  pendiente_revision: string;
  lista_para_aplicar: string;
  aplicada: string;
  descartada: string;
  error: string;
  backend: string;
  fullstack: string;
  ia: string;
  hibrido: string;
  desconocido: string;
};

export type LabelKey = keyof LabelMap;

export type DashboardElements = {
  jobs: HTMLElement;
  empty: HTMLElement;
  template: HTMLTemplateElement;
  total: HTMLElement;
  results: HTMLElement;
  connection: HTMLElement;
  modal: HTMLDialogElement;
  modalBody: HTMLElement;
  empresa: HTMLInputElement;
  estado: HTMLSelectElement;
  perfil: HTMLSelectElement;
  score: HTMLSelectElement;
  sencilla: HTMLSelectElement;
  modalClose: HTMLButtonElement;
  clearFilters: HTMLButtonElement;
  pagination: HTMLElement;
  previousPage: HTMLButtonElement;
  nextPage: HTMLButtonElement;
  pageInfo: HTMLElement;
  loadState: HTMLElement;
  errorState: HTMLElement;
  errorMessage: HTMLElement;
  retryLoad: HTMLButtonElement;
};
