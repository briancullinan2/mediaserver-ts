import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { GlobalToolbarsWindow } from '../bundle/menu.d';
import type { FilelistWindow, IErrorEvent, IFileDataProvider, IFilesEvent, WidgetErrorEventArgs, WidgetFilesEventArgs } from '../filelist/widget.d';
import { PUBLIC_GOOGLE_DRIVE_FOLDER_ID } from '../filelist/widget-google';
import { DEFAULT_HTTP_INDEX_URL } from '../filelist/widget-index';
import type { NestedTreeNode } from '../bundle/github-tools';
import type { FileListWidget } from '../filelist/widget';
import { CoverflowWidget } from './widget-coverflow';
import { PillSelectorWidget } from './widget-pill';
import { StyleSelectorWidget } from './widget-style';
import { ISignal, Signal } from '@lumino/signaling';
import { index } from 'd3';

export type ViewMode = 'netflix' | 'overflow' | 'grid' | 'details' | 'tree' | 'music' | string;

export type ViewRenderer = (this: ArtWidget, files: NestedTreeNode[], container: HTMLElement) => void;

export interface SourceProviderConfig
{
	pattern: RegExp | string;
	widgetClass: string;
	getWidget: (source: string) => Widget;
}

export interface ArtWindow
{
	ArtWidget?: typeof ArtWidget;
	artWidget?: ArtWidget;
}

type Constructor<T = any, Args extends any[] = any[]> = new (...args: Args) => T;

const widgetSelf: ArtWindow & LuminoLayoutWindow & GlobalToolbarsWindow & FilelistWindow = self as unknown as any;

export class ArtWidget extends Widget
{
	protected sources: string[];
	private activeWidget: Widget | undefined;
	private sourcePromises: Map<string, Promise<NestedTreeNode[]>> = new Map();

	protected activeViews: Set<ViewMode> = new Set(['pills', 'styles', 'coverflow']);
	protected dataProvider?: IFileDataProvider;
	// Active Mounted Sub-Widgets
	protected mountedSubWidgets: Map<HTMLElement, Widget> = new Map();
	protected viewContainer!: HTMLElement;

	// Filtering & Category Pills
	protected selectedCategoryPill: string = 'all';
	protected availableCategories: Set<string> = new Set();

	// Data
	protected rawFiles: NestedTreeNode[] | undefined = [];
	protected displayedFiles: NestedTreeNode[] = [];
	protected selectedFileIds: Set<string> = new Set();
	public sidebarTitle?: string = 'Generations';

	/**
	 * Overridable registry of view renderers mapped by mode string
	 */
	protected viewRenderers: Map<string, ViewRenderer> = new Map();
	private errorHandlers: ((sender: Widget, args: WidgetErrorEventArgs) => void)[] = [];

	private _errorOccurred = new Signal<Widget, WidgetErrorEventArgs>(this);
	protected widgetIndex: number = 0;

	get errorOccurred(): ISignal<Widget, WidgetErrorEventArgs>
	{
		return this._errorOccurred;
	}

	private readonly _filesSignal: Signal<Widget, WidgetFilesEventArgs> = new Signal<Widget, WidgetFilesEventArgs>(this);

	private filesSignals: Record<string, ISignal<Widget, WidgetFilesEventArgs>> = {};

	get filesChanged(): ISignal<any, WidgetFilesEventArgs>
	{
		return this._filesSignal;
	}

	constructor(title?: string, sources?: string | string[])
	{
		super();
		this.addClass('art-widget-container');
		this.title.label = title ?? 'Art Gallery';
		this.title.closable = true;

		if(Array.isArray(sources))
		{
			this.sources = sources;
		} else if(sources)
		{
			this.sources = [sources];
		} else
		{
			this.sources = [PUBLIC_GOOGLE_DRIVE_FOLDER_ID, DEFAULT_HTTP_INDEX_URL];
		}

	}

	protected clearMountedSubWidgets(): void
	{
		this.mountedSubWidgets.forEach((widget) => widget.dispose());
		this.mountedSubWidgets.clear();
	}


	/**
	 * Render Active View Modes Parallelly
	 */
	protected async renderActiveViews(): Promise<void>
	{
		this.clearMountedSubWidgets();
		this.viewContainer.innerHTML = '';
		this.viewContainer.className = `cloud-main-panel views-count-${this.activeViews.size}`;

		for(const mode of this.activeViews)
		{
			const pane = document.createElement('div');
			pane.className = `view-pane view-pane-${mode}`;
			this.viewContainer.appendChild(pane);
			let widgetInstance: Widget | undefined = undefined;

			switch(mode)
			{
				case 'coverflow':
					widgetInstance = new CoverflowWidget(null, {
						filesSignal: this._filesSignal
					});
					break;
				case 'pills':
					widgetInstance = new PillSelectorWidget(null, {
						categories: Array.from(this.availableCategories),
						activeCategory: this.selectedCategoryPill,
					});
					break;
				case 'styles':
					widgetInstance = new StyleSelectorWidget();
					break;
			}

			if(widgetInstance)
			{
				Widget.attach(widgetInstance, pane);
				this.mountedSubWidgets.set(pane, widgetInstance);
			}
		}

	}



	protected async updateActiveViews(): Promise<void>
	{
		// do stuff to update data without rebuilding entire widget
	}


	/**
	 * Public extension API to add or override a view mode renderer
	 */
	public registerViewRenderer(mode: string, renderer: ViewRenderer): void
	{
		this.viewRenderers.set(mode, renderer);
	}


	// TODO: move up to library build
	public static mediaWidgetFromURL(source?: string): Constructor | undefined
	{
		if(source?.startsWith('github:') || source?.includes('github.com'))
		{
			return widgetSelf.AssetListWidget;
		}
		// Google Drive Protocol / ID
		else if(source?.startsWith('gdrive://') || source?.startsWith('1') && source?.length > 25)
		{
			return widgetSelf.GoogleDriveWidget;
		}
		// Google Drive Protocol / ID
		else if(source?.startsWith('idb://'))
		{
			return widgetSelf.DatabaseListWidget;
		}
		// HTTP / HTTPS Web Index
		else if(source?.startsWith('http://') || source?.startsWith('https://'))
		{
			return widgetSelf.HttpIndexWidget;
		}
		// Local File System / Workspace Fallback
		else if(source?.startsWith('file://') || source?.startsWith('local://'))
		{
			return widgetSelf.FileListWidget;
		}
		return undefined;
	}


	// TODO: make API for file extension -> file list associations
	public static resolveDefaultMediaTitle(widgetType?: Function | string): string | undefined
	{
		if(typeof widgetType === 'undefined')
		{
			return undefined;
		}
		if(typeof widgetType === 'string')
		{
			const resolvedType = this.mediaWidgetFromURL(widgetType);
			if(resolvedType)
			{
				widgetType = resolvedType;
			}
		}
		if(typeof widgetType === 'function')
		{
			if(widgetType.name === widgetSelf.AssetListWidget?.name)
			{
				return 'GitHub Assets';
			}
			else if(widgetType.name === widgetSelf.GoogleDriveWidget?.name)
			{
				return 'Drive Assets';
			}
			else if(widgetType.name === widgetSelf.DatabaseListWidget?.name)
			{
				return 'Indexed DB';
			}
			else if(widgetType.name === widgetSelf.HttpIndexWidget?.name)
			{
				return 'HTTP Index';
			}
			else if(widgetType.name === widgetSelf.FileListWidget?.name)
			{
				return 'Local Workspace';
			}
		}

		return undefined;
	}


	/**
	 * Resolves source protocol/prefix to determine appropriate sidebar widget provider
	 */
	public static resolveSourceWidget(source: string, title?: string): Widget | undefined
	{
		if(!source) return undefined;

		const resolvedType = this.mediaWidgetFromURL(source);
		let defaultTitle = title;
		if(!defaultTitle && resolvedType)
		{
			defaultTitle = this.resolveDefaultMediaTitle(resolvedType);
		}

		if(resolvedType)
		{
			return new resolvedType(title, source);
		}

		return undefined;
	}

	/**
	 * Opens target widget or fallback widgets sequentially as outline panels
	 */
	private openOutlineWidget(index: number = 0): void
	{
		if(index >= this.sources.length) return;

		if(this.activeWidget)
		{
			this.showOutline();
			return;
		}

		const currentSource = this.sources[index];

		let targetWidget: Widget | FileListWidget | undefined;
		for(const w of widgetSelf.fileListWidgets ?? [])
		{
			if(w._source === currentSource)
			{
				targetWidget = w;
				break;
			}
		}

		if(!targetWidget)
		{
			targetWidget = ArtWidget.resolveSourceWidget(currentSource, this.sidebarTitle);
		}

		if(!targetWidget)
		{
			this.openOutlineWidget(index + 1);
			return;
		}

		this.activeWidget = targetWidget;
		this.widgetIndex = index;

		// subscribe to widget
		if('fetchFiles' in targetWidget && typeof targetWidget.fetchFiles === 'function')
		{
			this.dataProvider = targetWidget;
			//this.refreshCurrentFolder();
		}

		if('errorOccurred' in targetWidget && typeof (targetWidget as IErrorEvent).errorOccurred?.connect === 'function')
		{
			if(!this.errorHandlers[index])
			{
				this.errorHandlers[index] = this.handleError.bind(this, index);
			}
			(targetWidget as IErrorEvent).errorOccurred?.connect(this.errorHandlers[index], this);
		}

		if('filesChanged' in targetWidget && typeof (targetWidget as IFilesEvent).filesChanged?.connect === 'function')
		{
			if(!this.filesSignals[index])
			{
				this.filesSignals[index] = (targetWidget as IFilesEvent).filesChanged;
			}
			this.filesSignals[index]?.connect((sender: Widget, args: WidgetFilesEventArgs) =>
			{
				this._filesSignal.emit(args);
				this.refreshCurrentFolder();
			}, this);
		}

		this.showOutline();
	}


	private showOutline()
	{
		const that = this;

		if(!this.activeWidget)
		{
			return;
		}
		requestAnimationFrame(() =>
		{

			if(widgetSelf.mainDock && widgetSelf.LayoutAdjuster)
			{
				if(that.activeWidget && !that.activeWidget?.isAttached)
				{
					widgetSelf.LayoutAdjuster?.addOptimalWidgetLayout(widgetSelf.mainDock, that.activeWidget, {
						type: 'outline',
						projectId: that.activeWidget?.constructor.name
					});
				} else
				{
					that.activeWidget?.show();
				}
			}
		});
	}


	private handleError(index: number, sender: Widget, args: WidgetErrorEventArgs)
	{
		console.warn(`Source failed [${(sender as any)._source}]:`, args.error);
		(sender as unknown as IErrorEvent).errorOccurred?.disconnect(this.errorHandlers[index]);
		sender.close();
		if(sender === this.activeWidget)
		{
			this.activeWidget = undefined;
		}

		this.openOutlineWidget(index + 1);
		this._errorOccurred.emit(args);
	}

	/**
	 * Single Fetch API with Promise caching per source URL
	 */
	public fetchFileList(source: string): Promise<NestedTreeNode[]>
	{
		if(this.sourcePromises.has(source))
		{
			return this.sourcePromises.get(source)!;
		}

		const fetchPromise = (async () =>
		{
			const widget = ArtWidget.resolveSourceWidget(source);
			if(!widget) return [];

			if('fetchFiles' in widget && typeof widget.fetchFiles === 'function')
			{
				const nodes = await widget.fetchFiles();
				this.sourcePromises.delete(source);
				return nodes;
			}
			return [];
		})();

		this.sourcePromises.set(source, fetchPromise);
		return fetchPromise;
	}

	/**
	 * Dynamically swaps out views based on view mode via the lookup table
	 */
	public setViewMode(mode: ViewMode | ViewMode[] | Set<ViewMode> | string, files: NestedTreeNode[] = []): void
	{
		this.activeViews = new Set<ViewMode>(mode instanceof Set ? Array.from(mode) : mode instanceof Array ? mode : [mode]);
		this.renderActiveViews();
		this.updateSectionHeights();
	}

	protected override onResize(msg: Widget.ResizeMessage): void
	{
		super.onResize(msg);

		// Dynamically recalculate height based on Lumino dock dimensions (1/3 viewport target)
		const targetHeight = Math.floor(window.innerHeight / 3);
		const sections = this.node.querySelectorAll<HTMLElement>('.art-view-section');

		sections.forEach(section =>
		{
			section.style.height = `${targetHeight}px`;
			section.style.maxHeight = `${targetHeight}px`;
		});
	}

	private updateSectionHeights(): void
	{
		this.onResize(Widget.ResizeMessage.UnknownSize);
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.renderActiveViews();
		this.openOutlineWidget(this.widgetIndex);
		this.setViewMode(this.activeViews);
		//this.refreshCurrentFolder();
	}

	protected async refreshCurrentFolder(): Promise<void>
	{

	}

	protected override onActivateRequest(msg: Message): void
	{
		super.onActivateRequest(msg);
		this.openOutlineWidget(this.widgetIndex);
	}

	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		this.openOutlineWidget(this.widgetIndex);
	}

	public processMessage(msg: Message): void
	{
		if(msg.type === 'close-request')
		{
			this.activeWidget?.close();
		}

		super.processMessage(msg);
	}

}

widgetSelf.ArtWidget = ArtWidget;
