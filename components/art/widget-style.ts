import { Widget } from '@lumino/widgets';
import { ISignal, Signal } from '@lumino/signaling';
import { Message } from '@lumino/messaging';
import type { IPillSelectedArgs, PillFolderMeta, PillSelectorWidget } from './widget-pill';
import type { NestedTreeNode } from '../bundle/github-tools';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { KnownFileViews } from './widget';

const widgetSelf: LuminoLayoutWindow & KnownFileViews = self as unknown as any;

export interface IStyleViewOptions
{
	categorySelected?: ISignal<PillSelectorWidget, IPillSelectedArgs>;
	onStyleSelect?: (file: NestedTreeNode) => void;
	title?: string;
	styles?: PillFolderMeta[];
}

export class StyleSelectorWidget extends Widget
{
	/**
	 * Emitted when a user selects a style pill.
	 */
	readonly styleSelected = new Signal<StyleSelectorWidget, PillFolderMeta>(this);

	private _styles: PillFolderMeta[] = [];
	private _activeStyleId: string | null = null;
	private _focusedIndex: number = -1;

	private _categorySelected: Signal<PillSelectorWidget, IPillSelectedArgs> | undefined = undefined;

	constructor(styles: PillFolderMeta[] | IStyleViewOptions = [])
	{
		super();
		this.addClass('art-style-selector-widget');
		this.node.setAttribute('tabindex', '0'); // Enable focus for keyboard navigation

		if('files' in styles && styles.files instanceof Array && styles.files.length > 0)
		{
			this.setStyles(styles.files);
		}
		else if(styles instanceof Array && styles.length > 0)
		{
			this.setStyles(styles);
		}
		if('categorySelected' in styles && styles.categorySelected instanceof Signal)
		{
			this._categorySelected = styles.categorySelected;
			this._categorySelected.connect(this.selectCategory, this);
		}
	}

	private selectCategory(sender: PillSelectorWidget, args: IPillSelectedArgs)
	{
		this.setStyles(Object.values(args.styles));
	}

	/**
	 * Updates the available styles for the current category and selects a default style.
	 */
	public setStyles(styles: PillFolderMeta[], defaultStyleId?: string): void
	{
		this._styles = styles;

		// Hide widget if there are no distinct styles or only a single generic entry
		if(styles.length === 0 || (styles.length === 1 && styles[0].style.toLowerCase() === 'general'))
		{
			this.hide();
			this._activeStyleId = styles[0]?.id ?? null;
			return;
		}

		this.show();
		const initialId = defaultStyleId ?? styles[0]?.id ?? null;
		this._activeStyleId = initialId;
		this._focusedIndex = styles.findIndex(s => s.id === initialId);

		this.render();
	}

	/**
	 * Returns the currently active style option.
	 */
	public get activeStyle(): PillFolderMeta | null
	{
		return this._styles.find(s => s.id === this._activeStyleId) ?? null;
	}

	/**
	 * Programmatically selects a style by ID.
	 */
	public selectStyle(styleId: string): void
	{
		if(this._activeStyleId === styleId) return;

		const targetStyle = this._styles.find(s => s.id === styleId);
		if(!targetStyle) return;

		this._activeStyleId = styleId;
		this._focusedIndex = this._styles.indexOf(targetStyle);
		this.render();
		this.styleSelected.emit(targetStyle);
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.node.addEventListener('click', this._handleClick);
		this.node.addEventListener('keydown', this._handleKeyDown);
	}

	protected override onBeforeDetach(msg: Message): void
	{
		this.node.removeEventListener('click', this._handleClick);
		this.node.removeEventListener('keydown', this._handleKeyDown);
		super.onBeforeDetach(msg);
	}

	private render(): void
	{
		this.node.innerHTML = `
            <div class="style-selector-header">
                <h3 class="style-selector-title">Styles & Presets</h3>
                <span class="style-selector-count">${this._styles.length} available</span>
            </div>
            <div class="style-pill-grid" role="radiogroup" aria-label="Styles and Presets">
                ${this._styles
				.map((style, idx) =>
				{
					const isActive = style.id === this._activeStyleId;
					const isFocused = idx === this._focusedIndex;
					const icon = style.icon ?? '<i class="bx bx-folder"></i>';
					const countBadge = style.itemCount !== undefined
						? `<span class="style-badge">${style.itemCount}</span>`
						: '';

					return `
                            <button
                                type="button"
                                class="style-pill ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}"
                                data-style-id="${style.id}"
                                role="radio"
                                aria-checked="${isActive}"
                                tabindex="${isActive ? '0' : '-1'}"
                            >
                                <span class="style-icon">${icon}</span>
                                <span class="style-label">${style.style}</span>${countBadge}
                            </button>
                        `;
				})
				.join('')}
            </div>
        `;
	}

	private _handleClick = (e: MouseEvent): void =>
	{
		const target = e.target as HTMLElement;
		const button = target.closest<HTMLButtonElement>('.style-pill');
		if(!button) return;

		const styleId = button.dataset.styleId;
		if(styleId)
		{
			this.selectStyle(styleId);
		}
	};

	private _handleKeyDown = (e: KeyboardEvent): void =>
	{
		if(this._styles.length === 0) return;

		let handled = false;

		switch(e.key)
		{
			case 'ArrowRight':
			case 'ArrowDown':
				this._focusedIndex = (this._focusedIndex + 1) % this._styles.length;
				handled = true;
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
				this._focusedIndex = (this._focusedIndex - 1 + this._styles.length) % this._styles.length;
				handled = true;
				break;
			case 'Enter':
			case ' ':
				if(this._focusedIndex >= 0 && this._focusedIndex < this._styles.length)
				{
					this.selectStyle(this._styles[this._focusedIndex].id);
					handled = true;
				}
				break;
		}

		if(handled)
		{
			e.preventDefault();
			this.render();
			const focusedBtn = this.node.querySelector<HTMLButtonElement>('.style-pill.focused');
			focusedBtn?.focus();
		}
	};
}

widgetSelf.StyleSelectorWidget = StyleSelectorWidget;
