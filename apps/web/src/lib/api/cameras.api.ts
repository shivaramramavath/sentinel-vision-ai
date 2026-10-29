import { http } from './http';
import { Camera, CameraSchema, CameraTopologyTransition } from '@/types';

export interface CameraFilterParams {
  status?: string;
  location?: string;
  siteId?: string;
}

export const camerasApi = {
  list: async (params?: CameraFilterParams): Promise<Camera[]> => {
    const res = await http.get<Camera[]>('/cameras', { params });
    if (process.env.NODE_ENV !== 'production' && Array.isArray(res.data)) {
      res.data.forEach((c) => {
        const parsed = CameraSchema.safeParse(c);
        if (!parsed.success) {
          console.warn(`Camera validation warning for ${c.id}:`, parsed.error.issues);
        }
      });
    }
    return res.data;
  },

  get: async (id: string): Promise<Camera> => {
    const res = await http.get<Camera>(`/cameras/${id}`);
    if (process.env.NODE_ENV !== 'production') {
      const parsed = CameraSchema.safeParse(res.data);
      if (!parsed.success) {
        console.warn(`Camera validation warning for ${id}:`, parsed.error.issues);
      }
    }
    return res.data;
  },

  getGeoJson: async (siteId?: string, status?: string): Promise<any> => {
    const res = await http.get('/cameras/geojson', { params: { siteId, status } });
    return res.data;
  },

  getNearby: async (lat: number, lng: number, radiusM = 500): Promise<Camera[]> => {
    const res = await http.get<Camera[]>('/cameras/nearby', {
      params: { lat, lng, radiusM },
    });
    return res.data;
  },

  getTopology: async (): Promise<CameraTopologyTransition[]> => {
    const res = await http.get<CameraTopologyTransition[]>('/cameras/topology');
    return res.data;
  },

  updateTopology: async (from: string, to: string, dto: any): Promise<any> => {
    const res = await http.put(`/cameras/topology/${from}/${to}`, dto);
    return res.data;
  },

  patchTransition: async (id: string, dto: any): Promise<any> => {
    const res = await http.patch(`/cameras/topology/transitions/${id}`, dto);
    return res.data;
  },

  getGaps: async (id: string): Promise<any> => {
    const res = await http.get(`/cameras/${id}/gaps`);
    return res.data;
  },

  update: async (id: string, dto: Partial<Camera>): Promise<Camera> => {
    const res = await http.patch<Camera>(`/cameras/${id}`, dto);
    return res.data;
  },
};
