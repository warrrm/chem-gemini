export type ElementCountMap = Record<string, number>;

const VALID_ELEMENTS = new Set([
  'H', 'He',
  'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar',
  'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr',
  'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe',
  'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu',
  'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn',
]);

const SUBSCRIPT_MAP: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
};

const TO_SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
};

/**
 * 将包含 Unicode 下标数字的字符串归一化为标准 ASCII 数字字符串（同时保留首尾去空格）
 */
export function normalizeSubscripts(raw: string): string {
  return raw
    .trim()
    .replace(/[₀-₉]/g, (ch) => SUBSCRIPT_MAP[ch] ?? ch)
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/［/g, '[')
    .replace(/］/g, ']');
}

/**
 * 将 ASCII 化学式实时渲染为带 Unicode 下标的预览文本（如 CaCO3 -> CaCO₃）
 */
export function formatFormulaPreview(raw: string): string {
  const normalized = normalizeSubscripts(raw);
  return normalized.replace(/([A-Za-z)\]])(\d+)/g, (_match, prefix: string, digits: string) => {
    const sub = digits
      .split('')
      .map((d) => TO_SUBSCRIPT_MAP[d] ?? d)
      .join('');
    return `${prefix}${sub}`;
  });
}

export interface ParseSuccess {
  ok: true;
  counts: ElementCountMap;
}

export interface ParseFailure {
  ok: false;
  reason: 'empty' | 'illegal_char' | 'unmatched_paren' | 'invalid_syntax' | 'unknown_element';
}

export type ParseResult = ParseSuccess | ParseFailure;

/**
 * 递归下降解析化学式，支持嵌套括号如 Ca(OH)2、Al2(SO4)3
 */
export function parseChemicalFormula(rawInput: string): ParseResult {
  const input = normalizeSubscripts(rawInput);
  if (!input) {
    return { ok: false, reason: 'empty' };
  }

  if (!/^[A-Za-z0-9()[\]]+$/.test(input)) {
    return { ok: false, reason: 'illegal_char' };
  }

  let pos = 0;

  function parseNumber(): number | null {
    const start = pos;
    while (pos < input.length && /[0-9]/.test(input[pos])) {
      pos++;
    }
    if (pos === start) return 1;
    const numStr = input.slice(start, pos);
    const val = Number.parseInt(numStr, 10);
    if (Number.isNaN(val) || val <= 0) return null;
    return val;
  }

  function parseGroup(closingChar?: string): ElementCountMap | null {
    const counts: ElementCountMap = {};
    let itemsParsed = 0;

    while (pos < input.length) {
      const ch = input[pos];

      if (closingChar && ch === closingChar) {
        pos++;
        if (itemsParsed === 0) return null;
        return counts;
      }

      if (ch === ')' || ch === ']') {
        return null;
      }

      if (ch === '(' || ch === '[') {
        const expectedClose = ch === '(' ? ')' : ']';
        pos++;
        const inner = parseGroup(expectedClose);
        if (!inner) return null;
        const mult = parseNumber();
        if (mult === null) return null;
        for (const [el, cnt] of Object.entries(inner)) {
          counts[el] = (counts[el] ?? 0) + cnt * mult;
        }
        itemsParsed++;
        continue;
      }

      if (/[A-Z]/.test(ch)) {
        let symbol = ch;
        pos++;
        if (pos < input.length && /[a-z]/.test(input[pos])) {
          symbol += input[pos];
          pos++;
        }
        if (!VALID_ELEMENTS.has(symbol)) {
          return null;
        }
        const mult = parseNumber();
        if (mult === null) return null;
        counts[symbol] = (counts[symbol] ?? 0) + mult;
        itemsParsed++;
        continue;
      }

      return null;
    }

    if (closingChar) {
      return null;
    }

    return itemsParsed > 0 ? counts : null;
  }

  const counts = parseGroup();
  if (!counts) {
    let depth = 0;
    for (const c of input) {
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (depth < 0) return { ok: false, reason: 'unmatched_paren' };
    }
    if (depth !== 0) return { ok: false, reason: 'unmatched_paren' };
    return { ok: false, reason: 'invalid_syntax' };
  }

  return { ok: true, counts };
}

/**
 * 尝试在忽略大小写的情况下解析输入，用于检测“元素符号大小写错误”（如 cao, CAO, h2o, caco3）
 */
export function tryParseCaseInsensitive(rawInput: string): ElementCountMap | null {
  const input = normalizeSubscripts(rawInput);
  if (!input || !/^[A-Za-z0-9()[\]]+$/.test(input)) return null;

  let depth = 0;
  for (const c of input) {
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (depth < 0) return null;
  }
  if (depth !== 0) return null;

  const tokens = input.match(/[A-Za-z]+|[0-9]+|[()[\]]/g);
  if (!tokens || tokens.join('') !== input) return null;

  function segmentLetters(str: string): string[] | null {
    const memo = new Map<number, string[] | null>();

    function dfs(idx: number): string[] | null {
      if (idx === str.length) return [];
      if (memo.has(idx)) return memo.get(idx)!;

      if (idx + 2 <= str.length) {
        const two = str[idx].toUpperCase() + str[idx + 1].toLowerCase();
        if (VALID_ELEMENTS.has(two)) {
          const rest = dfs(idx + 2);
          if (rest !== null) {
            const res = [two, ...rest];
            memo.set(idx, res);
            return res;
          }
        }
      }

      const one = str[idx].toUpperCase();
      if (VALID_ELEMENTS.has(one)) {
        const rest = dfs(idx + 1);
        if (rest !== null) {
          const res = [one, ...rest];
          memo.set(idx, res);
          return res;
        }
      }

      memo.set(idx, null);
      return null;
    }

    return dfs(0);
  }

  let rebuilt = '';
  for (const tok of tokens) {
    if (/^[A-Za-z]+$/.test(tok)) {
      const segs = segmentLetters(tok);
      if (!segs) return null;
      rebuilt += segs.join('');
    } else {
      rebuilt += tok;
    }
  }

  const parsed = parseChemicalFormula(rebuilt);
  return parsed.ok ? parsed.counts : null;
}
