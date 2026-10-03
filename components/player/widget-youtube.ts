import { Widget } from "@lumino/widgets";
import type { PlaylistEntry } from "./widget";

// 1. YouTube Renderer Sub-Widget
export class YouTubeRendererWidget extends Widget
{
	iframe?: HTMLIFrameElement | null;
	constructor()
	{
		super();
		this.addClass('renderer-subwidget');
		this.node.innerHTML = `<iframe class="youtube-frame-wrapper" src="" allow="autoplay; encrypted-media"></iframe>`;
		this.iframe = this.node.querySelector('iframe');
	}

	loadTrack(track: PlaylistEntry)
	{
		if(this.iframe && track.src)
		{
			this.iframe.src = track.src;
		}
	}

	stop()
	{
		if(this.iframe)
		{
			this.iframe.src = '';
		}
	}
}
