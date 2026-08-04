import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Form,
  Input,
  Label,
  Modal,
  Skeleton,
  Spinner,
  TextField,
} from '@heroui/react';
import { IconFilePlus, IconSearch } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useEnvironmentSourceCandidates } from '../hooks/use-environment-tracker';
import {
  sourceFormSchema,
  type ProjectEnvironment,
  type SourceFormValues,
} from '../models/environment-tracker';

interface SourceFormModalProps {
  environment: ProjectEnvironment | null;
  isPending: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (relativePath: string) => Promise<void>;
  projectId: string;
}

export function SourceFormModal({
  environment,
  isPending,
  onOpenChange,
  onSubmit,
  projectId,
}: SourceFormModalProps) {
  const [search, setSearch] = useState('');
  const candidates = useEnvironmentSourceCandidates(
    projectId,
    search,
    1,
    50,
    Boolean(environment),
  );
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<SourceFormValues>({
    defaultValues: { relativePath: '' },
    resolver: zodResolver(sourceFormSchema),
  });
  const selectedPath = useWatch({ control, name: 'relativePath' });

  useEffect(() => {
    queueMicrotask(() => {
      reset({ relativePath: '' });
      setSearch('');
    });
  }, [environment?.id, reset]);

  const submit = handleSubmit(({ relativePath }) => onSubmit(relativePath));
  const configuredPaths = new Set(
    environment?.sources.map((source) => source.relativePath.toLowerCase()) ??
      [],
  );

  return (
    <Modal>
      <Button aria-hidden="true" className="hidden">
        Open source file dialog
      </Button>
      <Modal.Backdrop
        isOpen={Boolean(environment)}
        onOpenChange={onOpenChange}
        variant="blur"
      >
        <Modal.Container scroll="inside" size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon>
                <IconFilePlus aria-hidden="true" />
              </Modal.Icon>
              <Modal.Heading>
                Add source to {environment?.name ?? 'environment'}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <Form
                className="space-y-4"
                onSubmit={(event) => event.preventDefault()}
                validationBehavior="aria"
              >
                <input type="hidden" {...register('relativePath')} />
                <TextField fullWidth variant="secondary">
                  <Label>Search indexed project files</Label>
                  <div className="relative">
                    <IconSearch
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                      size={18}
                    />
                    <Input
                      aria-label="Search source files"
                      className="pl-10"
                      onChange={(event) => setSearch(event.target.value)}
                      value={search}
                    />
                  </div>
                </TextField>

                {errors.relativePath ? (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>
                        {errors.relativePath.message}
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : null}

                <div
                  aria-label="Environment source candidates"
                  className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-divider p-2"
                  role="listbox"
                >
                  {candidates.isLoading ? (
                    <div className="space-y-2 p-2" role="status">
                      <Skeleton className="h-12 rounded-lg" />
                      <Skeleton className="h-12 rounded-lg" />
                      <Skeleton className="h-12 rounded-lg" />
                    </div>
                  ) : candidates.isError ? (
                    <p className="p-4 text-sm text-danger">
                      Source candidates could not be loaded.
                    </p>
                  ) : candidates.data?.items.length ? (
                    candidates.data.items.map((candidate) => {
                      const configured = configuredPaths.has(
                        candidate.relativePath.toLowerCase(),
                      );
                      const selected = selectedPath === candidate.relativePath;
                      return (
                        <button
                          aria-selected={selected}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                            selected
                              ? 'border-accent bg-accent-soft'
                              : 'border-transparent hover:bg-surface-secondary'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                          disabled={configured || candidate.status !== 'active'}
                          key={candidate.id}
                          onClick={() =>
                            setValue('relativePath', candidate.relativePath, {
                              shouldValidate: true,
                            })
                          }
                          role="option"
                          type="button"
                        >
                          <span className="block truncate text-sm font-medium">
                            {candidate.name}
                          </span>
                          <span className="block truncate font-mono text-xs text-muted">
                            {candidate.relativePath}
                          </span>
                          {configured ? (
                            <span className="text-xs text-muted">
                              Already configured
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <p className="p-4 text-sm text-muted">
                      No indexed files match this search. Run File Inventory if
                      the source has not been indexed yet.
                    </p>
                  )}
                </div>
                {candidates.data ? (
                  <p className="text-xs text-muted">
                    Showing {candidates.data.items.length} of{' '}
                    {candidates.data.totalItems} bounded results.
                  </p>
                ) : null}
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button
                isDisabled={isPending}
                onPress={() => onOpenChange(false)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                isDisabled={isPending || !selectedPath}
                onPress={() => void submit()}
                variant="primary"
              >
                {isPending ? (
                  <Spinner aria-label="Adding source" size="sm" />
                ) : null}
                {isPending ? 'Adding…' : 'Add source'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
