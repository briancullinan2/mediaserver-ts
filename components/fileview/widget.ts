import { Message, MessageLoop } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import { ISignal, Signal } from '@lumino/signaling';
import { ArtWidget, modeToWidgetURI, modeToWindowType, type KnownFileViews } from '../art/widget';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { GoogleDriveFile } from '../filelist/widget-google';
import type { FlatFileNode, NestedTreeNode } from '../bundle/github-tools';
import type mime from 'mime';
import type { CarouselViewWidget } from './widget-carousel';
import { IPillSelectedArgs, IPillViewOptions, PillSelectorWidget } from '../art/widget-pill';
import type { IStyleViewOptions, StyleSelectorWidget } from '../art/widget-style';
import type { IFileDataProvider, WidgetFilesEventArgs } from '../filelist/widget.d';
import { WidgetSearchBar } from '../art/widget-search';
import type { MenuModules } from '../bundle/menu-manager';
import type { GlobalToolbarsWindow } from '../bundle/menu.d';
import type { IconSize } from './widget-grid';


export type ViewMode = 'carousel' | 'coverflow' | 'grid' | 'details' | 'tree' | 'pills' | 'styles';
export type SortOption = 'name-asc' | 'name-desc' | 'date-desc' | 'size-desc' | 'type';
export type GroupOption = 'none' | 'type' | 'date' | 'size';
type Constructor<T = any, Args extends any[] = any[]> = new (...args: Args) => T;

const fileviewSelf: LuminoLayoutWindow & KnownFileViews & GlobalToolbarsWindow & {
	mime: typeof mime;
} = self as unknown as any;


export interface IFileViewOptions
{
	filesSignal?: ISignal<any, WidgetFilesEventArgs>;
	files?: NestedTreeNode[]; // this just means the file widget comes with a file interpreter of its own
	onFileSelect?: (file: NestedTreeNode) => void;
	title?: string;
}


export class FileviewWidget extends ArtWidget implements MenuModules
{
	// Active Display State
	private isSplitView: boolean = false;

	// Filtering & Category Pills
	private searchQuery: string = '';
	private showHiddenFiles: boolean = false;
	private sortBy: SortOption = 'name-asc';
	private groupBy: GroupOption = 'none';

	// UI References
	private inspectorPanel!: HTMLElement;
	private addressInput!: HTMLInputElement;
	protected pillsWidget!: PillSelectorWidget;

	protected override activeViews: Set<ViewMode> = new Set(['carousel']);
	private styleWidget?: StyleSelectorWidget;

	public parentTabBar?: HTMLElement;
	public searchContainer?: HTMLDivElement;
	public searchInput?: HTMLInputElement;
	public searchObserver?: ResizeObserver;

	modules: Record<string, Record<string, Function>> = LOCAL_COMMANDS;

	constructor(title?: string, sources?: string | string[])
	{
		super(title ?? 'Explorer Workspace', sources);
		this.addClass('cloud-drive-explorer-widget');
		this.addClass(`${this.constructor.name.toLowerCase()}-frame`);
		// TODO: save this value for every widget
		this.addClass('zoom-' + this.zoom);
		this.id = 'fileview';
		this.title.className = this.id;

		//const theme = Array.from(document.body.classList.values()).find(c => c.startsWith('theme-'));
		//if(theme)
		//{
		//	this.addClass(theme);
		//}
	}

	protected override onResize(msg: Widget.ResizeMessage): void
	{
		super.onResize(msg);
		const widgets: Widget[] = Array.from(this.mountedSubWidgets.values());
		for(const w of widgets)
		{
			w.fit();
			MessageLoop.sendMessage(w, msg);
		}
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		//this.filesChanged.connect(() => this.refreshCurrentFolder());
		this.errorOccurred.connect((sender) =>
		{
			//if(this.dataProvider as any !== sender)
			//{
			//	this.refreshCurrentFolder();
			//}
		});
		//this.refreshCurrentFolder();
		this.parentTabBar = this.node.closest('.lm-DockPanel, .lm-TabPanel')?.querySelector(`.lm-TabBar:has(li.${this.id})`) as HTMLElement;
		if(this.isVisible)
		{
			WidgetSearchBar.onAfterAttach(this);
		}
	}

	protected override onBeforeDetach(msg: Message): void
	{
		this.clearMountedSubWidgets();
		WidgetSearchBar.onBeforeDetach(this);
		super.onBeforeDetach(msg);
	}


	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		WidgetSearchBar.onAfterShow(this);
	}

	protected onAfterHide(msg: any): void
	{
		super.onAfterHide(msg);
		WidgetSearchBar.onAfterHide(this);
	}

	/**
	 * Main UI Shell Construction
	 */
	private renderExplorerShell(): void
	{
		if(this.viewContainer)
		{
			// TODO: detach?
		}
		this.node.innerHTML = `
			<div class="cloud-explorer-container ${this.isSplitView ? 'split-view-active' : ''}">

			</div>
		`;

		this.viewContainer = this.node.querySelector('.cloud-explorer-container') as HTMLElement;
		this.inspectorPanel = this.node.querySelector('#cloud-inspector-panel') as HTMLElement;
		this.addressInput = this.node.querySelector('#address-input') as HTMLInputElement;
	}

	/**
	 * TODO: remove
	 * Attach UI Action Listeners
	 */
	private attachEventListeners(): void
	{
		// View Switchers
		this.node.querySelectorAll('.view-btn').forEach(btn =>
		{
			btn.addEventListener('click', e =>
			{
				const target = e.currentTarget as HTMLElement;
				const view = target.dataset.view as ViewMode;
				this.toggleViewMode(view, fileviewSelf.isShiftPressed || this.isSplitView);
			});
		});

		// Search Input
		const searchInput = this.node.querySelector('#search-input') as HTMLInputElement;
		searchInput?.addEventListener('input', (e) =>
		{
			this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
			this.applyFiltersAndSort();
			this.updateActiveViews();
		});

		// Ribbon Controls
		this.node.querySelector('#toggle-hidden-files')?.addEventListener('change', (e) =>
		{
			this.showHiddenFiles = (e.target as HTMLInputElement).checked;
			this.applyFiltersAndSort();
			this.updateActiveViews();
		});

		this.node.querySelector('#sort-select')?.addEventListener('change', (e) =>
		{
			this.sortBy = (e.target as HTMLSelectElement).value as SortOption;
			this.applyFiltersAndSort();
			this.updateActiveViews();
		});

		this.node.querySelector('#group-select')?.addEventListener('change', (e) =>
		{
			this.groupBy = (e.target as HTMLSelectElement).value as GroupOption;
			this.updateActiveViews();
		});

		// Split View & Inspector
		this.node.querySelector('#btn-toggle-split')?.addEventListener('click', () =>
		{
			this.isSplitView = !this.isSplitView;
			this.node.querySelector('.cloud-explorer-container')?.classList.toggle('split-view-active', this.isSplitView);
			this.updateActiveViews();
		});

		this.node.querySelector('#btn-toggle-inspector')?.addEventListener('click', () =>
		{
			this.inspectorPanel.classList.toggle('hidden');
		});

		this.node.querySelector('#close-inspector-btn')?.addEventListener('click', () =>
		{
			this.inspectorPanel.classList.add('hidden');
		});

		// Address Bar Toggle
		const breadcrumbTrail = this.node.querySelector('#breadcrumb-trail') as HTMLElement;
		breadcrumbTrail?.addEventListener('click', () =>
		{
			breadcrumbTrail.classList.add('hidden');
			this.addressInput.classList.remove('hidden');
			this.addressInput.focus();
		});

		this.addressInput?.addEventListener('keydown', (e) =>
		{
			if(e.key === 'Enter')
			{
				this.navigateToPath(this.addressInput.value);
				this.addressInput.classList.add('hidden');
				breadcrumbTrail.classList.remove('hidden');
			} else if(e.key === 'Escape')
			{
				this.addressInput.classList.add('hidden');
				breadcrumbTrail.classList.remove('hidden');
			}
		});
	}

	/**
	 * Toggle Active View Display Modes
	 */
	public async toggleViewMode(mode: ViewMode, multiSelect: boolean = false): Promise<void>
	{
		if(!multiSelect)
		{
			this.activeViews.clear();
			this.activeViews.add(mode);
		} else
		{
			if(this.activeViews.has(mode) && this.activeViews.size > 1)
			{
				this.activeViews.delete(mode);
			} else
			{
				this.activeViews.add(mode);
			}
		}

		this.node.querySelectorAll('.view-btn').forEach(btn =>
		{
			const target = btn as HTMLElement;
			const view = target.dataset.view as ViewMode;
			btn.classList.toggle('active', this.activeViews.has(view));
		});

		await this.renderActiveViews();
	}




	/**
	 * Render Active View Modes Parallelly
	 */
	protected override async renderActiveViews(): Promise<void>
	{
		if(!this.viewContainer)
		{
			this.renderExplorerShell();
		}

		this.clearMountedSubWidgets();

		this.viewContainer.innerHTML = '';
		this.viewContainer.className = `cloud-main-panel views-count-${this.activeViews.size}`;

		for(const mode of this.activeViews)
		{
			const pane = document.createElement('div');
			pane.className = `view-pane view-pane-${mode}`;
			this.viewContainer.appendChild(pane);
			let widgetInstance: Widget | undefined = undefined;

			let viewWidget = modeToWindowType(mode, this.sources[this.widgetIndex]);
			if(!viewWidget)
			{
				const widgetURI = modeToWidgetURI(mode, this.sources[this.widgetIndex]);
				if(fileviewSelf.loadScript && widgetURI)
				{
					await fileviewSelf.preloadDependencies?.([widgetURI]);
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
				case 'carousel':
					this.categorySelected = (widgetInstance as CarouselViewWidget).categorySelected;
					break;
				case 'coverflow':
					break;
				case 'pills':
					this.categorySelected = (widgetInstance as PillSelectorWidget).categorySelected;
					break;
				case 'styles':
					break;
				case 'tree':
					await this.renderSubtreeWidget(pane);
					return;
			}

			if(widgetInstance)
			{
				Widget.attach(widgetInstance, pane);
				this.mountedSubWidgets.set(pane, widgetInstance);
			}
		}

	}


	/**
	 * Mount imported Tree Sub-Widgets dynamically based on folder context
	 */
	private async renderSubtreeWidget(container: HTMLElement): Promise<void>
	{
		const widgetInstance = await ArtWidget.resolveSourceWidget(this.sources[this.widgetIndex]);
		if(widgetInstance)
		{
			Widget.attach(widgetInstance, container);
			this.mountedSubWidgets.set(container, widgetInstance);
		}
	}


	/**
	 * Data Fetch & Processing
	 */
	protected override async refreshCurrentFolder(): Promise<void>
	{
		super.refreshCurrentFolder();

		if(!this.viewContainer)
		{
			this.renderExplorerShell();
		}

		for(const file of this.rawFiles ?? [])
		{
			if(!file.mimeType)
			{
				file.mimeType = fileviewSelf.mime.getType(file.path);
			}
		}

		this.applyFiltersAndSort();
		//this.renderBreadcrumbTrail();
		await this.updateActiveViews();
	}

	protected override extractCategories(): void
	{
		this.availableCategories.clear();

		this.rawFiles?.forEach(file =>
		{
			if(file.mimeType)
			{
				const mainType = file.mimeType.split('/')[0];
				this.availableCategories.add(mainType);
			}
		});

		const pills = Object.keys(PillSelectorWidget.parseAndBuildCategoryMap(this.rawFiles ?? [], false));
		for(const pill of pills)
		{
			this.availableCategories.add(pill);
		}
	}

	// TODO: update this to parent class
	private applyFiltersAndSort(): void
	{
		this.displayedFiles = this.rawFiles?.filter(file =>
		{
			const matchesHidden = this.showHiddenFiles || !file.text.startsWith('.');
			const matchesSearch = !this.searchQuery || file.text.toLowerCase().includes(this.searchQuery);
			const matchesPill = this.selectedCategoryPill === 'all' || (file.mimeType && file.mimeType.startsWith(this.selectedCategoryPill));

			return matchesHidden && matchesSearch && matchesPill;
		}) ?? [];

		this.displayedFiles.sort((a, b) =>
		{
			switch(this.sortBy)
			{
				case 'name-asc':
					return a.text.localeCompare(b.text);
				case 'name-desc':
					return b.text.localeCompare(a.text);
				case 'type':
					return (a.mimeType ?? '').localeCompare(b.mimeType ?? '');
				default:
					return 0;
			}
		});
	}

	private updateInspectorPanel(): void
	{
		const inspectorBody = this.node.querySelector('#inspector-body') as HTMLElement;
		if(this.selectedFileIds.size === 0)
		{
			inspectorBody.innerHTML = `<div class="empty-selection">Select an item to view details</div>`;
			return;
		}

		const selectedFiles = this.rawFiles?.filter(f => this.selectedFileIds.has(f.id)) ?? [];
		if(selectedFiles.length === 1)
		{
			const file = selectedFiles[0];
			inspectorBody.innerHTML = `
				<div class="inspector-file-card">
					<div class="inspector-preview">
						${'thumbnailLink' in file ? `<img src="${file.thumbnailLink}" />` : `<i class="bx ${this.getFileIconClass(file)} icon-large"></i>`}
					</div>
					<h4>${file.text}</h4>
					<ul class="inspector-meta-list">
						<li><strong>ID:</strong> ${file.id}</li>
						<li><strong>Type:</strong> ${file.mimeType ?? 'File'}</li>
						<li><strong>Path:</strong> ${this.sources[this.widgetIndex]}/${file.text}</li>
					</ul>
				</div>
			`;
		} else
		{
			inspectorBody.innerHTML = `
				<div class="inspector-multi-card">
					<i class="bx bx-copy-alt icon-large"></i>
					<h4>${selectedFiles.length} items selected</h4>
				</div>
			`;
		}
	}

	/*
	private renderBreadcrumbTrail(): void
	{
		const trail = this.node.querySelector('#breadcrumb-trail') as HTMLElement;
		const segments = this.activeFolderPath.split('/').filter(Boolean);

		let currentPath = '';
		trail.innerHTML = `<span class="breadcrumb-item" data-path="/">Root</span>`;

		segments.forEach(seg =>
		{
			currentPath += `/${seg}`;
			trail.innerHTML += `
				<span class="breadcrumb-separator">/</span>
				<span class="breadcrumb-item" data-path="${currentPath}">${seg}</span>
			`;
		});

		trail.querySelectorAll('.breadcrumb-item').forEach(item =>
		{
			item.addEventListener('click', (e) =>
			{
				e.stopPropagation();
				const path = (item as HTMLElement).dataset.path!;
				this.navigateToPath(path);
			});
		});
	}
	*/

	private async navigateToPath(path: string): Promise<void>
	{
		//this.activeFolderPath = path;
		//const parts = path.split('/').filter(Boolean);
		//this.activeFolderName = parts[parts.length - 1] ?? 'Home';
		//await this.refreshCurrentFolder();
	}

	private getFileIconClass(file: FlatFileNode | NestedTreeNode | GoogleDriveFile): string
	{
		if(typeof file.mode === 'number' && (file.mode >> 12) === 4)
		{
			return 'bx-folder';
		}
		if('mimeType' in file)
		{
			if(file.mimeType?.includes('folder')) return 'bx-folder';
			if(file.mimeType?.includes('image')) return 'bx-image';
			if(file.mimeType?.includes('video')) return 'bx-video';
			if(file.mimeType?.includes('pdf')) return 'bx-file-pdf';
		}
		return 'bx-file';
	}

	public setZoom(delta?: number)
	{
		if(delta === -1)
		{
			if(this.zoom === 'tiny')
			{

			} else if(this.zoom === 'small')
			{
				this.zoom = 'tiny';
			} else if(this.zoom === 'medium')
			{
				this.zoom = 'small';
			} else if(this.zoom === 'large')
			{
				this.zoom = 'medium';
			} else if(this.zoom === 'huge')
			{
				this.zoom = 'large';
			} else
			{
				this.zoom = 'medium';
			}
		}
		else if(delta === 1)
		{
			if(this.zoom === 'tiny')
			{
				this.zoom = 'small';
			} else if(this.zoom === 'small')
			{
				this.zoom = 'medium';
			} else if(this.zoom === 'medium')
			{
				this.zoom = 'large';
			} else if(this.zoom === 'large')
			{
				this.zoom = 'huge';
			} else if(this.zoom === 'huge')
			{

			} else
			{
				this.zoom = 'medium';
			}
		} else if(delta === 0)
		{
			this.zoom = 'medium';
		}

		for(const w of this.mountedSubWidgets)
		{
			if('setIconSize' in w && typeof w.setIconSize === 'function')
			{
				w.setIconSize(this.zoom);
			}
		}

		for(const c of this.node.classList)
		{
			if(c.startsWith('zoom-') && c !== this.zoom)
			{
				this.removeClass(c);
			}
		}
		this.addClass('zoom-' + this.zoom);
	}

	private zoom: IconSize = 'medium';
}


const LOCAL_COMMANDS: Record<string, Record<string, Function>> = {};


LOCAL_COMMANDS['view/zoom'] = {
	in: function ()
	{
		//const toolbar = fileviewSelf.ViewToolbar?.getInstance();
		//toolbar?.toggleHiddenFiles();
		const activeWidget = fileviewSelf.lastInteractedWidget ?? fileviewSelf.previousInteractedWidget;
		if(typeof (activeWidget as any)?.setZoom === 'function')
		{
			(activeWidget as any).setZoom(1);
		}
	},
	out: function ()
	{
		//const toolbar = fileviewSelf.ViewToolbar?.getInstance();
		//toolbar?.toggleHiddenFiles();
		const activeWidget = fileviewSelf.lastInteractedWidget ?? fileviewSelf.previousInteractedWidget;
		if(typeof (activeWidget as any)?.setZoom === 'function')
		{
			(activeWidget as any).setZoom(-1);
		}
	}
};
