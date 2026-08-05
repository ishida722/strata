/**
 * ノートの日付を解決するための純粋関数群。
 *
 * このモジュールは Obsidian API に一切依存しない。入力は
 *   - フロントマターのオブジェクト
 *   - ファイルのベース名
 *   - タイムスタンプ (ctime / mtime)
 * の 3 つだけであり、単体テストの対象とする。
 */

export type FallbackTimestamp = "ctime" | "mtime";

export interface DateResolverConfig {
  /** 参照するフロントマターのキー。先頭から順に走査する。 */
  dateKeys: string[];
  /** 日付が取れなかった場合に使うファイルのタイムスタンプ。 */
  fallbackTimestamp: FallbackTimestamp;
}

export interface DateResolverInput {
  /** metadataCache 由来のフロントマター。未構築時は undefined になりうる。 */
  frontmatter?: Record<string, unknown> | null;
  /** 拡張子を除いたファイル名。 */
  basename: string;
  /** 作成日時 (epoch ms)。 */
  ctime: number;
  /** 最終更新日時 (epoch ms)。 */
  mtime: number;
}

export interface ResolvedDate {
  /** 解決された年。 */
  year: number;
  /** 解決された月 (1-12)。取得できなかった場合は null。 */
  month: number | null;
}

const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

/**
 * 年として妥当な範囲かを判定する。
 * `version: 12345` のような値を日付と誤認しないためのガード。
 */
function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
}

/** 1-12 の範囲に収まらない月は null に落とす。 */
function normalizeMonth(month: number): number | null {
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

/**
 * フロントマターの 1 つの値から日付を解決する。
 *
 * YAML パーサの挙動により、値は `Date` オブジェクトの場合と文字列の場合がある。
 * `date: 2026-08-06` をクォートなしで書くと `Date` になりうるため、両方を処理する。
 */
function fromFrontmatterValue(value: unknown): ResolvedDate | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      return null;
    }
    const year = value.getFullYear();
    if (!isValidYear(year)) {
      return null;
    }
    return { year, month: value.getMonth() + 1 };
  }

  const str = String(value).trim();
  if (str === "") {
    return null;
  }

  // 年と月をまとめて拾えるよう、まず区切り付きの日付を試す。
  const full = str.match(/(\d{4})[-_./](\d{1,2})/);
  if (full) {
    const year = parseInt(full[1], 10);
    if (isValidYear(year)) {
      return { year, month: normalizeMonth(parseInt(full[2], 10)) };
    }
  }

  // 月が取れない場合は年だけを抽出する。
  const yearOnly = str.match(/(\d{4})/);
  if (yearOnly) {
    const year = parseInt(yearOnly[1], 10);
    if (isValidYear(year)) {
      return { year, month: null };
    }
  }

  return null;
}

/**
 * ファイル名に含まれる日付から解決する。
 * `2026-08-06`, `20260806 議事録`, `日報 2026_08_06` などを拾う。
 */
function fromBasename(basename: string): ResolvedDate | null {
  const m = basename.match(/(\d{4})[-_./]?(\d{2})[-_./]?(\d{2})/);
  if (!m) {
    return null;
  }
  const year = parseInt(m[1], 10);
  if (!isValidYear(year)) {
    return null;
  }
  return { year, month: normalizeMonth(parseInt(m[2], 10)) };
}

/** ファイルのタイムスタンプから年を取る。月は捏造しない。 */
function fromTimestamp(ts: number): ResolvedDate | null {
  const d = new Date(ts);
  if (isNaN(d.getTime())) {
    return null;
  }
  const year = d.getFullYear();
  if (!isValidYear(year)) {
    return null;
  }
  return { year, month: null };
}

/**
 * 優先順位に従ってノートの日付を解決する。
 *
 *   1. フロントマターの日付フィールド (dateKeys を先頭から走査)
 *   2. ファイル名に含まれる日付
 *   3. ファイルのタイムスタンプ (ctime / mtime)
 *
 * 最初に有効な値が得られた時点で確定する。
 */
export function resolveDate(
  input: DateResolverInput,
  config: DateResolverConfig
): ResolvedDate {
  const { frontmatter, basename, ctime, mtime } = input;

  if (frontmatter) {
    for (const key of config.dateKeys) {
      const resolved = fromFrontmatterValue(frontmatter[key]);
      if (resolved) {
        return resolved;
      }
    }
  }

  const fromName = fromBasename(basename);
  if (fromName) {
    return fromName;
  }

  const primaryTs = config.fallbackTimestamp === "mtime" ? mtime : ctime;
  const fromPrimary = fromTimestamp(primaryTs);
  if (fromPrimary) {
    return fromPrimary;
  }

  // 選択したタイムスタンプが不正なら、もう一方を試す。
  const secondaryTs = config.fallbackTimestamp === "mtime" ? ctime : mtime;
  const fromSecondary = fromTimestamp(secondaryTs);
  if (fromSecondary) {
    return fromSecondary;
  }

  // 究極のフォールバック: 範囲チェックを外して ctime の年をそのまま使う。
  return { year: new Date(ctime).getFullYear(), month: null };
}
