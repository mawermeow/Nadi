'use client';

import { useState } from 'react';

import { TextInput } from '@/components/forms/text-input';
import { IconButton } from '@/components/ui/icon-button';
import { OverlayActionRail } from '@/components/ui/overlay-action-rail';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderIcon,
  PencilIcon,
  SaveIcon,
  TrashIcon,
  XIcon,
} from '@/components/ui/icons';
import type { ItemResponse } from '@/features/items/api';
import { getSyncStatusPresentation } from '@/features/sync/local-ui';

type ItemSettingsCardProps = {
  item: ItemResponse;
  variant: 'active' | 'archived';
  recordHistoryCount: number;
  isMutating: boolean;
  isEditing: boolean;
  editingTitle: string;
  onEditingTitleChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onToggleArchive: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  valueTypeLabel: string;
};

function getItemTypeBadgeClass(type: 'metric' | 'symptom') {
  return type === 'symptom'
    ? 'bg-rose-100 text-rose-700'
    : 'bg-[var(--accent-soft)] text-[var(--accent)]';
}

export function ItemSettingsCard({
  item,
  variant,
  recordHistoryCount,
  isMutating,
  isEditing,
  editingTitle,
  onEditingTitleChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onToggleArchive,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  valueTypeLabel,
}: ItemSettingsCardProps) {
  const [actionsRevealed, setActionsRevealed] = useState(false);
  const syncStatus = getSyncStatusPresentation(item.syncStatus);
  const canDelete = recordHistoryCount === 0;
  const shellClassName =
    variant === 'archived'
      ? 'rounded-2xl border border-[var(--line)] bg-stone-50 p-4'
      : 'rounded-2xl border border-[var(--line)] bg-white p-4';
  const maskClassName =
    variant === 'archived'
      ? 'from-stone-50 from-65% via-stone-50/95'
      : 'from-white from-65% via-white/95';

  const revealedActions = (
    <>
      <IconButton
        label="修改名稱"
        icon={<PencilIcon size={18} />}
        disabled={isMutating}
        onClick={() => {
          setActionsRevealed(false);
          onStartEdit();
        }}
        tabIndex={actionsRevealed ? undefined : -1}
      />
      {canDelete ? (
        <IconButton
          label={isMutating ? '刪除中…' : '刪除'}
          icon={isMutating ? <LoaderIcon size={18} /> : <TrashIcon size={18} />}
          disabled={isMutating}
          onClick={onDelete}
          className="text-rose-600"
          tabIndex={actionsRevealed ? undefined : -1}
        />
      ) : null}
      <IconButton
        label={
          isMutating
            ? '處理中…'
            : variant === 'active'
              ? '封存'
              : '恢復'
        }
        icon={
          isMutating ? (
            <LoaderIcon size={18} />
          ) : variant === 'active' ? (
            <EyeOffIcon size={18} />
          ) : (
            <EyeIcon size={18} />
          )
        }
        disabled={isMutating}
        onClick={onToggleArchive}
        tabIndex={actionsRevealed ? undefined : -1}
      />
      <IconButton
        label="往前移動"
        icon={<ArrowUpIcon size={18} />}
        disabled={isMutating || !canMoveUp}
        onClick={onMoveUp}
        tabIndex={actionsRevealed ? undefined : -1}
      />
      <IconButton
        label="往後移動"
        icon={<ArrowDownIcon size={18} />}
        disabled={isMutating || !canMoveDown}
        onClick={onMoveDown}
        tabIndex={actionsRevealed ? undefined : -1}
      />
    </>
  );

  return (
    <OverlayActionRail
      className={shellClassName}
      enabled={!isEditing}
      actionsRevealed={actionsRevealed}
      onReveal={() => setActionsRevealed(true)}
      onClose={() => setActionsRevealed(false)}
      ariaLabel="項目操作"
      maskClassName={maskClassName}
      maskWidthClassName="w-72 sm:w-80"
      revealedActions={revealedActions}
    >
      {isEditing ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <TextInput
            value={editingTitle}
            onChange={(event) => onEditingTitleChange(event.target.value)}
            placeholder="請輸入項目名稱"
            className="sm:max-w-xs"
          />
          <div className="flex gap-2">
            <IconButton
              label={isMutating ? '儲存中…' : '儲存名稱'}
              icon={isMutating ? <LoaderIcon size={18} /> : <SaveIcon size={18} />}
              disabled={isMutating}
              onClick={onSaveEdit}
            />
            <IconButton
              label="取消改名"
              icon={<XIcon size={18} />}
              disabled={isMutating}
              onClick={onCancelEdit}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={
                variant === 'active'
                  ? 'text-lg font-semibold'
                  : 'text-base font-semibold'
              }
            >
              {item.title}
            </h3>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${getItemTypeBadgeClass(item.type)}`}
            >
              {item.type === 'metric' ? '指標' : '症狀'}
            </span>
            {syncStatus ? (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${syncStatus.className}`}
              >
                {syncStatus.label}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {variant === 'archived'
              ? `${item.type === 'metric' ? '指標' : '症狀'} / ${valueTypeLabel}`
              : `格式：${valueTypeLabel}`}
            {variant === 'active' && item.unit ? ` / 單位：${item.unit}` : ''}
            {variant === 'active' &&
            item.valueType === 'scale' &&
            item.scaleMin !== undefined &&
            item.scaleMax !== undefined
              ? ` / 範圍：${item.scaleMin} - ${item.scaleMax}`
              : ''}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {recordHistoryCount === 0
              ? variant === 'active'
                ? '尚無歷史紀錄，可直接刪除。'
                : '尚無歷史紀錄，可恢復或直接刪除。'
              : `已有 ${recordHistoryCount} 筆歷史紀錄。`}
          </p>
        </>
      )}
    </OverlayActionRail>
  );
}
