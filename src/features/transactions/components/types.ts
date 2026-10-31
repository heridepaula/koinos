import type { AssetClass } from "@/features/market-data";
import type { TransactionKind, TransactionSource, TransactionType } from "../domain/types";

/** Lançamento como a tela recebe (sem dono: o id só identifica o lançamento). */
export type TransactionRow = {
  id: string;
  /** Classe pelo catálogo (null: fundo fora das classes; conta como FII no filtro). */
  assetClass: AssetClass | null;
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
