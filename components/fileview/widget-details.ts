import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import { NestedTreeNode } from '../bundle/github-tools';


export const SORT_KEY_MAP: Record<SortColumn, keyof NestedTreeNode> = {
	text: 'text',
	mimeType: 'mimeType',
	size: 'size',
	modifiedTime: 'modifiedTime',
};

export type SortColumn = 'text' | 'mimeType' | 'size' | 'modifiedTime';
export type SortDirection = 'asc' | 'desc';
export type GroupByOption = 'alphabetical' | 'date' | 'type' | 'size';
export type DisplayMode = 'details' | 'carousel';

export interface IDetailsOptions
{
	title?: string;
	onFileSelect?: (file: NestedTreeNode) => void;
}

export class DetailsViewWidget extends Widget
{
	private _files: NestedTreeNode[] = [];
	private _filteredFiles: NestedTreeNode[] = [];
	private _onFileSelect?: (file: NestedTreeNode) => void;

	// View State
	private _searchQuery: string = '';
	private _sortBy: SortColumn = 'text';
	private _sortDir: SortDirection = 'asc';
	private _groupBy: GroupByOption = 'alphabetical';
	private _displayMode: DisplayMode = 'details';
	private _controlsOpen: boolean = false;
	private _collapsedGroups: Set<string> = new Set();
	private _activeScrubberKey: string | null = null;

	// DOM Node References
	private _searchInput!: HTMLInputElement;
	private _popoverNode!: HTMLElement;
	private _scrubberNode!: HTMLElement;
	private _groupsContainer!: HTMLElement;
	private _resultCountNode!: HTMLElement;

	constructor(options: IDetailsOptions = {}, files?: NestedTreeNode[])
	{
		super();
		this.addClass('netflix-details-widget');
		this._files = files || [];
		this._onFileSelect = options.onFileSelect;

		this.renderShell();
		this.applyFilterAndSort();
	}

	public setFiles(files: NestedTreeNode[]): void
	{
		this._files = files;
		this.applyFilterAndSort();
	}

	private renderShell(): void
	{
		this.node.replaceChildren();

		// 1. Top Bar: Search, Stats, Popover Toggle & Layout Switcher
		const topBar = document.createElement('div');
		topBar.className = 'ndw-top-bar';

		const searchWrapper = document.createElement('div');
		searchWrapper.className = 'ndw-search-wrapper';
		searchWrapper.innerHTML = `<i class="bx bx-search search-icon"></i>`;

		this._searchInput = document.createElement('input');
		this._searchInput.type = 'text';
		this._searchInput.className = 'ndw-search-input';
		this._searchInput.placeholder = 'Filter cloud files...';
		this._searchInput.addEventListener('input', () =>
		{
			this._searchQuery = this._searchInput.value.trim().toLowerCase();
			this.applyFilterAndSort();
		});
		searchWrapper.appendChild(this._searchInput);

		this._resultCountNode = document.createElement('span');
		this._resultCountNode.className = 'ndw-result-count';

		const controlsWrapper = document.createElement('div');
		controlsWrapper.className = 'ndw-controls-wrapper';

		const gearBtn = document.createElement('button');
		gearBtn.className = 'ndw-btn ndw-gear-btn';
		gearBtn.innerHTML = `<i class="bx bx-slider-alt"></i> Controls`;
		gearBtn.addEventListener('click', (e) =>
		{
			e.stopPropagation();
			this._controlsOpen = !this._controlsOpen;
			this._popoverNode.classList.toggle('visible', this._controlsOpen);
		});

		// Popover Menu for Sorting and Grouping
		this._popoverNode = document.createElement('div');
		this._popoverNode.className = 'ndw-popover-menu';
		this.renderPopoverContent();

		// Close popover when clicking outside
		document.addEventListener('click', (e) =>
		{
			if(this._controlsOpen && !this._popoverNode.contains(e.target as Node))
			{
				this._controlsOpen = false;
				this._popoverNode.classList.remove('visible');
			}
		});

		const modeToggleBtn = document.createElement('button');
		modeToggleBtn.className = 'ndw-btn ndw-mode-btn';
		modeToggleBtn.innerHTML = `<i class="bx ${this._displayMode === 'details' ? 'bx-carousel' : 'bx-list-ul'}"></i> Switch View`;
		modeToggleBtn.title = 'Toggle between Table Details and Netflix Row Carousels';
		modeToggleBtn.addEventListener('click', () =>
		{
			this._displayMode = this._displayMode === 'details' ? 'carousel' : 'details';
			modeToggleBtn.innerHTML = `<i class="bx ${this._displayMode === 'details' ? 'bx-carousel' : 'bx-list-ul'}"></i> ${this._displayMode === 'details' ? 'Row View' : 'Table View'}`;
			this.renderGroupSections();
		});

		controlsWrapper.append(gearBtn, this._popoverNode, modeToggleBtn);
		topBar.append(searchWrapper, this._resultCountNode, controlsWrapper);

		// 2. Season-Inspired Scrubber Toolbar
		this._scrubberNode = document.createElement('div');
		this._scrubberNode.className = 'ndw-scrubber-bar';

		// 3. Scrollable Groups Stage
		this._groupsContainer = document.createElement('div');
		this._groupsContainer.className = 'ndw-groups-container';

		this.node.append(topBar, this._scrubberNode, this._groupsContainer);
	}

	private renderPopoverContent(): void
	{
		this._popoverNode.innerHTML = `
      <div class="popover-section">
        <label><i class="bx bx-layer"></i> Group By</label>
        <div class="popover-btn-grid">
          ${(['alphabetical', 'date', 'type', 'size'] as GroupByOption[])
				.map(
					(g) => `
            <button class="popover-chip ${this._groupBy === g ? 'active' : ''}" data-group="${g}">
              ${g.toUpperCase()}
            </button>
          `
				)
				.join('')}
        </div>
      </div>
      <div class="popover-divider"></div>
      <div class="popover-section">
        <label><i class="bx bx-sort"></i> Sort Column</label>
        <div class="popover-btn-grid">
          ${(['name', 'type', 'size', 'modifiedTime'] as SortColumn[])
				.map(
					(s) => `
            <button class="popover-chip ${this._sortBy === s ? 'active' : ''}" data-sort="${s}">
              ${s.replace('modifiedTime', 'Date').toUpperCase()}
            </button>
          `
				)
				.join('')}
        </div>
      </div>
      <div class="popover-section">
        <label><i class="bx bx-transfer-alt"></i> Order</label>
        <div class="popover-btn-grid">
          <button class="popover-chip ${this._sortDir === 'asc' ? 'active' : ''}" data-dir="asc">ASC</button>
          <button class="popover-chip ${this._sortDir === 'desc' ? 'active' : ''}" data-dir="desc">DESC</button>
        </div>
      </div>
    `;

		this._popoverNode.querySelectorAll('[data-group]').forEach((btn) =>
		{
			btn.addEventListener('click', (e) =>
			{
				this._groupBy = (e.currentTarget as HTMLElement).dataset.group as GroupByOption;
				this.renderPopoverContent();
				this.applyFilterAndSort();
			});
		});

		this._popoverNode.querySelectorAll('[data-sort]').forEach((btn) =>
		{
			btn.addEventListener('click', (e) =>
			{
				this._sortBy = (e.currentTarget as HTMLElement).dataset.sort as SortColumn;
				this.renderPopoverContent();
				this.applyFilterAndSort();
			});
		});

		this._popoverNode.querySelectorAll('[data-dir]').forEach((btn) =>
		{
			btn.addEventListener('click', (e) =>
			{
				this._sortDir = (e.currentTarget as HTMLElement).dataset.dir as SortDirection;
				this.renderPopoverContent();
				this.applyFilterAndSort();
			});
		});
	}

	private applyFilterAndSort(): void
	{
		// 1. Filter
		this._filteredFiles = this._files.filter((f) =>
		{
			if(!this._searchQuery) return true;
			return (
				f.text.toLowerCase().includes(this._searchQuery) ||
				(f.mimeType && f.mimeType.toLowerCase().includes(this._searchQuery))
			);
		});

		// 2. Sort
		this._filteredFiles.sort((a, b) =>
		{
			const targetKey = SORT_KEY_MAP[this._sortBy];
			let valA: any = a[targetKey] ?? '';
			let valB: any = b[targetKey] ?? '';

			if(this._sortBy === 'size')
			{
				valA = Number(valA || 0);
				valB = Number(valB || 0);
			} else if(this._sortBy === 'modifiedTime')
			{
				valA = new Date(valA || 0).getTime();
				valB = new Date(valB || 0).getTime();
			} else
			{
				valA = String(valA).toLowerCase();
				valB = String(valB).toLowerCase();
			}

			if(valA < valB) return this._sortDir === 'asc' ? -1 : 1;
			if(valA > valB) return this._sortDir === 'asc' ? 1 : -1;
			return 0;
		});

		this._resultCountNode.textContent = `${this._filteredFiles.length} / ${this._files.length} items`;

		this.renderScrubberBar();
		this.renderGroupSections();
	}

	private groupFiles(): Map<string, NestedTreeNode[]>
	{
		const map = new Map<string, NestedTreeNode[]>();

		this._filteredFiles.forEach((file) =>
		{
			let key = '#';
			if(this._groupBy === 'alphabetical')
			{
				const firstChar = file.text.trim().charAt(0).toUpperCase();
				if(/[0-9]/.test(firstChar)) key = '0-9';
				else if(/[A-Z]/.test(firstChar)) key = firstChar;
				else key = 'WILD';
			} else if(this._groupBy === 'date')
			{
				key = file.modifiedTime ? new Date(file.modifiedTime).getFullYear().toString() : 'UNKNOWN YEAR';
			} else if(this._groupBy === 'type')
			{
				key = file.mimeType ? file.mimeType.split('/')[0].toUpperCase() : 'OTHER';
			} else if(this._groupBy === 'size')
			{
				const size = Number(file.size || 0);
				if(size === 0) key = 'EMPTY';
				else if(size < 1024 * 1024) key = '< 1 MB';
				else if(size < 100 * 1024 * 1024) key = '1 - 100 MB';
				else key = '> 100 MB';
			}

			if(!map.has(key)) map.set(key, []);
			map.get(key)!.push(file);
		});

		return map;
	}

	private renderScrubberBar(): void
	{
		this._scrubberNode.replaceChildren();
		const grouped = this.groupFiles();

		let keys: string[] = [];
		if(this._groupBy === 'alphabetical')
		{
			keys = ['0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), 'WILD'];
		} else
		{
			keys = Array.from(grouped.keys());
		}

		keys.forEach((key) =>
		{
			const chip = document.createElement('button');
			const hasItems = grouped.has(key);
			chip.className = `ndw-scrubber-chip ${hasItems ? 'has-data' : 'empty'} ${this._activeScrubberKey === key ? 'active' : ''
				}`;
			chip.textContent = key;

			if(hasItems)
			{
				chip.addEventListener('click', () =>
				{
					this._activeScrubberKey = key;
					const targetGroup = this._groupsContainer.querySelector(`[data-group-key="${key}"]`);
					if(targetGroup)
					{
						targetGroup.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}
				});
			}

			this._scrubberNode.appendChild(chip);
		});
	}

	private renderGroupSections(): void
	{
		this._groupsContainer.replaceChildren();
		const grouped = this.groupFiles();

		if(grouped.size === 0)
		{
			this._groupsContainer.innerHTML = `
        <div class="ndw-empty-state">
          <i class="bx bx-ghost"></i>
          <p>No cloud items found matching query.</p>
        </div>`;
			return;
		}

		grouped.forEach((files, groupTitle) =>
		{
			const totalSize = files.reduce((acc, f) => acc + Number(f.size || 0), 0);
			const isCollapsed = this._collapsedGroups.has(groupTitle);

			const sectionNode = document.createElement('div');
			sectionNode.className = `ndw-group-section ${isCollapsed ? 'collapsed' : ''}`;
			sectionNode.dataset.groupKey = groupTitle;

			// Lumino Accordion Header (Sticky)
			const headerNode = document.createElement('div');
			headerNode.className = 'ndw-sticky-header';
			headerNode.innerHTML = `
        <div class="ndw-header-left">
          <i class="bx ${isCollapsed ? 'bx-chevron-right' : 'bx-chevron-down'} accordion-chevron"></i>
          <span class="ndw-group-title">${groupTitle}</span>
          <span class="ndw-group-badge">${files.length} ITEMS</span>
        </div>
        <div class="ndw-header-right">
          <span class="ndw-group-size"><i class="bx bx-data"></i> ${this.formatFileSize(totalSize)}</span>
        </div>
      `;

			headerNode.addEventListener('click', () =>
			{
				if(this._collapsedGroups.has(groupTitle))
				{
					this._collapsedGroups.delete(groupTitle);
				} else
				{
					this._collapsedGroups.add(groupTitle);
				}
				this.renderGroupSections();
			});

			sectionNode.appendChild(headerNode);

			// Accordion Content Body
			if(!isCollapsed)
			{
				const bodyNode = document.createElement('div');
				bodyNode.className = 'ndw-group-body';

				if(this._displayMode === 'details')
				{
					bodyNode.appendChild(this.buildTableDetails(files));
				} else
				{
					bodyNode.appendChild(this.buildNetflixCarousel(files));
				}

				sectionNode.appendChild(bodyNode);
			}

			this._groupsContainer.appendChild(sectionNode);
		});
	}

	private buildTableDetails(files: NestedTreeNode[]): HTMLElement
	{
		const table = document.createElement('table');
		table.className = 'ndw-details-table';

		table.innerHTML = `
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Size</th>
          <th>Date Modified</th>
        </tr>
      </thead>
      <tbody>
        ${files
				.map(
					(f) => `
          <tr data-id="${f.id}" class="ndw-table-row">
            <td class="cell-name">
              <i class="bx ${this.getFileIconClass(f)} file-icon"></i>
              <div class="name-meta-stack">
                <span class="file-title">${f.text}</span>
                <span class="file-sub-size">${this.formatFileSize(f.size)}</span>
              </div>
            </td>
            <td><span class="mime-tag">${f.mimeType || 'File'}</span></td>
            <td>${this.formatFileSize(f.size)}</td>
            <td>${f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : '--'}</td>
          </tr>
        `
				)
				.join('')}
      </tbody>
    `;

		table.querySelectorAll('.ndw-table-row').forEach((row) =>
		{
			row.addEventListener('click', (e) =>
			{
				const id = (e.currentTarget as HTMLElement).dataset.id;
				const target = this._files.find((f) => f.id === id);
				if(target && this._onFileSelect) this._onFileSelect(target);
			});
		});

		return table;
	}

	private buildNetflixCarousel(files: NestedTreeNode[]): HTMLElement
	{
		const wrapper = document.createElement('div');
		wrapper.className = 'ndw-carousel-wrapper';

		const track = document.createElement('div');
		track.className = 'ndw-carousel-track';

		files.forEach((file) =>
		{
			const card = document.createElement('div');
			card.className = 'ndw-carousel-card';

			const hue = Math.abs(this.hashCode(file.text)) % 360;
			card.style.background = `linear-gradient(135deg, hsl(${hue}, 60%, 20%), hsl(${(hue + 40) % 360}, 70%, 10%))`;

			card.innerHTML = `
        <div class="card-media-overlay"></div>
        <div class="card-content">
          <i class="bx ${this.getFileIconClass(file)} card-icon"></i>
          <div class="card-title" title="${file.text}">${file.text}</div>
          <div class="card-sub">${this.formatFileSize(file.size)}</div>
        </div>
      `;

			card.addEventListener('click', () =>
			{
				if(this._onFileSelect) this._onFileSelect(file);
			});

			track.appendChild(card);
		});

		wrapper.appendChild(track);
		return wrapper;
	}

	private getFileIconClass(file: NestedTreeNode): string
	{
		const mime = file.mimeType || '';
		if(mime.includes('image')) return 'bx-image file-img';
		if(mime.includes('video')) return 'bx-film file-vid';
		if(mime.includes('audio')) return 'bx-music file-aud';
		if(mime.includes('pdf')) return 'bxs-file-pdf file-pdf';
		if(mime.includes('zip') || mime.includes('compressed')) return 'bx-archive file-zip';
		return 'bx-file file-gen';
	}

	private formatFileSize(bytes?: number | null): string
	{
		if(!bytes || isNaN(bytes)) return '--';
		if(bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	private hashCode(str: string): number
	{
		let hash = 0;
		for(let i = 0; i < str.length; i++)
		{
			hash = (hash << 5) - hash + str.charCodeAt(i);
			hash |= 0;
		}
		return hash;
	}
}
