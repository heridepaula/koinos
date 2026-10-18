import type { TransactionKind, TransactionSource, TransactionType } from "../domain/types";

/** Lançamento como a tela recebe (sem dono: o id só identifica o lançamento). */
export type TransactionRow = {
  id: string;
  ticker: string;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  fees: number;
  date: Date;
  source: TransactionSource;
  kind: TransactionKind;
  notes: string | null;
};
