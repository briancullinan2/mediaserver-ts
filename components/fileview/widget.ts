import { Message } from '@lumino/messaging';
import { ArtWidget, type GoogleDriveClipartConfig } from './art-widget'; // Adjust import path
import type { DriveFile } from '../filelist/widget.d';

export type ViewMode = 'netflix' | 'itunes' | 'grid' | 'details' | 'tree';

/**
 * Common Data Provider interface to decouple fetching logic.
 * Implement this interface for Google Drive, Http Index, or local API providers.
 */
export interface ICloudDataProvider
{
	fetchFolders(parentId: string): Promise<Array<{ id: string; name: string; }>>;
	fetchFiles(folderId: string): Promise<DriveFile[]>;
}

export class CloudDriveExplorerWidget extends ArtWidget
{
	private currentView: ViewMode = 'netflix';
	private activeFolderId: string = '';
	private activeFolderName: string = 'Home';
	private dataProvider?: ICloudDataProvider;

	// View state element references
	private viewContainer!: HTMLElement;
	private treeSidebarNode!: HTMLElement;

	constructor(title?: string, config?: GoogleDriveClipartConfig, provider?: ICloudDataProvider)
	{
		super(title ?? 'Cloud Drive Explorer', config);
		this.addClass('cloud-drive-explorer-widget');
		this.dataProvider = provider;
		// Set initial active root folder
		this.activeFolderId = (this as any).rootFolderId;
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.renderExplorerShell();
		this.loadTreeSidebar();
		this.switchView(this.currentView);
	}

	/**
	 * Renders main layout structure: Left sidebar (Tree List) + Right main pane (Toolbar + Dynamic View)
	 */
	private renderExplorerShell(): void
	{
		this.node.innerHTML = `
            <div class="cloud-explorer-container">
                <aside class="cloud-tree-sidebar" id="cloud-tree-sidebar">
                    <div class="sidebar-header">
                        <span class="sidebar-title">Folders</span>
                        <button class="sidebar-refresh-btn" id="refresh-tree-btn" title="Refresh">↻</button>
                    </div>
                    <div class="sidebar-tree-content" id="sidebar-tree-content">
                        <div class="loading-state">Loading tree...</div>
                    </div>
                </aside>

                <main class="cloud-main-panel">
                    <header class="cloud-toolbar">
                        <div class="breadcrumb-trail" id="breadcrumb-trail">
                            <span class="breadcrumb-item" data-id="${this.activeFolderId}">${this.activeFolderName}</span>
                        </div>
                        <div class="view-switcher-buttons">
                            <button class="view-btn ${this.currentView === 'netflix' ? 'active' : ''}" data-view="netflix" title="Netflix Horizontal Rows">
                                <i class="bx bx-film"></i>
                            </button>
                            <button class="view-btn ${this.currentView === 'itunes' ? 'active' : ''}" data-view="itunes" title="iTunes Coverflow">
                                <i class="bx bx-carousel"></i>
                            </button>
                            <button class="view-btn ${this.currentView === 'grid' ? 'active' : ''}" data-view="grid" title="Icon Grid">
                                <i class="bx bx-grid-alt"></i>
                            </button>
                            <button class="view-btn ${this.currentView === 'details' ? 'active' : ''}" data-view="details" title="Details List">
                                <i class="bx bx-list-ul"></i>
                            </button>
                            <button class="view-btn ${this.currentView === 'tree' ? 'active' : ''}" data-view="tree" title="Full Tree">
                                <i class="bx bx-git-repo-forked"></i>
                            </button>
                        </div>
                    </header>

                    <section class="cloud-view-stage" id="cloud-view-stage">
                        <div class="loading-state">Loading files...</div>
                    </section>
                </main>
            </div>
        `;

		this.treeSidebarNode = this.node.querySelector('#sidebar-tree-content') as HTMLElement;
		this.viewContainer = this.node.querySelector('#cloud-view-stage') as HTMLElement;

		// Toolbar Events
		this.node.querySelectorAll('.view-btn').forEach(btn =>
		{
			btn.addEventListener('click', e =>
			{
				const target = e.currentTarget as HTMLElement;
				const view = target.dataset.view as ViewMode;
				this.switchView(view);
			});
		});

		this.node.querySelector('#refresh-tree-btn')?.addEventListener('click', () => this.loadTreeSidebar());
	}

	/**
	 * Swapping View Rendering Strategies without duplicate API calls
	 */
	public async switchView(mode: ViewMode): Promise<void>
	{
		this.currentView = mode;

		// Update active UI toolbar button state
		this.node.querySelectorAll('.view-btn').forEach(btn =>
		{
			btn.classList.toggle('active', (btn as HTMLElement).dataset.view === mode);
		});

		const files = await this.fetchSharedData(this.activeFolderId);

		switch(mode)
		{
			case 'netflix':
				this.renderNetflixView(files);
				break;
			case 'itunes':
				// Delegate to inherited Coverflow engine
				this.renderWidgetFrame();
				break;
			case 'grid':
				this.renderGridView(files);
				break;
			case 'details':
				this.renderDetailsView(files);
				break;
			case 'tree':
				this.renderFullTreeView(files);
				break;
		}
	}

	/**
	 * Common shared data fetch logic using ICloudDataProvider or fallback
	 */
	private async fetchSharedData(folderId: string): Promise<DriveFile[]>
	{
		if(this.dataProvider)
		{
			return await this.dataProvider.fetchFiles(folderId);
		}

		// Fallback: Use inherited lazy loader or raw GoogleDriveWidget reference
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

	/**
	 * View 1: Netflix-style horizontal row layout grouped by category/tags
	 */
	private async renderNetflixView(files: DriveFile[]): Promise<void>
	{
		const categoryMap = (this as any).categoryMap || {};
		const categories = Object.keys(categoryMap);

		if(categories.length === 0)
		{
			this.viewContainer.innerHTML = `<div class="empty-state">No folders found for Netflix layout.</div>`;
			return;
		}

		this.viewContainer.innerHTML = `<div class="netflix-rows-container"></div>`;
		const rowHost = this.viewContainer.querySelector('.netflix-rows-container')!;

		for(const cat of categories)
		{
			const styles = Object.keys(categoryMap[cat]);
			const rowSection = document.createElement('div');
			rowSection.className = 'netflix-row';
			rowSection.innerHTML = `
                <h3 class="netflix-row-title">${cat}</h3>
                <div class="netflix-carousel" id="row-cat-${cat.replace(/\s+/g, '-')}">
                    <div class="loading-state">Loading row...</div>
                </div>
            `;
			rowHost.appendChild(rowSection);

			// Fetch row items lazily
			const firstStyle = styles[0];
			const meta = categoryMap[cat][firstStyle];
			const rowFiles = meta ? await (this as any).loadFolderImagesLazy(meta) : [];
			const carouselNode = rowSection.querySelector('.netflix-carousel')!;

			if(rowFiles.length === 0)
			{
				carouselNode.innerHTML = `<div class="empty-state">Empty</div>`;
				continue;
			}

			carouselNode.innerHTML = rowFiles
				.map(
					f => `
                <div class="netflix-card" data-file-id="${f.id}">
                    <div class="netflix-card-media" id="card-media-${f.id}"></div>
                    <div class="netflix-card-title">${f.name}</div>
                </div>
            `
				)
				.join('');

			// Asynchronously resolve image binaries via inherited Blob cache method
			rowFiles.forEach(async f =>
			{
				const imgUrl = await (this as any).getDriveImageBlobUrl(f);
				const mediaNode = carouselNode.querySelector(`#card-media-${f.id}`) as HTMLElement;
				if(mediaNode)
				{
					mediaNode.style.backgroundImage = `url("${imgUrl}")`;
				}
			});
		}
	}

	/**
	 * View 2: Icon Grid View
	 */
	private renderGridView(files: DriveFile[]): void
	{
		if(files.length === 0)
		{
			this.viewContainer.innerHTML = `<div class="empty-state">No files to display.</div>`;
			return;
		}

		this.viewContainer.innerHTML = `
            <div class="explorer-grid">
                ${files
				.map(
					f => `
                    <div class="grid-item" data-id="${f.id}">
                        <div class="grid-item-icon"><i class="bx bx-file"></i></div>
                        <div class="grid-item-label" title="${f.name}">${f.name}</div>
                    </div>
                `
				)
				.join('')}
            </div>
        `;
	}

	/**
	 * View 3: Details List View (Windows Explorer style)
	 */
	private renderDetailsView(files: DriveFile[]): void
	{
		this.viewContainer.innerHTML = `
            <table class="explorer-details-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>ID</th>
                    </tr>
                </thead>
                <tbody>
                    ${files
				.map(
					f => `
                        <tr data-id="${f.id}">
                            <td><i class="bx bx-file"></i> ${f.name}</td>
                            <td>${f.mimeType || 'File'}</td>
                            <td class="code-font">${f.id}</td>
                        </tr>
                    `
				)
				.join('')}
                </tbody>
            </table>
        `;
	}

	/**
	 * View 4: Embedded Tree View
	 */
	private renderFullTreeView(files: DriveFile[]): void
	{
		this.viewContainer.innerHTML = `
            <div class="full-tree-view">
                <ul class="tree-node-root">
                    <li>
                        <span class="tree-label"><i class="bx bx-folder-open"></i> ${this.activeFolderName}</span>
                        <ul>
                            ${files.map(f => `<li><i class="bx bx-file"></i> ${f.name}</li>`).join('')}
                        </ul>
                    </li>
                </ul>
            </div>
        `;
	}

	/**
	 * Populates the left-hand Tree sidebar list
	 */
	private async loadTreeSidebar(): Promise<void>
	{
		const rootId = (this as any).rootFolderId;

		let folders: Array<{ id: string; name: string; }> = [];
		if(this.dataProvider)
		{
			folders = await this.dataProvider.fetchFolders(rootId);
		} else
		{
			const categoryMap = (this as any).categoryMap || {};
			folders = Object.keys(categoryMap).map(cat => ({ id: cat, name: cat }));
		}

		if(folders.length === 0)
		{
			this.treeSidebarNode.innerHTML = `<div class="empty-state">No folders</div>`;
			return;
		}

		this.treeSidebarNode.innerHTML = `
            <ul class="sidebar-tree-list">
                ${folders
				.map(
					f => `
                    <li class="tree-item" data-folder-id="${f.id}" data-folder-name="${f.name}">
                        <i class="bx bx-folder"></i> <span>${f.name}</span>
                    </li>
                `
				)
				.join('')}
            </ul>
        `;

		this.treeSidebarNode.querySelectorAll('.tree-item').forEach(item =>
		{
			item.addEventListener('click', e =>
			{
				const target = e.currentTarget as HTMLElement;
				this.activeFolderId = target.dataset.folderId || '';
				this.activeFolderName = target.dataset.folderName || 'Folder';
				(this as any).activeCategory = this.activeFolderId;

				this.switchView(this.currentView);
			});
		});
	}
}
