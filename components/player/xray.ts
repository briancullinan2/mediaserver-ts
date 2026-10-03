import { Widget } from "@lumino/widgets";
import type { PlaylistEntry } from "./widget";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";
import { Message } from "@lumino/messaging";

const playlistSelf: LuminoLayoutWindow = self as unknown as any;

export class XRayPanelWidget extends Widget
{
	constructor()
	{
		super();
		this.addClass('xray-panel-widget');
		this.title.label = 'Scene Info';
		this.title.closable = false;
		this.title.closable = true;

		this.node.innerHTML = `
						<div class="xray-card">
							<div class="xray-card-title"><i class="fa-solid fa-film"></i> Current Scene</div>
							<p id="xray-scene-text" style="font-size: 13px; color: var(--text-main);">Loading scene information...</p>
						</div>

						<div class="xray-card">
							<div class="xray-card-title"><i class="fa-solid fa-users"></i> Cast / Creators</div>
							<div class="cast-chip-group" id="xray-cast-chips"></div>
						</div>

						<div class="xray-card">
							<div class="xray-card-title"><i class="fa-solid fa-lightbulb"></i> Scene Trivia</div>
							<p id="xray-trivia-text" style="font-size: 12px; color: var(--text-muted); line-height: 1.5;"></p>
						</div>
					`;
	}

	public processMessage(msg: Message): void
	{
		if(msg.type === 'close-request')
		{
			console.log('Intercepted close request, hiding instead: ' + this.title.label);

			this.hide();
			playlistSelf.mainDock?.layout?.removeWidget(this);
			return; // BAIL OUT: Avoid calling super.processMessage() to prevent disposal
		}

		super.processMessage(msg);
	}

	updateMetadata(track: PlaylistEntry)
	{
		if(!track.xray) return;
		const scene = this.node.querySelector('#xray-scene-text') as HTMLElement;
		if(scene)
		{
			scene.innerText = track.xray.scene || 'General Playback';
		}
		const trivia = this.node.querySelector('#xray-trivia-text') as HTMLElement;
		if(trivia)
		{
			trivia.innerText = track.xray.trivia || 'No additional trivia for this item.';
		}

		const castWrapper = this.node.querySelector('#xray-cast-chips');
		if(castWrapper)
		{
			castWrapper.innerHTML = '';
			(track.xray.cast || []).forEach((member: string) =>
			{
				const chip = document.createElement('div');
				chip.className = 'cast-chip';
				chip.innerHTML = `<i class="fa-solid fa-user"></i> ${member}`;
				castWrapper.appendChild(chip);
			});
		}
	}
}
