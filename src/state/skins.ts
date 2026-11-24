export interface Skin {
  id: string;
  name: { pt: string; en: string };
  price: number;
  /** 8 cores das setas */
  colors: string[];
  /** Fundo do tabuleiro */
  board: string;
  /** Cor dos pontinhos do tabuleiro */
  dot: string;
}

export const SKINS: Skin[] = [
  {
    id: 'classic',
    name: { pt: 'Clássico', en: 'Classic' },
    price: 0,
    colors: ['#ff5d73', '#ff9f40', '#ffd93d', '#4fd67a', '#3ec5ff', '#8a8dff', '#d27bff', '#2ee6c8'],
    board: 'rgba(5,12,25,.55)',
    dot: 'rgba(255,255,255,.14)',
  },
  {
    id: 'pastel',
    name: { pt: 'Pastel', en: 'Pastel' },
    price: 150,
    colors: ['#ffadc6', '#ffcf9e', '#fff0a3', '#b5f2c3', '#a8e2ff', '#c4c6ff', '#e7b8ff', '#a6f5e6'],
    board: 'rgba(40,30,60,.55)',
    dot: 'rgba(255,255,255,.18)',
  },
  {
    id: 'neon',
    name: { pt: 'Neon', en: 'Neon' },
    price: 250,
    colors: ['#ff2e88', '#ff7b00', '#f5ff00', '#39ff14', '#00f0ff', '#6e5bff', '#ff00f5', '#00ffb3'],
    board: 'rgba(0,0,0,.75)',
    dot: 'rgba(0,240,255,.2)',
  },
  {
    id: 'ocean',
    name: { pt: 'Oceano', en: 'Ocean' },
    price: 300,
    colors: ['#0077b6', '#00b4d8', '#48cae4', '#90e0ef', '#2a9d8f', '#4cc9f0', '#4895ef', '#80ffdb'],
    board: 'rgba(0,20,40,.6)',
    dot: 'rgba(144,224,239,.2)',
  },
  {
    id: 'sunset',
    name: { pt: 'Pôr do sol', en: 'Sunset' },
    price: 400,
    colors: ['#ff6b6b', '#ff8e53', '#ffb347', '#ffd166', '#f25f5c', '#c06c84', '#f67280', '#f8b195'],
    board: 'rgba(40,10,20,.55)',
    dot: 'rgba(255,209,102,.18)',
  },
  {
    id: 'mono',
    name: { pt: 'Minimalista', en: 'Minimal' },
    price: 500,
    colors: ['#ffffff', '#e0e0e0', '#c2c2c2', '#f5f5f5', '#d6d6d6', '#ebebeb', '#bdbdbd', '#fafafa'],
    board: 'rgba(0,0,0,.6)',
    dot: 'rgba(255,255,255,.12)',
  },
];

export const skinById = (id: string): Skin => SKINS.find((s) => s.id === id) ?? SKINS[0];
