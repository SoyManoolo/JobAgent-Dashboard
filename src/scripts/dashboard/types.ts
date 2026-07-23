export type OfferStatus = 'extraida' | 'analizada' | 'pendientes_respuestas' | 'lista_para_aplicar' | 'aplicada' | 'descartada' | 'error';
export type RecommendedProfile = 'backend' | 'ia' | 'desconocido';
export type Seniority = 'junior' | 'mid' | 'senior' | 'desconocido';
export type OfferUpdate = { estado?: OfferStatus; notas?: string | null };

export type FormQuestion = {
  pregunta_id?: string;
  texto?: string;
  pregunta?: string;
  tipo?: string;
  obligatoria?: boolean;
  opciones?: string[];
};

export type FormAnswer = {
  pregunta_id?: string;
  respuesta?: string | number | boolean | null;
  valor_seleccionado?: string | null;
  informacion_suficiente?: boolean;
};

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
  preguntas_formulario: FormQuestion[] | null;
  respuestas?: FormAnswer[] | { respuestas?: FormAnswer[] } | null;
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

export type DashboardStats = {
  total_ofertas: number;
  aplicadas: number;
  descartadas: number;
};

export type LabelMap = {
  extraida: string;
  analizada: string;
  pendientes_respuestas: string;
  lista_para_aplicar: string;
  aplicada: string;
  descartada: string;
  error: string;
  backend: string;
  ia: string;
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
  deleteConfirmModal: HTMLDialogElement;
  confirmDelete: HTMLButtonElement;
};
