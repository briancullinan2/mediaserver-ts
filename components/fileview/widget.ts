import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import { ArtWidget } from '../art/widget';
import type { IFileDataProvider } from '../filelist/widget.d';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import { FileListWidget } from '../filelist/widget';
import { GoogleDriveFile, GoogleDriveWidget } from '../filelist/widget-google';
import { HttpIndexWidget } from '../filelist/widget-index';
import { AssetListWidget } from '../filelist/widget-assets';
import type { FlatFileNode, NestedTreeNode } from '../bundle/github-tools';
import type mime from 'mime';
import { NetflixViewWidget } from './widget-netflix';
import { CoverflowWidget } from '../art/widget-coverflow';
import { ExplorerGridWidget } from './widget-grid';
import { DetailsViewWidget } from './widget-details';


export type ViewMode = 'netflix' | 'itunes' | 'grid' | 'details' | 'tree';
export type SortOption = 'name-asc' | 'name-desc' | 'date-desc' | 'size-desc' | 'type';
export type GroupOption = 'none' | 'type' | 'date' | 'size';

const fileviewSelf: LuminoLayoutWindow & {
	isShiftPressed?: boolean;
	mime: typeof mime;
} = self as unknown as any;

export class FileviewWidget extends ArtWidget
{
	// Active Display State
	private activeViews: Set<ViewMode> = new Set(['netflix']);
	private isSplitView: boolean = false;
	private activeFolderId: string = 'root';
	private activeFolderPath: string = '/Home';
	private activeFolderName: string = 'Home';

	// Filtering & Category Pills
	private selectedCategoryPill: string = 'all';
	private availableCategories: Set<string> = new Set();
	private searchQuery: string = '';
	private showHiddenFiles: boolean = false;
	private sortBy: SortOption = 'name-asc';
	private groupBy: GroupOption = 'none';

	// Data
	private dataProvider?: IFileDataProvider;
	private rawFiles: NestedTreeNode[] = [];
	private displayedFiles: NestedTreeNode[] = [];
	private selectedFileIds: Set<string> = new Set();

	// Active Mounted Sub-Widgets
	private mountedSubWidgets: Map<HTMLElement, Widget> = new Map();

	// UI References
	private viewContainer!: HTMLElement;
	private inspectorPanel!: HTMLElement;
	private addressInput!: HTMLInputElement;
	private pillsContainer!: HTMLElement;

	constructor(title?: string, sources?: string | string[])
	{
		super(title ?? 'Explorer Workspace', sources);
		this.addClass('cloud-drive-explorer-widget');
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.renderExplorerShell();
		this.attachEventListeners();
		this.refreshCurrentFolder();
	}

	protected override onBeforeDetach(msg: Message): void
	{
		this.clearMountedSubWidgets();
		super.onBeforeDetach(msg);
	}

	protected override renderWidgetFrame(): void
	{
		this.node.classList.add(`${this.constructor.name.toLowerCase()}-frame`);
		this.node.classList.add('explorer-enhanced-shell');
	}

	/**
	 * Main UI Shell Construction
	 */
	private renderExplorerShell(): void
	{
		this.node.innerHTML = `
			<div class="cloud-explorer-container ${this.isSplitView ? 'split-view-active' : ''}">
				<!-- Top Action Ribbon Toolbar -->
				<header class="explorer-ribbon-bar">
					<div class="ribbon-group file-actions">
						<button class="ribbon-btn" id="btn-new-folder" title="New Folder"><i class="bx bx-folder-plus"></i><span>Folder</span></button>
						<button class="ribbon-btn" id="btn-new-file" title="New File"><i class="bx bx-file-plus"></i><span>File</span></button>
						<div class="ribbon-divider"></div>
						<button class="ribbon-btn" id="btn-cut" title="Cut"><i class="bx bx-cut"></i></button>
						<button class="ribbon-btn" id="btn-copy" title="Copy"><i class="bx bx-copy"></i></button>
						<button class="ribbon-btn" id="btn-paste" title="Paste" disabled><i class="bx bx-paste"></i></button>
						<button class="ribbon-btn" id="btn-rename" title="Rename"><i class="bx bx-edit"></i></button>
						<button class="ribbon-btn danger" id="btn-delete" title="Delete"><i class="bx bx-trash"></i></button>
					</div>

					<div class="ribbon-group view-controls">
						<label class="toggle-switch" title="Show/Hide Hidden Files">
							<input type="checkbox" id="toggle-hidden-files" ${this.showHiddenFiles ? 'checked' : ''} />
							<span class="toggle-label"><i class="bx bx-ghost"></i> Hidden</span>
						</label>
						<select id="sort-select" class="ribbon-select" title="Sort Items">
							<option value="name-asc">Name (A-Z)</option>
							<option value="name-desc">Name (Z-A)</option>
							<option value="date-desc">Date Modified</option>
							<option value="size-desc">Size</option>
							<option value="type">File Type</option>
						</select>
						<select id="group-select" class="ribbon-select" title="Group Items">
							<option value="none">No Grouping</option>
							<option value="type">Group by Type</option>
							<option value="date">Group by Date</option>
						</select>
					</div>

					<div class="ribbon-group layout-toggles">
						<button class="ribbon-btn ${this.isSplitView ? 'active' : ''}" id="btn-toggle-split" title="Toggle Split View Mode">
							<i class="bx bx-columns"></i>
						</button>
						<button class="ribbon-btn" id="btn-toggle-inspector" title="Toggle Details Panel">
							<i class="bx bx-info-circle"></i>
						</button>
					</div>
				</header>

				<!-- Navigation & Address Bar Header -->
				<div class="explorer-address-bar-container">
					<button class="nav-btn" id="btn-nav-up" title="Up"><i class="bx bx-folder-up-arrow"></i></button>

					<div class="address-bar-wrapper">
						<i class="bx bx-folder address-icon"></i>
						<div class="breadcrumb-trail" id="breadcrumb-trail"></div>
						<input type="text" class="address-input hidden" id="address-input" value="${this.activeFolderPath}" />
					</div>

					<div class="search-bar-wrapper">
						<i class="bx bx-search search-icon"></i>
						<input type="text" class="search-input" id="search-input" placeholder="Search files..." value="${this.searchQuery}" />
					</div>
				</div>

				<!-- Category Pills Filter Bar -->
				<div class="category-pills-bar" id="category-pills-bar">
					<button class="category-pill active" data-category="all">All Files</button>
				</div>

				<!-- Main Content Workspace -->
				<div class="explorer-workspace">
					<main class="cloud-main-panel">
						<header class="cloud-toolbar">
							<div class="view-switcher-buttons">
								<button class="view-btn ${this.activeViews.has('netflix') ? 'active' : ''}" data-view="netflix" title="Netflix Rows">
									<i class="bx bx-film"></i> Netflix
								</button>
								<button class="view-btn ${this.activeViews.has('itunes') ? 'active' : ''}" data-view="itunes" title="iTunes Coverflow">
									<i class="bx bx-carousel"></i> Coverflow
								</button>
								<button class="view-btn ${this.activeViews.has('grid') ? 'active' : ''}" data-view="grid" title="Icon Grid">
									<i class="bx bx-grid-alt"></i> Grid
								</button>
								<button class="view-btn ${this.activeViews.has('details') ? 'active' : ''}" data-view="details" title="Details List">
									<i class="bx bx-list-ul"></i> Details
								</button>
								<button class="view-btn ${this.activeViews.has('tree') ? 'active' : ''}" data-view="tree" title="Subtree Widget Instance">
									<i class="bx bx-git-repo-forked"></i> Subtree
								</button>
							</div>
						</header>

						<section class="cloud-view-stage" id="cloud-view-stage"></section>
					</main>

					<!-- Slide-Out Inspector Panel -->
					<aside class="cloud-inspector-panel hidden" id="cloud-inspector-panel">
						<div class="inspector-header">
							<h3>File Details</h3>
							<button class="close-inspector-btn" id="close-inspector-btn">×</button>
						</div>
						<div class="inspector-body" id="inspector-body">
							<div class="empty-selection">Select an item to preview properties</div>
						</div>
					</aside>
				</div>
			</div>
		`;

		this.viewContainer = this.node.querySelector('#cloud-view-stage') as HTMLElement;
		this.inspectorPanel = this.node.querySelector('#cloud-inspector-panel') as HTMLElement;
		this.addressInput = this.node.querySelector('#address-input') as HTMLInputElement;
		this.pillsContainer = this.node.querySelector('#category-pills-bar') as HTMLElement;
	}

	/**
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
			this.renderActiveViews();
		});

		// Ribbon Controls
		this.node.querySelector('#toggle-hidden-files')?.addEventListener('change', (e) =>
		{
			this.showHiddenFiles = (e.target as HTMLInputElement).checked;
			this.applyFiltersAndSort();
			this.renderActiveViews();
		});

		this.node.querySelector('#sort-select')?.addEventListener('change', (e) =>
		{
			this.sortBy = (e.target as HTMLSelectElement).value as SortOption;
			this.applyFiltersAndSort();
			this.renderActiveViews();
		});

		this.node.querySelector('#group-select')?.addEventListener('change', (e) =>
		{
			this.groupBy = (e.target as HTMLSelectElement).value as GroupOption;
			this.renderActiveViews();
		});

		// Split View & Inspector
		this.node.querySelector('#btn-toggle-split')?.addEventListener('click', () =>
		{
			this.isSplitView = !this.isSplitView;
			this.node.querySelector('.cloud-explorer-container')?.classList.toggle('split-view-active', this.isSplitView);
			this.renderActiveViews();
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
	private async renderActiveViews(): Promise<void>
	{
		this.clearMountedSubWidgets();
		this.viewContainer.innerHTML = '';
		this.viewContainer.className = `cloud-view-stage views-count-${this.activeViews.size}`;

		for(const mode of this.activeViews)
		{
			const pane = document.createElement('div');
			pane.className = `view-pane view-pane-${mode}`;
			this.viewContainer.appendChild(pane);
			let widgetInstance: Widget | undefined = undefined;

			switch(mode)
			{
				case 'netflix':
					widgetInstance = new NetflixViewWidget(pane, this.displayedFiles);
					break;
				case 'itunes':
					widgetInstance = new CoverflowWidget(pane, this.displayedFiles);
					break;
				case 'grid':
					widgetInstance = new ExplorerGridWidget(pane, this.displayedFiles);
					break;
				case 'details':
					widgetInstance = new DetailsViewWidget(pane, this.displayedFiles);
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
		let widgetInstance: Widget;

		if(this.activeFolderPath.startsWith('/Drive'))
		{
			widgetInstance = new GoogleDriveWidget();
		} else if(this.activeFolderPath.startsWith('/Http'))
		{
			widgetInstance = new HttpIndexWidget();
		} else if(this.activeFolderPath.startsWith('/Asset'))
		{
			widgetInstance = new AssetListWidget();
		} else
		{
			widgetInstance = new FileListWidget();
		}

		Widget.attach(widgetInstance, container);
		this.mountedSubWidgets.set(container, widgetInstance);
	}

	private clearMountedSubWidgets(): void
	{
		this.mountedSubWidgets.forEach((widget) => widget.dispose());
		this.mountedSubWidgets.clear();
	}

	/**
	 * Data Fetch & Processing
	 */
	private async refreshCurrentFolder(): Promise<void>
	{
		if(this.dataProvider)
		{
			this.rawFiles = await this.dataProvider.fetchFiles(this.activeFolderId);
			for(const file of this.rawFiles)
			{
				if(!file.mimeType)
				{
					file.mimeType = fileviewSelf.mime.getType(file.path);
				}
			}
		}

		this.extractCategories();
		this.renderCategoryPills();
		this.applyFiltersAndSort();
		this.renderBreadcrumbTrail();
		await this.renderActiveViews();
	}

	private extractCategories(): void
	{
		this.availableCategories.clear();
		this.rawFiles.forEach(file =>
		{
			if(file.mimeType)
			{
				const mainType = file.mimeType.split('/')[0];
				this.availableCategories.add(mainType);
			}
		});
	}

	private renderCategoryPills(): void
	{
		this.pillsContainer.innerHTML = `<button class="category-pill ${this.selectedCategoryPill === 'all' ? 'active' : ''}" data-category="all">All Files</button>`;

		this.availableCategories.forEach(cat =>
		{
			const btn = document.createElement('button');
			btn.className = `category-pill ${this.selectedCategoryPill === cat ? 'active' : ''}`;
			btn.dataset.category = cat;
			btn.innerText = cat.toUpperCase();
			btn.addEventListener('click', () =>
			{
				this.selectedCategoryPill = cat;
				this.renderCategoryPills();
				this.applyFiltersAndSort();
				this.renderActiveViews();
			});
			this.pillsContainer.appendChild(btn);
		});
	}

	private applyFiltersAndSort(): void
	{
		this.displayedFiles = this.rawFiles.filter(file =>
		{
			const matchesHidden = this.showHiddenFiles || !file.text.startsWith('.');
			const matchesSearch = !this.searchQuery || file.text.toLowerCase().includes(this.searchQuery);
			const matchesPill = this.selectedCategoryPill === 'all' || (file.mimeType && file.mimeType.startsWith(this.selectedCategoryPill));

			return matchesHidden && matchesSearch && matchesPill;
		});

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

		const selectedFiles = this.rawFiles.filter(f => this.selectedFileIds.has(f.id));
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
						<li><strong>Path:</strong> ${this.activeFolderPath}/${file.text}</li>
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

	private async navigateToPath(path: string): Promise<void>
	{
		this.activeFolderPath = path;
		const parts = path.split('/').filter(Boolean);
		this.activeFolderName = parts[parts.length - 1] ?? 'Home';
		await this.refreshCurrentFolder();
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

}
