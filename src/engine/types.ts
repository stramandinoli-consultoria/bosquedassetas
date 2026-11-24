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

export interface Level {
  /** Tamanho do tabuleiro (n x n) */
  n: number;
  arrows: Arrow[];
  /** Pontuação de dificuldade calculada pela engine */
  difficulty: number;
}

export interface GenerateOptions {
  n: number;
  maxLen: number;
  /** Fração do tabuleiro a preencher (0..1) */
  density: number;
  seed: number;
}

/** Formato compacto usado em data/levels.json: [n, dificuldade, [[dir, cor, ...células]]] */
export type PackedLevel = [number, number, number[][]];
