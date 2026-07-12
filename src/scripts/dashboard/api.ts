import type { Offer, OffersResponse, OfferUpdate } from './types';

export const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1';
export const MOCK_URL = '/data/ofertas.json';
export const PAGE_LIMIT = 10;

export const buildApiParams = (filters: {
  empresa: string;
  estado: string;
  perfil: string;
  score: string;
  sencilla: string;
}, page: number, limit: number): URLSearchParams => {
  const params = new URLSearchParams({ pagina: String(page), limite: String(limit) });
  if (filters.empresa) params.set('empresa', filters.empresa);
  if (filters.estado) params.set('estado', filters.estado);
  if (filters.perfil) params.set('perfil', filters.perfil);
  if (filters.score) params.set('score_min', filters.score);
  if (filters.sencilla) params.set('aplicacion_sencilla', filters.sencilla);
  return params;
};

export const fetchOffers = async (filters: {
  empresa: string;
  estado: string;
  perfil: string;
  score: string;
  sencilla: string;
}, page: number, limit: number): Promise<OffersResponse> => {
  const response = await fetch(`${API_BASE_URL}/ofertas/?${buildApiParams(filters, page, limit)}`);
  if (!response.ok) throw new Error(`La API respondió con error ${response.status}`);
  return (await response.json()) as OffersResponse;
};

export const fetchMockOffers = async (): Promise<OffersResponse> => {
  return (await fetch(MOCK_URL).then((response) => response.json())) as OffersResponse;
};

export const fetchOfferById = async (id: string): Promise<Offer> => {
  const response = await fetch(`${API_BASE_URL}/ofertas/${id}`);
  if (!response.ok) throw new Error('No se pudo cargar la oferta');
  return (await response.json()) as Offer;
};

export const deleteOfferById = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/ofertas/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('No se pudo eliminar la oferta');
};

export const updateOfferById = async (id: string, data: OfferUpdate): Promise<Offer> => {
  const response = await fetch(`${API_BASE_URL}/ofertas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!response.ok) throw new Error('No se pudo actualizar la oferta');
  return response.json() as Promise<Offer>;
};
