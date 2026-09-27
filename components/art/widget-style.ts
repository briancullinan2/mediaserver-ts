import { Widget } from '@lumino/widgets';
import { Signal } from '@lumino/signaling';
import { Message } from '@lumino/messaging';

export interface StyleOption
{
	id: string;
	label: string;
	itemCount?: number;
	icon?: string;
}

export class StyleSelectorWidget extends Widget
{
	/**
	 * Emitted when a user selects a style pill.
	 */
	readonly styleSelected = new Signal<this, StyleOption>(this);

	private _styles: StyleOption[] = [];
	private _activeStyleId: string | null = null;
	private _focusedIndex: number = -1;

	constructor(styles: StyleOption[] = [])
	{
		super();
		this.addClass('art-style-selector-widget');
		this.node.setAttribute('tabindex', '0'); // Enable focus for keyboard navigation

		if(styles.length > 0)
		{
			this.setStyles(styles);
		}
	}

	/**
	 * Updates the available styles for the current category and selects a default style.
	 */
	public setStyles(styles: StyleOption[], defaultStyleId?: string): void
	{
		this._styles = styles;

		// Hide widget if there are no distinct styles or only a single generic entry
		if(styles.length === 0 || (styles.length === 1 && styles[0].label.toLowerCase() === 'general'))
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
	public get activeStyle(): StyleOption | null
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
                <span class="style-selector-title">
                    <span class="folder-icon">📂</span> Styles & Presets
                </span>
                <span class="style-selector-count">${this._styles.length} available</span>
            </div>
            <div class="style-pill-grid" role="radiogroup" aria-label="Styles and Presets">
                ${this._styles
				.map((style, idx) =>
				{
					const isActive = style.id === this._activeStyleId;
					const isFocused = idx === this._focusedIndex;
					const icon = style.icon ?? '📁';
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
                                <span class="style-label">${style.label}</span>${countBadge}
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
