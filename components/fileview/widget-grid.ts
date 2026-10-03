import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import type { NestedTreeNode } from '../bundle/github-tools';
import type { IFileViewOptions } from './widget';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { KnownFileViews } from '../art/widget';
import { WidgetSearchBar } from '../art/widget-search';

const widgetSelf: LuminoLayoutWindow & KnownFileViews = self as unknown as any;

export type GridFlow = 'row-first' | 'column-first';
export type IconSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge';

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
	private _displayMode: GridFlow = 'row-first';
	private _iconSize: IconSize = 'medium';

	// Callbacks
	private _onSelectionChange?: (selectedFiles: NestedTreeNode[]) => void;
	private _onFileActivate?: (file: NestedTreeNode) => void;

	// DOM Elements
	//private _toolbarNode!: HTMLElement;
	private _gridViewport!: HTMLElement;
	private _gridContainer!: HTMLElement;
	private _marqueeBox!: HTMLElement;
	private _hoverCard!: HTMLElement;

	// Marquee Selection State
	private _isDragging: boolean = false;
	private _dragStartX: number = 0;
	private _dragStartY: number = 0;

	public _toggleBtn?: HTMLDivElement;

	constructor(title?: string | null, options: IExplorerGridOptions = {})
	{
		super();
		this.addClass('explorer-grid-widget');
		this._files = options?.files || [];
		this._iconSize = options.iconSize || 'medium';
		this._displayMode = options.flow || 'row-first';
		this._onSelectionChange = options.onSelectionChange;
		this._onFileActivate = options.onFileSelect;

		this.renderLayout();
		this.attachEvents();
	}

	protected onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		WidgetSearchBar.attachToggleIcon(this, this.renderToggleBtn, this.clickToggleBtn);
	}

	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		WidgetSearchBar.attachToggleIcon(this, this.renderToggleBtn, this.clickToggleBtn);
	}

	protected renderToggleBtn(toggle: HTMLElement)
	{
		toggle.innerHTML = `<i class="bx ${this._displayMode === 'row-first' ? 'bx-gallery-horizontal' : 'bx-gallery-vertical'}"></i>`;
		toggle.title = this._displayMode === 'row-first' ? 'Column View' : 'Row View';
	}


	protected clickToggleBtn()
	{
		this._displayMode = this._displayMode === 'row-first' ? 'column-first' : 'row-first';
		this.setGridFlow(this._displayMode);
		this.fit();
		this.update();
	}

	protected onBeforeDetach(msg: Message): void
	{
		if(this._toggleBtn)
		{
			this._toggleBtn?.remove();
			this._toggleBtn = undefined;
		}
		if(this.parent)
		{
			this.parent.removeClass('column-first');
			this.parent.removeClass('row-first');
		}
		if(this.node.parentElement)
		{
			const parent = this.node.parentElement.closest('.lm-Widget');
			if(parent)
			{
				parent.classList.remove('column-first');
				parent.classList.remove('row-first');
			}
		}
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
		//this._gridContainer.setAttribute('data-icon-size', size);
	}

	// TODO: set class on parent widget
	public setGridFlow(flow: GridFlow): void
	{
		this._displayMode = flow;
		//this._gridContainer.setAttribute('data-flow', flow);
		if(this.parent)
		{
			this.parent.removeClass(flow === 'column-first' ? 'row-first' : 'column-first');
			this.parent.addClass(flow === 'column-first' ? 'column-first' : 'row-first');
		}
		if(this.node.parentElement)
		{
			const parent = this.node.parentElement.closest('.lm-Widget');
			if(parent)
			{
				parent.classList.remove(flow === 'column-first' ? 'row-first' : 'column-first');
				parent.classList.add(flow === 'column-first' ? 'column-first' : 'row-first');
			}
		}
	}

	private renderLayout(): void
	{
		this.node.replaceChildren();

		// 2. Viewport & Grid Container
		this._gridViewport = document.createElement('div');
		this._gridViewport.className = 'egw-viewport';
		this._gridViewport.tabIndex = 0; // Focusable for Keyboard Navigation

		this._gridContainer = document.createElement('div');
		this._gridContainer.className = 'egw-grid-container';
		//this._gridContainer.setAttribute('data-icon-size', this._iconSize);
		//this._gridContainer.setAttribute('data-flow', this._displayMode);

		// 3. Marquee Drag Box
		this._marqueeBox = document.createElement('div');
		this._marqueeBox.className = 'egw-marquee-box';

		// 4. Floating Detail Hover Card
		this._hoverCard = document.createElement('div');
		this._hoverCard.className = 'egw-hover-card';

		this._gridViewport.append(this._gridContainer, this._marqueeBox, this._hoverCard);
		this.node.append(this._gridViewport);

		this.renderGridItems();
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

		if(this._displayMode === 'column-first')
		{
			//this.recalculateColumnFlow();
		}
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
