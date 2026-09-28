import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { GlobalToolbarsWindow } from '../bundle/menu.d';
import type { FilelistWindow, IErrorEvent, IFileDataProvider, WidgetErrorEventArgs } from '../filelist/widget.d';
import { PUBLIC_GOOGLE_DRIVE_FOLDER_ID } from '../filelist/widget-google';
import { DEFAULT_HTTP_INDEX_URL } from '../filelist/widget-index';
import type { NestedTreeNode } from '../bundle/github-tools';
import type { FileListWidget } from '../filelist/widget';

export type ViewMode = 'netflix' | 'itunes' | 'grid' | 'details' | 'tree' | 'music' | string;

export type ViewRenderer = (this: ArtWidget, files: NestedTreeNode[], container: HTMLElement) => void;

export interface SourceProviderConfig
{
	pattern: RegExp | string;
	widgetClass: string;
	getWidget: (source: string) => Widget;
}

export interface ArtWindow
{
	ArtWidget: typeof ArtWidget;
	artWidget: ArtWidget;
}

const widgetSelf: ArtWindow & LuminoLayoutWindow & GlobalToolbarsWindow & FilelistWindow = self as unknown as any;

export class ArtWidget extends Widget
{
	private sources: string[];
	private activeWidget: Widget | undefined;
	private sourcePromises: Map<string, Promise<NestedTreeNode[]>> = new Map();
	private currentMode: ViewMode = 'netflix';
	protected dataProvider?: IFileDataProvider;

	/**
	 * Overridable registry of view renderers mapped by mode string
	 */
	protected viewRenderers: Map<string, ViewRenderer> = new Map();
	errorHandlers: ((sender: Widget, args: WidgetErrorEventArgs) => void)[] = [];

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

		// Register default built-in view handlers
		this.renderWidgetFrame();
	}

	/**
	 * Registers initial set of view renderers. Subclasses can override this or use `registerViewRenderer`.
	 */
	protected renderWidgetFrame(): void
	{
		// TODO: make this a const list at the top

		// TODO: make this dynamic based on widget constructor name
		//container.classList.add('default-frame');
	}

	/**
	 * Public extension API to add or override a view mode renderer
	 */
	public registerViewRenderer(mode: string, renderer: ViewRenderer): void
	{
		this.viewRenderers.set(mode, renderer);
	}

	/**
	 * Resolves source protocol/prefix to determine appropriate sidebar widget provider
	 */
	private resolveSourceWidget(source: string): Widget | undefined
	{
		if(!source) return undefined;

		// GitHub Repository / Asset source
		if(source.startsWith('github:') || source.includes('github.com'))
		{
			if(widgetSelf.AssetListWidget)
			{
				return new widgetSelf.AssetListWidget('GitHub Assets', source);
			}
		}
		// Google Drive Protocol / ID
		else if(source.startsWith('gdrive://') || source.startsWith('1') && source.length > 25)
		{
			if(widgetSelf.GoogleDriveWidget)
			{
				return new widgetSelf.GoogleDriveWidget('Drive Assets', source);
			}
		}
		// Google Drive Protocol / ID
		else if(source.startsWith('idb://') || source.startsWith('1') && source.length > 25)
		{
			//const cleanId = source.replace('idb://', '') || source;
			if(widgetSelf.DatabaseListWidget)
			{
				return new widgetSelf.DatabaseListWidget('Indexed DB');
			}
		}
		// HTTP / HTTPS Web Index
		else if(source.startsWith('http://') || source.startsWith('https://'))
		{
			if(widgetSelf.HttpIndexWidget)
			{
				return new widgetSelf.HttpIndexWidget('HTTP Index', source);
			}
		}
		// Local File System / Workspace Fallback
		else if(source.startsWith('file://') || source.startsWith('local://'))
		{
			if(widgetSelf.FileListWidget)
			{
				return new widgetSelf.FileListWidget('Local Workspace', source);
			}
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
			targetWidget = this.resolveSourceWidget(currentSource);
		}

		if(!targetWidget)
		{
			this.openOutlineWidget(index + 1);
			return;
		}

		this.activeWidget = targetWidget;
		if('fetchFiles' in targetWidget && typeof targetWidget.fetchFiles === 'function')
		{
			this.dataProvider = targetWidget;
		}

		if('errorOccurred' in targetWidget && typeof (targetWidget as IErrorEvent).errorOccurred?.connect === 'function')
		{
			if(!this.errorHandlers[index])
			{
				this.errorHandlers[index] = this.handleError.bind(this, index);
			}
			(targetWidget as IErrorEvent).errorOccurred?.connect(this.errorHandlers[index], this);
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
		this.activeWidget?.close();
		this.activeWidget = undefined;

		this.openOutlineWidget(index + 1);
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
			const widget = this.resolveSourceWidget(source);
			if(!widget) return [];

			if('fetchFiles' in widget && typeof widget.fetchFiles === 'function')
			{
				return await widget.fetchFiles();
			}
			return [];
		})();

		this.sourcePromises.set(source, fetchPromise);
		return fetchPromise;
	}

	/**
	 * Dynamically swaps out views based on view mode via the lookup table
	 */
	public setViewMode(mode: ViewMode, files: NestedTreeNode[] = []): void
	{
		this.currentMode = mode;
		this.node.replaceChildren();

		const renderer = this.viewRenderers.get(mode);
		if(renderer)
		{
			const section = document.createElement('div');
			section.className = 'art-view-section';
			renderer.call(this, files, section);
			this.node.appendChild(section);
		} else
		{
			console.warn(`No view renderer registered for mode "${mode}".`);
		}

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
		this.openOutlineWidget(0);
		this.setViewMode(this.currentMode);
	}

	protected override onActivateRequest(msg: Message): void
	{
		super.onActivateRequest(msg);
		this.openOutlineWidget(0);
	}

	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		this.openOutlineWidget(0);
	}

	protected override onBeforeDetach(msg: Message): void
	{
		this.activeWidget?.close();
		this.sourcePromises.clear();
		super.onBeforeDetach(msg);
	}

	protected override onBeforeHide(msg: Message): void
	{
		this.activeWidget?.close();
		super.onBeforeHide(msg);
	}
}

widgetSelf.ArtWidget = ArtWidget;
