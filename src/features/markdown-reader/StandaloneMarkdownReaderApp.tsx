import { Toast } from '@heroui/react';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { StandaloneMarkdownReader } from './components/StandaloneMarkdownReader';

export function StandaloneMarkdownReaderApp() {
  return (
    <QueryProvider>
      <Toast.Provider placement="bottom end" />
      <StandaloneMarkdownReader />
    </QueryProvider>
  );
}
