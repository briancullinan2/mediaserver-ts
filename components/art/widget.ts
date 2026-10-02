import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { GlobalToolbarsWindow } from '../bundle/menu.d';
import type { FilelistWindow, FilesUpdated, IErrorEvent, IFileDataProvider, IFilesEvent, WidgetErrorEventArgs, WidgetFilesEventArgs } from '../filelist/widget.d';
import type { NestedTreeNode } from '../bundle/github-tools';
import type { CoverflowWidget } from './widget-coverflow';
import { IPillSelectedArgs, IPillViewOptions, PillSelectorWidget } from './widget-pill';
import type { IStyleViewOptions, StyleSelectorWidget } from './widget-style';
import type { NetflixViewWidget } from '../fileview/widget-netflix';
import type { ExplorerGridWidget } from '../fileview/widget-grid';
import type { DetailsViewWidget } from '../fileview/widget-details';
import { ISignal, Signal } from '@lumino/signaling';
import { index } from 'd3';
import type mime from 'mime';
import type { IFileViewOptions } from '../fileview/widget';

export type ViewMode = 'netflix' | 'overflow' | 'grid' | 'details' | 'tree' | 'music' | string;

export type ViewRenderer = (this: ArtWidget, files: NestedTreeNode[], container: HTMLElement) => void;

export interface KnownFileViews
{
	ArtWidget?: typeof ArtWidget;
	artWidget?: ArtWidget;

	CoverflowWidget?: typeof CoverflowWidget;
	coverflowWidget?: CoverflowWidget;

	PillSelectorWidget?: typeof PillSelectorWidget;
	pillSelectorWidget?: PillSelectorWidget;

	StyleSelectorWidget?: typeof StyleSelectorWidget;
	styleSelectorWidget?: StyleSelectorWidget;

	NetflixViewWidget: typeof NetflixViewWidget;
	netflixViewWidget: NetflixViewWidget;

	ExplorerGridWidget: typeof ExplorerGridWidget;
	explorerGridWidget: ExplorerGridWidget;

	DetailsViewWidget: typeof DetailsViewWidget;
	detailsViewWidget: DetailsViewWidget;
}

export function modeToWindowType(mode: string, source?: string): Constructor | undefined
{

	switch(mode)
	{
		case 'netflix':
			return widgetSelf.NetflixViewWidget;
			break;
		case 'coverflow':
			return widgetSelf.CoverflowWidget;
			break;
		case 'grid':
			return widgetSelf.ExplorerGridWidget;
			break;
		case 'details':
			return widgetSelf.DetailsViewWidget;
			break;
		case 'pills':
			return widgetSelf.PillSelectorWidget;
			break;
		case 'styles':
			return widgetSelf.StyleSelectorWidget;
			break;
		case 'tree':
			return ArtWidget.mediaWidgetFromURL(source);
	}
}


export function modeToWidgetURI(mode: string, source?: string): string | undefined
{

	switch(mode)
	{
		case 'netflix':
			return '/components/fileview/widget-netflix.ts';
			break;
		case 'coverflow':
			return '/components/art/widget-coverflow.ts';
			break;
		case 'grid':
			return '/components/fileview/widget-grid.ts';
			break;
		case 'details':
			return '/components/fileview/widget-details.ts';
			break;
		case 'pills':
			return '/components/fileview/widget-pill.ts';
			break;
		case 'styles':
			return '/components/fileview/widget-style.ts';
			break;
		case 'tree':
			if(source?.startsWith('github:') || source?.includes('github.com'))
			{
				return '/components/filelist/widget-assets.ts';
			}
			// Google Drive Protocol / ID
			else if(source?.startsWith('gdrive://') || source?.startsWith('1') && source?.length > 25)
			{
				return '/components/filelist/widget-google.ts';
			}
			// Google Drive Protocol / ID
			else if(source?.startsWith('idb://'))
			{
				return '/components/filelist/widget-database.ts';
			}
			// HTTP / HTTPS Web Index
			else if(source?.startsWith('http://') || source?.startsWith('https://'))
			{
				return '/components/filelist/widget-index.ts';
			}
			// Local File System / Workspace Fallback
			else if(source?.startsWith('file://') || source?.startsWith('local://'))
			{
				return '/components/filelist/widget.ts';
			}
			break;
	}
}

export interface SourceProviderConfig
{
	pattern: RegExp | string;
	widgetClass: string;
	getWidget: (source: string) => Widget;
}

// export interface ArtWindow
// {
// }

type Constructor<T = any, Args extends any[] = any[]> = new (...args: Args) => T;

const widgetSelf: KnownFileViews & LuminoLayoutWindow & GlobalToolbarsWindow & FilelistWindow & {
	mime: typeof mime;
} = self as unknown as any;

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
	protected categorySelected?: Signal<PillSelectorWidget, IPillSelectedArgs>;

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
		this.title.className = this.id;
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
			this.sources = [
				widgetSelf.settingsManager?.get('filelist', 'google_drives')?.[0],
				widgetSelf.settingsManager?.get('filelist', 'http_indexes')?.[0]
			].filter(Boolean);
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
			let viewWidget = modeToWindowType(mode);
			if(!viewWidget)
			{
				const widgetURI = modeToWidgetURI(mode, this.sources[this.widgetIndex]);
				if(widgetSelf.loadScript && widgetURI)
				{
					await widgetSelf.preloadDependencies?.([widgetURI]);
					const targetUrl = widgetURI.replace(/\.ts$/, '.js').replace(/^\.\//, '/base/');
					const modulePromise = await import(/* webpackIgnore: true */ targetUrl + '?t=' + Date.now() + '&local-csp=true');
					viewWidget = modeToWindowType(mode, this.sources[this.widgetIndex]);
				}
			}

			if(!viewWidget)
			{
				continue;
			}

			const instantiationVars: IFileViewOptions = {
				filesSignal: this.filesChanged,
				files: this.rawFiles
			};

			switch(mode)
			{
				case 'coverflow':
					break;
				case 'pills':
					(instantiationVars as IPillViewOptions).categories = Array.from(this.availableCategories);
					(instantiationVars as IPillViewOptions).activeCategory = this.selectedCategoryPill;
					break;
				case 'styles':
					(instantiationVars as IStyleViewOptions).categorySelected = this.categorySelected;
					break;
			}

			widgetInstance = new viewWidget(undefined, instantiationVars);

			switch(mode)
			{
				case 'pills':
					this.categorySelected = (widgetInstance as PillSelectorWidget).categorySelected;
					break;
				case 'styles':
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
	public static async resolveSourceWidget(source: string, title?: string): Promise<Widget | undefined>
	{
		if(!source) return undefined;

		let resolvedType = this.mediaWidgetFromURL(source);
		let defaultTitle = title;
		if(!defaultTitle && resolvedType)
		{
			defaultTitle = this.resolveDefaultMediaTitle(resolvedType);
		}

		if(!resolvedType)
		{
			const widgetURI = modeToWidgetURI('tree', source);
			if(widgetSelf.loadScript && widgetURI)
			{
				await widgetSelf.preloadDependencies?.([widgetURI]);
				const targetUrl = widgetURI.replace(/\.ts$/, '.js').replace(/^\.\//, '/base/');
				const modulePromise = await import(/* webpackIgnore: true */ targetUrl + '?t=' + Date.now() + '&local-csp=true');
				resolvedType = this.mediaWidgetFromURL(source);
			}
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
	private async openOutlineWidget(index: number = 0): Promise<void>
	{
		if(index >= this.sources.length) return;

		if(this.activeWidget)
		{
			this.showOutline();
			return;
		}

		const currentSource = this.sources[index];

		let targetWidget: Widget | undefined;
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
			targetWidget = await ArtWidget.resolveSourceWidget(currentSource, this.sidebarTitle);
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
			this.dataProvider = targetWidget as { fetchFiles: FilesUpdated; };
			// triggered by files signal event or already on the correct index
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
				this.rawFiles = args.items;
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
			const widget = await ArtWidget.resolveSourceWidget(source);
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
		this.openOutlineWidget(this.widgetIndex);
		this.refreshCurrentFolder();
		requestAnimationFrame(() =>
		{
			this.setViewMode(this.activeViews);
		});
	}

	protected async refreshCurrentFolder(): Promise<void>
	{

		if(this.dataProvider)
		{
			while(this.widgetIndex < this.sources.length)
			{
				try
				{
					const dp = await ArtWidget.resolveSourceWidget(this.sources[this.widgetIndex]);
					if(dp && 'fetchFiles' in dp && typeof dp.fetchFiles === 'function')
					{
						this.dataProvider = dp as IFileDataProvider;
						this.rawFiles = await dp.fetchFiles(this.sources[this.widgetIndex]);
						if(this.rawFiles)
						{
							this._filesSignal.emit({
								items: this.rawFiles,
								source: this.dataProvider
							});
						}
						break;
					}
				} catch(e)
				{
					console.error('Drive fetch failed: ', e);
					this.widgetIndex++;
				}
			}

			for(const file of this.rawFiles ?? [])
			{
				if(!file.mimeType)
				{
					file.mimeType = widgetSelf.mime.getType(file.path);
				}
			}

		}

		this.extractCategories();
	}


	protected extractCategories()
	{
		this.availableCategories.clear();

		const pills = Object.keys(PillSelectorWidget.parseAndBuildCategoryMap(this.rawFiles ?? [], false));
		for(const pill of pills)
		{
			this.availableCategories.add(pill);
		}
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
