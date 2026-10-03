import { Widget } from "@lumino/widgets";
import type { PlaylistEntry } from "./widget";

// 4. Photo Slideshow Sub-Widget with Indicator Dots
export class SlideshowRendererWidget extends Widget
{
	imgElem: any;
	dotsContainer: any;
	photos: string[];
	currentIndex: number;
	timer: ReturnType<typeof setInterval> | null;
	constructor()
	{
		super();
		this.addClass('renderer-subwidget');
		this.node.innerHTML = `
						<div class="slideshow-container">
							<img class="slideshow-image" src="" alt="Slideshow Item">
							<div class="slideshow-dots-bar"></div>
						</div>
					`;
		this.imgElem = this.node.querySelector('.slideshow-image');
		this.dotsContainer = this.node.querySelector('.slideshow-dots-bar');
		this.photos = [];
		this.currentIndex = 0;
		this.timer = null;
	}

	loadTrack(track: PlaylistEntry)
	{
		if(track.photos)
		{
			this.photos = track.photos;
		}
		if(!this.photos && track.thumb)
		{
			this.photos = [track.thumb];
		}
		this.currentIndex = 0;
		this.renderDots();
		this.showPhoto(0);
		this.startAutoSlide();
	}

	showPhoto(index: number)
	{
		this.currentIndex = index;
		this.imgElem.style.opacity = '0';
		setTimeout(() =>
		{
			this.imgElem.src = this.photos[this.currentIndex];
			this.imgElem.style.opacity = '1';
		}, 200);

		const dots = Array.from(this.dotsContainer.querySelectorAll('.dot-indicator')) as HTMLElement[];
		dots.forEach((dot: HTMLElement, idx: number) =>
		{
			dot.classList.toggle('active', idx === this.currentIndex);
		});
	}

	renderDots()
	{
		this.dotsContainer.innerHTML = '';
		this.photos.forEach((_, idx) =>
		{
			const dot = document.createElement('div');
			dot.className = `dot-indicator ${idx === 0 ? 'active' : ''}`;
			dot.addEventListener('click', () => this.showPhoto(idx));
			this.dotsContainer.appendChild(dot);
		});
	}

	startAutoSlide()
	{
		this.stopAutoSlide();
		this.timer = setInterval(() =>
		{
			const nextIndex = (this.currentIndex + 1) % this.photos.length;
			this.showPhoto(nextIndex);
		}, 4000);
	}

	stopAutoSlide()
	{
		if(this.timer) clearInterval(this.timer);
	}
}
