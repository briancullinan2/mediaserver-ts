import { Widget } from "@lumino/widgets";
import type { TransporterCallback } from "./widget";

export class TransportBarWidget extends Widget
{
	onCommand: TransporterCallback;
	constructor(onCommandCallback: TransporterCallback)
	{
		super();
		this.addClass('transport-bar-widget');
		this.onCommand = onCommandCallback;

		this.node.innerHTML = `
						<div class="scrub-container">
							<span class="time-stamp" id="curr-time">0:00</span>
							<input type="range" class="range-slider-custom" id="seek-bar" value="0" min="0" max="100">
							<span class="time-stamp" id="total-time">0:00</span>
						</div>
						<div class="controls-row">
							<div class="controls-group">
								<button class="btn-ctrl" id="btn-prev" title="Previous Track"><i class="fa-solid fa-backward-step"></i></button>
								<button class="btn-ctrl" id="btn-rw" title="-10s Rewind"><i class="fa-solid fa-rotate-left"></i></button>
								<button class="btn-ctrl btn-primary-play" id="btn-play" title="Play/Pause"><i class="fa-solid fa-play"></i></button>
								<button class="btn-ctrl" id="btn-ff" title="+10s Fast Forward"><i class="fa-solid fa-rotate-right"></i></button>
								<button class="btn-ctrl" id="btn-next" title="Next Track"><i class="fa-solid fa-forward-step"></i></button>
							</div>

							<div class="controls-group">
								<div class="fader-control-box">
									<i class="fa-solid fa-sliders"></i>
									<span>Crossfade: <strong id="fader-val">3s</strong></span>
									<input type="range" class="range-slider-custom fader-slider" id="fader-input" min="0" max="10" value="3">
								</div>
								<button class="btn-glass" id="btn-layout-toggle" title="Toggle Carousel / Sidebar View">
									<i class="fa-solid fa-table-columns"></i>
									<span>Layout</span>
								</button>
							</div>
						</div>
					`;

		this.attachEvents();
	}

	attachEvents()
	{
		const playBtn = this.node.querySelector('#btn-play');
		let isPlaying = false;

		playBtn?.addEventListener('click', () =>
		{
			isPlaying = !isPlaying;
			playBtn.innerHTML = isPlaying ? `<i class="fa-solid fa-pause"></i>` : `<i class="fa-solid fa-play"></i>`;
			this.onCommand('togglePlay', isPlaying);
		});

		this.node.querySelector('#btn-next')?.addEventListener('click', () => this.onCommand('next'));
		this.node.querySelector('#btn-prev')?.addEventListener('click', () => this.onCommand('prev'));
		this.node.querySelector('#btn-rw')?.addEventListener('click', () => this.onCommand('rw'));
		this.node.querySelector('#btn-ff')?.addEventListener('click', () => this.onCommand('ff'));

		const faderInput = this.node.querySelector('#fader-input');
		faderInput?.addEventListener('input', (e) =>
		{
			const fader = this.node.querySelector('#fader-val') as HTMLElement;
			if(fader && e.target && 'value' in e.target && (e.target as HTMLInputElement).value)
			{
				fader.innerText = `${e.target.value}s`;
				this.onCommand('setCrossfade', e.target.value);
			}
		});

		this.node.querySelector('#btn-layout-toggle')?.addEventListener('click', () =>
		{
			this.onCommand('toggleLayout');
		});
	}
}

