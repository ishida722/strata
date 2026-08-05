import { Notice, Plugin, TAbstractFile, TFile } from "obsidian";
import {
  StrataSettings,
  DEFAULT_SETTINGS,
  StrataSettingTab,
  normalizeArchiveRoot,
} from "./settings";
import {
  ArchiveRecord,
  archiveFile,
  isInArchive,
  undoArchive,
} from "./vault-ops";

export default class StrataPlugin extends Plugin {
  settings!: StrataSettings;
  /** 直前のアーカイブ移動。メモリ上に 1 件だけ保持し、永続化しない。 */
  private lastArchive: ArchiveRecord | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "archive-current-note",
      name: "このノートをアーカイブ",
      checkCallback: (checking: boolean): boolean => {
        const file = this.app.workspace.getActiveFile();
        if (!this.canArchive(file)) {
          return false;
        }
        if (!checking) {
          void this.runArchive(file);
        }
        return true;
      },
    });

    this.addCommand({
      id: "undo-last-archive",
      name: "直前のアーカイブを取り消す",
      checkCallback: (checking: boolean): boolean => {
        if (!this.lastArchive) {
          return false;
        }
        if (!checking) {
          void this.runUndo();
        }
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!this.settings.showFileMenuItem) {
          return;
        }
        if (!this.canArchive(file)) {
          return;
        }
        const target = file;
        menu.addItem((item) => {
          item
            .setTitle("アーカイブ")
            .setIcon("archive")
            .onClick(() => {
              void this.runArchive(target);
            });
        });
      })
    );

    this.addSettingTab(new StrataSettingTab(this.app, this));
  }

  /**
   * アーカイブ可能なファイルかを判定する型ガード。
   * TFile かつ md 拡張子かつアーカイブフォルダ配下にないこと。
   */
  private canArchive(file: TAbstractFile | null): file is TFile {
    if (!(file instanceof TFile)) {
      return false;
    }
    if (file.extension !== "md") {
      return false;
    }
    if (isInArchive(file.path, this.settings.archiveRoot)) {
      return false;
    }
    return true;
  }

  private async runArchive(file: TFile): Promise<void> {
    try {
      const record = await archiveFile(this.app, this.settings, file);
      this.lastArchive = record;
      new Notice(`アーカイブしました → ${record.to}`);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`アーカイブに失敗しました: ${message}`);
    }
  }

  private async runUndo(): Promise<void> {
    const record = this.lastArchive;
    if (!record) {
      return;
    }
    try {
      await undoArchive(this.app, record);
      this.lastArchive = null;
      new Notice(`アーカイブを取り消しました → ${record.from}`);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`取り消しに失敗しました: ${message}`);
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    // archiveRoot は保存時に正規化して永続化する。
    this.settings.archiveRoot = normalizeArchiveRoot(this.settings.archiveRoot);
    await this.saveData(this.settings);
  }
}
