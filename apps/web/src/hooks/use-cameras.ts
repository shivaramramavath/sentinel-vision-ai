import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  camerasListQueryOptions,
  cameraDetailQueryOptions,
  cameraGeoJsonQueryOptions,
  cameraTopologyQueryOptions,
} from '@/lib/query/options';
import { camerasApi, CameraFilterParams } from '@/lib/api/cameras.api';
import { keys } from '@/lib/query/keys';
import { Camera } from '@/types';

export function useCameras(filters?: CameraFilterParams) {
  return useQuery(camerasListQueryOptions(filters));
}

export function useCamera(id: string) {
  return useQuery(cameraDetailQueryOptions(id));
}

export function useCameraGeoJson(siteId?: string, status?: string) {
  return useQuery(cameraGeoJsonQueryOptions(siteId, status));
}

export function useCameraTopology() {
  return useQuery(cameraTopologyQueryOptions());
}

export function useUpdateCamera() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<Camera> }) =>
      camerasApi.update(id, dto),
    onSuccess: (cam) => {
      queryClient.invalidateQueries({ queryKey: keys.cameras.detail(cam.id) });
      queryClient.invalidateQueries({ queryKey: keys.cameras.all });
      queryClient.invalidateQueries({ queryKey: keys.counts('global') });
    },
  });
}

export function useUpdateTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) =>
      camerasApi.patchTransition(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.cameras.topology });
    },
  });
}
