import { TILE_SIZE } from '../config.js';

export const TILE = {
  EMPTY: 0,
  SOLID: 1,
  ONE_WAY: 2, // platforma przechodnia – blokuje tylko od góry
};

const CHAR_TO_TILE = {
  '.': TILE.EMPTY,
  '#': TILE.SOLID,
  '-': TILE.ONE_WAY,
};

/**
 * Poziom: siatka kafelków wczytana z danych (tablica napisów) + zapytania o kolizje.
 * Nie zawiera żadnego kodu rysującego – tym zajmuje się LevelRenderer.
 *
 * Konwencje brzegów: poza lewą/prawą krawędzią jest lita skała, nad mapą jest pusto
 * (można wyskoczyć ponad kadr), a pod mapą jest przepaść.
 */
export class Level {
  constructor(data) {
    this.name = data.name;
    this.tileSize = TILE_SIZE;
    this.rows = data.tiles.length;
    this.cols = Math.max(...data.tiles.map((row) => row.length));
    this.grid = new Uint8Array(this.cols * this.rows);
    this.spawn = { x: this.tileSize * 2, y: this.tileSize * 2 };

    data.tiles.forEach((row, ty) => {
      for (let tx = 0; tx < this.cols; tx++) {
        const ch = row[tx] ?? '.';
        if (ch === 'P') {
          // Spawn to środek dolnej krawędzi komórki (pozycja stóp).
          this.spawn = { x: (tx + 0.5) * this.tileSize, y: (ty + 1) * this.tileSize };
          continue;
        }
        const tile = CHAR_TO_TILE[ch];
        if (tile === undefined) throw new Error(`Nieznany kafelek "${ch}" w poziomie "${data.name}" (${tx}, ${ty})`);
        this.grid[ty * this.cols + tx] = tile;
      }
    });

    this.width = this.cols * this.tileSize;
    this.height = this.rows * this.tileSize;
  }

  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.cols) return TILE.SOLID;
    if (ty < 0 || ty >= this.rows) return TILE.EMPTY;
    return this.grid[ty * this.cols + tx];
  }

  isSolid(tx, ty) {
    return this.tileAt(tx, ty) === TILE.SOLID;
  }

  // Czy prostokąt (w pikselach) nie nachodzi na żaden lity kafelek. Platformy przechodnie są pomijane.
  isRectFree(x, y, w, h) {
    const T = this.tileSize;
    const x0 = Math.floor(x / T);
    const x1 = Math.floor((x + w - 0.001) / T);
    const y0 = Math.floor(y / T);
    const y1 = Math.floor((y + h - 0.001) / T);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.isSolid(tx, ty)) return false;
      }
    }
    return true;
  }
}
