import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Modal } from './Modal';
import { parseReceiptUrls } from '../../utils/receiptHelpers';

export interface ReceiptViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  billUrl?: string | null;
  urls?: string[];
  title?: string;
  initialIndex?: number;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  isOpen,
  onClose,
  billUrl,
  urls: propUrls,
  title = 'Expense Receipts',
  initialIndex = 0,
}) => {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const resolvedUrls = propUrls || parseReceiptUrls(billUrl);

  useEffect(() => {
    setActiveIndex(0);
  }, [isOpen, billUrl]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || resolvedUrls.length <= 1) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setActiveIndex(prev => (prev > 0 ? prev - 1 : resolvedUrls.length - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveIndex(prev => (prev < resolvedUrls.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, resolvedUrls.length]);

  if (!isOpen) return null;

  const currentUrl = resolvedUrls[activeIndex] || null;
  const totalCount = resolvedUrls.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={totalCount > 1 ? `${title} (${activeIndex + 1} of ${totalCount})` : title}
      maxWidth="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Main Display Area */}
        {totalCount === 0 || !currentUrl ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No receipt attachments available for this expense.
          </div>
        ) : (
          <div className="relative flex items-center justify-center bg-slate-950/80 rounded-2xl overflow-hidden min-h-[320px] max-h-[70vh] p-2 border border-slate-800">
            {/* Previous Button */}
            {totalCount > 1 && (
              <button
                type="button"
                onClick={() => setActiveIndex(prev => (prev > 0 ? prev - 1 : totalCount - 1))}
                aria-label="Previous receipt"
                className="absolute left-3 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all shadow-lg hover:scale-105"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {/* Active Image */}
            <img
              src={currentUrl}
              alt={`Receipt attachment ${activeIndex + 1}`}
              className="max-h-[66vh] max-w-full object-contain rounded-xl shadow-md transition-opacity duration-200"
            />

            {/* Next Button */}
            {totalCount > 1 && (
              <button
                type="button"
                onClick={() => setActiveIndex(prev => (prev < totalCount - 1 ? prev + 1 : 0))}
                aria-label="Next receipt"
                className="absolute right-3 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all shadow-lg hover:scale-105"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* Count Badge overlay */}
            {totalCount > 1 && (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-xs font-semibold shadow-sm">
                {activeIndex + 1} / {totalCount}
              </div>
            )}
          </div>
        )}

        {/* Action Controls & Thumbnail Strip */}
        {totalCount > 0 && currentUrl && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-slate-200 dark:border-slate-800">
            {/* Thumbnail Strip (if multiple) */}
            {totalCount > 1 ? (
              <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full">
                {resolvedUrls.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                      idx === activeIndex
                        ? 'border-amber-500 ring-2 ring-amber-500/30 scale-105 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] font-bold px-1 rounded-tl-md">
                      {idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-400">1 attachment uploaded</span>
            )}

            {/* External Links */}
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/60 border border-amber-300/60 dark:border-amber-700/50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Full Original</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
