import {
  resolveDate,
  DateResolverConfig,
  DateResolverInput,
} from "../src/date-resolver";

const CONFIG: DateResolverConfig = {
  dateKeys: ["date", "created", "作成日"],
  fallbackTimestamp: "ctime",
};

/** テスト用の入力を組み立てるヘルパ。 */
function makeInput(
  overrides: Partial<DateResolverInput> = {}
): DateResolverInput {
  return {
    frontmatter: undefined,
    basename: "無題",
    // 既定の ctime は 2000 年。個別テストで上書きする。
    ctime: new Date("2000-01-01T00:00:00Z").getTime(),
    mtime: new Date("2000-01-01T00:00:00Z").getTime(),
    ...overrides,
  };
}

describe("resolveDate", () => {
  test("1: 文字列の日付", () => {
    const input = makeInput({ frontmatter: { date: "2024-03-15" } });
    expect(resolveDate(input, CONFIG).year).toBe(2024);
  });

  test("2: Date オブジェクト（最重要）", () => {
    const input = makeInput({ frontmatter: { date: new Date("2024-03-15") } });
    expect(resolveDate(input, CONFIG).year).toBe(2024);
  });

  test("3: キーのフォールバック", () => {
    const input = makeInput({ frontmatter: { created: "2023-01-01" } });
    expect(resolveDate(input, CONFIG).year).toBe(2023);
  });

  test("4: 空文字は無効として次へ", () => {
    const input = makeInput({
      frontmatter: { date: "", created: "2023-01-01" },
    });
    expect(resolveDate(input, CONFIG).year).toBe(2023);
  });

  test("5: 範囲外の数値を日付と誤認しない", () => {
    const input = makeInput({
      frontmatter: { version: 12345 },
      basename: "2022-05-05 メモ",
    });
    expect(resolveDate(input, CONFIG).year).toBe(2022);
  });

  test("6: 区切り文字なしのファイル名", () => {
    const input = makeInput({ basename: "20210101 日報" });
    expect(resolveDate(input, CONFIG).year).toBe(2021);
  });

  test("7: 最終フォールバック (ctime)", () => {
    const input = makeInput({
      basename: "無題",
      ctime: new Date("2020-06-01T00:00:00Z").getTime(),
    });
    expect(resolveDate(input, CONFIG).year).toBe(2020);
  });

  test("8: 不正な Date を弾いて次へ", () => {
    const input = makeInput({
      frontmatter: { date: new Date("invalid") },
      basename: "2019-12-31",
    });
    expect(resolveDate(input, CONFIG).year).toBe(2019);
  });

  test("月も解決される (文字列)", () => {
    const input = makeInput({ frontmatter: { date: "2024-03-15" } });
    expect(resolveDate(input, CONFIG).month).toBe(3);
  });

  test("月も解決される (ファイル名)", () => {
    const input = makeInput({ basename: "20210101 日報" });
    expect(resolveDate(input, CONFIG).month).toBe(1);
  });

  test("タイムスタンプ由来では月を捏造しない", () => {
    const input = makeInput({
      ctime: new Date("2020-06-15T00:00:00Z").getTime(),
    });
    expect(resolveDate(input, CONFIG).month).toBeNull();
  });

  test("mtime フォールバックに切り替えられる", () => {
    const input = makeInput({
      ctime: new Date("2010-01-01T00:00:00Z").getTime(),
      mtime: new Date("2015-01-01T00:00:00Z").getTime(),
    });
    const config: DateResolverConfig = {
      ...CONFIG,
      fallbackTimestamp: "mtime",
    };
    expect(resolveDate(input, config).year).toBe(2015);
  });
});
