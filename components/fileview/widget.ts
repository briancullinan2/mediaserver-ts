import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import { ArtWidget } from '../art/widget'; // Adjust import path
import type { DriveFile } from '../filelist/widget.d';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { FileListWidget } from '../filelist/widget';
import type { GoogleDriveWidget } from '../filelist/widget-google';

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
	FileListWidget: typeof FileListWidget;
	GoogleDriveWidget: typeof GoogleDriveWidget;
} = self as unknown as any;


export class FileviewWidget extends ArtWidget
{
	// Active Display State
	private activeViews: Set<ViewMode> = new Set(['netflix']);
	private isSplitView: boolean = false;
	private activeFolderId: string = 'root';
	private activeFolderPath: string = '/Home';
	private activeFolderName: string = 'Home';

	// Data & Filtering
	private dataProvider?: ICloudDataProvider;
	private rawFiles: DriveFile[] = [];
	private displayedFiles: DriveFile[] = [];
	private selectedFileIds: Set<string> = new Set();
	private clipboard: { action: 'copy' | 'cut'; items: DriveFile[]; } | null = null;

	// View Options & Controls
	private searchQuery: string = '';
	private showHiddenFiles: boolean = false;
	private sortBy: SortOption = 'name-asc';
	private groupBy: GroupOption = 'none';

	// Sub-widgets & UI References
	private mountedTreeWidget?: Widget;
	private viewContainer!: HTMLElement;
	private treeSidebarNode!: HTMLElement;
	private inspectorPanel!: HTMLElement;
	private addressInput!: HTMLInputElement;

	constructor(title?: string, sources: string | string[] = [''])
	{
		super(title ?? 'Cloud Drive Explorer', sources);
		this.addClass('cloud-drive-explorer-widget');
		//this.dataProvider = provider;
		this.activeFolderId = (this as any).rootFolderId ?? 'root';
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.renderExplorerShell();
		this.attachEventListeners();
		this.loadTreeSidebar();
		this.refreshCurrentFolder();
	}

	/**
	 * Override parent frame renderer to build ribbon + address bar shell
	 */
	protected override renderWidgetFrame(): void
	{
		// Dynamic class setup based on constructor
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
                <!-- Primary Action Ribbon -->
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
                        <button class="ribbon-btn ${this.isSplitView ? 'active' : ''}" id="btn-toggle-split" title="Toggle Split View">
                            <i class="bx bx-columns"></i>
                        </button>
                        <button class="ribbon-btn" id="btn-toggle-inspector" title="Toggle Details Panel">
                            <i class="bx bx-info-circle"></i>
                        </button>
                    </div>
                </header>

                <!-- Navigation & Address Bar Header -->
                <div class="explorer-address-bar-container">
                    <button class="nav-btn" id="btn-nav-back" title="Back"><i class="bx bx-arrow-back"></i></button>
                    <button class="nav-btn" id="btn-nav-up" title="Up"><i class="bx bx-up-arrow-alt"></i></button>

                    <div class="address-bar-wrapper">
                        <i class="bx bx-folder address-icon"></i>
                        <div class="breadcrumb-trail" id="breadcrumb-trail">
                            <!-- Rendered dynamically -->
                        </div>
                        <input type="text" class="address-input hidden" id="address-input" value="${this.activeFolderPath}" />
                    </div>

                    <div class="search-bar-wrapper">
                        <i class="bx bx-search search-icon"></i>
                        <input type="text" class="search-input" id="search-input" placeholder="Search files..." value="${this.searchQuery}" />
                    </div>
                </div>

                <!-- Main Content Split Workspace -->
                <div class="explorer-workspace">
                    <!-- Left Sidebar (Tree / Quick Access) -->
                    <aside class="cloud-tree-sidebar" id="cloud-tree-sidebar">
                        <div class="sidebar-header">
                            <span class="sidebar-title">Navigation</span>
                            <button class="sidebar-refresh-btn" id="refresh-tree-btn" title="Refresh">↻</button>
                        </div>
                        <div class="sidebar-tree-content" id="sidebar-tree-content">
                            <div class="loading-state">Loading navigation...</div>
                        </div>
                    </aside>

                    <!-- Central Dynamic View Stage -->
                    <main class="cloud-main-panel">
                        <header class="cloud-toolbar">
                            <div class="view-switcher-buttons">
                                <button class="view-btn ${this.activeViews.has('netflix') ? 'active' : ''}" data-view="netflix" title="Netflix Horizontal Rows">
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
                                <button class="view-btn ${this.activeViews.has('tree') ? 'active' : ''}" data-view="tree" title="Full Subtree Widget">
                                    <i class="bx bx-git-repo-forked"></i> Subtree
                                </button>
                            </div>
                        </header>

                        <section class="cloud-view-stage" id="cloud-view-stage">
                            <!-- Layout views rendered dynamically here -->
                        </section>
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

		this.treeSidebarNode = this.node.querySelector('#sidebar-tree-content') as HTMLElement;
		this.viewContainer = this.node.querySelector('#cloud-view-stage') as HTMLElement;
		this.inspectorPanel = this.node.querySelector('#cloud-inspector-panel') as HTMLElement;
		this.addressInput = this.node.querySelector('#address-input') as HTMLInputElement;
	}

	/**
	 * Wire Action Listeners for Ribbon, Breadcrumbs, and Search
	 */
	private attachEventListeners(): void
	{
		// View Toggle Switchers
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

		// Ribbon Options
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

		// Split View and Inspector Toggles
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

		// Refresh & Navigation
		this.node.querySelector('#refresh-tree-btn')?.addEventListener('click', () =>
		{
			this.loadTreeSidebar();
			this.refreshCurrentFolder();
		});

		// Address Bar Switch
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
	 * Switch or Add View Render Strategies
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

		// Highlight Active View Buttons
		this.node.querySelectorAll('.view-btn').forEach(btn =>
		{
			const target = btn as HTMLElement;
			const view = target.dataset.view as ViewMode;
			btn.classList.toggle('active', this.activeViews.has(view));
		});

		await this.renderActiveViews();
	}

	/**
	 * Orchestrate Active Views Generation
	 */
	private async renderActiveViews(): Promise<void>
	{
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
	 * Netflix Dynamic Row Layout Composer
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

			// Attach card click & Inspector selection triggers
			row.querySelectorAll('.netflix-card').forEach(card =>
			{
				card.addEventListener('click', (e) => this.handleFileSelection((card as HTMLElement).dataset.id!, e as MouseEvent));
			});

			container.appendChild(row);
		}
	}

	/**
	 * Grid Layout Renderer
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
	 * Details Table View Renderer
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
	 * Coverflow / iTunes View Renderer
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
	 * Mount Sub-Widget Tree into Pane
	 */
	private async renderSubtreeWidget(container: HTMLElement): Promise<void>
	{
		container.innerHTML = '<div class="subtree-widget-mount" id="subtree-mount-node"></div>';
		const mountNode = container.querySelector('#subtree-mount-node') as HTMLElement;

		// Clean up former widget if present
		if(this.mountedTreeWidget)
		{
			this.mountedTreeWidget.dispose();
		}

		// Dynamically initialize external tree widget (e.g. GoogleDriveWidget or FileListWidget)
		const WidgetClass = fileviewSelf.FileListWidget || fileviewSelf.GoogleDriveWidget;
		if(WidgetClass)
		{
			this.mountedTreeWidget = new WidgetClass(this.activeFolderId);
			Widget.attach(this.mountedTreeWidget, mountNode);
		} else
		{
			mountNode.innerHTML = `<div class="widget-fallback-info"><i class="bx bx-tree"></i> Native Tree View Active for Root [${this.activeFolderId}]</div>`;
		}
	}

	/**
	 * Fetch Folder Content and Update Data Context
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

		this.applyFiltersAndSort();
		this.renderBreadcrumbTrail();
		await this.renderActiveViews();
	}

	/**
	 * Navigation & Address Handler
	 */
	private async navigateToPath(path: string): Promise<void>
	{
		this.activeFolderPath = path;
		const parts = path.split('/').filter(Boolean);
		this.activeFolderName = parts[parts.length - 1] ?? 'Home';
		await this.refreshCurrentFolder();
	}

	/**
	 * Handle File Selection and Slide-Out Inspector Updating
	 */
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

	/**
	 * Render Details Inspector Panel
	 */
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

	/**
	 * Apply Filtering, Search, and Sorting Rules
	 */
	private applyFiltersAndSort(): void
	{
		this.displayedFiles = this.rawFiles.filter(file =>
		{
			const matchesHidden = this.showHiddenFiles || !file.name.startsWith('.');
			const matchesSearch = !this.searchQuery || file.name.toLowerCase().includes(this.searchQuery);
			return matchesHidden && matchesSearch;
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

	/**
	 * Group Items Dynamically
	 */
	private groupFiles(files: DriveFile[]): Record<string, DriveFile[]>
	{
		if(this.groupBy === 'none')
		{
			return { 'All Files': files };
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

	/**
	 * Breadcrumb UI Construction
	 */
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

	/**
	 * Load Navigation Tree Sidebar
	 */
	private async loadTreeSidebar(): Promise<void>
	{
		if(!this.treeSidebarNode) return;
		this.treeSidebarNode.innerHTML = `
            <ul class="tree-root-list">
                <li class="tree-item active" data-path="/Home"><i class="bx bx-home"></i> Home</li>
                <li class="tree-item" data-path="/Documents"><i class="bx bx-folder"></i> Documents</li>
                <li class="tree-item" data-path="/Pictures"><i class="bx bx-image"></i> Pictures</li>
                <li class="tree-item" data-path="/Drive"><i class="bx bx-cloud"></i> Cloud Drive</li>
            </ul>
        `;

		this.treeSidebarNode.querySelectorAll('.tree-item').forEach(item =>
		{
			item.addEventListener('click', () =>
			{
				const path = (item as HTMLElement).dataset.path!;
				this.navigateToPath(path);
			});
		});
	}

	/**
	 * Utility: Determine Boxicon class by MIME type/extension
	 */
	private getFileIconClass(file: DriveFile): string
	{
		if(file.mimeType?.includes('folder')) return 'bx-folder';
		if(file.mimeType?.includes('image')) return 'bx-image';
		if(file.mimeType?.includes('video')) return 'bx-video';
		if(file.mimeType?.includes('pdf')) return 'bx-file-pdf';
		return 'bx-file';
	}

	/**
	 * Data Fetching Fallback
	 */
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
