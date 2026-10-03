import { Widget } from "@lumino/widgets";
import { YouTubeRendererWidget } from "./widget-youtube";
import { HTML5VideoRendererWidget } from "./widget-html5";
import { SilkDropVisualizerWidget } from "./widget-silkdrop";
import { SlideshowRendererWidget } from "./widget-slides";
import type { PlaylistEntry } from "./widget";
import { Message } from "@lumino/messaging";

export class MediaViewportWidget extends Widget
{
	ytRenderer: YouTubeRendererWidget;
	videoRenderer: HTML5VideoRendererWidget;
	silkDropRenderer: SilkDropVisualizerWidget;
	slideshowRenderer: SlideshowRendererWidget;
	activeRenderer?: Widget | null;
	constructor()
	{
		super();
		this.addClass('media-viewport-widget');

		// Register Sub-Renderers
		this.ytRenderer = new YouTubeRendererWidget();
		this.videoRenderer = new HTML5VideoRendererWidget();
		this.silkDropRenderer = new SilkDropVisualizerWidget();
		this.slideshowRenderer = new SlideshowRendererWidget();


		this.activeRenderer = null;
	}


	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		// this.node.appendChild(this.ytRenderer.node);
		// this.node.appendChild(this.videoRenderer.node);
		// this.node.appendChild(this.silkDropRenderer.node);
		// this.node.appendChild(this.slideshowRenderer.node);
		Widget.attach(this.ytRenderer, this.node);
		Widget.attach(this.videoRenderer, this.node);
		Widget.attach(this.silkDropRenderer, this.node);
		Widget.attach(this.slideshowRenderer, this.node);

	}


	switchTrack(track: PlaylistEntry)
	{
		// Hide all
		[this.ytRenderer, this.videoRenderer, this.silkDropRenderer, this.slideshowRenderer].forEach(r =>
		{
			r.node.classList.remove('active');
		});

		if(this.silkDropRenderer) this.silkDropRenderer.stopAnimation();
		if(this.slideshowRenderer) this.slideshowRenderer.stopAutoSlide();

		if(track.type === 'youtube')
		{
			this.activeRenderer = this.ytRenderer;
			this.ytRenderer.loadTrack(track);
		} else if(track.type === 'video')
		{
			this.activeRenderer = this.videoRenderer;
			this.videoRenderer.loadTrack(track);
			this.videoRenderer.videoElem.play();
		} else if(track.type === 'audio')
		{
			this.activeRenderer = this.silkDropRenderer;
			this.silkDropRenderer.loadTrack(track);
			//this.silkDropRenderer.startAnimation();
		} else if(track.type === 'photo')
		{
			this.activeRenderer = this.slideshowRenderer;
			this.slideshowRenderer.loadTrack(track);
		}

		if(this.activeRenderer)
		{
			this.activeRenderer.node.classList.add('active');
		}
	}
}



