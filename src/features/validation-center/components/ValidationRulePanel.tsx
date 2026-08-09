import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Card, EmptyState, Skeleton } from '@heroui/react';
import {
  IconArrowDown,
  IconArrowUp,
  IconEdit,
  IconGripVertical,
  IconPlus,
  IconChecklist,
  IconTrash,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { Environment } from '@/features/environment-tracker';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { ConfirmDialog, SemanticStatusChip } from '@/shared/ui';
import type { ValidationRule } from '../models/validation';

interface ValidationRulePanelProps {
  environments: Environment[];
  isLoading: boolean;
  isReordering: boolean;
  onCreate: () => void;
  onDelete: (rule: ValidationRule) => void;
  onEdit: (rule: ValidationRule) => void;
  onReorder: (ruleIds: string[]) => Promise<void>;
  rules: ValidationRule[];
}

export function ValidationRulePanel({
  environments,
  isLoading,
  isReordering,
  onCreate,
  onDelete,
  onEdit,
  onReorder,
  rules,
}: ValidationRulePanelProps) {
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null);
  const [deletingRule, setDeletingRule] = useState<ValidationRule | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const orderedRules = useMemo(() => {
    if (!optimisticOrder) return rules;

    const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
    if (
      optimisticOrder.length !== rules.length ||
      optimisticOrder.some((ruleId) => !rulesById.has(ruleId))
    ) {
      return rules;
    }

    return optimisticOrder.map((ruleId) => rulesById.get(ruleId)!);
  }, [optimisticOrder, rules]);

  function persistOrder(nextRules: ValidationRule[]) {
    const previousOrder = optimisticOrder;
    const nextOrder = nextRules.map((rule) => rule.id);
    setOptimisticOrder(nextOrder);
    void onReorder(nextOrder).then(
      () => setOptimisticOrder(null),
      () => setOptimisticOrder(previousOrder),
    );
  }

  function move(ruleId: string, offset: -1 | 1) {
    const oldIndex = orderedRules.findIndex((rule) => rule.id === ruleId);
    const newIndex = oldIndex + offset;
    if (oldIndex < 0 || newIndex < 0 || newIndex >= orderedRules.length) return;
    persistOrder(arrayMove(orderedRules, oldIndex, newIndex));
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = orderedRules.findIndex(
      (rule) => rule.id === event.active.id,
    );
    const newIndex = orderedRules.findIndex(
      (rule) => rule.id === event.over?.id,
    );
    if (oldIndex < 0 || newIndex < 0) return;
    persistOrder(arrayMove(orderedRules, oldIndex, newIndex));
  }

  return (
    <Card className="border border-divider bg-surface">
      <Card.Header className="flex flex-row items-start justify-between gap-3 border-b border-divider px-4 py-3">
        <div>
          <Card.Title>Validation rules</Card.Title>
          <Card.Description>
            Required, optional, and forbidden key placement by environment.
          </Card.Description>
        </div>
        <Button
          isDisabled={environments.length === 0}
          onPress={onCreate}
          size="sm"
          variant="primary"
        >
          <IconPlus
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          Add rule
        </Button>
      </Card.Header>
      <Card.Content className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton className="h-20 rounded-md" key={index} />
            ))}
          </div>
        ) : orderedRules.length === 0 ? (
          <EmptyState className="rounded-md border border-dashed border-divider bg-workspace p-6 text-center">
            <IconChecklist
              aria-hidden="true"
              className="mx-auto text-muted"
              size={ICON_SIZE.emptyState}
              stroke={ICON_STROKE}
            />
            <h3 className="mt-3 font-semibold">No validation rules yet</h3>
            <p className="mt-1 text-sm text-muted">
              Add a rule to make environment placement explicit. Unruled keys
              are not treated as unexpected.
            </p>
          </EmptyState>
        ) : (
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            sensors={sensors}
          >
            <SortableContext
              items={orderedRules.map((rule) => rule.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2" role="list">
                {orderedRules.map((rule, index) => (
                  <SortableRule
                    environmentNames={rule.environmentIds.map(
                      (id) =>
                        environments.find(
                          (environment) => environment.id === id,
                        )?.name ?? 'Removed environment',
                    )}
                    index={index}
                    isBusy={isReordering}
                    isFirst={index === 0}
                    isLast={index === orderedRules.length - 1}
                    key={rule.id}
                    onDelete={() => setDeletingRule(rule)}
                    onEdit={() => onEdit(rule)}
                    onMoveDown={() => move(rule.id, 1)}
                    onMoveUp={() => move(rule.id, -1)}
                    rule={rule}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </Card.Content>
      <ConfirmDialog
        body={
          deletingRule
            ? `Delete the ${deletingRule.keyName} rule? Existing issues will be re-evaluated.`
            : null
        }
        isOpen={deletingRule !== null}
        onConfirm={() => {
          if (deletingRule) onDelete(deletingRule);
          setDeletingRule(null);
        }}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeletingRule(null);
        }}
        title="Delete validation rule"
      />
    </Card>
  );
}

function SortableRule({
  environmentNames,
  index,
  isBusy,
  isFirst,
  isLast,
  onDelete,
  onEdit,
  onMoveDown,
  onMoveUp,
  rule,
}: {
  environmentNames: string[];
  index: number;
  isBusy: boolean;
  isFirst: boolean;
  isLast: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  rule: ValidationRule;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      disabled: isBusy,
      id: rule.id,
    });

  return (
    <div
      className={`flex items-start gap-2 rounded-md border border-divider bg-workspace p-3 ${rule.enabled ? '' : 'opacity-60'}`}
      ref={setNodeRef}
      role="listitem"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        aria-label={`Reorder ${rule.keyName}`}
        className="mt-1 cursor-grab rounded p-1 text-muted hover:bg-surface-secondary hover:text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        type="button"
        {...attributes}
        {...listeners}
      >
        <IconGripVertical
          aria-hidden="true"
          size={ICON_SIZE.button}
          stroke={ICON_STROKE}
        />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">
            {rule.keyName}
          </span>
          <SemanticStatusChip
            dataStatus={rule.ruleType}
            label={rule.ruleType}
            labelClassName="capitalize"
            tone={
              rule.ruleType === 'forbidden'
                ? 'danger'
                : rule.ruleType === 'required'
                  ? 'accent'
                  : 'neutral'
            }
          />
          <SemanticStatusChip
            dataStatus={rule.severity}
            label={rule.severity}
            labelClassName="capitalize"
            tone={
              rule.severity === 'error'
                ? 'danger'
                : rule.severity === 'warning'
                  ? 'warning'
                  : 'neutral'
            }
          />
          {!rule.enabled && (
            <span className="text-xs text-muted">Disabled</span>
          )}
        </div>
        <p
          className="mt-1 truncate text-xs text-muted"
          title={environmentNames.join(', ')}
        >
          {environmentNames.join(', ')}
        </p>
        {rule.description && (
          <p className="mt-1 text-xs text-secondary">{rule.description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          aria-label={`Move ${rule.keyName} up`}
          isDisabled={isBusy || isFirst}
          isIconOnly
          onPress={onMoveUp}
          size="sm"
          variant="ghost"
        >
          <IconArrowUp
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        </Button>
        <Button
          aria-label={`Move ${rule.keyName} down`}
          isDisabled={isBusy || isLast}
          isIconOnly
          onPress={onMoveDown}
          size="sm"
          variant="ghost"
        >
          <IconArrowDown
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        </Button>
        <Button
          aria-label={`Edit ${rule.keyName}`}
          isIconOnly
          onPress={onEdit}
          size="sm"
          variant="ghost"
        >
          <IconEdit
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        </Button>
        <Button
          aria-label={`Delete ${rule.keyName}`}
          isIconOnly
          onPress={onDelete}
          size="sm"
          variant="ghost"
        >
          <IconTrash
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        </Button>
      </div>
      <span className="sr-only">Position {index + 1}</span>
    </div>
  );
}
