"use client";

import { cn } from "@/shared/lib/utils";
import { FileSpreadsheetIcon, UploadIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";

/** Negociação, Movimentação e Eventos: a atualização só sai com os três. */
const FILE_COUNT = 3;

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
    // min-w-0 nos itens dos grids: o nome do arquivo (truncate) não pode ditar a largura mínima,
    // senão a lista empurra o card para fora da tela no celular.
    <div className="grid min-w-0 gap-3">
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-[border-color,background-color,scale] duration-420 ease-snappy motion-reduce:transition-none",
          dragging
            ? "border-info bg-info/5 motion-safe:scale-[1.01]"
            : "border-border hover:border-info/50 hover:bg-info/3",
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
        {/* O azulejo da Atualização B3 no menu: a área de soltar é a ação desta página. */}
        <span className="tile size-12 rounded-lg [--tile:var(--tile-indigo)]">
          <UploadIcon className="size-6" aria-hidden="true" />
        </span>
        {/* No toque não há arrastar: o convite muda pelo tipo de ponteiro. */}
        <span className="text-headline">
          <span className="pointer-coarse:hidden">
            Arraste os arquivos .xlsx aqui ou clique para escolher
          </span>
          <span className="hidden pointer-coarse:inline">
            Toque para escolher os arquivos .xlsx
          </span>
        </span>
        <span className="max-w-xl text-footnote text-muted-foreground">
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
        <ul className="grid min-w-0 gap-1.5">
          {files.map((file) => (
            <li
              key={`${file.name}-${file.size}`}
              className="flex min-w-0 items-center gap-2 text-sm"
            >
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
                size="icon-sm"
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
