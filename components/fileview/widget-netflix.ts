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

const netflixSelf: LuminoLayoutWindow & KnownFileViews = self as unknown as any;


export interface INetflixViewOptions extends IFileViewOptions
{
	categoryName?: string;
}

export class NetflixViewWidget extends Widget
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

	constructor(title?: string, options: INetflixViewOptions = {})
	{
		super();
		this.addClass('netflix-hero-widget');

		this._files = options.files || [];
		this._filesSignal = options.filesSignal;
		this._onFileSelect = options.onFileSelect;

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

		// Fullscreen Ambient Dynamic Backdrop
		this._backdropNode = document.createElement('div');
		this._backdropNode.className = 'netflix-backdrop';

		const overlay = document.createElement('div');
		overlay.className = 'animated-bg-layer';

		// Hero Section
		const heroContainer = document.createElement('div');
		heroContainer.className = 'netflix-hero-container';

		const brandBadge = document.createElement('div');
		brandBadge.className = 'netflix-brand-badge';
		brandBadge.textContent = 'NETFLIX ORIGINAL';

		this._heroTitleNode = document.createElement('h1');
		this._heroTitleNode.className = 'netflix-hero-title';
		this._heroTitleNode.textContent = title;

		this._heroMetaNode = document.createElement('div');
		this._heroMetaNode.className = 'netflix-hero-meta';

		this._heroDescNode = document.createElement('p');
		this._heroDescNode.className = 'netflix-hero-description';
		this._heroDescNode.textContent = 'Select a file to preview its media properties, metadata details, and streaming options.';

		const heroActions = document.createElement('div');
		heroActions.className = 'netflix-hero-actions';

		const playBtn = document.createElement('button');
		playBtn.className = 'netflix-btn netflix-btn-primary';
		playBtn.innerHTML = `<span class="icon">▶</span> Play`;
		playBtn.addEventListener('click', () =>
		{
			if(this._activeFile && this._onFileSelect)
			{
				this._onFileSelect(this._activeFile);
			}
		});

		const infoBtn = document.createElement('button');
		infoBtn.className = 'netflix-btn netflix-btn-secondary';
		infoBtn.innerHTML = `<span class="icon">ⓘ</span> More Info`;

		heroActions.append(playBtn, infoBtn);
		heroContainer.append(brandBadge, this._heroTitleNode, this._heroMetaNode, this._heroDescNode, heroActions);

		// Carousel Row
		const rowSection = document.createElement('div');
		rowSection.className = 'netflix-row-section';

		const rowHeader = document.createElement('h2');
		rowHeader.className = 'netflix-row-header';
		rowHeader.textContent = category;

		const carouselWrapper = document.createElement('div');
		carouselWrapper.className = 'netflix-carousel-wrapper';

		this._btnLeft = document.createElement('button');
		this._btnLeft.className = 'netflix-nav-arrow netflix-nav-left';
		this._btnLeft.innerHTML = '❮';

		this._trackNode = document.createElement('div');
		this._trackNode.className = 'netflix-carousel-track';

		this._btnRight = document.createElement('button');
		this._btnRight.className = 'netflix-nav-arrow netflix-nav-right';
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
		this.pillsSection.className = 'netflix-pill-section';

		this.node.append(this._backdropNode, overlay, heroContainer, this.pillsSection, rowSection);

		this.renderCarousel();

	}

	private renderCarousel(): void
	{
		this._trackNode.replaceChildren();

		if(this._files.length === 0)
		{
			const emptyState = document.createElement('div');
			emptyState.className = 'netflix-empty-state';
			emptyState.textContent = 'No media titles available in workspace.';
			this._trackNode.appendChild(emptyState);
			return;
		}

		this._files.forEach((file, index) =>
		{
			const card = document.createElement('div');
			card.className = 'netflix-card';
			card.dataset.fileId = file.id;

			const mediaFrame = document.createElement('div');
			mediaFrame.className = 'netflix-card-media';

			// Fallback visual generator based on name hash
			const hue = Math.abs(this.hashCode(file.text)) % 360;
			mediaFrame.style.background = `linear-gradient(135deg, hsl(${hue}, 70%, 20%), hsl(${(hue + 40) % 360}, 80%, 10%))`;

			const cardBody = document.createElement('div');
			cardBody.className = 'netflix-card-body';

			const cardTitle = document.createElement('div');
			cardTitle.className = 'netflix-card-title';
			cardTitle.textContent = file.text;

			const cardBadge = document.createElement('span');
			cardBadge.className = 'netflix-card-badge';
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
      <span class="duration">${file.mimeType ?? (typeof this.dataProvider?.constructor === 'function' ? netflixSelf.ArtWidget?.resolveDefaultMediaTitle(this.dataProvider.constructor) : undefined) ?? 'Media Source'}</span>
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

netflixSelf.NetflixViewWidget = NetflixViewWidget;
