import { Widget } from '@lumino/widgets';
import { Signal } from '@lumino/signaling';
import { Message } from '@lumino/messaging';
import type { GithubWindow } from '../bundle/github.d';

export interface CoverflowItem
{
	id: string;
	name: string;
	imageUrl?: string;
	rawMetadata?: Record<string, unknown>;
}

const widgetSelf = self as unknown as GithubWindow & {
	[key: string]: any;
};

export class CoverflowWidget extends Widget
{
	/**
	 * Signal emitted when an item gains focus/selection in the Cover Flow carousel.
	 */
	readonly itemSelected = new Signal<this, CoverflowItem>(this);

	private _items: CoverflowItem[] = [];
	private _activeIndex: number = 0;
	private _imageResolver?: (item: CoverflowItem) => Promise<string>;
	cid: string | undefined;
	loading: Promise<string> | undefined;

	/**
	 * @param items Initial set of display items.
	 * @param imageResolver Optional async callback to resolve high-res or blob URLs dynamically.
	 * @param styleSelectionChanged Optional Signal to subscribe to style/category changes externally.
	 */
	constructor(
		items: CoverflowItem[] = [],
		imageResolver?: (item: CoverflowItem) => Promise<string>,
		styleSelectionChanged?: Signal<unknown, { styles?: unknown[]; selectedStyle?: string; } | string>
	)
	{
		super();
		this.addClass('art-coverflow-widget');
		this.node.setAttribute('tabindex', '0');
		this._items = items;
		this._imageResolver = imageResolver;

		// Subscribe to incoming style selection events if provided via constructor
		if(styleSelectionChanged)
		{
			styleSelectionChanged.connect(this.onExternalStyleChange, this);
		}

		this.loading = widgetSelf.getGitShaBrowser?.(JSON.stringify(items)).then(sha => this.cid = sha);
	}

	/**
	 * Listener callback when connected to a Style/Category selector signal.
	 */
	public onExternalStyleChange(sender: unknown, args: unknown): void
	{
		if(Array.isArray(args))
		{
			this.setItems(args as CoverflowItem[]);
		} else if(args && typeof args === 'object' && 'items' in args)
		{
			this.setItems((args as { items: CoverflowItem[]; }).items);
		}
	}

	/**
	 * Replaces current carousel items and resets carousel positioning.
	 */
	public setItems(items: CoverflowItem[]): void
	{
		this._items = items;
		this._activeIndex = 0;
		this.render();

		if(this._items.length > 0)
		{
			this.emitSelection();
			this.loadImagesLazy();
		}
	}

	/**
	 * Returns the currently focused coverflow item.
	 */
	public get activeItem(): CoverflowItem | null
	{
		return this._items[this._activeIndex] ?? null;
	}

	/**
	 * Shifts the active index by a relative step (+1 or -1).
	 */
	public rotate(direction: number): void
	{
		if(this._items.length === 0) return;

		this._activeIndex = (this._activeIndex + direction + this._items.length) % this._items.length;
		this.applyTransforms();
		this.emitSelection();
	}

	/**
	 * Programmatically jumps to a target item index.
	 */
	public selectIndex(index: number): void
	{
		if(index < 0 || index >= this._items.length || index === this._activeIndex) return;

		this._activeIndex = index;
		this.applyTransforms();
		this.emitSelection();
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.node.addEventListener('keydown', this._handleKeyDown);
		this.render();
		if(this._items.length > 0)
		{
			this.loadImagesLazy();
		}
	}

	protected override onBeforeDetach(msg: Message): void
	{
		this.node.removeEventListener('keydown', this._handleKeyDown);
		super.onBeforeDetach(msg);
	}

	private async render(): Promise<void>
	{
		await this.loading;
		if(this._items.length === 0)
		{
			this.node.innerHTML = `<div class="coverflow-empty">No items available to display</div>`;
			return;
		}

		this.node.innerHTML = `
            <div class="coverflow-stage">
                <button type="button" class="coverflow-btn prev" aria-label="Previous Item">❮</button>
                <div class="coverflow-container">
                    ${this._items
				.map(
					(item, idx) => `
                        <div class="coverflow-card" data-idx="${idx}" id="cf-card-${this.cid}-${idx}">
                            <div class="coverflow-card-label" title="${item.name}">${item.name}</div>
                        </div>
                    `
				)
				.join('')}
                </div>
                <button type="button" class="coverflow-btn next" aria-label="Next Item">❯</button>
            </div>
            <div class="coverflow-tags-bar"></div>
        `;

		this.node.querySelector('.coverflow-btn.prev')?.addEventListener('click', () => this.rotate(-1));
		this.node.querySelector('.coverflow-btn.next')?.addEventListener('click', () => this.rotate(1));

		this.node.querySelectorAll('.coverflow-card').forEach(card =>
		{
			card.addEventListener('click', e =>
			{
				const idx = parseInt((e.currentTarget as HTMLElement).dataset.idx || '0', 10);
				this.selectIndex(idx);
			});
		});

		this.applyTransforms();
	}

	private applyTransforms(): void
	{
		const cards = this.node.querySelectorAll<HTMLElement>('.coverflow-card');

		cards.forEach((card, idx) =>
		{
			card.className = 'coverflow-card';
			const offset = idx - this._activeIndex;

			if(offset === 0)
			{
				card.classList.add('active');
			} else if(offset === -1)
			{
				card.classList.add('left-1');
			} else if(offset === 1)
			{
				card.classList.add('right-1');
			} else if(offset === -2)
			{
				card.classList.add('left-2');
			} else if(offset === 2)
			{
				card.classList.add('right-2');
			} else
			{
				card.classList.add('hidden');
			}
		});

		this.updateTags();
	}

	private async loadImagesLazy(): Promise<void>
	{
		await this.loading;
		this._items.forEach(async (item, idx) =>
		{
			const cardNode = this.node.querySelector<HTMLElement>(`#cf-card-${this.cid}-${idx}`);
			if(!cardNode) return;

			let url = item.imageUrl;
			if(!url && this._imageResolver)
			{
				try
				{
					url = await this._imageResolver(item);
				} catch(err)
				{
					console.error(`Failed resolving coverflow image for ${item.name}:`, err);
				}
			}

			if(url && cardNode)
			{
				cardNode.style.backgroundImage = `url("${url}")`;
			}
		});
	}

	private updateTags(): void
	{
		const tagsContainer = this.node.querySelector('.coverflow-tags-bar');
		const activeItem = this.activeItem;

		if(!tagsContainer) return;

		if(!activeItem)
		{
			tagsContainer.innerHTML = '';
			return;
		}

		const tokens = activeItem.name
			.toLowerCase()
			.split(/[^a-z0-9]/gi)
			.filter((v, i, a) => v.length > 2 && a.indexOf(v) === i);

		tagsContainer.innerHTML = tokens.map(t => `<span class="coverflow-tag">#${t}</span>`).join('');
	}

	private emitSelection(): void
	{
		const active = this.activeItem;
		if(active)
		{
			this.itemSelected.emit(active);
		}
	}

	private _handleKeyDown = (e: KeyboardEvent): void =>
	{
		if(e.key === 'ArrowLeft')
		{
			this.rotate(-1);
			e.preventDefault();
		} else if(e.key === 'ArrowRight')
		{
			this.rotate(1);
			e.preventDefault();
		}
	};
}
