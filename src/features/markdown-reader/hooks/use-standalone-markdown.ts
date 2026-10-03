import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { markdownReaderGateway } from '../services/markdown-reader.gateway';

export const standaloneMarkdownKeys = {
  document: ['standalone-markdown-document'] as const,
};

export function useStandaloneMarkdownDocument() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void markdownReaderGateway
      .onDocumentChanged(() => {
        void queryClient.invalidateQueries({
          queryKey: standaloneMarkdownKeys.document,
        });
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, [queryClient]);

  return useQuery({
    queryKey: standaloneMarkdownKeys.document,
    queryFn: () => markdownReaderGateway.getDocument(),
    staleTime: 0,
  });
}
