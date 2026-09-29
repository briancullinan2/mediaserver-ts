import { Widget } from '@lumino/widgets';
import { ISignal, Signal } from '@lumino/signaling';
import { Message } from '@lumino/messaging';
import type { NestedTreeNode } from '../bundle/github-tools';

export interface IPillSelectedArgs
{
	category: string;
	index: number;
}

interface PillFolderMeta
{
	id: string;
	rawName: string;
	category: string;
	style: string;
	isHttpSource?: boolean;
}

export interface IPillViewOptions
{
	filesSignal?: ISignal<Widget, { items: NestedTreeNode[]; }>;
	onFileSelect?: (file: NestedTreeNode) => void;
	title?: string;
	categories?: string[];
}

const widgetSelf: {
	parseAndBuildCategoryMap(folders: { id: string; text: string; }[], isHttpSource: boolean): void;
} = self as unknown as any;


export class PillSelectorWidget extends Widget
{
	/**
	 * Signal emitted when a pill category is selected
	 */
	public readonly categorySelected = new Signal<PillSelectorWidget, IPillSelectedArgs>(this);
	private categoryMap: { [category: string]: { [style: string]: PillFolderMeta; }; } = {};

	private _categories: string[] = [];
	private _activeCategory: string = '';
	private _title: string = 'Categories';

	private _pillsContainer: HTMLDivElement | null = null;
	private _leftScrollBtn: HTMLButtonElement | null = null;
	private _rightScrollBtn: HTMLButtonElement | null = null;

	private _filesSignal = new Signal<Widget, { items: NestedTreeNode[]; }>(this);

	constructor(categories: string[] | IPillViewOptions = [], activeCategory?: string)
	{
		super();
		this.addClass('pill-selector-widget');

		if(categories instanceof Array)
		{
			this._categories = categories;
		} else if('categories' in categories && categories.categories instanceof Array)
		{
			this._categories = categories.categories;
		}
		this._title = 'title' in categories && categories.title
			? categories.title : 'Categories';
		this._activeCategory = activeCategory
			?? (categories instanceof Array && categories.length > 0
				? categories[0] : '');

		if('_filesSignal' in categories && categories._filesSignal instanceof Signal)
		{
			this._filesSignal = categories._filesSignal;
			this._filesSignal.connect(this.onFilesUpdated, this);
		}
		this.renderWidget();
	}


	onFilesUpdated(sender: Widget, files: { items: NestedTreeNode[]; })
	{
		this.categoryMap = PillSelectorWidget.parseAndBuildCategoryMap(files.items, false);
	}

	/**
	 * Get currently active category name
	 */
	public get activeCategory(): string
	{
		return this._activeCategory;
	}

	/**
	 * Programmatically update categories list
	 */
	public setCategories(categories: string[], activeCategory?: string): void
	{
		this._categories = categories;
		this._activeCategory = activeCategory || (categories.length > 0 ? categories[0] : '');
		this.renderWidget();
	}

	/**
	 * Programmatically select a category
	 */
	public selectCategory(category: string, emitSignal: boolean = true): void
	{
		if(!this._categories.includes(category)) return;

		this._activeCategory = category;
		this.updatePillStates();
		this.scrollToActivePill();

		if(emitSignal)
		{
			const index = this._categories.indexOf(category);
			this.categorySelected.emit({ category, index });
		}
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.updateScrollOverflowIndicators();
	}

	private renderWidget(): void
	{
		this.node.innerHTML = `
      <div class="pill-nav-header">
        <h2 class="pill-nav-title">${this._title}</h2>
      </div>
      <div class="pill-carousel-wrapper">
        <button class="pill-scroll-btn left" aria-label="Scroll left">❮</button>
        <div class="pill-scroll-container">
          <div class="pill-grid"></div>
        </div>
        <button class="pill-scroll-btn right" aria-label="Scroll right">❯</button>
      </div>
    `;

		this._pillsContainer = this.node.querySelector('.pill-scroll-container');
		this._leftScrollBtn = this.node.querySelector('.pill-scroll-btn.left');
		this._rightScrollBtn = this.node.querySelector('.pill-scroll-btn.right');

		const grid = this.node.querySelector('.pill-grid');
		if(!grid) return;

		// Render individual pill buttons
		grid.innerHTML = this._categories
			.map(
				cat => `
        <button class="art-pill ${cat === this._activeCategory ? 'active' : ''}" data-cat="${cat}">
          <span class="pill-label">${cat}</span>
        </button>
      `
			)
			.join('');

		// Attach click listeners to pills
		grid.querySelectorAll('.art-pill').forEach((btn, idx) =>
		{
			btn.addEventListener('click', e =>
			{
				const cat = (e.currentTarget as HTMLElement).dataset.cat || '';
				this._activeCategory = cat;
				this.updatePillStates();

				this.categorySelected.emit({
					category: cat,
					index: idx,
				});
			});
		});

		// Handle horizontal scrolling behavior
		this._leftScrollBtn?.addEventListener('click', () => this.scrollByAmount(-240));
		this._rightScrollBtn?.addEventListener('click', () => this.scrollByAmount(240));

		this._pillsContainer?.addEventListener('scroll', () =>
		{
			this.updateScrollOverflowIndicators();
		});
	}

	private updatePillStates(): void
	{
		const pills = this.node.querySelectorAll('.art-pill');
		pills.forEach(pill =>
		{
			const cat = (pill as HTMLElement).dataset.cat;
			if(cat === this._activeCategory)
			{
				pill.classList.add('active');
			} else
			{
				pill.classList.remove('active');
			}
		});
	}

	private scrollByAmount(amount: number): void
	{
		if(!this._pillsContainer) return;
		this._pillsContainer.scrollBy({
			left: amount,
			behavior: 'smooth',
		});
	}

	private scrollToActivePill(): void
	{
		if(!this._pillsContainer) return;
		const activeBtn = this.node.querySelector('.art-pill.active') as HTMLElement;
		if(activeBtn)
		{
			const containerRect = this._pillsContainer.getBoundingClientRect();
			const btnRect = activeBtn.getBoundingClientRect();

			if(btnRect.left < containerRect.left || btnRect.right > containerRect.right)
			{
				activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
			}
		}
	}

	private updateScrollOverflowIndicators(): void
	{
		if(!this._pillsContainer) return;

		const { scrollLeft, scrollWidth, clientWidth } = this._pillsContainer;
		const isAtStart = scrollLeft <= 5;
		const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 5;

		if(this._leftScrollBtn)
		{
			this._leftScrollBtn.style.opacity = isAtStart ? '0' : '1';
			this._leftScrollBtn.style.pointerEvents = isAtStart ? 'none' : 'auto';
		}

		if(this._rightScrollBtn)
		{
			this._rightScrollBtn.style.opacity = isAtEnd ? '0' : '1';
			this._rightScrollBtn.style.pointerEvents = isAtEnd ? 'none' : 'auto';
		}
	}


	/**
	 * Parses folder names dynamically based on prefix frequency analysis across all available folders.
	 */
	public static parseAndBuildCategoryMap(folders: { id: string; text: string; }[], isHttpSource: boolean): { [category: string]: { [style: string]: PillFolderMeta; }; }
	{
		const categoryMap: { [category: string]: { [style: string]: PillFolderMeta; }; } = {};

		// Tokenize clean words for frequency scoring
		const folderTokenList = folders.map(f =>
		{
			const clean = f.text.trim();
			const tokens = clean.split(/[\s_\-]+/).filter(t => t.length > 0);
			return { folder: f, tokens, rawName: clean };
		});

		// 1. Build prefix frequency map for word lengths 1 to 3
		const prefixCounts: { [prefix: string]: number; } = {};

		folderTokenList.forEach(item =>
		{
			const t = item.tokens;
			if(t.length === 0) return;

			// Normalize first word, first two words, first three words
			for(let len = 1; len <= Math.min(3, t.length); len++)
			{
				const prefixKey = t.slice(0, len).join(' ').toLowerCase();
				prefixCounts[prefixKey] = (prefixCounts[prefixKey] || 0) + 1;
			}
		});

		// 2. Classify each folder into optimal Category and Style
		folderTokenList.forEach(item =>
		{
			const t = item.tokens;
			if(t.length === 0)
			{
				this.addCategoryMeta({
					id: item.folder.id,
					rawName: item.rawName,
					category: 'Other',
					style: 'General',
					isHttpSource
				}, categoryMap);
				return;
			}

			let splitIndex = 1;

			// Determine if multi-word prefix (e.g., "5 Love Languages" or "7 Wonders") exists across folders
			if(t.length >= 3)
			{
				const threeWordPrefix = t.slice(0, 3).join(' ').toLowerCase();
				const twoWordPrefix = t.slice(0, 2).join(' ').toLowerCase();
				const oneWordPrefix = t[0].toLowerCase();

				// If 3-word prefix has higher/equal recurrence than downstream specific titles, use it
				if((prefixCounts[threeWordPrefix] || 0) > 1)
				{
					splitIndex = 3;
				}
				else if((prefixCounts[twoWordPrefix] || 0) > 1)
				{
					splitIndex = 2;
				}
				else if((prefixCounts[oneWordPrefix] || 0) > 1)
				{
					splitIndex = 1;
				}
				else if(/^\d+$/.test(t[0]))
				{
					// Number prefix fallback: include next 1-2 words if not recognized
					splitIndex = Math.min(t.length - 1 || 1, 3);
				}
			}
			else if(t.length === 2)
			{
				const twoWordPrefix = t.slice(0, 2).join(' ').toLowerCase();
				const oneWordPrefix = t[0].toLowerCase();

				if((prefixCounts[twoWordPrefix] || 0) > (prefixCounts[oneWordPrefix] || 0))
				{
					splitIndex = 2;
				}
				else if((prefixCounts[oneWordPrefix] || 0) > 1)
				{
					splitIndex = 1;
				}
				else
				{
					splitIndex = 1;
				}
			}

			const categoryTokens = t.slice(0, splitIndex);
			const styleTokens = t.slice(splitIndex);

			const rawCat = categoryTokens.join(' ');
			const category = rawCat.replace(/\b\w/g, c => c.toUpperCase());

			const rawStyle = styleTokens.join(' ');
			const style = rawStyle ? rawStyle.replace(/\b\w/g, c => c.toUpperCase()) : 'General';

			this.addCategoryMeta({
				id: item.folder.id,
				rawName: item.rawName,
				category,
				style,
				isHttpSource
			}, categoryMap);
		});

		return categoryMap;
	}

	private static addCategoryMeta(meta: PillFolderMeta, categoryMap: { [category: string]: { [style: string]: PillFolderMeta; }; }): void
	{
		if(!categoryMap[meta.category])
		{
			categoryMap[meta.category] = {};
		}
		categoryMap[meta.category][meta.style] = meta;
	}
}

widgetSelf.parseAndBuildCategoryMap = PillSelectorWidget.parseAndBuildCategoryMap;
