import { Widget } from '@lumino/widgets';
import { Signal } from '@lumino/signaling';
import { Message } from '@lumino/messaging';

export interface IPillSelectedArgs
{
	category: string;
	index: number;
}

export class PillSelectorWidget extends Widget
{
	/**
	 * Signal emitted when a pill category is selected
	 */
	public readonly categorySelected = new Signal<PillSelectorWidget, IPillSelectedArgs>(this);

	private _categories: string[] = [];
	private _activeCategory: string = '';
	private _title: string = 'Categories';

	private _pillsContainer: HTMLDivElement | null = null;
	private _leftScrollBtn: HTMLButtonElement | null = null;
	private _rightScrollBtn: HTMLButtonElement | null = null;

	constructor(categories: string[] = [], activeCategory?: string, title?: string)
	{
		super();
		this.addClass('pill-selector-widget');

		this._categories = categories;
		this._title = title ?? 'Categories';
		this._activeCategory = activeCategory || (categories.length > 0 ? categories[0] : '');

		this.renderWidget();
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
}
