// Divisão do aporte entre FIIs e ações pela meta por classe (spec aporte por classe, §4.2).

export type ClassKey = "FII" | "ACAO";
/** Meta de alocação entre as classes: a % de FIIs; a das ações é o resto. */
export type ClassTarget = { fiiPercent: number };
export type ClassShare = { asked: number; share: number };
export type ClassSplit = Record<ClassKey, ClassShare>;

/** Sem meta salva: tudo para FIIs, como antes da carteira de ações. */
export const DEFAULT_CLASS_TARGET: ClassTarget = { fiiPercent: 100 };

const KEYS: readonly ClassKey[] = ["FII", "ACAO"];
const round2 = (value: number) => Math.round(value * 100) / 100;
const floorCents = (value: number) => Math.floor(value * 100 + 1e-6) / 100;

/**
 * Cada classe pede o que falta para a meta × (patrimônio das duas + aporte). Pedidos acima do
 * aporte dividem na proporção; abaixo, o resto vai pela %. Meta 0% ou classe sem ativo elegível
 * não recebe, e a parte vai para a outra. As partes são em centavos e somam o aporte.
 */
export function splitByClassTarget(input: {
  amount: number;
  target: ClassTarget;
  values: Record<ClassKey, number>;
  canReceive: Record<ClassKey, boolean>;
}): ClassSplit {
  const { amount, values } = input;
  const percent: Record<ClassKey, number> = {
    FII: input.target.fiiPercent / 100,
    ACAO: 1 - input.target.fiiPercent / 100,
  };
  const total = values.FII + values.ACAO + amount;
  const asked: Record<ClassKey, number> = {
    FII: Math.max(0, percent.FII * total - values.FII),
    ACAO: Math.max(0, percent.ACAO * total - values.ACAO),
  };
  const receivers = KEYS.filter((key) => input.canReceive[key] && percent[key] > 0);
  const raw: Record<ClassKey, number> = { FII: 0, ACAO: 0 };
  if (amount > 0 && receivers.length === 1) {
    raw[receivers[0]!] = amount;
  } else if (amount > 0 && receivers.length === 2) {
    const sumAsked = asked.FII + asked.ACAO;
    for (const key of KEYS) {
      raw[key] =
        sumAsked >= amount
          ? (amount * asked[key]) / sumAsked
          : asked[key] + (amount - sumAsked) * percent[key];
    }
  }
  const share: Record<ClassKey, number> = { FII: floorCents(raw.FII), ACAO: floorCents(raw.ACAO) };
  const rest = round2(amount - share.FII - share.ACAO);
  if (rest > 0 && receivers.length > 0) {
    const key = receivers.length === 1 ? receivers[0]! : asked.ACAO > asked.FII ? "ACAO" : "FII";
    share[key] = round2(share[key] + rest);
  }
  return {
    FII: { asked: round2(asked.FII), share: share.FII },
    ACAO: { asked: round2(asked.ACAO), share: share.ACAO },
  };
}
