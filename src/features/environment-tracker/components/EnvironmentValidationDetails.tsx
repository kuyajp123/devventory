import { Chip } from '@heroui/react';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { SemanticStatusChip } from '@/shared/ui';
import type { EnvironmentMatrixCellValidation } from '../models/environment';

export function EnvironmentValidationDetails({
  validation,
}: {
  validation: EnvironmentMatrixCellValidation;
}) {
  return (
    <section aria-labelledby="selected-key-validation-heading">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium" id="selected-key-validation-heading">
          Validation
        </h3>
        <Chip size="sm" variant="soft">
          <Chip.Label>{validation.openIssues.length} open</Chip.Label>
        </Chip>
      </div>

      {validation.openIssues.length === 0 ? (
        <div className="mt-3 flex items-start gap-2 text-sm text-muted">
          <IconCircleCheck
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-success"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          <p>No open validation issues target this key and environment.</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {validation.openIssues.map((issue) => {
            const IssueIcon =
              issue.severity === 'error'
                ? IconAlertCircle
                : issue.severity === 'warning'
                  ? IconAlertTriangle
                  : IconInfoCircle;
            return (
              <li
                className="rounded-[4px] border border-divider bg-workspace p-3"
                key={issue.id}
              >
                <div className="flex items-start gap-2">
                  <IssueIcon
                    aria-hidden="true"
                    className={
                      issue.severity === 'error'
                        ? 'text-danger'
                        : issue.severity === 'warning'
                          ? 'text-warning'
                          : 'text-accent'
                    }
                    size={ICON_SIZE.small}
                    stroke={ICON_STROKE}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SemanticStatusChip
                        dataStatus={issue.severity}
                        label={issue.severity}
                        labelClassName="capitalize"
                        tone={
                          issue.severity === 'error'
                            ? 'danger'
                            : issue.severity === 'warning'
                              ? 'warning'
                              : 'accent'
                        }
                      />
                      <span className="font-mono text-[10px] uppercase text-muted">
                        {issue.issueType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted">
                      {issue.message}
                    </p>
                    {issue.sourcePath ? (
                      <p className="mt-1 truncate font-mono text-[10px] text-muted">
                        {issue.sourcePath}
                        {issue.lineNumber ? `:${issue.lineNumber}` : ''}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 border-t border-divider pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Applicable rules
          </p>
          <span className="font-mono text-[10px] text-muted">
            {validation.rules.length}
          </span>
        </div>
        {validation.rules.length === 0 ? (
          <p className="mt-2 text-xs text-muted">
            No enabled rule targets this cell.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {validation.rules.map((rule) => (
              <li
                className="flex items-start justify-between gap-3 rounded-[4px] border border-divider px-3 py-2"
                key={rule.id}
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs font-medium capitalize">
                    {rule.ruleType}
                  </p>
                  {rule.description ? (
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {rule.description}
                    </p>
                  ) : null}
                </div>
                <SemanticStatusChip
                  dataStatus={rule.severity}
                  label={rule.severity}
                  labelClassName="capitalize"
                  tone={
                    rule.severity === 'error'
                      ? 'danger'
                      : rule.severity === 'warning'
                        ? 'warning'
                        : 'accent'
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
