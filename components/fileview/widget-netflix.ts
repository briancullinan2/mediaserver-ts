import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import type { ISignal } from '@lumino/signaling';
import { NestedTreeNode } from '../bundle/github-tools';

export interface INetflixViewOptions
{
	filesSignal?: ISignal<any, NestedTreeNode[]>;
	onFileSelect?: (file: NestedTreeNode) => void;
	title?: string;
	categoryName?: string;
}

export class NetflixViewWidget extends Widget
{
	private _files: NestedTreeNode[] = [];
	private _filesSignal?: ISignal<any, NestedTreeNode[]>;
	private _onFileSelect?: (file: NestedTreeNode) => void;
	private _activeFile: NestedTreeNode | null = null;

	// DOM Elements
	private _backdropNode!: HTMLElement;
	private _heroTitleNode!: HTMLElement;
	private _heroMetaNode!: HTMLElement;
	private _heroDescNode!: HTMLElement;
	private _trackNode!: HTMLElement;
	private _btnLeft!: HTMLButtonElement;
	private _btnRight!: HTMLButtonElement;

	constructor(options: INetflixViewOptions = {}, files?: NestedTreeNode[])
	{
		super();
		this.addClass('netflix-hero-widget');

		this._files = files || [];
		this._filesSignal = options.filesSignal;
		this._onFileSelect = options.onFileSelect;

		this.renderShell(options.title || 'FEATURED COLLECTION', options.categoryName || 'TRENDING NOW');

		if(this._filesSignal)
		{
			this._filesSignal.connect(this.onFilesUpdated, this);
		}
	}

	public setFiles(files: NestedTreeNode[]): void
	{
		this._files = files;
		this.renderCarousel();
	}

	private onFilesUpdated(sender: any, files: NestedTreeNode[]): void
	{
		this.setFiles(files);
	}

	private renderShell(title: string, category: string): void
	{
		this.node.replaceChildren();

		// Fullscreen Ambient Dynamic Backdrop
		this._backdropNode = document.createElement('div');
		this._backdropNode.className = 'netflix-backdrop';

		const overlay = document.createElement('div');
		overlay.className = 'netflix-backdrop-overlay';

		// Hero Section
		const heroContainer = document.createElement('div');
		heroContainer.className = 'netflix-hero-container';

		const brandBadge = document.createElement('div');
		brandBadge.className = 'netflix-brand-badge';
		brandBadge.textContent = 'N E T F L I X   O R I G I N A L';

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
		infoBtn.innerHTML = `<span class="icon">ℹ</span> More Info`;

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

		this.node.append(this._backdropNode, overlay, heroContainer, rowSection);

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
      <span class="duration">${file.mimeType || 'Media Source'}</span>
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

	protected override onBeforeDetach(msg: Message): void
	{
		if(this._filesSignal)
		{
			this._filesSignal.disconnect(this.onFilesUpdated, this);
		}
		super.onBeforeDetach(msg);
	}
}
