import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import { ArtWidget } from '../art/widget';
import type { DriveFile } from '../filelist/widget.d';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import { FileListWidget } from '../filelist/widget';
import { GoogleDriveWidget } from '../filelist/widget-google';
import { HttpIndexWidget } from '../filelist/widget-index';
import { AssetListWidget } from '../filelist/widget-assets';

export type ViewMode = 'netflix' | 'itunes' | 'grid' | 'details' | 'tree';
export type SortOption = 'name-asc' | 'name-desc' | 'date-desc' | 'size-desc' | 'type';
export type GroupOption = 'none' | 'type' | 'date' | 'size';

export interface ICloudDataProvider
{
	fetchFolders(parentId: string): Promise<Array<{ id: string; name: string; path?: string; }>>;
	fetchFiles(folderId: string): Promise<DriveFile[]>;
	createFolder?(parentId: string, name: string): Promise<boolean>;
	createFile?(parentId: string, name: string, content?: Blob): Promise<boolean>;
	deleteItems?(ids: string[]): Promise<boolean>;
	renameItem?(id: string, newName: string): Promise<boolean>;
}

const fileviewSelf: LuminoLayoutWindow & {
	isShiftPressed?: boolean;
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
	private dataProvider?: ICloudDataProvider;
	private rawFiles: DriveFile[] = [];
	private displayedFiles: DriveFile[] = [];
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
		this.activeFolderId = (this as any).rootFolderId ?? 'root';
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

			switch(mode)
			{
				case 'netflix':
					this.renderNetflixView(pane, this.displayedFiles);
					break;
				case 'itunes':
					this.renderCoverflowView(pane, this.displayedFiles);
					break;
				case 'grid':
					this.renderGridView(pane, this.displayedFiles);
					break;
				case 'details':
					this.renderDetailsView(pane, this.displayedFiles);
					break;
				case 'tree':
					await this.renderSubtreeWidget(pane);
					break;
			}
		}
	}

	/**
	 * Netflix Layout View
	 */
	private renderNetflixView(container: HTMLElement, files: DriveFile[]): void
	{
		container.innerHTML = '';
		const groups = this.groupFiles(files);

		for(const [groupName, groupFiles] of Object.entries(groups))
		{
			const row = document.createElement('div');
			row.className = 'netflix-row';
			row.innerHTML = `
				<h4 class="netflix-row-title">${groupName} (${groupFiles.length})</h4>
				<div class="netflix-row-slider">
					${groupFiles.map(file => `
						<div class="netflix-card ${this.selectedFileIds.has(file.id) ? 'selected' : ''}" data-id="${file.id}">
							<div class="card-media">
								${file.thumbnailLink ? `<img src="${file.thumbnailLink}" alt="${file.name}" />` : `<i class="bx ${this.getFileIconClass(file)}"></i>`}
							</div>
							<div class="card-details">
								<span class="card-title">${file.name}</span>
							</div>
						</div>
					`).join('')}
				</div>
			`;

			row.querySelectorAll('.netflix-card').forEach(card =>
			{
				card.addEventListener('click', (e) => this.handleFileSelection((card as HTMLElement).dataset.id!, e as MouseEvent));
			});

			container.appendChild(row);
		}
	}

	/**
	 * Grid Layout View
	 */
	private renderGridView(container: HTMLElement, files: DriveFile[]): void
	{
		container.innerHTML = `
			<div class="grid-view-container">
				${files.map(file => `
					<div class="grid-item ${this.selectedFileIds.has(file.id) ? 'selected' : ''}" data-id="${file.id}">
						<div class="grid-icon">
							${file.thumbnailLink ? `<img src="${file.thumbnailLink}" />` : `<i class="bx ${this.getFileIconClass(file)}"></i>`}
						</div>
						<div class="grid-label" title="${file.name}">${file.name}</div>
					</div>
				`).join('')}
			</div>
		`;

		container.querySelectorAll('.grid-item').forEach(item =>
		{
			item.addEventListener('click', (e) => this.handleFileSelection((item as HTMLElement).dataset.id!, e as MouseEvent));
		});
	}

	/**
	 * Details List View
	 */
	private renderDetailsView(container: HTMLElement, files: DriveFile[]): void
	{
		container.innerHTML = `
			<table class="details-table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Modified</th>
						<th>Type</th>
						<th>Size</th>
					</tr>
				</thead>
				<tbody>
					${files.map(file => `
						<tr class="details-row ${this.selectedFileIds.has(file.id) ? 'selected' : ''}" data-id="${file.id}">
							<td class="name-cell"><i class="bx ${this.getFileIconClass(file)}"></i> ${file.name}</td>
							<td>${(file as any).modifiedTime ?? '—'}</td>
							<td>${file.mimeType ?? 'File'}</td>
							<td>${(file as any).size ? `${Math.round((file as any).size / 1024)} KB` : '—'}</td>
						</tr>
					`).join('')}
				</tbody>
			</table>
		`;

		container.querySelectorAll('.details-row').forEach(row =>
		{
			row.addEventListener('click', (e) => this.handleFileSelection((row as HTMLElement).dataset.id!, e as MouseEvent));
		});
	}

	/**
	 * iTunes Coverflow View
	 */
	private renderCoverflowView(container: HTMLElement, files: DriveFile[]): void
	{
		container.innerHTML = `
			<div class="itunes-coverflow-stage">
				<div class="coverflow-track">
					${files.map(file => `
						<div class="coverflow-item ${this.selectedFileIds.has(file.id) ? 'selected' : ''}" data-id="${file.id}">
							${file.thumbnailLink ? `<img src="${file.thumbnailLink}" />` : `<div class="coverflow-placeholder"><i class="bx ${this.getFileIconClass(file)}"></i></div>`}
							<div class="coverflow-title">${file.name}</div>
						</div>
					`).join('')}
				</div>
			</div>
		`;

		container.querySelectorAll('.coverflow-item').forEach(item =>
		{
			item.addEventListener('click', (e) => this.handleFileSelection((item as HTMLElement).dataset.id!, e as MouseEvent));
		});
	}

	/**
	 * Mount imported Tree Sub-Widgets dynamically based on folder context
	 */
	private async renderSubtreeWidget(container: HTMLElement): Promise<void>
	{
		const mountNode = document.createElement('div');
		mountNode.className = 'subtree-widget-mount';
		container.appendChild(mountNode);

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

		Widget.attach(widgetInstance, mountNode);
		this.mountedSubWidgets.set(mountNode, widgetInstance);
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
		} else
		{
			this.rawFiles = await this.fetchSharedData(this.activeFolderId);
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
			const matchesHidden = this.showHiddenFiles || !file.name.startsWith('.');
			const matchesSearch = !this.searchQuery || file.name.toLowerCase().includes(this.searchQuery);
			const matchesPill = this.selectedCategoryPill === 'all' || (file.mimeType && file.mimeType.startsWith(this.selectedCategoryPill));

			return matchesHidden && matchesSearch && matchesPill;
		});

		this.displayedFiles.sort((a, b) =>
		{
			switch(this.sortBy)
			{
				case 'name-asc':
					return a.name.localeCompare(b.name);
				case 'name-desc':
					return b.name.localeCompare(a.name);
				case 'type':
					return (a.mimeType ?? '').localeCompare(b.mimeType ?? '');
				default:
					return 0;
			}
		});
	}

	private groupFiles(files: DriveFile[]): Record<string, DriveFile[]>
	{
		if(this.groupBy === 'none')
		{
			return { 'All Items': files };
		}

		return files.reduce((acc, file) =>
		{
			let key = 'Other';
			if(this.groupBy === 'type')
			{
				key = file.mimeType ? file.mimeType.split('/')[0].toUpperCase() : 'FILES';
			}
			if(!acc[key]) acc[key] = [];
			acc[key].push(file);
			return acc;
		}, {} as Record<string, DriveFile[]>);
	}

	private handleFileSelection(id: string, e: MouseEvent): void
	{
		if(!e.ctrlKey && !e.metaKey)
		{
			this.selectedFileIds.clear();
		}

		if(this.selectedFileIds.has(id))
		{
			this.selectedFileIds.delete(id);
		} else
		{
			this.selectedFileIds.add(id);
		}

		this.updateInspectorPanel();
		this.renderActiveViews();
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
						${file.thumbnailLink ? `<img src="${file.thumbnailLink}" />` : `<i class="bx ${this.getFileIconClass(file)} icon-large"></i>`}
					</div>
					<h4>${file.name}</h4>
					<ul class="inspector-meta-list">
						<li><strong>ID:</strong> ${file.id}</li>
						<li><strong>Type:</strong> ${file.mimeType ?? 'File'}</li>
						<li><strong>Path:</strong> ${this.activeFolderPath}/${file.name}</li>
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

	private getFileIconClass(file: DriveFile): string
	{
		if(file.mimeType?.includes('folder')) return 'bx-folder';
		if(file.mimeType?.includes('image')) return 'bx-image';
		if(file.mimeType?.includes('video')) return 'bx-video';
		if(file.mimeType?.includes('pdf')) return 'bx-file-pdf';
		return 'bx-file';
	}

	private async fetchSharedData(folderId: string): Promise<DriveFile[]>
	{
		if(this.dataProvider)
		{
			return await this.dataProvider.fetchFiles(folderId);
		}

		const categoryMap = (this as any).categoryMap;
		const activeCategory = (this as any).activeCategory;
		const activeStyle = (this as any).activeStyle;
		const meta = categoryMap?.[activeCategory]?.[activeStyle];

		if(meta)
		{
			return await (this as any).loadFolderImagesLazy(meta);
		}

		return [];
	}
}
