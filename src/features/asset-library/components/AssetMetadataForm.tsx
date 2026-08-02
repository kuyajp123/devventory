import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Card,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  Switch,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { Controller, useForm } from 'react-hook-form';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { useUpdateAssetMetadataMutation } from '../hooks/use-assets';
import {
  assetMetadataFormSchema,
  parseTags,
  type Asset,
  type AssetMetadataFormValues,
} from '../models/asset';

export function AssetMetadataForm({
  asset,
  candidates,
}: {
  asset: Asset;
  candidates: Asset[];
}) {
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
      variantIds: asset.variantIds,
    },
    resolver: zodResolver(assetMetadataFormSchema),
  });

  const submit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        assetId: asset.id,
        favorite: values.favorite,
        note: values.note || undefined,
        tags: parseTags(values.tagsText),
        variantIds: values.variantIds,
      });
      toast.success('Asset metadata saved');
    } catch (error) {
      toast.danger(
        error instanceof TauriCommandError
          ? error.message
          : 'Asset metadata could not be saved.',
      );
    }
  });

  return (
    <Card>
      <Card.Header>
        <Card.Title>Managed metadata</Card.Title>
        <Card.Description>
          Tags are reusable within this project. Variant relationships stay
          project-local.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <Form
          className="grid gap-5 sm:grid-cols-2"
          onSubmit={(event) => event.preventDefault()}
          validationBehavior="aria"
        >
          <TextField
            fullWidth
            isInvalid={Boolean(errors.tagsText)}
            variant="secondary"
          >
            <Label>Tags (comma separated)</Label>
            <Input placeholder="brand, approved" {...register('tagsText')} />
            <FieldError>{errors.tagsText?.message}</FieldError>
          </TextField>

          <Controller
            control={control}
            name="variantIds"
            render={({ field, fieldState }) => (
              <Select
                fullWidth
                isInvalid={Boolean(fieldState.error)}
                onBlur={field.onBlur}
                onChange={(value) => field.onChange(value ?? [])}
                placeholder="Select related variants"
                selectionMode="multiple"
                value={field.value}
                variant="secondary"
              >
                <Label>Asset variants</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <FieldError>{fieldState.error?.message}</FieldError>
                <Select.Popover>
                  <ListBox>
                    {candidates.map((candidate) => (
                      <ListBox.Item
                        id={candidate.id}
                        key={candidate.id}
                        textValue={candidate.relativePath}
                      >
                        <Label>{candidate.name}</Label>
                        <span className="block truncate font-mono text-xs text-muted">
                          {candidate.relativePath}
                        </span>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            )}
          />

          <TextField
            className="sm:col-span-2"
            fullWidth
            isInvalid={Boolean(errors.note)}
            variant="secondary"
          >
            <Label>Note</Label>
            <TextArea rows={5} {...register('note')} />
            <FieldError>{errors.note?.message}</FieldError>
          </TextField>

          <Controller
            control={control}
            name="favorite"
            render={({ field }) => (
              <Switch isSelected={field.value} onChange={field.onChange}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Favorite asset
                </Switch.Content>
              </Switch>
            )}
          />

          <div className="flex justify-end sm:col-span-2">
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
