"use client";

import { cn } from "cn";
import { FileSpreadsheetIcon, UploadIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";

/** Negociação, Movimentação e Eventos: a atualização só sai com os três. */
export const FILE_COUNT = 3;

/** Os três extratos .xlsx, por clique ou arrastar e soltar. O servidor reconhece cada um. */
export function FilePicker({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const file of list) {
      if (!next.some((item) => item.name === file.name && item.size === file.size)) next.push(file);
    }
    onChange(next.slice(0, FILE_COUNT));
  };

  return (
    <div className="grid gap-3">
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          add(event.dataTransfer.files);
        }}
      >
        <UploadIcon className="size-6 text-primary" aria-hidden="true" />
        <span className="font-medium">Arraste os arquivos .xlsx aqui ou clique para escolher</span>
        <span className="max-w-xl text-sm text-muted-foreground">
          Os três extratos da Área do Investidor da B3: Negociação, Movimentação e Eventos.
        </span>
        <input
          type="file"
          multiple
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(event) => {
            add(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {files.length > 0 ? (
        <ul className="grid gap-1.5">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`} className="flex items-center gap-2 text-sm">
              <FileSpreadsheetIcon
                className="size-4 shrink-0 text-[var(--switch-on)]"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {Math.ceil(file.size / 1024)} KB
              </span>
              <Button
                type="button"
                className="shrink-0"
                variant="ghost"
                size="icon-xs"
                aria-label={`Tirar ${file.name}`}
                onClick={() => onChange(files.filter((item) => item !== file))}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
