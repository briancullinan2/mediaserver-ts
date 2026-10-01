import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import type { NestedTreeNode } from '../bundle/github-tools';
import type { IFileViewOptions } from './widget';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { KnownFileViews } from '../art/widget';

const widgetSelf: LuminoLayoutWindow & KnownFileViews = self as unknown as any;

export type GridFlow = 'row-first' | 'column-first';
export type IconSize = 'small' | 'medium' | 'large' | 'huge';

export interface IExplorerGridOptions extends IFileViewOptions
{
	iconSize?: IconSize;
	flow?: GridFlow;
	onSelectionChange?: (selectedFiles: NestedTreeNode[]) => void;
}

export class ExplorerGridWidget extends Widget
{
	private _files: NestedTreeNode[] = [];
	private _selectedIds: Set<string> = new Set();
	private _flow: GridFlow = 'row-first';
	private _iconSize: IconSize = 'medium';

	// Callbacks
	private _onSelectionChange?: (selectedFiles: NestedTreeNode[]) => void;
	private _onFileActivate?: (file: NestedTreeNode) => void;

	// DOM Elements
	private _toolbarNode!: HTMLElement;
	private _gridViewport!: HTMLElement;
	private _gridContainer!: HTMLElement;
	private _marqueeBox!: HTMLElement;
	private _hoverCard!: HTMLElement;

	// Marquee Selection State
	private _isDragging: boolean = false;
	private _dragStartX: number = 0;
	private _dragStartY: number = 0;

	// ResizeObserver for Column-First Dynamic Calculations
	//private _resizeObserver: ResizeObserver;

	constructor(title?: string | null, options: IExplorerGridOptions = {})
	{
		super();
		this.addClass('explorer-grid-widget');
		this._files = options?.files || [];
		this._iconSize = options.iconSize || 'medium';
		this._flow = options.flow || 'row-first';
		this._onSelectionChange = options.onSelectionChange;
		this._onFileActivate = options.onFileSelect;

		this.renderLayout();

		//this._resizeObserver = new ResizeObserver(() =>
		//{
		//	if(this._flow === 'column-first')
		//	{
		//		this.recalculateColumnFlow();
		//	}
		//});

		this.attachEvents();
	}

	protected onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		//this._resizeObserver.observe(this._gridViewport);
	}

	protected onBeforeDetach(msg: Message): void
	{
		//this._resizeObserver.unobserve(this._gridViewport);
		super.onBeforeDetach(msg);
	}

	public setFiles(files: NestedTreeNode[]): void
	{
		this._files = files;
		this._selectedIds.clear();
		this.renderGridItems();
		this.notifySelectionChange();
	}

	public setIconSize(size: IconSize): void
	{
		this._iconSize = size;
		this._gridContainer.setAttribute('data-icon-size', size);
		if(this._flow === 'column-first')
		{
			//this.recalculateColumnFlow();
		}
	}

	public setGridFlow(flow: GridFlow): void
	{
		this._flow = flow;
		this._gridContainer.setAttribute('data-flow', flow);
		if(flow === 'column-first')
		{
			//this.recalculateColumnFlow();
		} else
		{
			this._gridContainer.style.removeProperty('grid-template-rows');
			this._gridContainer.style.removeProperty('grid-auto-flow');
			this._gridContainer.style.removeProperty('grid-auto-columns');
		}
	}

	private renderLayout(): void
	{
		this.node.replaceChildren();

		// 1. Toolbar Controls
		this._toolbarNode = document.createElement('div');
		this._toolbarNode.className = 'egw-toolbar';
		this.buildToolbar();

		// 2. Viewport & Grid Container
		this._gridViewport = document.createElement('div');
		this._gridViewport.className = 'egw-viewport';
		this._gridViewport.tabIndex = 0; // Focusable for Keyboard Navigation

		this._gridContainer = document.createElement('div');
		this._gridContainer.className = 'egw-grid-container';
		this._gridContainer.setAttribute('data-icon-size', this._iconSize);
		this._gridContainer.setAttribute('data-flow', this._flow);

		// 3. Marquee Drag Box
		this._marqueeBox = document.createElement('div');
		this._marqueeBox.className = 'egw-marquee-box';

		// 4. Floating Detail Hover Card
		this._hoverCard = document.createElement('div');
		this._hoverCard.className = 'egw-hover-card';

		this._gridViewport.append(this._gridContainer, this._marqueeBox, this._hoverCard);
		this.node.append(this._toolbarNode, this._gridViewport);

		this.renderGridItems();
	}

	private buildToolbar(): void
	{
		this._toolbarNode.innerHTML = `
      <div class="egw-toolbar-group">
        <label><i class="bx bx-slider"></i> Icon Size</label>
        <div class="egw-btn-group">
          ${(['small', 'medium', 'large', 'huge'] as IconSize[])
				.map(
					(s) => `
            <button class="egw-tool-btn ${this._iconSize === s ? 'active' : ''}" data-size="${s}">
              ${s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          `
				)
				.join('')}
        </div>
      </div>
      <div class="egw-toolbar-divider"></div>
      <div class="egw-toolbar-group">
        <label><i class="bx bx-layout"></i> Order Flow</label>
        <div class="egw-btn-group">
          <button class="egw-tool-btn ${this._flow === 'row-first' ? 'active' : ''}" data-flow="row-first" title="Standard Wrap (Horizontal Left-to-Right)">
            <i class="bx bx-right-arrow-alt"></i> Row-First
          </button>
          <button class="egw-tool-btn ${this._flow === 'column-first' ? 'active' : ''}" data-flow="column-first" title="Alphabetical Column Wrap (Top-to-Bottom then Right)">
            <i class="bx bx-down-arrow-alt"></i> Column-First
          </button>
        </div>
      </div>
    `;

		this._toolbarNode.querySelectorAll('[data-size]').forEach((btn) =>
		{
			btn.addEventListener('click', (e) =>
			{
				const size = (e.currentTarget as HTMLElement).dataset.size as IconSize;
				this.setIconSize(size);
				this.buildToolbar();
			});
		});

		this._toolbarNode.querySelectorAll('[data-flow]').forEach((btn) =>
		{
			btn.addEventListener('click', (e) =>
			{
				const flow = (e.currentTarget as HTMLElement).dataset.flow as GridFlow;
				this.setGridFlow(flow);
				this.buildToolbar();
			});
		});
	}

	private renderGridItems(): void
	{
		this._gridContainer.replaceChildren();

		if(this._files.length === 0)
		{
			this._gridContainer.innerHTML = `
        <div class="egw-empty-state">
          <i class="bx bx-folder-open"></i>
          <span>No files found in directory</span>
        </div>`;
			return;
		}

		this._files.forEach((file) =>
		{
			const item = document.createElement('div');
			item.className = `egw-grid-item ${this._selectedIds.has(file.id) ? 'selected' : ''}`;
			item.dataset.id = file.id;

			item.innerHTML = `
        <div class="egw-item-thumbnail">
          <i class="bx ${this.getFileIconClass(file)}"></i>
        </div>
        <div class="egw-item-label" title="${file.text}">${file.text}</div>
        <div class="egw-item-badge">${this.formatFileSize(file.size)}</div>
      `;

			// Hover card interactions
			item.addEventListener('mouseenter', (e) => this.showHoverCard(e, file));
			item.addEventListener('mouseleave', () => this.hideHoverCard());

			// File activation (double click / enter)
			item.addEventListener('dblclick', () =>
			{
				if(this._onFileActivate) this._onFileActivate(file);
			});

			this._gridContainer.appendChild(item);
		});

		if(this._flow === 'column-first')
		{
			//this.recalculateColumnFlow();
		}
	}

	/**
	 * Forces alphabetical vertical overflow by measuring viewport height and computing fixed CSS rows.
	 */
	private recalculateColumnFlow(): void
	{
		if(this._flow !== 'column-first' || !this.isAttached) return;

		const viewportHeight = this._gridViewport.clientHeight - 32; // minus viewport padding
		let itemHeight = 100; // base default

		if(this._iconSize === 'small') itemHeight = 70;
		if(this._iconSize === 'medium') itemHeight = 100;
		if(this._iconSize === 'large') itemHeight = 135;
		if(this._iconSize === 'huge') itemHeight = 180;

		const computedRows = Math.max(1, Math.floor(viewportHeight / (itemHeight + 12)));

		this._gridContainer.style.gridTemplateRows = `repeat(${computedRows}, ${itemHeight}px)`;
		this._gridContainer.style.gridAutoFlow = 'column';
		this._gridContainer.style.gridAutoColumns = `minmax(${itemHeight}px, max-content)`;
	}

	/* ==========================================================================
	   HOVER DETAILS CARD
	   ========================================================================== */

	private showHoverCard(e: MouseEvent, file: NestedTreeNode): void
	{
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const vpRect = this._gridViewport.getBoundingClientRect();

		this._hoverCard.innerHTML = `
      <div class="egw-card-header">
        <i class="bx ${this.getFileIconClass(file)}"></i>
        <span class="egw-card-title">${file.text}</span>
      </div>
      <div class="egw-card-body">
        <div class="egw-card-row"><span>Type:</span> <strong>${file.mimeType || 'Unknown'}</strong></div>
        <div class="egw-card-row"><span>Size:</span> <strong>${this.formatFileSize(file.size)}</strong></div>
        <div class="egw-card-row"><span>Modified:</span> <strong>${file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : '--'
			}</strong></div>
      </div>
    `;

		// Position popover safely relative to viewport
		let top = rect.top - vpRect.top;
		let left = rect.right - vpRect.left + 12;

		if(left + 240 > vpRect.width)
		{
			left = rect.left - vpRect.left - 250; // Flip to left side if overflowing right
		}

		this._hoverCard.style.top = `${Math.max(10, top)}px`;
		this._hoverCard.style.left = `${Math.max(10, left)}px`;
		this._hoverCard.classList.add('visible');
	}

	private hideHoverCard(): void
	{
		this._hoverCard.classList.remove('visible');
	}

	/* ==========================================================================
	   RUBBERBAND MARQUEE SELECTION ENGINE
	   ========================================================================== */

	private attachEvents(): void
	{
		// Mouse Down - Start Marquee or Click Select
		this._gridViewport.addEventListener('mousedown', (e) =>
		{
			if(e.button !== 0) return; // Left click only

			const targetItem = (e.target as HTMLElement).closest('.egw-grid-item') as HTMLElement;
			const vpRect = this._gridViewport.getBoundingClientRect();

			this._dragStartX = e.clientX - vpRect.left + this._gridViewport.scrollLeft;
			this._dragStartY = e.clientY - vpRect.top + this._gridViewport.scrollTop;

			if(!targetItem)
			{
				// Clicked background: Clear selections unless Shift/Ctrl pressed
				if(!e.ctrlKey && !e.shiftKey && !e.metaKey)
				{
					this._selectedIds.clear();
					this.updateVisualSelections();
					this.notifySelectionChange();
				}
			} else
			{
				const id = targetItem.dataset.id!;
				if(e.ctrlKey || e.metaKey)
				{
					if(this._selectedIds.has(id)) this._selectedIds.delete(id);
					else this._selectedIds.add(id);
				} else if(!this._selectedIds.has(id))
				{
					this._selectedIds.clear();
					this._selectedIds.add(id);
				}
				this.updateVisualSelections();
				this.notifySelectionChange();
			}

			this._isDragging = true;
			document.addEventListener('mousemove', this.onMouseMove);
			document.addEventListener('mouseup', this.onMouseUp);
		});

		// Keyboard Shortcuts
		this._gridViewport.addEventListener('keydown', (e) =>
		{
			if((e.ctrlKey || e.metaKey) && e.key === 'a')
			{
				e.preventDefault();
				this._selectedIds = new Set(this._files.map((f) => f.id));
				this.updateVisualSelections();
				this.notifySelectionChange();
			}
		});
	}

	private onMouseMove = (e: MouseEvent): void =>
	{
		if(!this._isDragging) return;

		const vpRect = this._gridViewport.getBoundingClientRect();
		const currentX = e.clientX - vpRect.left + this._gridViewport.scrollLeft;
		const currentY = e.clientY - vpRect.top + this._gridViewport.scrollTop;

		const rectLeft = Math.min(this._dragStartX, currentX);
		const rectTop = Math.min(this._dragStartY, currentY);
		const rectWidth = Math.abs(currentX - this._dragStartX);
		const rectHeight = Math.abs(currentY - this._dragStartY);

		// Show marquee if drag threshold passed
		if(rectWidth > 4 || rectHeight > 4)
		{
			this._marqueeBox.style.display = 'block';
			this._marqueeBox.style.left = `${rectLeft}px`;
			this._marqueeBox.style.top = `${rectTop}px`;
			this._marqueeBox.style.width = `${rectWidth}px`;
			this._marqueeBox.style.height = `${rectHeight}px`;

			this.evaluateMarqueeIntersection(rectLeft, rectTop, rectWidth, rectHeight, e.ctrlKey || e.metaKey);
		}
	};

	private onMouseUp = (): void =>
	{
		this._isDragging = false;
		this._marqueeBox.style.display = 'none';
		document.removeEventListener('mousemove', this.onMouseMove);
		document.removeEventListener('mouseup', this.onMouseUp);
	};

	private evaluateMarqueeIntersection(
		mLeft: number,
		mTop: number,
		mWidth: number,
		mHeight: number,
		isAdditive: boolean
	): void
	{
		const mRight = mLeft + mWidth;
		const mBottom = mTop + mHeight;

		const items = this._gridContainer.querySelectorAll('.egw-grid-item');

		items.forEach((itemNode) =>
		{
			const el = itemNode as HTMLElement;
			const id = el.dataset.id!;

			const iLeft = el.offsetLeft;
			const iTop = el.offsetTop;
			const iRight = iLeft + el.offsetWidth;
			const iBottom = iTop + el.offsetHeight;

			// Axis-Aligned Bounding Box Intersection Test
			const intersects = iLeft < mRight && iRight > mLeft && iTop < mBottom && iBottom > mTop;

			if(intersects)
			{
				this._selectedIds.add(id);
			} else if(!isAdditive)
			{
				this._selectedIds.delete(id);
			}
		});

		this.updateVisualSelections();
		this.notifySelectionChange();
	}

	private updateVisualSelections(): void
	{
		const items = this._gridContainer.querySelectorAll('.egw-grid-item');
		items.forEach((itemNode) =>
		{
			const el = itemNode as HTMLElement;
			const id = el.dataset.id!;
			el.classList.toggle('selected', this._selectedIds.has(id));
		});
	}

	private notifySelectionChange(): void
	{
		if(!this._onSelectionChange) return;
		const selectedFiles = this._files.filter((f) => this._selectedIds.has(f.id));
		this._onSelectionChange(selectedFiles);
	}

	/* ==========================================================================
	   UTILITIES
	   ========================================================================== */

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
}

widgetSelf.ExplorerGridWidget = ExplorerGridWidget;
