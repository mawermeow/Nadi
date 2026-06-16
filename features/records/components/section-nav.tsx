'use client';

import { useEffect, useMemo, useState } from 'react';

type SectionNavItem = {
  id: string;
  label: string;
  shortLabel?: string;
};

type SectionNavProps = {
  items: SectionNavItem[];
};

function scrollToSection(id: string) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

export function SectionNav({ items }: SectionNavProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) ?? items[0] ?? null,
    [activeId, items],
  );

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => section instanceof HTMLElement);

    if (sections.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio);
        const nextActive = visibleEntries[0]?.target.id;

        if (nextActive) {
          setActiveId(nextActive);
        }
      },
      {
        rootMargin: '-25% 0px -55% 0px',
        threshold: [0.2, 0.35, 0.5, 0.7],
      },
    );

    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <nav className="sticky top-3 z-20 hidden md:block">
        <div className="overflow-x-auto rounded-[1.6rem] border border-[var(--line)] bg-white/88 p-2 shadow-[0_12px_32px_rgba(31,42,42,0.08)] backdrop-blur">
          <div className="flex min-w-max gap-2">
            {items.map((item) => {
              const isActive = activeId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={`rounded-full px-4 py-2.5 text-sm font-medium whitespace-nowrap transition ${
                    isActive
                      ? 'bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(45,106,90,0.2)]'
                      : 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="md:hidden">
        <div
          className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#f0eadf] to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-10 transition-opacity duration-300 ${
            isMobileOpen ? 'opacity-100' : 'opacity-95'
          }`}
        >
          <div
            className={`pointer-events-auto mx-auto w-full max-w-md overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-white/92 shadow-[0_-16px_40px_rgba(31,42,42,0.12)] backdrop-blur transition-all duration-300 ${
              isMobileOpen ? 'translate-y-0' : 'translate-y-0'
            }`}
          >
            <button
              type="button"
              onClick={() => setIsMobileOpen((value) => !value)}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left"
            >
              <div>
                <p className="text-xs tracking-[0.18em] text-[var(--muted)] uppercase">
                  快速導覽
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {activeItem?.label ?? '選擇區塊'}
                </p>
              </div>
              <span
                className={`rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)] transition-transform duration-300 ${
                  isMobileOpen ? 'rotate-180' : ''
                }`}
              >
                ⌃
              </span>
            </button>

            <div
              className={`grid transition-[grid-template-rows,opacity] duration-300 ${
                isMobileOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="grid grid-cols-3 gap-2 border-t border-[var(--line)] px-3 pb-3 pt-2">
                  {items.map((item) => {
                    const isActive = activeId === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          scrollToSection(item.id);
                          setActiveId(item.id);
                          setIsMobileOpen(false);
                        }}
                        className={`min-h-12 rounded-2xl px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? 'bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(45,106,90,0.18)]'
                            : 'bg-[var(--surface)] text-[var(--foreground)]'
                        }`}
                      >
                        {item.shortLabel ?? item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
