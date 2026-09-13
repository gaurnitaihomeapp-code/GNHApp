import React, { useRef, useEffect } from 'react';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';

export interface MultiAttachmentUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
  label?: string;
  sublabel?: string;
  required?: boolean;
  disabled?: boolean;
  onError?: (message: string) => void;
  className?: string;
}

const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const MultiAttachmentUpload: React.FC<MultiAttachmentUploadProps> = ({
  files,
  onFilesChange,
  maxFiles = DEFAULT_MAX_FILES,
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
  label = 'Bill / Receipt Attachments',
  sublabel = 'JPG, PNG, WebP or PDF (up to 10 MB per file)',
  required = false,
  disabled = false,
  onError,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = React.useState<{ file: File; url: string | null }[]>([]);

  // Maintain preview object URLs
  useEffect(() => {
    const newPreviews = files.map(file => {
      if (file.type.startsWith('image/')) {
        return { file, url: URL.createObjectURL(file) };
      }
      return { file, url: null };
    });

    setPreviews(newPreviews);

    return () => {
      newPreviews.forEach(p => {
        if (p.url) {
          URL.revokeObjectURL(p.url);
        }
      });
    };
  }, [files]);

  const handleFileSelection = (selectedList: FileList | null) => {
    if (!selectedList || selectedList.length === 0) return;

    const incoming = Array.from(selectedList);
    const availableSlots = maxFiles - files.length;

    if (availableSlots <= 0) {
      if (onError) {
        onError(`Maximum ${maxFiles} attachments allowed per expense.`);
      }
      return;
    }

    const filesToConsider = incoming.slice(0, availableSlots);
    if (incoming.length > availableSlots && onError) {
      onError(`Only ${availableSlots} more attachment(s) could be added (max ${maxFiles}).`);
    }

    const validNewFiles: File[] = [];
    for (const file of filesToConsider) {
      if (file.size > maxSizeBytes) {
        if (onError) {
          onError(`"${file.name}" exceeds the 10 MB limit.`);
        }
        continue;
      }
      validNewFiles.push(file);
    }

    if (validNewFiles.length > 0) {
      onFilesChange([...files, ...validNewFiles]);
    }

    // Reset input value so same files can be re-selected if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = (indexToRemove: number) => {
    onFilesChange(files.filter((_, idx) => idx !== indexToRemove));
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header & Label */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>{label}</span>
          {required && <span className="text-red-500 font-bold ml-1">*</span>}
          {required && (
            <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400 ml-1.5">
              (Mandatory)
            </span>
          )}
        </label>
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            files.length === maxFiles
              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/60'
              : files.length > 0
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
              : 'text-slate-400'
          }`}
        >
          {files.length} / {maxFiles} attachments
        </span>
      </div>

      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        disabled={disabled || files.length >= maxFiles}
        onChange={e => handleFileSelection(e.target.files)}
        className="hidden"
      />

      {/* Upload Dropzone (if slots remaining) */}
      {files.length < maxFiles && (
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
            required && files.length === 0
              ? 'border-amber-400/90 dark:border-amber-600/80 bg-amber-50/40 dark:bg-amber-950/10 hover:border-amber-500'
              : 'border-slate-300 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 hover:border-amber-500 hover:bg-slate-50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Upload className="w-5 h-5" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {files.length === 0 ? 'Upload bills / receipts' : 'Add another receipt'}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Select up to {maxFiles - files.length} more file(s) • {sublabel}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Thumbnail Previews Grid */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
          {previews.map((preview, index) => (
            <div
              key={index}
              className="relative group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 overflow-hidden shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-all flex flex-col"
            >
              {/* Image / File Thumbnail */}
              <div className="relative h-20 w-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                {preview.url ? (
                  <img
                    src={preview.url}
                    alt={preview.file.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                    <FileText className="w-6 h-6 text-amber-500 mb-0.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">PDF</span>
                  </div>
                )}

                {/* Badge Number */}
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[9px] font-bold">
                  #{index + 1}
                </span>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleRemove(index);
                  }}
                  title="Remove attachment"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-md transition-transform hover:scale-110"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* File Info */}
              <div className="p-1.5 bg-white dark:bg-slate-800 text-[10px]">
                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={preview.file.name}>
                  {preview.file.name}
                </div>
                <div className="text-slate-400 text-[9px]">
                  {formatSize(preview.file.size)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length >= maxFiles && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium px-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Maximum 5 attachments reached. Remove an attachment to replace it.</span>
        </div>
      )}
    </div>
  );
};
