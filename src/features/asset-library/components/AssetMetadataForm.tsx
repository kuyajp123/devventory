import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import {
  Button,
  Card,
  FieldError,
  Form,
  Input,
  Label,
  Spinner,
  Switch,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  IconDeviceFloppy,
  IconHash,
  IconHeart,
  IconNote,
} from '@tabler/icons-react';
import { Controller, useForm } from 'react-hook-form';
import { useUpdateAssetMetadataMutation } from '../hooks/use-assets';
import {
  assetMetadataFormSchema,
  parseTags,
  type Asset,
  type AssetMetadataFormValues,
} from '../models/asset';

interface AssetMetadataFormProps {
  asset: Asset;
  embedded?: boolean;
  onSaved?: (asset: Asset) => void;
}

export function AssetMetadataForm({
  asset,
  embedded = false,
  onSaved,
}: AssetMetadataFormProps) {
  const update = useUpdateAssetMetadataMutation(asset.projectId);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<AssetMetadataFormValues>({
    defaultValues: {
      favorite: asset.favorite,
      note: asset.note ?? '',
      tagsText: asset.tags.join(', '),
    },
    resolver: zodResolver(assetMetadataFormSchema),
  });

  const submit = handleSubmit(async (values) => {
    try {
      const updated = await update.mutateAsync({
        assetId: asset.id,
        favorite: values.favorite,
        note: values.note || undefined,
        tags: parseTags(values.tagsText),
        variantIds: asset.variantIds,
      });
      toast.success('Asset metadata saved');
      onSaved?.(updated);
    } catch (error) {
      toast.danger(
        error instanceof TauriCommandError
          ? error.message
          : 'Asset metadata could not be saved.',
      );
    }
  });

  return (
    <Card className={embedded ? 'border-0 bg-transparent' : undefined}>
      {!embedded && (
        <Card.Header>
          <Card.Title>Managed metadata</Card.Title>
          <Card.Description>
            Tags are reusable within this project. Variant relationships stay
            project-local.
          </Card.Description>
        </Card.Header>
      )}
      <Card.Content>
        <Form
          className="space-y-5"
          onSubmit={(event) => event.preventDefault()}
          validationBehavior="aria"
        >
          <Controller
            control={control}
            name="favorite"
            render={({ field }) => (
              <Switch isSelected={field.value} onChange={field.onChange}>
                <Switch.Content>
                  <span className="flex items-center gap-1.5">
                    <IconHeart
                      aria-hidden="true"
                      className={field.value ? 'text-danger' : 'text-muted'}
                      size={ICON_SIZE.small}
                      stroke={ICON_STROKE}
                    />
                    Favorite asset
                  </span>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            )}
          />

          {/* Tags field with icon cue */}
          <TextField
            fullWidth
            isInvalid={Boolean(errors.tagsText)}
            variant="secondary"
          >
            <Label className="flex items-center gap-1.5">
              <IconHash
                aria-hidden="true"
                className="text-muted"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
              Tags
            </Label>
            <Input
              placeholder="brand, approved, v2 — separate with commas"
              {...register('tagsText')}
            />
            <FieldError>{errors.tagsText?.message}</FieldError>
          </TextField>

          {/* Note field with icon cue */}
          <TextField
            fullWidth
            isInvalid={Boolean(errors.note)}
            variant="secondary"
          >
            <Label className="flex items-center gap-1.5">
              <IconNote
                aria-hidden="true"
                className="text-muted"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
              Note
            </Label>
            <TextArea
              placeholder="Add internal notes, usage context, or review comments..."
              rows={4}
              {...register('note')}
            />
            <FieldError>{errors.note?.message}</FieldError>
          </TextField>

          {/* Favorite + Save row */}
          <div className="flex flex-wrap items-center justify-end gap-4 border-t p-4">
            <Button
              isDisabled={update.isPending}
              onPress={() => void submit()}
              variant="primary"
            >
              {update.isPending ? (
                <Spinner aria-label="Saving asset metadata" size="sm" />
              ) : (
                <IconDeviceFloppy
                  aria-hidden="true"
                  size={ICON_SIZE.button}
                  stroke={ICON_STROKE}
                />
              )}
              {update.isPending ? 'Saving…' : 'Save metadata'}
            </Button>
          </div>
        </Form>
      </Card.Content>
    </Card>
  );
}
