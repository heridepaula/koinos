import { createCn } from "cn/config";

/**
 * O `cn` do projeto: o do pacote, mais a escala tipográfica da Apple definida em globals.css.
 * Sem isso, `text-headline` passaria por cor, e `cn("text-headline", "text-muted-foreground")`
 * apagaria o tamanho.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "title-1",
            "title-2",
            "title-3",
            "headline",
            "subheadline",
            "footnote",
            "caption",
          ],
        },
      ],
    },
  },
});
