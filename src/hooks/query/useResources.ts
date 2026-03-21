import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ADMIN_LIST_CACHE } from '@/config/adminQueryCache'
import {
  resourcesService,
  type WebLink,
  type YoutubeLink,
  type ResourceFilters,
  type ResourcePath,
  type ResourceCursor,
  type PaginatedResources,
  type CreateWebLinkData,
  type CreateYoutubeLinkData,
  type UpdateResourceData,
} from '@/services/firebase/resources.service'

const RESOURCES_KEYS = {
  all: ['resources'] as const,
  list: (filters: ResourceFilters) =>
    [...RESOURCES_KEYS.all, 'list', filters.grado, filters.materiaCode, filters.topicCode] as const,
}

export interface ResourcesData {
  webLinks: WebLink[]
  youtubeLinks: YoutubeLink[]
}

async function fetchResources(filters: ResourceFilters): Promise<ResourcesData> {
  const [webRes, ytRes] = await Promise.all([
    resourcesService.getWebLinks(filters),
    resourcesService.getYoutubeLinks(filters),
  ])
  return {
    webLinks: webRes.success ? webRes.data : [],
    youtubeLinks: ytRes.success ? ytRes.data : [],
  }
}

/**
 * Hook para cargar recursos (enlaces web y YouTube) con filtros.
 * Usa React Query con caché de 2 minutos.
 */
export function useResources(filters: ResourceFilters = {}) {
  return useQuery({
    queryKey: RESOURCES_KEYS.list(filters),
    queryFn: () => fetchResources(filters),
    ...ADMIN_LIST_CACHE,
  })
}

export function useWebLinksInfinite(filters: ResourceFilters = {}, pageSize: number = 10) {
  return useInfiniteQuery({
    queryKey: [...RESOURCES_KEYS.list(filters), 'web', 'infinite', pageSize],
    queryFn: async ({ pageParam }): Promise<PaginatedResources<WebLink>> => {
      const cursor = pageParam as ResourceCursor | undefined
      const res = await resourcesService.getWebLinksPaginated(filters, pageSize, cursor)
      if (!res.success) throw res.error
      return res.data
    },
    initialPageParam: undefined as ResourceCursor | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    ...ADMIN_LIST_CACHE,
  })
}

export function useYoutubeLinksInfinite(filters: ResourceFilters = {}, pageSize: number = 10) {
  return useInfiniteQuery({
    queryKey: [...RESOURCES_KEYS.list(filters), 'youtube', 'infinite', pageSize],
    queryFn: async ({ pageParam }): Promise<PaginatedResources<YoutubeLink>> => {
      const cursor = pageParam as ResourceCursor | undefined
      const res = await resourcesService.getYoutubeLinksPaginated(filters, pageSize, cursor)
      if (!res.success) throw res.error
      return res.data
    },
    initialPageParam: undefined as ResourceCursor | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    ...ADMIN_LIST_CACHE,
  })
}

/**
 * Mutaciones para crear, actualizar y eliminar recursos. Invalidan la caché automáticamente.
 */
export function useResourcesMutations() {
  const queryClient = useQueryClient()

  const createWebLink = useMutation({
    mutationFn: async (data: CreateWebLinkData) => {
      const res = await resourcesService.createWebLink(data)
      if (!res.success) throw res.error
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOURCES_KEYS.all })
    },
  })

  const createYoutubeLink = useMutation({
    mutationFn: async (data: CreateYoutubeLinkData) => {
      const res = await resourcesService.createYoutubeLink(data)
      if (!res.success) throw res.error
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOURCES_KEYS.all })
    },
  })

  const deleteWebLink = useMutation({
    mutationFn: async (path: ResourcePath) => {
      const res = await resourcesService.deleteWebLink(path)
      if (!res.success) throw res.error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOURCES_KEYS.all })
    },
  })

  const deleteYoutubeLink = useMutation({
    mutationFn: async (path: ResourcePath) => {
      const res = await resourcesService.deleteYoutubeLink(path)
      if (!res.success) throw res.error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOURCES_KEYS.all })
    },
  })

  const updateWebLink = useMutation({
    mutationFn: async ({ path, data }: { path: ResourcePath; data: UpdateResourceData }) => {
      const res = await resourcesService.updateWebLink(path, data)
      if (!res.success) throw res.error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOURCES_KEYS.all })
    },
  })

  const updateYoutubeLink = useMutation({
    mutationFn: async ({ path, data }: { path: ResourcePath; data: UpdateResourceData }) => {
      const res = await resourcesService.updateYoutubeLink(path, data)
      if (!res.success) throw res.error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESOURCES_KEYS.all })
    },
  })

  return {
    createWebLink,
    createYoutubeLink,
    deleteWebLink,
    deleteYoutubeLink,
    updateWebLink,
    updateYoutubeLink,
  }
}
