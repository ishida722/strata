import { App, PluginSettingTab, Setting } from "obsidian";
import type StrataPlugin from "./main";
import type { FallbackTimestamp } from "./date-resolver";

export interface StrataSettings {
  /** アーカイブ先のルートフォルダ。 */
  archiveRoot: string;
  /** 参照するフロントマターのキー。 */
  dateKeys: string[];
  /** 有効時は `年/月` の 2 階層にする。 */
  groupByMonth: boolean;
  /** 日付が取れなかった場合に使うファイルのタイムスタンプ。 */
  fallbackTimestamp: FallbackTimestamp;
  /** ファイルメニューに項目を追加するか。 */
  showFileMenuItem: boolean;
}

export const DEFAULT_SETTINGS: StrataSettings = {
  archiveRoot: "archive",
  dateKeys: ["date", "created", "作成日"],
  groupByMonth: false,
  fallbackTimestamp: "ctime",
  showFileMenuItem: true,
};

/**
 * archiveRoot の入力値を正規化する。
 * 前後の空白除去、先頭と末尾のスラッシュ除去、空文字なら "archive"。
 */
export function normalizeArchiveRoot(value: string): string {
  const trimmed = (value ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  return trimmed === "" ? "archive" : trimmed;
}

/** カンマ区切りのテキストをトリム・空要素除去して配列化する。 */
export function parseDateKeys(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export class StrataSettingTab extends PluginSettingTab {
  plugin: StrataPlugin;

  constructor(app: App, plugin: StrataPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("アーカイブ先フォルダ")
      .setDesc("ノートの移動先ルートフォルダ。")
      .addText((text) =>
        text
          .setPlaceholder("archive")
          .setValue(this.plugin.settings.archiveRoot)
          .onChange(async (value) => {
            this.plugin.settings.archiveRoot = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("日付フィールド")
      .setDesc(
        "参照するフロントマターのキー。カンマ区切りで、先頭から順に走査します。"
      )
      .addText((text) =>
        text
          .setPlaceholder("date, created, 作成日")
          .setValue(this.plugin.settings.dateKeys.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.dateKeys = parseDateKeys(value);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("月別サブフォルダ")
      .setDesc("有効にすると `年/月` の 2 階層に振り分けます。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.groupByMonth)
          .onChange(async (value) => {
            this.plugin.settings.groupByMonth = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("フォールバックのタイムスタンプ")
      .setDesc(
        "日付が取れなかった場合に使うファイルのタイムスタンプ。同期・移行で作成日時が信用できない場合は更新日時を選びます。"
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("ctime", "作成日時 (ctime)")
          .addOption("mtime", "最終更新日時 (mtime)")
          .setValue(this.plugin.settings.fallbackTimestamp)
          .onChange(async (value) => {
            this.plugin.settings.fallbackTimestamp =
              value as FallbackTimestamp;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("ファイルメニューに項目を追加")
      .setDesc(
        "ファイルエクスプローラやタブの右クリックメニューに「アーカイブ」を表示します。"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showFileMenuItem)
          .onChange(async (value) => {
            this.plugin.settings.showFileMenuItem = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
