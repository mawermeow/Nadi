'use client';

import { useEffect, useState, useTransition } from 'react';

import { ActionButton } from '@/components/ui/action-button';
import { TextInput } from '@/components/forms/text-input';
import { ArrowRightIcon, RefreshIcon, SaveIcon, XIcon } from '@/components/ui/icons';
import { authClient } from '@/lib/auth/auth-client';
import {
  getLocalAccountMergeSummary,
  linkDeviceToAuthenticatedAccount,
  unlinkLocalAccount,
} from '@/features/auth/client-service';
import { runSync } from '@/features/sync/client-service';

type AccountPanelProps = {
  initialSessionUser: {
    id: string;
    email: string;
    name: string;
  } | null;
};

type AuthMode = 'sign-in' | 'sign-up';

export function AccountPanel({ initialSessionUser }: AccountPanelProps) {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [currentUser, setCurrentUser] = useState(initialSessionUser);
  const [name, setName] = useState(initialSessionUser?.name ?? '');
  const [email, setEmail] = useState(initialSessionUser?.email ?? '');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mergeSummary, setMergeSummary] = useState<{
    deviceId: string;
    localItemCount: number;
    localRecordCount: number;
    pendingOperationCount: number;
    linkedAccountUserId: string | null;
  } | null>(null);
  const [isWorking, startTransition] = useTransition();

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (session?.user) {
      setCurrentUser({
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      });
      return;
    }

    setCurrentUser(null);
  }, [isPending, session?.user]);

  const effectiveUser = currentUser;

  useEffect(() => {
    void getLocalAccountMergeSummary().then(setMergeSummary);
  }, []);

  async function refreshLocalSummary() {
    const summary = await getLocalAccountMergeSummary();
    setMergeSummary(summary);
    return summary;
  }

  function resetMessages() {
    setNotice(null);
    setError(null);
  }

  function resetAuthForm() {
    setPassword('');
    if (!effectiveUser) {
      setName('');
      setEmail('');
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();

    startTransition(async () => {
      try {
        if (mode === 'sign-up') {
          const result = await authClient.signUp.email({
            name: name.trim(),
            email: email.trim(),
            password,
          });

          if (result.error) {
            setError(result.error.message ?? '註冊失敗');
            return;
          }

          setNotice('帳號已建立。接下來可以連結這台裝置，將本機資料同步到雲端。');
        } else {
          const result = await authClient.signIn.email({
            email: email.trim(),
            password,
          });

          if (result.error) {
            setError(result.error.message ?? '登入失敗');
            return;
          }

          setNotice('登入成功。若要把本機資料同步到帳號，請先連結這台裝置。');
        }

        await refetch();
        await refreshLocalSummary();
        resetAuthForm();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '帳號操作失敗');
      }
    });
  }

  function handleSignOut() {
    resetMessages();

    startTransition(async () => {
      try {
        const result = await authClient.signOut();

        if (result.error) {
          setError(result.error.message ?? '登出失敗');
          return;
        }

        await unlinkLocalAccount();
        await refetch();
        await refreshLocalSummary();
        setCurrentUser(null);
        setNotice('已登出。你的本機資料仍保留在這台裝置。');
        resetAuthForm();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '登出失敗');
      }
    });
  }

  function handleLinkDevice(forceRelink = false) {
    if (!effectiveUser) {
      return;
    }

    resetMessages();

    startTransition(async () => {
      try {
        const result = await linkDeviceToAuthenticatedAccount({
          userId: effectiveUser.id,
          email: effectiveUser.email,
          forceRelink,
        });

        await runSync();
        const summary = await refreshLocalSummary();
        setNotice(
          result.requiresLocalMerge || summary.pendingOperationCount > 0
            ? '裝置已連結，並已開始把本機資料合併到雲端帳號。'
            : '裝置已連結，之後這台裝置的雲端同步會以目前帳號為準。',
        );
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '裝置連結失敗');
      }
    });
  }

  const isLinkedToCurrentAccount =
    !!effectiveUser &&
    mergeSummary?.linkedAccountUserId === effectiveUser.id;
  const isLinkedToOtherAccount =
    !!effectiveUser &&
    !!mergeSummary?.linkedAccountUserId &&
    mergeSummary.linkedAccountUserId !== effectiveUser.id;

  return (
    <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/88 p-4 backdrop-blur sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">帳號與雲端同步</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            未登入時仍可使用本機模式。登入後，請先連結這台裝置，再決定是否把本機資料同步到帳號。
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--muted)]">
          裝置 ID：{mergeSummary?.deviceId ?? '讀取中…'}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">本機項目</p>
          <p className="mt-2 text-lg font-semibold">{mergeSummary?.localItemCount ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">本機紀錄</p>
          <p className="mt-2 text-lg font-semibold">{mergeSummary?.localRecordCount ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-sm text-[var(--muted)]">待同步變更</p>
          <p className="mt-2 text-lg font-semibold">
            {mergeSummary?.pendingOperationCount ?? '—'}
          </p>
        </div>
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

      {effectiveUser ? (
        <div className="mt-5 grid gap-4">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm text-[var(--muted)]">目前登入帳號</p>
            <p className="mt-2 text-lg font-semibold">{effectiveUser.email}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {isLinkedToCurrentAccount
                ? '這台裝置已連結到目前帳號。'
                : isLinkedToOtherAccount
                  ? '這台裝置目前記得另一個帳號的同步上下文，改綁前不會自動同步。'
                  : '這台裝置尚未連結到目前帳號。'}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <ActionButton
              type="button"
              icon={isLinkedToCurrentAccount ? <RefreshIcon size={18} /> : <SaveIcon size={18} />}
              iconOnly
              disabled={isWorking || isPending}
              label={
                isLinkedToCurrentAccount ? '重新同步本機與雲端' : '連結裝置並合併本機資料'
              }
              onClick={() => handleLinkDevice(false)}
            />
            {isLinkedToOtherAccount ? (
              <ActionButton
                type="button"
                variant="secondary"
                icon={<ArrowRightIcon size={18} />}
                disabled={isWorking || isPending}
                label="改綁到目前帳號"
                onClick={() => handleLinkDevice(true)}
              />
            ) : null}
            <ActionButton
              type="button"
              variant="secondary"
              icon={<XIcon size={18} />}
              disabled={isWorking || isPending}
              label="登出"
              onClick={handleSignOut}
            />
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[var(--line)] bg-white p-4"
          >
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('sign-in')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  mode === 'sign-in'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--accent-soft)] text-[var(--foreground)]'
                }`}
              >
                登入
              </button>
              <button
                type="button"
                onClick={() => setMode('sign-up')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  mode === 'sign-up'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--accent-soft)] text-[var(--foreground)]'
                }`}
              >
                註冊
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {mode === 'sign-up' ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium">名稱</span>
                  <TextInput
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="例如：Mawer"
                  />
                </label>
              ) : null}

              <label className="grid gap-2">
                <span className="text-sm font-medium">Email</span>
                <TextInput
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium">密碼</span>
                <TextInput
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 8 個字元"
                />
              </label>
            </div>

            <div className="mt-4">
              <ActionButton
                type="submit"
                icon={<SaveIcon size={18} />}
                disabled={isWorking || isPending}
                label={mode === 'sign-up' ? '建立帳號' : '登入'}
              />
            </div>
          </form>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)] p-4 text-sm leading-6 text-[var(--muted)]">
            <p className="font-medium text-[var(--foreground)]">目前是本機模式</p>
            <p className="mt-2">
              你現在仍可建立項目、寫入紀錄與保留離線資料。登入後，Nadi 會以已驗證帳號作為同步身份，再由你決定是否把本機資料合併到雲端。
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
