import { Button, Chip, Spinner, Table } from '@heroui/react';
import { IconPlus } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type { VariantCandidate } from '../models/asset';

interface VariantCandidateTableProps {
  candidates: VariantCandidate[];
  isFetching: boolean;
  isPending: boolean;
  onAdd: (candidate: VariantCandidate) => void;
}

export function VariantCandidateTable({
  candidates,
  isFetching,
  isPending,
  onAdd,
}: VariantCandidateTableProps) {
  if (isPending) {
    return (
      <div className="flex min-h-40 items-center justify-center" role="status">
        <Spinner aria-label="Loading variant candidates" />
      </div>
    );
  }
  if (!candidates.length) {
    return (
      <div className="rounded-xl border border-dashed border-default p-8 text-center">
        <p className="font-medium">No matching files</p>
        <p className="mt-1 text-sm text-muted">
          Try another search or broaden the scope.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {isFetching && (
        <Spinner
          aria-label="Refreshing variant candidates"
          className="absolute right-3 top-3 z-10"
          size="sm"
        />
      )}
      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-label="Variant candidates">
            <Table.Header>
              <Table.Column id="relativePath" isRowHeader>
                File path
              </Table.Column>
              <Table.Column id="type">Type</Table.Column>
              <Table.Column id="origin">Origin</Table.Column>
              <Table.Column id="match">Match</Table.Column>
              <Table.Column id="action">Action</Table.Column>
            </Table.Header>
            <Table.Body items={candidates}>
              {(candidate) => (
                <Table.Row id={candidate.id}>
                  <Table.Cell className="max-w-md">
                    <span className="block truncate font-medium">
                      {candidate.name}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted">
                      {candidate.relativePath}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="uppercase">
                    {candidate.extension ?? candidate.category}
                  </Table.Cell>
                  <Table.Cell>
                    <Chip size="sm" variant="soft">
                      <Chip.Label className="capitalize">
                        {candidate.origin}
                      </Chip.Label>
                    </Chip>
                  </Table.Cell>
                  <Table.Cell className="text-xs text-muted">
                    {matchLabel(candidate)}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      aria-label={`Add ${candidate.relativePath}`}
                      onPress={() => onAdd(candidate)}
                      size="sm"
                      variant="ghost"
                    >
                      <IconPlus
                        aria-hidden="true"
                        size={ICON_SIZE.small}
                        stroke={ICON_STROKE}
                      />
                      Add
                    </Button>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}

function matchLabel(candidate: VariantCandidate) {
  if (candidate.reasons.sameFolder) return 'Same folder';
  if (candidate.reasons.similarName) return 'Similar name';
  if (candidate.reasons.matchingMetadata) return 'Shared metadata';
  if (candidate.reasons.compatibleType) return 'Compatible type';
  if (candidate.reasons.sameAssetRoot) return 'Asset root';
  return 'Indexed file';
}
