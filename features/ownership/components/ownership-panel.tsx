'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { TextInput } from '@/components/forms/text-input';
import { ActionButton } from '@/components/ui/action-button';
import { ClockIcon, RefreshIcon, SaveIcon, UploadIcon } from '@/components/ui/icons';
import { sectionCopy } from '@/lib/ui/section-copy';

import type { ExportFormat, ExportHistoryResponse, ImportPreviewResponse, OwnershipSummaryResponse } from '../api';
import {
  applyBackupRecovery,
  downloadOwnershipExport,
  fetchExportHistory,
  fetchOwnershipSummary,
  validateOwnershipImport,
} from '../client-service';

type OwnershipPanelProps = {
  enabled: boolean;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function OwnershipPanel({ enabled }: OwnershipPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [summary, setSummary] = useState<OwnershipSummaryResponse | null>(null);
  const [history, setHistory] = useState<ExportHistoryResponse[]>([]);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [pendingPayload, setPendingPayload] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    startTransition(async () => {
      try {
        const [nextSummary, nextHistory] = await Promise.all([
          fetchOwnershipSummary(),
          fetchExportHistory(),
        ]);
        setSummary(nextSummary);
        setHistory(nextHistory);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '讀取 ownership 狀態失敗');
      }
    });
  }, [enabled]);

  function resetMessages() {
    setNotice(null);
    setError(null);
  }

  async function refreshAll() {
    const [nextSummary, nextHistory] = await Promise.all([
      fetchOwnershipSummary(),
      fetchExportHistory(),
    ]);
    setSummary(nextSummary);
    setHistory(nextHistory);
  }

  function handleExport(format: ExportFormat) {
    resetMessages();

    startTransition(async () => {
      try {
        const fileName = await downloadOwnershipExport(format);
        await refreshAll();
        setNotice(`已開始下載 ${fileName}。檔案可能包含敏感資料，請妥善保存。`);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '匯出失敗');
      }
    });
  }

  function handlePickImportFile() {
    fileInputRef.current?.click();
  }

  async function handleImportFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    resetMessages();

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as unknown;
      const nextPreview = await validateOwnershipImport(parsed);
      setPendingPayload(parsed);
      setPreview(nextPreview);
      setConfirmText('');
      setNotice(
        nextPreview.canApply
          ? '驗證完成。若要恢復備份，請再次確認後套用。'
          : '驗證完成。偵測到重複資料或 schema mismatch，現階段不會覆蓋既有資料。',
      );
    } catch (nextError) {
      setPendingPayload(null);
      setPreview(null);
      setError(nextError instanceof Error ? nextError.message : '匯入驗證失敗');
    } finally {
      event.target.value = '';
    }
  }

  function handleApplyRecovery() {
    if (!pendingPayload || !preview?.canApply) {
      return;
    }

    resetMessages();

    startTransition(async () => {
      try {
        const result = await applyBackupRecovery(pendingPayload, confirmText);
        await refreshAll();
        setNotice(
          `恢復完成：新增 ${result.restored.items} 個項目、${result.restored.records} 筆紀錄與 ${result.restored.reportSnapshots} 份報表快照。`,
        );
        setPreview(null);
        setPendingPayload(null);
        setConfirmText('');
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '備份恢復失敗');
      }
    });
  }

  if (!enabled) {
    return (
      <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 backdrop-blur sm:p-5 lg:p-6">
        <h2 className="text-xl font-semibold">資料主控權</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {sectionCopy.settings.ownership}
        </p>
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
          目前仍可在本機保存資料；若要匯出雲端資料、查看 export history 或恢復備份，請先登入並連結帳號。
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 backdrop-blur sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">資料主控權</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {sectionCopy.settings.ownership}
          </p>
        </div>
        <ActionButton
          type="button"
          variant="secondary"
          icon={<RefreshIcon size={18} />}
          label="重新整理"
          onClick={() => {
            resetMessages();
            startTransition(async () => {
              try {
                await refreshAll();
              } catch (nextError) {
                setError(nextError instanceof Error ? nextError.message : '重新整理失敗');
              }
            });
          }}
          disabled={isPending}
        />
      </div>

      {notice ? (
        <p className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--foreground)]">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">本機資料</p>
          <p className="mt-2 text-lg font-semibold">
            {summary ? `${summary.local.itemCount} 項目 / ${summary.local.recordCount} 紀錄` : '—'}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            尚未上雲 {summary?.local.localOnlyCount ?? '—'} 筆
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">雲端資料</p>
          <p className="mt-2 text-lg font-semibold">
            {summary ? `${summary.cloud.itemCount} 項目 / ${summary.cloud.recordCount} 紀錄` : '—'}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            報表快照 {summary?.cloud.reportSnapshotCount ?? '—'} 份
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">同步隊列</p>
          <p className="mt-2 text-lg font-semibold">
            待同步 {summary?.local.pendingCount ?? '—'}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            失敗 {summary?.local.failedCount ?? '—'} · 衝突 {summary?.local.conflictCount ?? '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">最後同步</p>
          <p className="mt-2 text-sm font-medium">{formatTimestamp(summary?.sync.lastSyncAt ?? null)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {summary?.sync.lastSyncMessage ?? '目前沒有額外同步訊息'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="grid gap-4">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <h3 className="text-base font-semibold">資料匯出</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              CSV 適合 spreadsheet，JSON 與完整備份適合保留完整結構。匯出檔案可能包含敏感資料，請妥善保存。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton
                type="button"
                icon={<SaveIcon size={18} />}
                label="匯出 CSV"
                onClick={() => handleExport('csv')}
                disabled={isPending}
              />
              <ActionButton
                type="button"
                variant="secondary"
                icon={<SaveIcon size={18} />}
                label="匯出 JSON"
                onClick={() => handleExport('json')}
                disabled={isPending}
              />
              <ActionButton
                type="button"
                variant="secondary"
                icon={<SaveIcon size={18} />}
                label="建立完整備份"
                onClick={() => handleExport('full_backup')}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <h3 className="text-base font-semibold">匯入驗證與備份恢復</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              先驗證，再決定是否恢復。若偵測到 duplicate、schema mismatch 或關聯不完整，系統不會直接覆蓋既有資料。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton
                type="button"
                icon={<UploadIcon size={18} />}
                label="選擇 JSON / 備份檔"
                onClick={handlePickImportFile}
                disabled={isPending}
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void handleImportFileChange(event)}
            />

            {preview ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--foreground)]">
                  偵測格式：{preview.format === 'full_backup' ? '完整備份' : 'JSON'} ·
                  schema version：{preview.schemaVersion}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--line)] bg-stone-50 p-4 text-sm">
                    <p>項目：{preview.summary.itemCount}</p>
                    <p>紀錄：{preview.summary.recordCount}</p>
                    <p>報表快照：{preview.summary.reportSnapshotCount}</p>
                    <p>裝置資訊：{preview.summary.deviceCount}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-stone-50 p-4 text-sm">
                    <p>重複項目：{preview.duplicates.items}</p>
                    <p>重複紀錄：{preview.duplicates.records}</p>
                    <p>重複報表快照：{preview.duplicates.reportSnapshots}</p>
                  </div>
                </div>
                {preview.conflicts.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {preview.conflicts.map((conflict) => (
                      <p key={`${conflict.kind}:${conflict.message}`}>{conflict.message}</p>
                    ))}
                  </div>
                ) : null}
                <div className="rounded-2xl border border-[var(--line)] bg-stone-50 p-4">
                  <p className="text-sm text-[var(--muted)]">
                    若要套用恢復，請輸入 <span className="font-semibold text-[var(--foreground)]">RESTORE</span> 後再確認。
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <TextInput
                      value={confirmText}
                      onChange={(event) => setConfirmText(event.target.value)}
                      placeholder="輸入 RESTORE"
                    />
                    <ActionButton
                      type="button"
                      icon={<RefreshIcon size={18} />}
                      label="確認恢復"
                      onClick={handleApplyRecovery}
                      disabled={isPending || !preview.canApply || confirmText !== 'RESTORE'}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <h3 className="text-base font-semibold">匯出紀錄</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              可回顧過去曾經匯出的格式、時間與範圍感知。
            </p>
            <div className="mt-4 grid gap-3">
              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-4 text-sm text-[var(--muted)]">
                  目前還沒有 export history。
                </div>
              ) : (
                history.slice(0, 6).map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-2xl border border-[var(--line)] bg-stone-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <ClockIcon size={16} />
                      <p className="text-sm font-medium">{entry.fileName}</p>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {entry.exportFormat} · {formatTimestamp(entry.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {entry.itemCount} 項目 · {entry.recordCount} 紀錄 · 使用者參考 {entry.maskedUserReference}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <h3 className="text-base font-semibold">同步中的裝置</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              以狀態為主，協助理解哪些裝置仍在參與同步，不提供過度複雜的即時控制。
            </p>
            <div className="mt-4 grid gap-3">
              {summary?.devices.length ? (
                summary.devices.map((device) => (
                  <article
                    key={device.deviceId}
                    className="rounded-2xl border border-[var(--line)] bg-stone-50 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {device.isCurrentDevice ? '目前裝置' : '其他裝置'}
                      </p>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[var(--muted)]">
                        {device.lastSyncStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)] break-all">
                      {device.deviceId}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      上次完成同步：{formatTimestamp(device.lastSyncCompletedAt)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      最近看見：{formatTimestamp(device.lastSeenAt)}
                    </p>
                    {device.lastErrorCode ? (
                      <p className="mt-1 text-xs text-rose-700">
                        最近錯誤：{device.lastErrorCode}
                      </p>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--accent-soft)] px-4 py-4 text-sm text-[var(--muted)]">
                  目前只有最小可行裝置資訊；若後續資料結構補齊，再擴充完整裝置管理。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
