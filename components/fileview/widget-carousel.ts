import { Message, MessageLoop } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import type { ISignal, Signal } from '@lumino/signaling';
import type { NestedTreeNode } from '../bundle/github-tools';
import type { IFileDataProvider, WidgetFilesEventArgs } from '../filelist/widget.d';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { KnownFileViews } from '../art/widget';
import { IPillSelectedArgs, PillSelectorWidget } from '../art/widget-pill';
import { StyleSelectorWidget } from '../art/widget-style';
import type { IFileViewOptions } from './widget';
import { WidgetSearchBar } from '../art/widget-search';

const carouselSelf: LuminoLayoutWindow & KnownFileViews = self as unknown as any;

export type CarouselMode = 'episodes' | 'carousel';

export interface ICarouselViewOptions extends IFileViewOptions
{
	categoryName?: string;
}

export class CarouselViewWidget extends Widget
{
	private _files: NestedTreeNode[] = [];
	private _filesSignal?: ISignal<any, WidgetFilesEventArgs>;
	private _onFileSelect?: (file: NestedTreeNode) => void;
	private _activeFile: NestedTreeNode | null = null;
	protected selectedCategoryPill: string = 'all';
	public categorySelected?: Signal<PillSelectorWidget, IPillSelectedArgs>;

	// DOM Elements
	private _backdropNode!: HTMLElement;
	private _heroTitleNode!: HTMLElement;
	private _heroMetaNode!: HTMLElement;
	private _heroDescNode!: HTMLElement;
	private _trackNode!: HTMLElement;
	private _btnLeft!: HTMLButtonElement;
	private _btnRight!: HTMLButtonElement;
	private dataProvider?: Function | IFileDataProvider;
	private pillsWidget?: PillSelectorWidget;
	private styleWidget?: StyleSelectorWidget;
	private pillsSection!: HTMLDivElement;
	private _displayMode: CarouselMode = 'carousel';
	private _category: string | undefined;
	private _title: string | undefined;
	public _toggleBtn?: HTMLDivElement;

	constructor(title?: string, options: ICarouselViewOptions = {})
	{
		super();
		this.addClass('carousel-hero-widget');

		this._files = options.files || [];
		this._filesSignal = options.filesSignal;
		this._onFileSelect = options.onFileSelect;

		this._title = options.title;
		this._category = options.categoryName;
		this.renderShell(options.title || 'FEATURED COLLECTION', options.categoryName || 'TRENDING NOW');

		if(this._filesSignal)
		{
			this._filesSignal.connect(this.onFilesUpdated, this);
		}
	}

	protected override onResize(msg: Widget.ResizeMessage): void
	{
		super.onResize(msg);
		if(this.pillsWidget)
		{
			this.pillsWidget.fit();
			MessageLoop.sendMessage(this.pillsWidget, msg);
		}
		if(this.styleWidget)
		{
			this.styleWidget.fit();
			MessageLoop.sendMessage(this.styleWidget, msg);
		}
	}

	protected onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);

		this.pillsWidget = new PillSelectorWidget(null, {
			filesSignal: this._filesSignal,
			files: this._files,
			//categories: Array.from(this.availableCategories),
			activeCategory: this.selectedCategoryPill
		});
		this.categorySelected = this.pillsWidget.categorySelected;

		this.styleWidget = new StyleSelectorWidget({
			categorySelected: this.categorySelected
		});

		if(this.pillsWidget && !this.pillsWidget.isAttached)
		{
			Widget.attach(this.pillsWidget, this.pillsSection);
		}
		if(this.styleWidget && !this.styleWidget.isAttached)
		{
			Widget.attach(this.styleWidget, this.pillsSection);
		}
		WidgetSearchBar.attachToggleIcon(this, this.renderToggleBtn, this.clickToggleBtn);
	}

	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		WidgetSearchBar.attachToggleIcon(this, this.renderToggleBtn, this.clickToggleBtn);
	}

	private setContainClass()
	{
		if(this.parent)
		{
			this.parent.addClass('contain-height');
		}
		if(this.node.parentElement)
		{
			const parent = this.node.parentElement.closest('.lm-Widget');
			if(parent)
			{
				parent.classList.add('contain-height');
			}
		}
	}

	private removeContainClass()
	{
		if(this.parent)
		{
			this.parent.removeClass('contain-height');
		}
		if(this.node.parentElement)
		{
			const parent = this.node.parentElement.closest('.lm-Widget');
			if(parent)
			{
				parent.classList.remove('contain-height');
			}
		}
	}

	protected renderToggleBtn(toggle: HTMLElement)
	{
		toggle.innerHTML = `<i class="bx ${this._displayMode === 'episodes' ? 'bx-gallery-horizontal' : 'bx-list-play'}"></i>`;
		toggle.title = this._displayMode === 'episodes' ? 'Carousel View' : 'Episode View';
	}

	protected override onBeforeDetach(msg: Message): void
	{
		this.removeContainClass();
		if(this._toggleBtn)
		{
			this._toggleBtn?.remove();
			this._toggleBtn = undefined;
		}
		super.onBeforeDetach(msg);
	}

	protected clickToggleBtn()
	{
		this._displayMode = this._displayMode === 'episodes' ? 'carousel' : 'episodes';
		if(this._displayMode === 'episodes')
		{
			this.renderEpisodes(this._title || 'FEATURED COLLECTION', this._category || 'TRENDING NOW');
		} else
		{
			this.renderShell(this._title || 'FEATURED COLLECTION', this._category || 'TRENDING NOW');
		}
		this.fit();
		this.update();
	}

	public setFiles(files: NestedTreeNode[]): void
	{
		this._files = files;
		this.renderCarousel();
	}

	private onFilesUpdated(sender: any, files: WidgetFilesEventArgs): void
	{
		if(files.items)
		{
			this.setFiles(files.items);
		}
		if('fetchFiles' in sender && typeof sender.fetchFiles === 'function')
		{
			this.dataProvider = sender;
		}
		else if(files.source && 'fetchFiles' in files.source
			&& typeof files.source.fetchFiles === 'function'
		)
		{
			this.dataProvider = files.source as IFileDataProvider;
		}
	}

	private renderShell(title: string, category: string): void
	{
		this.node.replaceChildren();
		this.removeContainClass();

		// Fullscreen Ambient Dynamic Backdrop
		this._backdropNode = document.createElement('div');
		this._backdropNode.className = 'carousel-backdrop';

		// const overlay = document.createElement('div');
		// overlay.className = 'animated-bg-layer';

		// Hero Section
		const heroContainer = document.createElement('div');
		heroContainer.className = 'carousel-hero-container';

		const brandBadge = document.createElement('div');
		brandBadge.className = 'carousel-brand-badge';
		brandBadge.textContent = 'CAROUSEL ORIGINAL';

		this._heroTitleNode = document.createElement('h1');
		this._heroTitleNode.className = 'carousel-hero-title';
		this._heroTitleNode.textContent = title;

		this._heroMetaNode = document.createElement('div');
		this._heroMetaNode.className = 'carousel-hero-meta';

		this._heroDescNode = document.createElement('p');
		this._heroDescNode.className = 'carousel-hero-description';
		this._heroDescNode.textContent = 'Select a file to preview its media properties, metadata details, and streaming options.';

		const heroActions = document.createElement('div');
		heroActions.className = 'carousel-hero-actions';

		const playBtn = document.createElement('button');
		playBtn.className = 'carousel-btn carousel-btn-primary';
		playBtn.innerHTML = `<span class="icon">▶</span> Play`;
		playBtn.addEventListener('click', () =>
		{
			if(this._activeFile && this._onFileSelect)
			{
				this._onFileSelect(this._activeFile);
			}
		});

		const infoBtn = document.createElement('button');
		infoBtn.className = 'carousel-btn carousel-btn-secondary';
		infoBtn.innerHTML = `<span class="icon">ⓘ</span> More Info`;

		heroActions.append(playBtn, infoBtn);
		heroContainer.append(brandBadge, this._heroTitleNode, this._heroMetaNode, this._heroDescNode, heroActions);

		// Carousel Row
		const rowSection = document.createElement('div');
		rowSection.className = 'carousel-row-section';

		const rowHeader = document.createElement('h2');
		rowHeader.className = 'carousel-row-header';
		rowHeader.textContent = category;

		const carouselWrapper = document.createElement('div');
		carouselWrapper.className = 'carousel-carousel-wrapper';

		this._btnLeft = document.createElement('button');
		this._btnLeft.className = 'carousel-nav-arrow carousel-nav-left';
		this._btnLeft.innerHTML = '❮';

		this._trackNode = document.createElement('div');
		this._trackNode.className = 'carousel-carousel-track';

		this._btnRight = document.createElement('button');
		this._btnRight.className = 'carousel-nav-arrow carousel-nav-right';
		this._btnRight.innerHTML = '❯';

		this._btnLeft.addEventListener('click', () =>
		{
			this._trackNode.scrollBy({ left: -window.innerWidth * 0.6, behavior: 'smooth' });
		});

		this._btnRight.addEventListener('click', () =>
		{
			this._trackNode.scrollBy({ left: window.innerWidth * 0.6, behavior: 'smooth' });
		});

		carouselWrapper.append(this._btnLeft, this._trackNode, this._btnRight);
		rowSection.append(rowHeader, carouselWrapper);

		this.pillsSection = document.createElement('div');
		this.pillsSection.className = 'carousel-pill-section';

		this.node.append(this._backdropNode, heroContainer, this.pillsSection, rowSection);

		this.renderCarousel();
	}


	private renderEpisodes(title: string, category: string): void
	{
		this.node.replaceChildren();
		this.setContainClass();

		// Episode Page Container
		const epContainer = document.createElement('div');
		epContainer.className = 'carousel-episodes-container';

		// Background / Hero Poster Section
		this._backdropNode = document.createElement('div');
		this._backdropNode.className = 'carousel-episodes-backdrop';

		// const backdropOverlay = document.createElement('div');
		// backdropOverlay.className = 'animated-bg-layer';

		// Show Header / Details Section
		const showHeader = document.createElement('div');
		showHeader.className = 'carousel-episodes-header';

		const showBadge = document.createElement('div');
		showBadge.className = 'carousel-brand-badge';
		showBadge.textContent = 'CAROUSEL SERIES';

		this._heroTitleNode = document.createElement('h1');
		this._heroTitleNode.className = 'carousel-episodes-title';
		this._heroTitleNode.textContent = title;

		this._heroMetaNode = document.createElement('div');
		this._heroMetaNode.className = 'carousel-hero-meta';

		this._heroDescNode = document.createElement('p');
		this._heroDescNode.className = 'carousel-episodes-synopsis';
		this._heroDescNode.textContent = 'Select a file to preview its media properties, metadata details, and streaming options.';

		const heroSpacer = document.createElement('div');
		heroSpacer.className = 'carousel-spacer';

		const heroActions = document.createElement('div');
		heroActions.className = 'carousel-hero-actions';

		const playBtn = document.createElement('button');
		playBtn.className = 'carousel-btn carousel-btn-primary';
		playBtn.innerHTML = `<span class="icon">▶</span> Play Episode`;
		playBtn.addEventListener('click', () =>
		{
			if(this._activeFile && this._onFileSelect)
			{
				this._onFileSelect(this._activeFile);
			}
		});

		const infoBtn = document.createElement('button');
		infoBtn.className = 'carousel-btn carousel-btn-secondary';
		infoBtn.innerHTML = `<span class="icon">ⓘ</span> Details`;

		heroActions.append(playBtn, infoBtn);
		showHeader.append(showBadge, this._heroTitleNode, this._heroMetaNode, this._heroDescNode, heroSpacer, heroActions);

		// Control Toolbar Section (Season Selector & Search/Pills)
		const controlsBar = document.createElement('div');
		controlsBar.className = 'carousel-episodes-controls';

		const seasonHeader = document.createElement('h2');
		seasonHeader.className = 'carousel-season-title';
		seasonHeader.textContent = category;

		this.pillsSection = document.createElement('div');
		this.pillsSection.className = 'carousel-pill-section';

		controlsBar.append(seasonHeader, this.pillsSection);

		// Episodes Grid Section
		const episodesSection = document.createElement('div');
		episodesSection.className = 'carousel-episodes-list-section';

		const listWrapper = document.createElement('div');
		listWrapper.className = 'carousel-episodes-grid-wrapper';

		this._btnLeft = document.createElement('button');
		this._btnLeft.className = 'carousel-nav-arrow carousel-nav-left';
		this._btnLeft.innerHTML = '▲';

		this._trackNode = document.createElement('div');
		this._trackNode.className = 'carousel-episodes-grid';

		this._btnRight = document.createElement('button');
		this._btnRight.className = 'carousel-nav-arrow carousel-nav-right';
		this._btnRight.innerHTML = '▼';

		this._btnLeft.addEventListener('click', () =>
		{
			this._trackNode.scrollBy({ top: -400, behavior: 'smooth' });
		});

		this._btnRight.addEventListener('click', () =>
		{
			this._trackNode.scrollBy({ top: 400, behavior: 'smooth' });
		});

		listWrapper.append(this._btnLeft, this._trackNode, this._btnRight);
		episodesSection.append(listWrapper);

		// Assemble Episode Layout
		epContainer.append(this._backdropNode, showHeader, controlsBar, episodesSection);
		this.node.append(epContainer);

		this.renderCarousel();
	}


	private renderCarousel(): void
	{
		this._trackNode.replaceChildren();

		if(this._files.length === 0)
		{
			const emptyState = document.createElement('div');
			emptyState.className = 'carousel-empty-state';
			emptyState.textContent = 'No media titles available in workspace.';
			this._trackNode.appendChild(emptyState);
			return;
		}

		this._files.forEach((file, index) =>
		{
			const card = document.createElement('div');
			card.className = 'carousel-card';
			card.dataset.fileId = file.id;

			const mediaFrame = document.createElement('div');
			mediaFrame.className = 'carousel-card-media';

			// Fallback visual generator based on name hash
			const hue = Math.abs(this.hashCode(file.text)) % 360;
			mediaFrame.style.background = `linear-gradient(135deg, hsl(${hue}, 70%, 20%), hsl(${(hue + 40) % 360}, 80%, 10%))`;

			const cardBody = document.createElement('div');
			cardBody.className = 'carousel-card-body';

			const cardTitle = document.createElement('div');
			cardTitle.className = 'carousel-card-title';
			cardTitle.textContent = file.text;

			const cardBadge = document.createElement('span');
			cardBadge.className = 'carousel-card-badge';
			cardBadge.textContent = file.mimeType?.split('/')[1]?.toUpperCase() || 'FILE';

			cardBody.append(cardTitle, cardBadge);
			card.append(mediaFrame, cardBody);

			// Focus / Preview events
			card.addEventListener('mouseenter', () => this.setActiveFile(file, mediaFrame.style.background));
			card.addEventListener('click', () =>
			{
				if(this._onFileSelect) this._onFileSelect(file);
			});

			this._trackNode.appendChild(card);

			// Default focus first item
			if(index === 0)
			{
				this.setActiveFile(file, mediaFrame.style.background);
			}
		});
	}

	private setActiveFile(file: NestedTreeNode, backgroundStyle: string): void
	{
		this._activeFile = file;
		this._backdropNode.style.background = backgroundStyle;

		this._heroTitleNode.textContent = file.text;
		this._heroMetaNode.innerHTML = `
      <span class="match-score">98% Match</span>
      <span class="cert-rating">4K Ultra HD</span>
      <span class="duration">${file.mimeType ?? (typeof this.dataProvider?.constructor === 'function' ? carouselSelf.ArtWidget?.resolveDefaultMediaTitle(this.dataProvider.constructor) : undefined) ?? 'Media Source'}</span>
      <span class="hd-badge">HDR</span>
    `;
		this._heroDescNode.textContent = `File ID: ${file.id}. Streaming ready via active Cloud Data Provider.`;
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

	public processMessage(msg: Message): void
	{
		if(msg.type === 'close-request')
		{
			if(this._filesSignal)
			{
				this._filesSignal.disconnect(this.onFilesUpdated, this);
			}
		}

		super.processMessage(msg);
	}
}

carouselSelf.CarouselViewWidget = CarouselViewWidget;
