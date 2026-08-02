import { Label, ListBox, Select, type Key } from '@heroui/react';

const ALL_ITEMS = 'all';

export function AssetFilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: Key | null) => void;
  options: ReadonlyArray<{ label: string; value: string }>;
  value: Key;
}) {
  return (
    <Select fullWidth onChange={onChange} value={value} variant="secondary">
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id={ALL_ITEMS} textValue={`All ${label.toLowerCase()}`}>
            <Label>All {label.toLowerCase()}</Label>
            <ListBox.ItemIndicator />
          </ListBox.Item>
          {options.map((option) => (
            <ListBox.Item
              id={option.value}
              key={option.value}
              textValue={option.label}
            >
              <Label>{option.label}</Label>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
