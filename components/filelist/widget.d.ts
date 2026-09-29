import type { GitHubBranchLike } from "../bundle/github-settings";
import type { RepositoryToolbar } from "../bundle/menu-repos";
import type { Settings } from "../bundle/settings";
import type { GlobalToolbars, GlobalToolbarsWindow, SettingsWindow } from '../bundle/menu.d';
import type { GithubWindow } from '../bundle/github.d';
import type { LocalWindow } from "../bundle/local.d";
import type { FileListWidget, GameListWidget } from "./widget";
import type { LuminoWindow } from '../bundle/lumino.d';
import type { ApiWindow, WorkerWindow } from "../bundle/worker.d";
import type { BuildWindow } from "../bundle/make.d";
import type { Widget } from "@lumino/widgets";
import type { Signal, ISignal } from '@lumino/signaling';

import type { SearchListWidget } from "./widget-search";
//import type { LocalD} from "./widget-local";
import type { HttpIndexWidget } from "./widget-index";
import type { GoogleDriveWidget } from "./widget-google";
import type { GithubListWidget } from "./widget-github";
import type { DatabaseListWidget } from "./widget-database";
import type { AssetListWidget } from "./widget-assets";
import type { NestedTreeNode } from "../bundle/github-tools";

type PermissionState = 'granted' | 'denied' | 'prompt';


interface FileSystemHandle extends FileSystemDirectoryHandle
{
	queryPermission(descriptor?: { mode?: 'read' | 'readwrite'; }): Promise<PermissionState>;
	requestPermission(descriptor?: { mode?: 'read' | 'readwrite'; }): Promise<PermissionState>;
}

export interface DirectoryPickerOptions
{
	/** An optional string identifier to remember the last opened directory */
	id?: string;
	/** Defaults to "read" for read-only access or "readwrite" for read/write access */
	mode?: 'read' | 'readwrite';
	/** A FileSystemHandle or a well-known directory name ("desktop", "documents", "downloads", "music", "pictures", "videos") */
	startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}


export interface FilelistWindow extends FileWidgetWindow, EditorUtilities, GlobalToolbars, SettingsWindow, GithubWindow, LocalWindow, LuminoWindow
{
	loadFileTree?: (repoOwner: string, repoName: string, branch: string, selector: string) => Promise<void>;
	fileListWidgets?: Array<FileListWidget>;
	showDirectoryPicker?: (
		options?: DirectoryPickerOptions
	) => Promise<FileSystemDirectoryHandle>;
	getRegistryIdFromWidget(widget: string | HTMLElement | FileListWidget): string | null | undefined | void;
}

declare var self: Window & FilelistWindow & typeof globalThis;

export interface GithubWorkerWindow extends ApiWindow, GithubWindow, GlobalToolbarsWindow, BuildWindow, WorkerWindow
{

}

export type GithubChanges = {
	modified: FileRecord[],
	added: FileRecord[],
	deleted: FileRecord[],
	treeEntries: FileRecord[];
};

export interface CommitWorkerWindow extends ApiWindow, GithubWindow, WorkerWindow
{

}


export interface WidgetErrorEventArgs
{
	source: Widget;
	error: Error | string;
	// fallbackType?: string;
}

export interface WidgetFilesEventArgs
{
	source: Widget;
	items: NestedTreeNode[];
}


export interface IErrorEvent
{
	get errorOccurred(): ISignal<Widget, WidgetErrorEventArgs>;
}

export interface IFilesEvent
{
	get filesChanged(): ISignal<Widget, WidgetFilesEventArgs>;
}


export interface FileWidgetWindow
{
	fileListWidget: FileListWidget;
	FileListWidget: typeof FileListWidget;

	searchListWidget: SearchListWidget;
	SearchListWidget: typeof SearchListWidget;

	gameListWidget: GameListWidget;
	GameListWidget: typeof GameListWidget;

	assetListWidget: AssetListWidget;
	AssetListWidget: typeof AssetListWidget;

	googleDriveWidget: GoogleDriveWidget;
	GoogleDriveWidget: typeof GoogleDriveWidget;

	httpIndexWidget: HttpIndexWidget;
	HttpIndexWidget: typeof HttpIndexWidget;

	githubListWidget: GithubListWidget;
	GithubListWidget: typeof GithubListWidget;

	databaseListWidget: DatabaseListWidget;
	DatabaseListWidget: typeof DatabaseListWidget;

}


export interface IFileDataProvider
{
	fetchFolders(parentId?: string): Promise<NestedTreeNode[] | undefined>;
	fetchFiles(folderId?: string): Promise<NestedTreeNode[] | undefined>;
	createFolder?(parentId: string, name: string): Promise<boolean>;
	createFile?(parentId: string, name: string, content?: Blob): Promise<boolean>;
	deleteItems?(ids: string[]): Promise<boolean>;
	renameItem?(id: string, newName: string): Promise<boolean>;
}
