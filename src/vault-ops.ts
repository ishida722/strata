import { App, TFile } from "obsidian";
import { StrataSettings } from "./settings";
import { resolveDate } from "./date-resolver";

/** 直前のアーカイブ移動を表す履歴。TFile ではなくパス文字列で保持する。 */
export interface ArchiveRecord {
  from: string;
  to: string;
}

/** 指定パスがアーカイブフォルダ配下（または自身）かを判定する。 */
export function isInArchive(path: string, archiveRoot: string): boolean {
  return path === archiveRoot || path.startsWith(archiveRoot + "/");
}

/**
 * 中間フォルダを 1 階層ずつ存在確認しながら作成する。
 * `vault.createFolder()` は既存フォルダに対して例外を投げるため、
 * getAbstractFileByPath で確認してから作る。
 */
export async function ensureFolder(app: App, folderPath: string): Promise<void> {
  const parts = folderPath.split("/").filter((p) => p.length > 0);
  let current = "";
  for (const part of parts) {
    current = current === "" ? part : `${current}/${part}`;
    const existing = app.vault.getAbstractFileByPath(current);
    if (!existing) {
      await app.vault.createFolder(current);
    }
  }
}

/**
 * 移動先に同名ファイルが存在する場合、` 2`, ` 3`, ... と連番を付けて
 * 空いているパスを返す。既存ファイルは上書きしない。
 */
export function uniquePath(
  app: App,
  folder: string,
  basename: string,
  extension: string
): string {
  const build = (name: string): string =>
    folder === "" ? `${name}.${extension}` : `${folder}/${name}.${extension}`;

  let candidate = build(basename);
  let counter = 2;
  while (app.vault.getAbstractFileByPath(candidate)) {
    candidate = build(`${basename} ${counter}`);
    counter++;
  }
  return candidate;
}

/**
 * ノートの日付から移動先フォルダを組み立てる。
 * `{archiveRoot}/{年}` あるいは月別有効時は `{archiveRoot}/{年}/{月}`。
 * 月が取得できない場合は年フォルダ直下に置く（ctime から月を捏造しない）。
 */
function buildDestinationFolder(settings: StrataSettings, file: TFile, app: App): string {
  const cache = app.metadataCache.getFileCache(file);
  const frontmatter = cache?.frontmatter;

  const resolved = resolveDate(
    {
      frontmatter,
      basename: file.basename,
      ctime: file.stat.ctime,
      mtime: file.stat.mtime,
    },
    {
      dateKeys: settings.dateKeys,
      fallbackTimestamp: settings.fallbackTimestamp,
    }
  );

  let folder = `${settings.archiveRoot}/${resolved.year}`;
  if (settings.groupByMonth && resolved.month !== null) {
    folder = `${folder}/${String(resolved.month).padStart(2, "0")}`;
  }
  return folder;
}

/**
 * ファイルをアーカイブフォルダへ移動する。
 * リンクを張り替えるため fileManager.renameFile を使う。
 */
export async function archiveFile(
  app: App,
  settings: StrataSettings,
  file: TFile
): Promise<ArchiveRecord> {
  const folder = buildDestinationFolder(settings, file, app);
  await ensureFolder(app, folder);

  const dest = uniquePath(app, folder, file.basename, file.extension);
  const from = file.path;

  await app.fileManager.renameFile(file, dest);

  return { from, to: dest };
}

/**
 * 直前のアーカイブを取り消し、元のパスへ戻す。
 * `to` のパスからファイルを引き直し、親フォルダを作り直してから戻す。
 */
export async function undoArchive(
  app: App,
  record: ArchiveRecord
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(record.to);
  if (!(file instanceof TFile)) {
    throw new Error(`取り消し対象が見つかりません: ${record.to}`);
  }

  const parentFolder = record.from.split("/").slice(0, -1).join("/");
  if (parentFolder) {
    await ensureFolder(app, parentFolder);
  }

  await app.fileManager.renameFile(file, record.from);
}
