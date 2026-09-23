export function createDisabledStorage(initialSettings) {
  const settings = structuredClone(initialSettings);
  const emptyPage = { wishes: [], hasMore: false, nextCursor: null };

  return {
    settings: {
      get: async () => ({ settings: structuredClone(settings), updatedAt: null })
    },
    wishes: {
      list: async () => emptyPage
    },
    guestLinks: {
      list: async () => []
    },
    gallery: {
      list: async () => [],
      getFile: async () => null
    }
  };
}
