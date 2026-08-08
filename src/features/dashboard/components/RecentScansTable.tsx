import { Card, Chip, Table } from '@heroui/react';
import type { ProjectDashboard } from '../models/dashboard';

export function RecentScansTable({
  scans,
}: {
  scans: ProjectDashboard['recentScans'];
}) {
  return (
    <Card className="overflow-hidden border border-divider bg-surface">
      <Card.Header>
        <Card.Title className="text-sm">Recent inventory scans</Card.Title>
        <Card.Description className="text-xs">
          The eight most recent scan summaries for this project.
        </Card.Description>
      </Card.Header>
      <Card.Content className="p-0">
        {scans.length === 0 ? (
          <p className="border-t border-divider p-5 text-xs text-muted">
            No inventory scan has been recorded yet.
          </p>
        ) : (
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Recent inventory scans">
                <Table.Header>
                  <Table.Column id="started" isRowHeader>
                    Started
                  </Table.Column>
                  <Table.Column id="type">Type</Table.Column>
                  <Table.Column id="status">Status</Table.Column>
                  <Table.Column id="discovered">Discovered</Table.Column>
                  <Table.Column id="changed">Changed</Table.Column>
                  <Table.Column id="duration">Duration</Table.Column>
                </Table.Header>
                <Table.Body items={scans}>
                  {(scan) => (
                    <Table.Row id={scan.id}>
                      <Table.Cell className="font-mono text-xs">
                        {formatTimestamp(scan.startedAt)}
                      </Table.Cell>
                      <Table.Cell className="font-mono text-xs">
                        {scan.scanType.replace(/_/g, ' ')}
                      </Table.Cell>
                      <Table.Cell>
                        <Chip
                          color={
                            scan.status === 'completed'
                              ? 'success'
                              : scan.status === 'failed'
                                ? 'danger'
                                : 'warning'
                          }
                          size="sm"
                          variant="soft"
                        >
                          <Chip.Label className="font-mono text-[10px]">
                            {scan.status}
                          </Chip.Label>
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="font-mono tabular-nums">
                        {scan.filesDiscovered}
                      </Table.Cell>
                      <Table.Cell className="font-mono tabular-nums">
                        +{scan.filesAdded} / ~{scan.filesUpdated} / -
                        {scan.filesMissing}
                      </Table.Cell>
                      <Table.Cell className="font-mono tabular-nums">
                        {scan.durationMs} ms
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        )}
      </Card.Content>
    </Card>
  );
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(parsed);
}
