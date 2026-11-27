/** Direções: 0 = cima, 1 = baixo, 2 = esquerda, 3 = direita */
export type Dir = 0 | 1 | 2 | 3;

/** Deslocamento [linha, coluna] de cada direção */
export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

export interface Arrow {
  id: number;
  /** Células ocupadas, da cauda até a cabeça (índice = linha * n + coluna) */
  cells: number[];
  /** Direção para onde a cabeça aponta */
  dir: Dir;
  /** Índice de cor na paleta da skin (0..7) */
  color: number;
}

/**
 * Mecânicas especiais (docs/novas-mecanicas-de-dificuldades.md), aplicadas por cima das setas:
 * - ice: seta congelada; sai só depois de {count} jogadas válidas (cada batida recongela 1).
 * - gate: portão numa célula vazia; bloqueia até a seta-chave {key} sair.
 * - vine: cipó ligando duas setas; tocar numa faz as duas saírem juntas.
 * - flip: mão dupla; a seta (reta) inverte a direção a cada jogada válida.
 * - orbit: a ponta da seta gira 90° a cada jogada válida (horário ou anti-horário).
 * - magma: contagem regressiva; se chegar a zero, a seta explode (perde 1 vida) e o contador recomeça.
 */
export type Mechanic =
  | { type: 'ice'; arrow: number; count: number }
  | { type: 'gate'; cell: number; key: number }
  | { type: 'vine'; a: number; b: number }
  | { type: 'flip'; arrow: number }
  | { type: 'orbit'; arrow: number; cw: boolean }
  | { type: 'magma'; arrow: number; count: number };

export type MechanicType = Mechanic['type'];

export interface Level {
  /** Tamanho do tabuleiro (n x n) */
  n: number;
  arrows: Arrow[];
  /** Pontuação de dificuldade calculada pela engine (só a geometria; o bônus das mecânicas fica em mechanicBonus) */
  difficulty: number;
  /** Mecânicas especiais da fase (ausente = fase clássica) */
  mechanics?: Mechanic[];
}

export interface GenerateOptions {
  n: number;
  maxLen: number;
  /** Fração do tabuleiro a preencher (0..1) */
  density: number;
  seed: number;
}

/**
 * Formato compacto usado em data/levels.json: [n, dificuldade, [[dir, cor, ...células]], mecânicas?]
 * Mecânicas (opcional): [[código, ...valores]] com os códigos
 *   0 ice [0, seta, contador] · 1 gate [1, célula, chave] · 2 vine [2, a, b]
 *   3 flip [3, seta] · 4 orbit [4, seta, horário(1|0)] · 5 magma [5, seta, contador]
 * O servidor (LevelCatalog.cs) lê o mesmo formato.
 */
export type PackedLevel = [number, number, number[][]] | [number, number, number[][], number[][]];
