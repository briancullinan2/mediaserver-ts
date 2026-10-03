import { Widget } from "@lumino/widgets";
import type { PlaylistEntry } from "./widget";


// 2. HTML5 Video Sub-Widget
export class HTML5VideoRendererWidget extends Widget
{
	videoElem: HTMLVideoElement;
	constructor()
	{
		super();
		this.addClass('renderer-subwidget');
		this.videoElem = document.createElement('video');
		this.videoElem.style.width = '100%';
		this.videoElem.style.height = '100%';
		this.videoElem.controls = false;
		this.node.appendChild(this.videoElem);
	}

	loadTrack(track: PlaylistEntry)
	{
		if(track.src)
		{
			this.videoElem.src = track.src;
		}
	}
}
