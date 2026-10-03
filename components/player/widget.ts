import { BoxPanel, DockPanel, SplitPanel, Widget } from "@lumino/widgets";
import { MediaViewportWidget } from "./widget-viewport";
import { TransportBarWidget } from "./controls";
import { PLAYLIST_DATA, PlaylistPanelWidget } from "./playlist";
import { XRayPanelWidget } from "./xray";
import { Message } from "@lumino/messaging";

export type TransporterCommand = 'next' | 'ff' | 'rw' | 'prev' | 'setCrossfade' | 'toggleLayout' | 'togglePlay';
export type TransporterCallback = (cmd: TransporterCommand, state?: any) => void;
export type TrackCallback = (track: string | PlaylistEntry) => void;

export interface PlaylistEntry
{
	id: string;
	type: 'youtube' | 'audio' | 'video' | 'photo';
	title: string;
	artist?: string;
	src?: string;
	thumb?: string;
	duration?: number;
	xray?: {
		scene: string,
		cast: string[],
		trivia: string;
	};
	photos?: string[];
}

export class PlayerWidget extends Widget
{
	currentTrackIndex: number;
	crossfadeTime: number;
	isCarouselHorizontal: boolean;
	mainSplitPanel!: SplitPanel;
	mediaViewport?: MediaViewportWidget;
	transportBar?: TransportBarWidget;
	rightDockPanel!: DockPanel;
	playlistPanel?: PlaylistPanelWidget;
	xrayPanel?: XRayPanelWidget;

	constructor()
	{
		super();
		this.currentTrackIndex = 0;
		this.crossfadeTime = 3;
		this.isCarouselHorizontal = false;
		this.title.closable = true;

		// Ensure root widget container expands to fill viewport
		this.addClass('player-outer-container');
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.initUI();
		this.loadTrack(PLAYLIST_DATA[0]);
	}

	protected override onResize(msg: Widget.ResizeMessage): void
	{
		super.onResize(msg);
		// Force Lumino panels to recalculate dimensions on parent window resize
		if(this.mainSplitPanel)
		{
			this.mainSplitPanel.update();
		}
	}

	initUI()
	{
		// 1. App Header
		const header = document.createElement('header');
		this.title.label = 'Player';
		// header.className = 'app-header';
		// header.innerHTML = `
		//     <div class="app-title">
		//         <i class="fa-solid fa-compact-disc"></i> Lumino Media Suite
		//     </div>
		//     <div class="header-actions">
		//         <button class="btn-glass active"><i class="fa-solid fa-layer-group"></i> Dock Layout</button>
		//     </div>
		// `;
		// this.node.appendChild(header);

		// 2. Center Stack Construction
		this.mediaViewport = new MediaViewportWidget();
		this.transportBar = new TransportBarWidget((cmd, val) => this.handleTransportCommand(cmd, val));

		const centerBox = new BoxPanel({ direction: 'top-to-bottom' });
		BoxPanel.setStretch(this.mediaViewport, 1);
		BoxPanel.setStretch(this.transportBar, 0);
		BoxPanel.setSizeBasis(this.transportBar, 100); // Ensure non-zero explicit basis height for controls

		centerBox.addWidget(this.mediaViewport);
		//centerBox.addWidget(this.transportBar);
		// attach it unmanaged so it can collapse
		if(centerBox.node)
		{
			centerBox.node.appendChild(this.transportBar.node);
		}

		// 3. Sidebar DockPanel
		this.rightDockPanel = new DockPanel();
		this.playlistPanel = new PlaylistPanelWidget((track: PlaylistEntry | string) => this.loadTrack(track));
		this.xrayPanel = new XRayPanelWidget();

		this.rightDockPanel.addWidget(this.playlistPanel);
		this.rightDockPanel.addWidget(this.xrayPanel, { mode: 'tab-after', ref: this.playlistPanel });

		// 4. Main Split Panel Assembly
		this.mainSplitPanel = new SplitPanel({ orientation: 'horizontal' });
		this.mainSplitPanel.id = 'lumino-main-split';

		this.mainSplitPanel.addWidget(centerBox);
		this.mainSplitPanel.addWidget(this.rightDockPanel);
		this.mainSplitPanel.setRelativeSizes([0.72, 0.28]);

		// Attach layout directly as a child Lumino widget instead of raw Widget.attach call
		Widget.attach(this.mainSplitPanel, this.node);

		// Force layout pass
		this.mainSplitPanel.update();
	}

	loadTrack(track: PlaylistEntry | string)
	{
		if(typeof track === 'object')
		{
			this.currentTrackIndex = PLAYLIST_DATA.findIndex(t => t.id === track.id);
			this.mediaViewport?.switchTrack(track);
			this.playlistPanel?.renderTracks(track.id);
			this.xrayPanel?.updateMetadata(track);
		}
	}

	handleTransportCommand(command: TransporterCommand, value: any)
	{
		if(command === 'next')
		{
			const nextIdx = (this.currentTrackIndex + 1) % PLAYLIST_DATA.length;
			this.loadTrack(PLAYLIST_DATA[nextIdx]);
		} else if(command === 'prev')
		{
			const prevIdx = (this.currentTrackIndex - 1 + PLAYLIST_DATA.length) % PLAYLIST_DATA.length;
			this.loadTrack(PLAYLIST_DATA[prevIdx]);
		} else if(command === 'setCrossfade')
		{
			this.crossfadeTime = parseInt(value, 10);
		} else if(command === 'toggleLayout')
		{
			this.toggleCarouselLayout();
		}
	}

	toggleCarouselLayout()
	{
		this.isCarouselHorizontal = !this.isCarouselHorizontal;
		if(this.isCarouselHorizontal)
		{
			this.playlistPanel?.addClass('carousel-horizontal');
		} else
		{
			this.playlistPanel?.removeClass('carousel-horizontal');
		}
	}
}
